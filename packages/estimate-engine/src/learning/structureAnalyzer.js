/**
 * structureAnalyzer.js — Pure function, no DB access.
 *
 * Computes section + item diffs between AI-predicted and designer-final state.
 * Returns structured events the backend writes to StructureEvent,
 * UserSectionProfile, and GlobalSectionStats.
 */

/**
 * @param {Array}  aiCategories    - categories from the AI prediction (Level 2 output)
 * @param {Array}  finalCategories - categories from the locked EstimateVersion
 * @param {Object} projectContext  - { projectType, tier, city }
 * @returns {{ sectionEvents: Array, itemEvents: Array, sectionFreqDeltas: Array }}
 */
function extractStructureLearning(aiCategories, finalCategories, projectContext) {
  const { projectType } = projectContext

  const aiSectionRefs    = new Set((aiCategories    || []).map(c => c.canonicalRef).filter(Boolean))
  const finalSectionRefs = new Set((finalCategories || []).map(c => c.canonicalRef).filter(Boolean))

  const sectionEvents = []

  // Sections added by designer (not in AI prediction)
  for (const ref of finalSectionRefs) {
    if (!aiSectionRefs.has(ref)) {
      sectionEvents.push({ canonicalRef: ref, eventType: 'section_added', projectType })
    }
  }

  // Sections removed by designer (were in AI prediction, not in final)
  for (const ref of aiSectionRefs) {
    if (!finalSectionRefs.has(ref)) {
      sectionEvents.push({ canonicalRef: ref, eventType: 'section_removed', projectType })
    }
  }

  // Sections kept (in both AI prediction and final)
  for (const ref of aiSectionRefs) {
    if (finalSectionRefs.has(ref)) {
      sectionEvents.push({ canonicalRef: ref, eventType: 'section_kept', projectType })
    }
  }

  // Item-level diffs per section
  const itemEvents = []
  const aiItemMap = new Map()
  for (const cat of (aiCategories || [])) {
    if (!cat.canonicalRef) continue
    const aiItems = new Set((cat.items || []).map(i => i.canonicalRef).filter(Boolean))
    aiItemMap.set(cat.canonicalRef, aiItems)
  }

  for (const cat of (finalCategories || [])) {
    if (!cat.canonicalRef) continue
    const aiItems    = aiItemMap.get(cat.canonicalRef) || new Set()
    const finalItems = new Set((cat.items || []).map(i => i.canonicalRef).filter(Boolean))

    for (const ref of finalItems) {
      if (!aiItems.has(ref)) {
        itemEvents.push({ canonicalRef: ref, sectionRef: cat.canonicalRef, eventType: 'item_added', projectType })
      }
    }
    for (const ref of aiItems) {
      if (!finalItems.has(ref)) {
        itemEvents.push({ canonicalRef: ref, sectionRef: cat.canonicalRef, eventType: 'item_removed', projectType })
      }
    }
    for (const ref of finalItems) {
      if (aiItems.has(ref)) {
        itemEvents.push({ canonicalRef: ref, sectionRef: cat.canonicalRef, eventType: 'item_kept', projectType })
      }
    }
  }

  // Section frequency deltas — one entry per confirmed section
  const sectionFreqDeltas = (finalCategories || [])
    .filter(c => c.canonicalRef)
    .map(c => ({
      canonicalRef: c.canonicalRef,
      projectType,
      items: (c.items || []).map(i => i.canonicalRef).filter(Boolean),
    }))

  return { sectionEvents, itemEvents, sectionFreqDeltas }
}

module.exports = { extractStructureLearning }
