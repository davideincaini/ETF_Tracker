/**
 * Smart PAC rebalancing: allocate budget to underweight ETFs,
 * buying whole shares only.
 *
 * @param {number} budget - monthly EUR to invest
 * @param {Object} holdings - { ticker: qty }
 * @param {Object} prices - { ticker: price }
 * @param {Array} tickers - ticker config array with target_weight
 * @returns {{ buys: Array<{ticker, name, shares, cost}> }}
 */
export function calculatePac(budget, holdings, prices, ObjectTickers) {
  let available = budget

  // Solo i ticker del Vault B sono calcolabili
  const tickers = ObjectTickers.filter(t => t.vault === 'B')

  // current portfolio value (Solo Vault B)
  const portfolioValue = tickers.reduce(
    (sum, t) => sum + (holdings[t.ticker] || 0) * (prices[t.ticker] || 0),
    0
  )
  const totalAfter = portfolioValue + available

  // Calcolo della deviazione: Target Teorico (%) - Peso Reale (%)
  const deviations = tickers.map((t) => {
    const currentVal = (holdings[t.ticker] || 0) * (prices[t.ticker] || 0)
    const currentWeight = portfolioValue > 0 ? (currentVal / portfolioValue) : 0
    const deviation = t.target_weight - currentWeight
    return { ...t, deviation, price: prices[t.ticker] || 0, currentWeight }
  }).filter(t => t.price > 0) // Escludi asset senza prezzo

  if (deviations.length === 0) return { buys: [] }

  // Ordina per la deviazione positiva più alta (quello matematicamente più "indietro")
  deviations.sort((a, b) => b.deviation - a.deviation)

  const buys = []

  // Il "motore di default" del PAC suggerisce UN SOLO ETF da comprare con tutto il flusso di cassa mensile
  const targetEtf = deviations[0]

  if (targetEtf && targetEtf.deviation > 0) {
    const shares = Math.floor(available / targetEtf.price)
    if (shares > 0) {
      buys.push({
        ticker: targetEtf.ticker,
        name: targetEtf.name,
        shares,
        cost: shares * targetEtf.price,
        deviation: targetEtf.deviation
      })
    }
  }

  // Se l'ETF primario non è acquistabile (es. quota troppo costosa)
  // potremmo valutare il secondo, ma per ora teniamo la logica semplice: l'utente deve accumulare o comprare a mano.

  return { buys, deviations }
}
