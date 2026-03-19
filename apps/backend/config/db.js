const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI;
  console.log("Connecting to MongoDB with URI:", uri);

  if (!uri) throw new Error("MONGO_URI not set in environment");

  try {
    await mongoose.connect(uri);

    isConnected = true;

    console.log(`MongoDB connected: ${mongoose.connection.host}`);
    console.log(`Database: ${mongoose.connection.name}`);

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.warn("MongoDB disconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err);
      isConnected = false;
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
