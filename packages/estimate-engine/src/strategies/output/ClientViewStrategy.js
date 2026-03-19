/**
 * Client view — strips internal cost breakdowns.
 * Only exposes sell price (subtotal + tax).
 * Used when generating client-facing PDF/quote.
 */
class ClientViewStrategy {
  format(categories, totals, input, meta) {
    const clientCategories = categories.map(cat => ({
      ...cat,
      items: (cat.items || []).map(item => {
        const computed = item.computed instanceof Map
          ? Object.fromEntries(item.computed)
          : (item.computed || {})

        const clientComputed = new Map()
        // Only expose what the client sees — no directCost, no margin
        clientComputed.set('subtotal',   computed.subtotal   ?? 0)
        clientComputed.set('taxAmount',  computed.taxAmount  ?? 0)
        clientComputed.set('finalTotal', computed.finalTotal ?? 0)

        return {
          ...item,
          computed: clientComputed,
          // Strip internal rate fields from client view
          rateSource: undefined,
          confidence: undefined
        }
      }),
      computedTotals: {
        totalSell:    cat.computedTotals?.totalSell    ?? 0,
        marginAmount: undefined,
        marginPercent: undefined
      }
    }))

    return {
      categories: clientCategories,
      computedTotals: {
        totalSell:    totals.computedTotals?.totalSell ?? 0,
        subtotal:     totals.computedTotals?.subtotal  ?? 0
      },
      generationMeta: {
        generatedAt: new Date()
      }
    }
  }
}

module.exports = ClientViewStrategy
