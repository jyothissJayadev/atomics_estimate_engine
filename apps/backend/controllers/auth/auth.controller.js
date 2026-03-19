const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const { googleClient } = require("../../config/googleClient");
const { createAccessToken, createRefreshToken } = require("../../utils/token");

// In-memory OTP store — replace with Redis in production
const otpStore = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────

async function getMe(req, res, next) {
  try {
    // req.user is set by protect middleware
    const user = await User.findById(req.user.id)
      .select("-refreshToken")
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ─── GOOGLE LOGIN ─────────────────────────────────────────────────────────────
// Flow:
//   New user  → returns NEW_USER + tempUser payload → frontend calls /send-otp
//   Returning → returns LOGIN_SUCCESS + tokens

async function googleLogin(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Google token required" });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub, email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (user) {
      // Returning user — issue tokens immediately
      const accessToken = createAccessToken({ id: user._id });
      const refreshToken = createRefreshToken({ id: user._id });

      user.refreshToken = refreshToken;
      await user.save();

      return res.json({
        status: "LOGIN_SUCCESS",
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      });
    }

    // New user — frontend needs to collect phone + verify OTP before creating account
    return res.json({
      status: "NEW_USER",
      tempUser: { sub, email, name, picture },
    });
  } catch (err) {
    next(err);
  }
}

// ─── SEND OTP ─────────────────────────────────────────────────────────────────

async function sendOtp(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const otp = generateOtp();
    // Store OTP with 10-minute expiry
    otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    // TODO: integrate SMS provider (Twilio / MSG91) here
    // For now, log to console in dev
    if (process.env.NODE_ENV === "development") {
      console.log(`OTP for ${phone}: ${otp}`);
    }

    res.json({ status: "OTP_SENT" });
  } catch (err) {
    next(err);
  }
}

// ─── VERIFY OTP + REGISTER ────────────────────────────────────────────────────

async function verifyOtpAndRegister(req, res, next) {
  try {
    const { phone, otp, tempUser } = req.body;

    if (!phone || !otp || !tempUser) {
      return res
        .status(400)
        .json({ error: "phone, otp, and tempUser are required" });
    }

    const stored = otpStore.get(phone);

    if (!stored) {
      return res
        .status(400)
        .json({ error: "OTP not found — request a new one" });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: "OTP expired — request a new one" });
    }
    if (stored.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if user already exists (race condition guard)
    let user = await User.findOne({ email: tempUser.email });
    if (user) {
      // Already registered — just log them in
      const accessToken = createAccessToken({ id: user._id });
      const refreshToken = createRefreshToken({ id: user._id });
      user.refreshToken = refreshToken;
      await user.save();
      otpStore.delete(phone);
      return res.json({
        status: "LOGIN_SUCCESS",
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      });
    }

    user = await User.create({
      googleId: tempUser.sub,
      email: tempUser.email,
      name: tempUser.name,
      avatar: tempUser.picture,
      phone,
      phoneVerified: true,
    });

    const accessToken = createAccessToken({ id: user._id });
    const refreshToken = createRefreshToken({ id: user._id });
    user.refreshToken = refreshToken;
    await user.save();

    otpStore.delete(phone);

    res.status(201).json({
      status: "REGISTER_SUCCESS",
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

async function refreshAccessToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ error: "Refresh token required" });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res
        .status(403)
        .json({ error: "Refresh token expired or invalid" });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ error: "Refresh token revoked" });
    }

    const newAccessToken = createAccessToken({ id: user._id });
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  googleLogin,
  sendOtp,
  verifyOtpAndRegister,
  refreshAccessToken,
};
