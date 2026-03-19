import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createProjectApi, updateProjectSetupApi,
  completeProjectSetupApi, getProjectSetupApi,
  predictSectionsApi, predictItemsApi,
  recalculateItemsApi,
} from "../../../../Api/projectApi";

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  projectName: "", clientName: "",
  coverImage: null, coverImagePreview: null,
  projectType: "", roomConfig: "",
  city: "", localityTier: "",
  totalArea: "", interiorType: "",
  totalBudget: "", budgetTier: "", flexibilityPercent: "",
  rooms: [], additionalWork: [], roomDetails: [],
  notes: "",
  // Level 1 engine output
  predictedSections: [],    // [{ canonicalRef, label, allocatedBudget, isAnchor }]
  confirmedSections: [],    // user-confirmed after step 4
  allAvailableSections: [], // full canonical list for "add section" picker
  prunedSections: [],       // sections pruned due to insufficient budget
  // Level 2 engine output
  predictedItems: [],       // [{ canonicalRef, label, items, sectionTotal, allocatedBudget }]
  confirmedItems: {},       // { [sectionRef]: [itemCanonicalRef, ...] } after step 5
  allAvailableItems: {},    // { [sectionRef]: [{canonicalRef, label, unit}] }
  projectTotals: null,      // { totalBudget, projectTotal, budgetDeviationPercent }
};

function hydrateProjectData(a) {
  return {
    projectName:       a.projectName        || "",
    clientName:        a.clientName         || "",
    coverImage:        a.coverImage         || null,
    coverImagePreview: a.coverImage         || null,
    projectType:       a.projectType        || "",
    roomConfig:        a.roomConfig         || a.subType || "",
    city:              a.city               || "",
    localityTier:      a.localityTier       || "",
    totalArea:         a.totalArea          || "",
    interiorType:      a.interiorType       || "",
    totalBudget:       a.totalBudget        || "",
    budgetTier:        a.budgetTier         || "",
    flexibilityPercent: a.flexibilityPercent || "",
    rooms:             a.rooms              || [],
    additionalWork:    a.additionalWork     || [],
    roomDetails:       a.roomDetails        || [],
    notes:             a.notes              || "",
    predictedSections:    a.predictedSections    || [],
    confirmedSections:    a.confirmedSections    || [],
    allAvailableSections: a.allAvailableSections || [],
    prunedSections:       a.prunedSections       || [],
    predictedItems:       a.predictedItems       || [],
    confirmedItems:       a.confirmedItems       || {},
    allAvailableItems:    a.allAvailableItems     || {},
    projectTotals:        a.projectTotals        || null,
  };
}

function buildAnswers(projectData) {
  return {
    projectName:        projectData.projectName,
    clientName:         projectData.clientName,
    coverImage:         projectData.coverImage,
    projectType:        projectData.projectType,
    subType:            projectData.roomConfig,
    roomConfig:         projectData.roomConfig,
    city:               projectData.city,
    localityTier:       projectData.localityTier,
    totalArea:          projectData.totalArea,
    interiorType:       projectData.interiorType,
    totalBudget:        projectData.totalBudget,
    budgetTier:         projectData.budgetTier,
    flexibilityPercent: projectData.flexibilityPercent,
    rooms:              projectData.rooms,
    additionalWork:     projectData.additionalWork,
    roomDetails:        projectData.roomDetails,
    notes:              projectData.notes,
    confirmedSections:  projectData.confirmedSections,
    confirmedItems:     projectData.confirmedItems,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWizardState() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId       = searchParams.get("resume");
  const sessionDraftId = sessionStorage.getItem("wizardDraftId");
  const effectiveDraftId = resumeId || sessionDraftId || null;

  const [step, setStep]               = useState(0);
  const [projectData, setProjectData] = useState(initialState);
  const [projectId, setProjectId]     = useState(effectiveDraftId);
  const [isLoading, setIsLoading]     = useState(!!effectiveDraftId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveStatus, setSaveStatus]   = useState("idle");
  const [stepSaveLoading, setStepSaveLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Level 1/2 engine loading states
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingItems, setIsLoadingItems]       = useState(false);
  const [engineError, setEngineError]             = useState(null);

  const autoSaveTimer    = useRef(null);
  const recalcTimer      = useRef(null);
  const isFirstRender    = useRef(true);
  const initialized      = useRef(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // ── 1. Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (effectiveDraftId) {
      if (!resumeId) navigate(`/projects/create-new?resume=${effectiveDraftId}`, { replace: true });
      sessionStorage.setItem("wizardDraftId", effectiveDraftId);
      (async () => {
        try {
          setIsLoading(true);
          const res   = await getProjectSetupApi(effectiveDraftId);
          const setup = res.data?.setup;
          if (!setup) throw new Error("Setup data missing");
          if (typeof setup.currentStep === "number") setStep(setup.currentStep);
          setProjectData(hydrateProjectData(setup.answers || {}));
        } catch (err) {
          console.error("Failed to resume draft", err);
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      (async () => {
        try {
          const formData = new FormData();
          formData.append("name", "Untitled Project");
          const res   = await createProjectApi(formData);
          const newId = res.data.project._id;
          setProjectId(newId);
          sessionStorage.setItem("wizardDraftId", newId);
          navigate(`/projects/create-new?resume=${newId}`, { replace: true });
        } catch (err) {
          console.error("Failed to create draft project", err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Auto-save ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || isLoading) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    clearTimeout(autoSaveTimer.current);
    setSaveStatus("saving");
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await updateProjectSetupApi(projectId, { currentStep: step, answers: buildAnswers(projectData) });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Auto-save failed", err);
        setSaveStatus("error");
      } finally {
        setIsSaving(false);
      }
    }, 800);
    return () => clearTimeout(autoSaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectData, step, projectId, isLoading]);

  // ── 3. Validation ──────────────────────────────────────────────────────────
  const canContinue = useCallback(() => {
    switch (step) {
      case 0: return projectData.projectName.trim() && projectData.clientName.trim() && projectData.projectType;
      case 1: return (projectData.city || "").trim() && projectData.localityTier && projectData.totalArea && projectData.interiorType;
      case 2: return projectData.totalBudget && Number(projectData.totalBudget) > 0 && projectData.budgetTier;
      case 3: return projectData.confirmedSections?.length > 0;
      case 4: return Object.keys(projectData.confirmedItems || {}).length > 0;
      default: return true;
    }
  }, [step, projectData]);

  // ── 4. Next (with engine calls at step transitions) ────────────────────────
  const handleNext = async () => {
    // Step 2 → 3: save first, then call Level 1 engine to predict sections
    if (step === 2) {
      setStepSaveLoading(true);
      setEngineError(null);
      try {
        await updateProjectSetupApi(projectId, { currentStep: 3, answers: buildAnswers(projectData) });
        setSaveStatus("saved");
        // Move to step 3 immediately so UI updates
        setStep(3);
        window.scrollTo(0, 0);
        // Then call Level 1 engine
        setIsLoadingSections(true);
        const res = await predictSectionsApi(projectId);
        const { predictedSections, prunedSections, allSections } = res.data;
        setProjectData(prev => ({
          ...prev,
          predictedSections:    predictedSections || [],
          prunedSections:       prunedSections    || [],
          confirmedSections:    (predictedSections || []).map(s => s.canonicalRef),
          allAvailableSections: allSections || [],
        }));
      } catch (err) {
        console.error("Level 1 engine error", err);
        setEngineError("Could not load AI section predictions. You can continue manually.");
      } finally {
        setIsLoadingSections(false);
        setStepSaveLoading(false);
      }
      return;
    }

    // Step 3 → 4: save confirmed sections, call Level 2 engine to predict items
    if (step === 3) {
      setStepSaveLoading(true);
      setEngineError(null);
      try {
        await updateProjectSetupApi(projectId, { currentStep: 4, answers: buildAnswers(projectData) });
        setSaveStatus("saved");
        setStep(4);
        window.scrollTo(0, 0);
        setIsLoadingItems(true);
        const confirmedSections = projectData.confirmedSections || [];
        const res = await predictItemsApi(projectId, confirmedSections);
        const { sections, allItemsBySectionRef, projectTotals } = res.data;
        // Build confirmedItems map: section → all predicted item refs
        const confirmedItems = {};
        for (const sec of (sections || [])) {
          confirmedItems[sec.canonicalRef] = (sec.items || []).map(i => i.canonicalRef);
        }
        setProjectData(prev => ({
          ...prev,
          predictedItems:    sections || [],
          confirmedItems,
          allAvailableItems: allItemsBySectionRef || {},
          projectTotals:     projectTotals || null,
        }));
      } catch (err) {
        console.error("Level 2 engine error", err);
        setEngineError("Could not load AI item predictions. You can continue manually.");
      } finally {
        setIsLoadingItems(false);
        setStepSaveLoading(false);
      }
      return;
    }

    // All other steps — just save and advance
    if (step < 5) {
      setStepSaveLoading(true);
      try {
        await updateProjectSetupApi(projectId, { currentStep: step + 1, answers: buildAnswers(projectData) });
        setSaveStatus("saved");
      } catch (e) {
        console.error("Step save failed", e);
      } finally {
        setStepSaveLoading(false);
      }
    }
    setStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => { if (step > 0) setStep(prev => prev - 1); };

  // ── 5. Final submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!projectId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updateProjectSetupApi(projectId, { currentStep: 5, answers: buildAnswers(projectData) });
      const res = await completeProjectSetupApi(projectId);
      sessionStorage.removeItem("wizardDraftId");
      const estimateId = res.data?.estimateId;
      if (estimateId) {
        navigate(`/projects/${projectId}/quotes/${estimateId}`);
      } else {
        navigate(`/projects/${projectId}/quotes`);
      }
    } catch (err) {
      console.error("Failed to complete project setup", err);
      setSubmitError(err.response?.data?.error || "Failed to launch project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 6. Field helpers ───────────────────────────────────────────────────────
  const updateField = (field, value) =>
    setProjectData(prev => ({ ...prev, [field]: value }));

  const updateRoomDetail = (idx, updated) => {
    setProjectData(prev => {
      const newDetails = [...prev.roomDetails];
      newDetails[idx] = updated;
      return { ...prev, roomDetails: newDetails };
    });
  };

  const toggleAdditionalWork = (id) => {
    setProjectData(prev => {
      const current = prev.additionalWork || [];
      const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      return { ...prev, additionalWork: updated };
    });
  };

  // Confirm/remove a section (Step 4)
  const toggleSection = (canonicalRef) => {
    setProjectData(prev => {
      const current = prev.confirmedSections || [];
      const updated = current.includes(canonicalRef)
        ? current.filter(r => r !== canonicalRef)
        : [...current, canonicalRef];
      return { ...prev, confirmedSections: updated };
    });
  };

  // Add a section from canonical list (Step 4)
  const addSection = (canonicalRef, label) => {
    setProjectData(prev => {
      if ((prev.confirmedSections || []).includes(canonicalRef)) return prev;
      const newPredicted = [...(prev.predictedSections || []),
        { canonicalRef, label, allocatedBudget: 0, isAnchor: false, userAdded: true }];
      return {
        ...prev,
        predictedSections: newPredicted,
        confirmedSections: [...(prev.confirmedSections || []), canonicalRef],
      };
    });
  };

  // Debounced recalculate — fires 400ms after last item change
  const scheduleRecalculate = useCallback((newConfirmedSections, newConfirmedItems) => {
    clearTimeout(recalcTimer.current);
    recalcTimer.current = setTimeout(async () => {
      if (!projectId) return;
      try {
        setIsRecalculating(true);
        const res = await recalculateItemsApi(projectId, newConfirmedSections, newConfirmedItems);
        const { sections, projectTotals } = res.data;
        // Merge recalculated costs back into predictedItems
        setProjectData(prev => {
          const updatedPredicted = (prev.predictedItems || []).map(sec => {
            const fresh = (sections || []).find(s => s.canonicalRef === sec.canonicalRef);
            if (!fresh) return sec;
            // Merge item costs: keep predicted item structure, update cost fields
            const freshItemMap = new Map((fresh.items || []).map(i => [i.canonicalRef, i]));
            const mergedItems = (sec.items || []).map(i => {
              const fi = freshItemMap.get(i.canonicalRef);
              return fi ? { ...i, ...fi } : i;
            });
            // Add any newly-added items that weren't in original prediction
            const existingRefs = new Set(sec.items.map(i => i.canonicalRef));
            const newItems = (fresh.items || []).filter(i => !existingRefs.has(i.canonicalRef));
            return { ...sec, items: [...mergedItems, ...newItems], sectionTotal: fresh.sectionTotal };
          });
          return {
            ...prev,
            predictedItems: updatedPredicted,
            projectTotals: projectTotals || prev.projectTotals,
          };
        });
      } catch (err) {
        console.error('Recalculate failed:', err);
      } finally {
        setIsRecalculating(false);
      }
    }, 400);
  }, [projectId]);

  // Toggle item in a section (Step 5) — optimistic update + debounced recalculate
  const toggleItem = (sectionRef, itemRef) => {
    setProjectData(prev => {
      const sectionItems = prev.confirmedItems?.[sectionRef] || [];
      const updated = sectionItems.includes(itemRef)
        ? sectionItems.filter(r => r !== itemRef)
        : [...sectionItems, itemRef];
      const newConfirmedItems = { ...prev.confirmedItems, [sectionRef]: updated };
      scheduleRecalculate(prev.confirmedSections || [], newConfirmedItems);
      return { ...prev, confirmedItems: newConfirmedItems };
    });
  };

  // Add item from canonical DB (Step 5) — immediate add + debounced recalculate
  const addItem = (sectionRef, itemRef) => {
    setProjectData(prev => {
      const sectionItems = prev.confirmedItems?.[sectionRef] || [];
      if (sectionItems.includes(itemRef)) return prev;
      const newItems = [...sectionItems, itemRef];
      const newConfirmedItems = { ...prev.confirmedItems, [sectionRef]: newItems };
      scheduleRecalculate(prev.confirmedSections || [], newConfirmedItems);
      return { ...prev, confirmedItems: newConfirmedItems };
    });
  };

  return {
    step, projectData, setProjectData, updateField, updateRoomDetail,
    toggleAdditionalWork, canContinue, handleNext, handleBack, handleSubmit,
    toggleSection, addSection, toggleItem, addItem,
    isSubmitting, isSaving, saveStatus, isLoading, stepSaveLoading,
    isLoadingSections, isLoadingItems, isRecalculating, engineError,
    projectId, isResuming: !!(resumeId || sessionDraftId),
    submitError,
  };
}
