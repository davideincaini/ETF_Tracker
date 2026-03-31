import { buildHoldingsTimeline, getEverHeldTickers } from './holdings'

/**
 * Find the price closest to a target date in a sorted price history array.
 * Uses binary search for efficiency.
 */
export function findClosestPrice(tickerHistory, targetDate) {
  if (!tickerHistory || tickerHistory.length === 0) return null

  let lo = 0
  let hi = tickerHistory.length - 1

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (tickerHistory[mid].date < targetDate) lo = mid + 1
    else hi = mid
  }

  // Check neighbors for closest match
  if (lo > 0) {
    const prev = tickerHistory[lo - 1]
    const curr = tickerHistory[lo]
    if (Math.abs(prev.date - targetDate) < Math.abs(curr.date - targetDate)) {
      return prev.price
    }
  }

  return tickerHistory[lo].price
}

/**
 * Compute personal cumulative returns for a single asset over time.
 *
 * For each date in priceHistory (starting from the first transaction):
 *   rendimento_t = (qty_t × price_t - invested_t) / invested_t × 100
 *
 * @param {string} ticker
 * @param {Array} transactions - all portfolio transactions
 * @param {Array} priceHistory - [{date, price}] sorted chronologically for this ticker
 * @param {boolean} logarithmic - use ln() instead of linear formula
 * @returns {Array<{date, return, value, invested}>}
 */
export function computeAssetReturns(ticker, transactions, priceHistory, logarithmic = false) {
  if (!priceHistory || priceHistory.length === 0) return []

  // Filter and sort transactions for this ticker
  const tickerTxns = transactions
    .filter(tx => tx.ticker === ticker)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (tickerTxns.length === 0) return []

  const firstTxDate = new Date(tickerTxns[0].date).getTime()

  // Filter price history to start from first transaction
  const relevantPrices = priceHistory.filter(p => p.date >= firstTxDate)
  if (relevantPrices.length === 0) return []

  const result = []
  let txIdx = 0
  let qty = 0
  let invested = 0
  let avgCost = 0 // average cost per share for sell handling

  for (const point of relevantPrices) {
    // Replay transactions up to this date
    while (txIdx < tickerTxns.length) {
      const txDate = new Date(tickerTxns[txIdx].date).getTime()
      if (txDate > point.date) break

      const tx = tickerTxns[txIdx]
      if (tx.type === 'buy') {
        invested += tx.cost
        qty += tx.shares
        avgCost = qty > 0 ? invested / qty : 0
      } else {
        // Sell: reduce invested proportionally (average cost method)
        const sellCostBasis = avgCost * tx.shares
        invested = Math.max(0, invested - sellCostBasis)
        qty = Math.max(0, qty - tx.shares)
        avgCost = qty > 0 ? invested / qty : 0
      }
      txIdx++
    }

    if (invested <= 0 || qty <= 0) continue

    const value = qty * point.price
    const ret = logarithmic
      ? Math.log(value / invested) * 100
      : (value / invested - 1) * 100

    result.push({
      date: point.date,
      return: Math.round(ret * 100) / 100,
      value: Math.round(value * 100) / 100,
      invested: Math.round(invested * 100) / 100,
    })
  }

  return result
}

/**
 * Compute personal cumulative returns for the entire portfolio over time.
 *
 * Uses buildHoldingsTimeline() to reconstruct holdings at each date,
 * then computes total market value vs total invested capital.
 *
 * @param {Array} transactions - all portfolio transactions
 * @param {Object} historyData - { [ticker]: [{date, price}] }
 * @param {Array} tickers - ticker config objects from tickers.json
 * @param {boolean} logarithmic
 * @returns {Array<{date, return, value, invested}>}
 */
export function computePortfolioReturns(transactions, historyData, tickers, logarithmic = false) {
  if (!transactions || transactions.length === 0 || !historyData) return []

  const sortedTxns = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))
  const firstTxDate = new Date(sortedTxns[0].date).getTime()

  // Use the ticker with the most data points as reference for chart dates
  const everHeld = getEverHeldTickers(transactions).filter(t => historyData[t])
  if (everHeld.length === 0) return []

  let refTicker = everHeld[0]
  let maxLen = 0
  for (const t of everHeld) {
    if (historyData[t].length > maxLen) {
      maxLen = historyData[t].length
      refTicker = t
    }
  }

  const chartDates = historyData[refTicker]
    .filter(p => p.date >= firstTxDate)
    .map(p => p.date)

  if (chartDates.length === 0) return []

  // Reconstruct holdings at each date
  const holdingsTimeline = buildHoldingsTimeline(sortedTxns, chartDates)

  // Track per-ticker invested capital for accurate sell handling (average cost method)
  let txIdx = 0
  const perTickerInvested = {}
  const perTickerQty = {}
  const investedTimeline = []
  let cumulativeInvested = 0

  for (const dateMs of chartDates) {
    while (txIdx < sortedTxns.length) {
      const txDate = new Date(sortedTxns[txIdx].date).getTime()
      if (txDate > dateMs) break

      const tx = sortedTxns[txIdx]
      const t = tx.ticker

      if (tx.type === 'buy') {
        perTickerInvested[t] = (perTickerInvested[t] || 0) + tx.cost
        perTickerQty[t] = (perTickerQty[t] || 0) + tx.shares
        cumulativeInvested += tx.cost
      } else {
        // Sell at average cost
        const avgC = perTickerQty[t] > 0 ? perTickerInvested[t] / perTickerQty[t] : 0
        const sellCostBasis = avgC * tx.shares
        perTickerInvested[t] = Math.max(0, (perTickerInvested[t] || 0) - sellCostBasis)
        perTickerQty[t] = Math.max(0, (perTickerQty[t] || 0) - tx.shares)
        cumulativeInvested = Math.max(0, cumulativeInvested - sellCostBasis)
      }
      txIdx++
    }
    investedTimeline.push(cumulativeInvested)
  }

  // Compute portfolio value and return at each date
  const result = []

  for (let i = 0; i < chartDates.length; i++) {
    const dateMs = chartDates[i]
    const holdingsAtDate = holdingsTimeline.get(dateMs) || {}
    const invested = investedTimeline[i]

    if (invested <= 0) continue

    let totalValue = 0
    for (const t of everHeld) {
      const qty = holdingsAtDate[t] || 0
      if (qty === 0) continue
      const price = findClosestPrice(historyData[t], dateMs)
      if (price !== null) {
        totalValue += qty * price
      }
    }

    if (totalValue === 0) continue

    const ret = logarithmic
      ? Math.log(totalValue / invested) * 100
      : (totalValue / invested - 1) * 100

    result.push({
      date: dateMs,
      return: Math.round(ret * 100) / 100,
      value: Math.round(totalValue * 100) / 100,
      invested: Math.round(invested * 100) / 100,
    })
  }

  return result
}
