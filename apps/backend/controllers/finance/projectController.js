const crypto = require("crypto");
const Project = require("../../models/Project");
const ProjectMember = require("../../models/ProjectMember");
const ProjectSetup = require("../../models/ProjectSetup");
const ProjectClient = require("../../models/ProjectClient");
const EstimateVersion = require("../../models/finance/EstimateVersion");
const CanonicalNode = require("../../models/CanonicalNode");
const GlobalSectionStats = require("../../models/GlobalSectionStats");
const UserRateProfile = require("../../models/UserRateProfile");
const UserSectionProfile = require("../../models/UserSectionProfile");
const StructureEvent = require("../../models/StructureEvent");
const { buildEngine } = require("@atomics/estimate-engine");
const CanonicalItem   = require("../../models/CanonicalItem");
const { generateId, generateDocId } = require("../../utils/idGenerator");
const { uploadToR2 } = require("../../utils/uploadToR2");
const { deleteFromR2 } = require("../../utils/deleteFromR2");
const { inferTier, CONFIDENCE } = require("../../config/constants");
const Estimate = require("../../models/finance/Estimate");
const ProjectFinance = require("../../models/finance/ProjectFinance");

// ─── CREATE PROJECT ───────────────────────────────────────────────────────────
// Creates a draft project + blank setup doc + owner membership

async function createProject(req, res, next) {
  try {
    const { name, clientName, startDate, endDate } = req.body;
    const userId = req.user.id;

    let coverImage = null;
    if (req.file) {
      coverImage = await uploadToR2({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
        folder: "projectcoverimage",
      });
    }

    const project = await Project.create({
      createdBy: userId,
      name: name || "Untitled Project",
      clientName: clientName || null,
      coverImage,
      startDate: startDate || null,
      endDate: endDate || null,
      setupStatus: "draft",
      currentSetupStep: 0,
    });

    // Blank setup document
    await ProjectSetup.create({
      projectId: project._id,
      currentStep: 0,
      answers: {},
      isCompleted: false,
    });

    // Creator is owner
    await ProjectMember.create({
      projectId: project._id,
      userId,
      role: "owner",
    });

    res.status(201).json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

// ─── GET SETUP ────────────────────────────────────────────────────────────────

async function getProjectSetup(req, res, next) {
  try {
    const setup = await ProjectSetup.findOne({
      projectId: req.params.projectId,
    }).lean();
    if (!setup) return res.status(404).json({ error: "Setup not found" });

    // Convert Map to plain object for JSON response
    const answers =
      setup.answers instanceof Map
        ? Object.fromEntries(setup.answers)
        : setup.answers || {};
    console.log(answers);
    res.json({ success: true, setup: { ...setup, answers } });
  } catch (err) {
    next(err);
  }
}

// ─── UPDATE SETUP (auto-save wizard steps 1–N) ────────────────────────────────
// Called on every wizard step — just saves answers, no engine call yet

async function updateProjectSetup(req, res, next) {
  try {
    const { currentStep, answers } = req.body;

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const setup = await ProjectSetup.findOne({
      projectId: req.params.projectId,
    });
    if (!setup) return res.status(404).json({ error: "Setup not found" });

    // Merge incoming answers into existing Map
    if (answers && typeof answers === "object") {
      Object.entries(answers).forEach(([key, value]) => {
        setup.answers.set(key, value);
      });
      setup.markModified("answers");
    }

    if (typeof currentStep === "number") {
      setup.currentStep = currentStep;
      project.currentSetupStep = currentStep;
    }

    // Live-sync name + clientName so lists/tabs stay current
    const ans = setup.answers;
    const get = (k) => (ans instanceof Map ? ans.get(k) : ans[k]);

    if (get("projectName")) project.name = get("projectName");
    if (get("clientName")) project.clientName = get("clientName");

    if (project.setupStatus === "draft") project.setupStatus = "in_progress";

    await setup.save();
    await project.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── COMPLETE SETUP + RUN ESTIMATE ENGINE ────────────────────────────────────
// Called when the user finishes the wizard.
// Validates required fields, runs the estimate engine, returns the full estimate.

async function completeProjectSetup(req, res, next) {
  try {
    const project = await Project.findById(req.params.projectId);
    const setup = await ProjectSetup.findOne({
      projectId: req.params.projectId,
    });

    if (!project || !setup) {
      return res.status(404).json({ error: "Project or setup not found" });
    }

    const get = (k) => {
      if (setup.answers instanceof Map) return setup.answers.get(k);
      return (setup.answers || {})[k];
    };

    // ── Validate required fields ─────────────────────────────────────
    // ── Normalize wizard answers → engine input ───────────────────────

    // ── Normalize wizard answers → canonical engine format ─────────────

    const totalArea = Number(get("totalArea"));
    const totalBudget = Number(get("totalBudget"));

    // Wizard uses UI labels like "Apartment"
    const PROJECT_TYPE_MAP = {
      Apartment: "residential_apartment",
      Villa: "villa",
      Office: "commercial_office",
      Retail: "retail_shop",
    };

    const rawProjectType = get("projectType");
    const projectType = PROJECT_TYPE_MAP[rawProjectType] || rawProjectType;

    // Frontend wizard saves "subType" and "roomConfig" as aliases for the BHK / config value.
    // Accept both to be resilient against field name changes.
    const rooms =
      get("subType") ||      // "3BHK", "2BHK", etc. from wizard step 1/4
      get("roomConfig") ||   // alternate key from useWizardState
      get("roomSubtype") ||
      "3BHK";

    // roomSubtype is the commercial/retail sub-type (e.g. "startup_office", "cafe")
    const roomSubtype = get("roomSubtype") || null;

    const city = get("city") || null;

    if (!totalArea || !totalBudget || !projectType) {
      return res.status(400).json({
        error:
          "totalArea, totalBudget, and projectType are required to complete setup",
      });
    }

    // ── Derive tier and intelligence context ─────────────────────────
    const tier = inferTier(totalBudget, totalArea);
    const budgetPerSqft = totalBudget / totalArea;

    let bandMin = 800,
      bandMax = 1400;
    if (budgetPerSqft < 800) {
      bandMin = 0;
      bandMax = 800;
    } else if (budgetPerSqft > 1400) {
      bandMin = 1400;
      bandMax = 9999;
    }

    // ── Persist project fields ────────────────────────────────────────
    project.projectType = projectType;
    project.city = city;
    project.sqft = totalArea;
    project.budget = totalBudget;
    project.tier = tier;
    project.rooms = rooms;
    project.roomSubtype = roomSubtype;
    project.intelligenceContext = {
      clusterKey: `${projectType}_${city || "unknown"}`,
      budgetPerSqft,
      budgetBand: { min: bandMin, max: bandMax },
      cityCluster: city || null,
    };
    project.setupStatus = "completed";
    setup.isCompleted = true;

    await setup.save();
    await project.save();

    // ── Run the estimate engine ───────────────────────────────────────
    const userId = req.user.id;

    const input = {
      projectType,
      budget: totalBudget,
      sqft: totalArea,
      rooms,
      roomSubtype,
      tier,
      city,
      userId: userId.toString(),
      financialDefaults: {},
    };

    const UserQuantityProfile = require("../../models/UserQuantityProfile");

    const [sectionStats, rawUserRates, canonicalNodes, rawUserSectionProfiles, rawUserQuantityProfiles] = await Promise.all([
      GlobalSectionStats.findOne({ projectType }).lean(),
      UserRateProfile.find({ userId: userId.toString() }).lean(),
      CanonicalNode.find({
        projectTypes: projectType,
        status: "active",
        level: { $in: [2, 3] },
      }).lean(),
      UserSectionProfile.find({ userId: userId.toString(), projectType }).lean(),
      UserQuantityProfile.find({ userId: userId.toString() }).lean()
    ]);

    // City-keyed rate map (Gap 7: UserHistoryStrategy city-specific lookup)
    const userRates = new Map();
    for (const p of rawUserRates) {
      userRates.set(`${p.canonicalRef}::${p.tier}`, p);
      if (!userRates.has(p.canonicalRef)) userRates.set(p.canonicalRef, p);
      if (p.city) userRates.set(`${p.canonicalRef}::${p.tier}::${p.city}`, p);
    }

    const userSectionProfile = {};
    for (const p of rawUserSectionProfiles) {
      userSectionProfile[p.canonicalRef] = p;
    }

    const userQuantityProfile = {};
    for (const p of rawUserQuantityProfiles) {
      userQuantityProfile[p.canonicalRef] = p;
    }

    const parentMap = new Map();
    for (const node of canonicalNodes) {
      if (node.level === 3 && node.parentId)
        parentMap.set(node.canonicalId, node.parentId);
    }

    // Fetch CanonicalItem catalogue for DemoRateStrategy + quantityEstimator
    const rawCanonicalItems = await CanonicalItem.find({ status: 'active' }).lean();
    const canonicalItemMap  = new Map();
    for (const item of rawCanonicalItems) canonicalItemMap.set(item.canonicalId, item);

    const dbData = { sectionStats, userRates, canonicalNodes, parentMap, userSectionProfile, userQuantityProfile, city, canonicalItemMap };

    const engine = buildEngine(dbData);
    const result = engine.predict(input, dbData, generateId);

    // ── Filter to user-confirmed sections + items (Level 3) ───────────────
    // The wizard saves confirmedSections and confirmedItems after steps 4+5.
    // If the user completed those steps, we use their selections.
    // Otherwise we use the full engine output (backward compat).
    const confirmedSectionRefs = get("confirmedSections") || [];
    const confirmedItemsMap    = get("confirmedItems")    || {};

    let finalCategories = result.categories || [];

    if (confirmedSectionRefs.length > 0) {
      const confirmedSet = new Set(confirmedSectionRefs);
      finalCategories = finalCategories.filter(cat => confirmedSet.has(cat.canonicalRef));
    }

    if (Object.keys(confirmedItemsMap).length > 0) {
      finalCategories = finalCategories.map(cat => {
        const allowedItems = confirmedItemsMap[cat.canonicalRef];
        if (!Array.isArray(allowedItems)) return cat;
        const allowedSet = new Set(allowedItems);
        return { ...cat, items: (cat.items || []).filter(item => allowedSet.has(item.canonicalRef)) };
      });
    }

    // Recompute totals for filtered categories
    const { aggregateCategory, aggregateProject } = require('@atomics/estimate-engine');
    for (const cat of finalCategories) {
      cat.computedTotals = aggregateCategory(cat.items || []);
    }
    const finalTotals = aggregateProject(finalCategories, totalBudget);

    // ── Create Estimate parent doc ────────────────────────────────────────
    const estimate = await Estimate.create({
      projectId: project._id,
      estimateName: `${project.name} — Initial Estimate`,
      createdBy: userId,
      generatedByEngine: true,
      computedTotals: finalTotals.computedTotals || {},
      budgetContext: {
        totalBudget,
        budgetPerSqft,
        targetMarginBand: { min: bandMin, max: bandMax },
      },
    });

    // ── Create first EstimateVersion with confirmed + engine output ────────
    await EstimateVersion.create({
      estimateId: estimate._id,
      versionNumber: 1,
      summary: "AI-generated initial estimate",
      categories: finalCategories,
      cellFormatting: [],
      computedTotals: finalTotals.computedTotals || {},
      projectContext: {
        projectType,
        tier,
        city,
        sqft: totalArea,
        rooms,
        roomSubtype,
        budget: totalBudget,
      },
      financialDefaults: {},
      generationMeta: result.generationMeta || {},
      createdBy: userId,
    });

    // ── Initialise ProjectFinance ─────────────────────────────────────────
    await ProjectFinance.create({
      projectId: project._id,
      estimates: [
        {
          estimateId: estimate._id,
          estimateName: estimate.estimateName,
          includedInBudget: true,
          position: 0,
          subtotal: finalTotals.computedTotals?.totalSell || 0,
          isLocked: false,
          lastUpdatedAt: new Date(),
        },
      ],
      totals: {
        subtotal: finalTotals.computedTotals?.totalSell || 0,
        gstAmount: 0,
        grandTotal: finalTotals.computedTotals?.totalSell || 0,
      },
      createdBy: userId,
    });

    // Update project cache
    project.latestEstimateId = estimate._id.toString();
    project.latestTotal = result.computedTotals?.totalSell ?? null;
    await project.save();

    // Log events (non-blocking)
    const eventContext = {
      budget: totalBudget,
      sqft: totalArea,
      rooms,
      roomSubtype,
      tier,
      city,
      projectType,
    };
    StructureEvent.insertMany(
      (result.categories || []).map((cat) => ({
        projectId: project._id.toString(),
        estimateId: estimate._id.toString(),
        userId: userId.toString(),
        eventType: "section_added",
        canonicalRef: cat.canonicalRef,
        position: cat.order,
        context: eventContext,
        wasAiSuggested: true,
        userAccepted: null,
      })),
    ).catch((e) => console.error("Event log error (non-critical):", e.message));

    res.json({
      success: true,
      project,
      estimateId: estimate._id,
      estimate: _serialize(estimate.toObject()),
    });
  } catch (err) {
    next(err);
  }
}

// ─── LIST MY PROJECTS ─────────────────────────────────────────────────────────

async function getMyProjects(req, res, next) {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    // Find all projects where user is a member
    const memberships = await ProjectMember.find({ userId })
      .select("projectId")
      .lean();
    const projectIds = memberships.map((m) => m.projectId);

    const filter = { _id: { $in: projectIds } };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Project.countDocuments(filter);

    const projects = await Project.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      projects,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET SINGLE PROJECT ───────────────────────────────────────────────────────

async function getProjectById(req, res, next) {
  try {
    const project = await Project.findById(req.params.projectId).lean();
    if (!project) return res.status(404).json({ error: "Project not found" });

    // If setup not complete, return minimal info + draft flag
    if (project.setupStatus !== "completed") {
      return res.json({
        _id: project._id,
        name: project.name,
        setupStatus: project.setupStatus,
        currentSetupStep: project.currentSetupStep,
        isDraft: true,
      });
    }

    res.json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

// ─── UPDATE PROJECT ───────────────────────────────────────────────────────────

async function updateProject(req, res, next) {
  try {
    const allowed = [
      "name",
      "clientName",
      "clientPhone",
      "status",
      "tier",
      "city",
      "sqft",
      "rooms",
      "roomSubtype",
      "budget",
      "startDate",
      "endDate",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      { $set: updates },
      { new: true },
    ).lean();

    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE PROJECT ───────────────────────────────────────────────────────────

async function deleteProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.coverImage) {
      deleteFromR2(project.coverImage).catch(() => {});
    }

    await Promise.all([
      Project.findByIdAndDelete(projectId),
      ProjectMember.deleteMany({ projectId }),
      ProjectSetup.deleteMany({ projectId }),
      ProjectClient.deleteMany({ projectId }),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── UPDATE COVER IMAGE ───────────────────────────────────────────────────────

async function updateProjectCover(req, res, next) {
  try {
    console.log(
      "Updating project cover image for projectId:",
      req.params.projectId,
    );
    if (!req.file)
      return res.status(400).json({ error: "Cover image required" });

    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.coverImage) {
      deleteFromR2(project.coverImage).catch(() => {});
    }

    const coverImage = await uploadToR2({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname,
      folder: "projectcoverimage",
    });

    project.coverImage = coverImage;
    await project.save();

    res.json({ success: true, coverImage });
  } catch (err) {
    next(err);
  }
}

// ─── MEMBERS ──────────────────────────────────────────────────────────────────

async function getProjectMembers(req, res, next) {
  try {
    const members = await ProjectMember.find({
      projectId: req.params.projectId,
    })
      .populate("userId", "name email avatar")
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      members: members.map((m) => ({
        _id: m._id,
        role: m.role,
        user: {
          _id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          avatar: m.userId.avatar,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function addProjectMember(req, res, next) {
  try {
    const { email, role } = req.body;
    if (!["owner", "designer", "viewer"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Role must be owner, designer, or viewer" });
    }

    const User = require("../../models/User");
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found — ask them to sign up first" });
    }

    const existing = await ProjectMember.findOne({
      projectId: req.params.projectId,
      userId: user._id,
    });
    if (existing)
      return res.status(400).json({ error: "User is already a member" });

    await ProjectMember.create({
      projectId: req.params.projectId,
      userId: user._id,
      role,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removeProjectMember(req, res, next) {
  try {
    const member = await ProjectMember.findOne({
      projectId: req.params.projectId,
      userId: req.params.userId,
    });
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (member.role === "owner") {
      return res.status(400).json({ error: "Owner cannot be removed" });
    }
    await member.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── CLIENT ACCESS ────────────────────────────────────────────────────────────

async function addClient(req, res, next) {
  try {
    const { email } = req.body;
    // One client per project — replace if already set
    await ProjectClient.findOneAndDelete({ projectId: req.params.projectId });
    const token = crypto.randomBytes(24).toString("hex");
    await ProjectClient.create({
      projectId: req.params.projectId,
      email,
      token,
    });
    res.json({
      success: true,
      link: `${process.env.CLIENT_URL}/moodboard/${token}`,
    });
  } catch (err) {
    next(err);
  }
}

async function removeClient(req, res, next) {
  try {
    await ProjectClient.findOneAndDelete({ projectId: req.params.projectId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── PROJECT ESTIMATES ────────────────────────────────────────────────────────

async function getProjectEstimates(req, res, next) {
  try {
    const estimates = await EstimateVersion.find({
      projectId: req.params.projectId,
    })
      .select(
        "estimateId versionNumber computedTotals generationMeta status createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, estimates });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _serialize(obj) {
  return JSON.parse(
    JSON.stringify(obj, (k, v) => {
      if (v instanceof Map) return Object.fromEntries(v);
      return v;
    }),
  );
}

module.exports = {
  createProject,
  getProjectSetup,
  updateProjectSetup,
  completeProjectSetup,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
  updateProjectCover,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  addClient,
  removeClient,
  getProjectEstimates,
};
