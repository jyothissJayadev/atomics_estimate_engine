const ProjectFinance  = require('../../models/finance/ProjectFinance')
const Estimate        = require('../../models/finance/Estimate')
const EstimateVersion = require('../../models/finance/EstimateVersion')
const { uploadToR2 }  = require('../../utils/uploadToR2')
const { calculateFinanceTotals } = require('../../utils/calcHelpers')

// ─── SHARED: recalculate and sync finance for a project ───────────────────────
// Called internally by estimateController on every version save / lock / delete.

async function recalculateFinanceForProject(projectId) {
  let finance = await ProjectFinance.findOne({ projectId })

  if (!finance) {
    // Auto-create on first estimate save
    finance = await ProjectFinance.create({ projectId, estimates: [] })
  }

  const estimates = await Estimate.find({ projectId }).lean()

  const updatedRefs = estimates.map(est => {
    const existing = finance.estimates.find(
      e => e.estimateId.toString() === est._id.toString()
    )
    return {
      estimateId:       est._id,
      estimateName:     est.estimateName,
      includedInBudget: existing ? existing.includedInBudget : true,
      position:         existing ? existing.position         : 0,
      subtotal:         est.computedTotals?.subtotal || 0,
      isLocked:         est.status === 'Locked',
      lastUpdatedAt:    est.updatedAt
    }
  })

  finance.estimates = updatedRefs
  finance.totals    = calculateFinanceTotals(
    updatedRefs, finance.gstEnabled, finance.gstPercentage
  )

  await finance.save()
  return finance
}

// ─── GET FINANCE ──────────────────────────────────────────────────────────────

async function getProjectFinance(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
      .select('estimates totals gstEnabled gstPercentage header status')
      .lean()

    if (!finance) return res.status(404).json({ error: 'Finance not initialised' })
    res.json(finance)
  } catch (err) { next(err) }
}

// ─── SYNC ESTIMATES ───────────────────────────────────────────────────────────

async function syncProjectEstimates(req, res, next) {
  try {
    const finance = await recalculateFinanceForProject(req.params.projectId)
    res.json(finance)
  } catch (err) { next(err) }
}

// ─── TOGGLE GST ───────────────────────────────────────────────────────────────

async function toggleFinanceGst(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    if (finance.status === 'Finalized') {
      return res.status(400).json({ error: 'Finance is finalized' })
    }

    finance.gstEnabled = !finance.gstEnabled
    finance.totals     = calculateFinanceTotals(
      finance.estimates, finance.gstEnabled, finance.gstPercentage
    )

    await finance.save()
    res.json({ gstEnabled: finance.gstEnabled, totals: finance.totals })
  } catch (err) { next(err) }
}

// ─── TOGGLE ESTIMATE INCLUDE / EXCLUDE ───────────────────────────────────────

async function toggleEstimateInclusion(req, res, next) {
  try {
    const { projectId, estimateId } = req.params

    const finance = await ProjectFinance.findOne({ projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    const ref = finance.estimates.find(
      e => e.estimateId.toString() === estimateId
    )
    if (!ref) return res.status(404).json({ error: 'Estimate not linked to finance' })

    ref.includedInBudget = !ref.includedInBudget
    finance.totals       = calculateFinanceTotals(
      finance.estimates, finance.gstEnabled, finance.gstPercentage
    )

    await finance.save()
    res.json(finance)
  } catch (err) { next(err) }
}

// ─── REORDER ESTIMATES ────────────────────────────────────────────────────────

async function reorderFinanceEstimates(req, res, next) {
  try {
    const { projectId }          = req.params
    const { orderedEstimateIds } = req.body   // string array of estimate _id values

    const finance = await ProjectFinance.findOne({ projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    if (finance.status === 'Finalized') {
      return res.status(400).json({ error: 'Finance is finalized' })
    }

    orderedEstimateIds.forEach((id, index) => {
      const ref = finance.estimates.find(e => e.estimateId.toString() === id)
      if (ref) ref.position = index
    })

    finance.estimates.sort((a, b) => a.position - b.position)
    await finance.save()

    res.json(finance.estimates)
  } catch (err) { next(err) }
}

// ─── HEADER ───────────────────────────────────────────────────────────────────

async function updateFinanceHeader(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    if (finance.status === 'Finalized') {
      return res.status(400).json({ error: 'Finance is finalized' })
    }

    finance.header = { ...finance.header, ...req.body }
    await finance.save()
    res.json(finance.header)
  } catch (err) { next(err) }
}

async function uploadFinanceHeaderLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No logo uploaded' })

    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    if (finance.status === 'Finalized') {
      return res.status(400).json({ error: 'Finance is finalized' })
    }

    const logoUrl = await uploadToR2({
      buffer:       req.file.buffer,
      mimetype:     req.file.mimetype,
      originalName: req.file.originalname,
      folder:       'finance'
    })

    finance.header = { ...finance.header, logoUrl }
    await finance.save()
    res.json({ logoUrl })
  } catch (err) { next(err) }
}

async function getFinanceLayout(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
      .select('header footer status gstEnabled gstPercentage').lean()

    if (!finance) return res.status(404).json({ error: 'Finance not found' })
    res.json(finance)
  } catch (err) { next(err) }
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

async function updateFinanceFooter(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    if (finance.status === 'Finalized') {
      return res.status(400).json({ error: 'Finance is finalized' })
    }

    finance.footer = { ...finance.footer, ...req.body }
    await finance.save()
    res.json(finance.footer)
  } catch (err) { next(err) }
}

// ─── FINALIZE ─────────────────────────────────────────────────────────────────

async function finalizeProjectFinance(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId })
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    finance.status = 'Finalized'
    await finance.save()
    res.json({ success: true })
  } catch (err) { next(err) }
}

// ─── PREVIEW ─────────────────────────────────────────────────────────────────

async function getFinancePreview(req, res, next) {
  try {
    const finance = await ProjectFinance.findOne({ projectId: req.params.projectId }).lean()
    if (!finance) return res.status(404).json({ error: 'Finance not found' })

    const includedRefs = finance.estimates
      .filter(e => e.includedInBudget)
      .sort((a, b) => a.position - b.position)

    if (!includedRefs.length) {
      return res.json({
        header:        finance.header,
        estimates:     [],
        totals:        finance.totals,
        footer:        finance.footer,
        status:        finance.status,
        gstEnabled:    finance.gstEnabled,
        gstPercentage: finance.gstPercentage
      })
    }

    const estimateIds = includedRefs.map(e => e.estimateId)

    const [estimates, versions] = await Promise.all([
      Estimate.find({ _id: { $in: estimateIds } }).lean(),
      EstimateVersion.find({ estimateId: { $in: estimateIds } }).lean()
    ])

    const estMap = new Map(estimates.map(e => [e._id.toString(), e]))
    const verMap = new Map(versions.map(v => [`${v.estimateId}_${v.versionNumber}`, v]))

    const populatedEstimates = includedRefs.map(ref => {
      const est = estMap.get(ref.estimateId.toString())
      if (!est) return null

      const ver = verMap.get(`${est._id}_${est.currentVersion}`)
      if (!ver) return null

      return {
        estimateId:     est._id,
        estimateName:   est.estimateName,
        currentVersion: est.currentVersion,
        subtotal:       ref.subtotal,
        isLocked:       ref.isLocked,
        categories:     ver.categories.map(cat => {
          const catTotal = (cat.items || []).reduce((sum, item) => {
            const c = item.computed instanceof Map
              ? Object.fromEntries(item.computed) : (item.computed || {})
            return sum + (parseFloat(c.total || 0))
          }, 0)

          return {
            _id:           cat._id,
            name:          cat.name,
            columns:       cat.columns,
            computedTotals:{ subtotal: catTotal },
            items:         (cat.items || []).map(item => ({
              _id:      item._id,
              values:   item.values instanceof Map ? Object.fromEntries(item.values) : item.values,
              computed: item.computed instanceof Map ? Object.fromEntries(item.computed) : item.computed,
              children: item.children || []
            }))
          }
        })
      }
    }).filter(Boolean)

    res.json({
      header:        finance.header,
      estimates:     populatedEstimates,
      totals:        finance.totals,
      footer:        finance.footer,
      status:        finance.status,
      gstEnabled:    finance.gstEnabled,
      gstPercentage: finance.gstPercentage
    })
  } catch (err) { next(err) }
}

module.exports = {
  recalculateFinanceForProject,
  getProjectFinance,
  syncProjectEstimates,
  toggleFinanceGst,
  toggleEstimateInclusion,
  reorderFinanceEstimates,
  updateFinanceHeader,
  uploadFinanceHeaderLogo,
  getFinanceLayout,
  updateFinanceFooter,
  finalizeProjectFinance,
  getFinancePreview
}
