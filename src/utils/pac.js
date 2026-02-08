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
export function calculatePac(budget, holdings, prices, tickers) {
  let available = budget

  // current portfolio value
  const portfolioValue = tickers.reduce(
    (sum, t) => sum + (holdings[t.ticker] || 0) * (prices[t.ticker] || 0),
    0
  )
  const totalAfter = portfolioValue + available

  // compute gap = target value - current value for underweight ETFs
  const gaps = tickers
    .map((t) => {
      const currentVal = (holdings[t.ticker] || 0) * (prices[t.ticker] || 0)
      const targetVal = t.target_weight * totalAfter
      return { ...t, gap: targetVal - currentVal, price: prices[t.ticker] || 0 }
    })
    .filter((t) => t.price > 0 && t.gap > 0)

  const totalGap = gaps.reduce((s, t) => s + t.gap, 0)

  const buys = []

  // Distribute budget proportionally to each ETF's gap
  // This ensures all underweight ETFs get bought, maintaining allocation
  for (const etf of gaps) {
    const proportion = totalGap > 0 ? etf.gap / totalGap : 0
    const idealSpend = available * proportion
    const shares = Math.floor(idealSpend / etf.price)
    if (shares <= 0) continue
    buys.push({ ticker: etf.ticker, name: etf.name, shares, cost: shares * etf.price })
  }

  // Spend leftover on most underweight ETF that we can still afford
  const spent = buys.reduce((s, b) => s + b.cost, 0)
  let leftover = available - spent
  const remaining = gaps
    .filter((t) => t.price <= leftover)
    .sort((a, b) => b.gap - a.gap)
  for (const etf of remaining) {
    const extra = Math.floor(leftover / etf.price)
    if (extra <= 0) continue
    const existing = buys.find((b) => b.ticker === etf.ticker)
    if (existing) {
      existing.shares += extra
      existing.cost += extra * etf.price
    } else {
      buys.push({ ticker: etf.ticker, name: etf.name, shares: extra, cost: extra * etf.price })
    }
    leftover -= extra * etf.price
  }

  return { buys }
}
