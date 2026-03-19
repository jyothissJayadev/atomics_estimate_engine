const { CONFIDENCE, RATE_SOURCE } = require('../../../../../apps/backend/config/constants')

/**
 * DemoRateStrategy
 *
 * Provides fallback rates for items with no user history.
 *
 * V1 (original): reads from a hardcoded DEMO_RATES constant map.
 * V2 (current):  reads from CanonicalItem.baselineRates in the DB,
 *                with city multiplier from CanonicalItem.regionMultipliers.
 *
 * Falls back to hardcoded rates if DB data is not pre-loaded (cold start safety).
 *
 * The controller calls DemoRateStrategy.loadRates(canonicalItemMap) once
 * before building the engine, passing a pre-fetched Map<canonicalId, CanonicalItem>.
 * This keeps the engine pure (no async, no DB calls).
 */

// Fallback hardcoded rates for cold-start / missing DB entries
const FALLBACK_RATES = {
  budget: {
    kit_carcass_ply:        { materialRate: 75,  laborRate: 18 },
    kit_shutter_laminate:   { materialRate: 95,  laborRate: 22 },
    fc_gypsum_board:        { materialRate: 42,  laborRate: 16 },
    fc_metal_frame:         { materialRate: 22,  laborRate: 12 },
    fl_vitrified_tile:      { materialRate: 55,  laborRate: 28 },
    wt_emulsion_paint:      { materialRate: 8,   laborRate: 12 },
    el_switch_point:        { materialRate: 280, laborRate: 120},
  },
  balanced: {
    kit_carcass_ply:        { materialRate: 95,  laborRate: 24 },
    kit_shutter_laminate:   { materialRate: 130, laborRate: 30 },
    fc_gypsum_board:        { materialRate: 52,  laborRate: 18 },
    fc_metal_frame:         { materialRate: 28,  laborRate: 14 },
    fl_vitrified_tile:      { materialRate: 75,  laborRate: 35 },
    wt_emulsion_paint:      { materialRate: 12,  laborRate: 15 },
    el_switch_point:        { materialRate: 380, laborRate: 150},
  },
  premium: {
    kit_carcass_ply:        { materialRate: 130, laborRate: 32 },
    kit_shutter_laminate:   { materialRate: 185, laborRate: 40 },
    fc_gypsum_board:        { materialRate: 68,  laborRate: 24 },
    fc_metal_frame:         { materialRate: 35,  laborRate: 18 },
    fl_vitrified_tile:      { materialRate: 120, laborRate: 48 },
    wt_emulsion_paint:      { materialRate: 18,  laborRate: 18 },
    el_switch_point:        { materialRate: 650, laborRate: 180},
  }
}

// City multipliers (Bangalore baseline = 1.0)
const DEFAULT_CITY_MULTIPLIERS = {
  bangalore: 1.00, mumbai: 1.22, delhi: 1.18, gurgaon: 1.18,
  noida: 1.15, hyderabad: 0.97, pune: 1.05, chennai: 1.02,
  kolkata: 0.92, ahmedabad: 0.88, surat: 0.85, jaipur: 0.88,
  lucknow: 0.82, chandigarh: 0.90, kochi: 0.95,
}

class DemoRateStrategy {
  /**
   * @param {Map<string, Object>} canonicalItemMap  — pre-fetched CanonicalItem docs
   * @param {string} [city]                         — current project city
   */
  constructor(canonicalItemMap, city) {
    this.itemMap = canonicalItemMap || new Map()
    this.city    = (city || '').toLowerCase().trim()
  }

  getRates(itemCanonicalRef, tier) {
    const effectiveTier = tier || 'balanced'
    const cityKey       = this.city

    // ── 1. Try DB-loaded CanonicalItem ────────────────────────────────────────
    const catalogItem = this.itemMap.get(itemCanonicalRef)
    if (catalogItem) {
      const tierRates = catalogItem.baselineRates?.[effectiveTier]
        || catalogItem.baselineRates?.balanced
        || null

      if (tierRates && (tierRates.materialRate || tierRates.laborRate)) {
        // Apply city multiplier
        let mult = 1.0
        if (cityKey) {
          const rm = catalogItem.regionMultipliers
          if (rm) {
            mult = (rm instanceof Map ? rm.get(cityKey) : rm[cityKey]) || 1.0
          } else {
            mult = DEFAULT_CITY_MULTIPLIERS[cityKey] || 1.0
          }
        }

        return {
          materialRate: Math.round((tierRates.materialRate || 0) * mult),
          laborRate:    Math.round((tierRates.laborRate    || 0) * mult),
          confidence:   CONFIDENCE.LOW,
          source:       RATE_SOURCE.DEMO,
          basis:        `market estimate${cityKey ? ` (${cityKey})` : ''} — verify with your own rates`
        }
      }
    }

    // ── 2. Fallback to hardcoded rates ────────────────────────────────────────
    const tierRates = FALLBACK_RATES[effectiveTier] || FALLBACK_RATES.balanced
    const rates = tierRates[itemCanonicalRef]
    if (!rates) return null

    let mult = 1.0
    if (cityKey) {
      mult = DEFAULT_CITY_MULTIPLIERS[cityKey] || 1.0
    }

    return {
      materialRate: Math.round((rates.materialRate || 0) * mult),
      laborRate:    Math.round((rates.laborRate    || 0) * mult),
      confidence:   CONFIDENCE.LOW,
      source:       RATE_SOURCE.DEMO,
      basis:        'market estimate (fallback) — verify with your own rates'
    }
  }
}

module.exports = DemoRateStrategy
