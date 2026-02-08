/**
 * Reconstruct holdings at each historical date from the transaction log.
 * Returns a Map<timestamp_ms, { [ticker]: qty }> for efficient lookup.
 *
 * Since chart points and transactions are both chronological, we walk through
 * them together in O(n + m) time instead of scanning all transactions per point.
 *
 * @param {Array} transactions - sorted chronologically: { ticker, shares, type, date }
 * @param {Array} dates - sorted timestamps (ms) for which we need holdings
 * @returns {Map<number, Object>} map from date timestamp to holdings object
 */
export function buildHoldingsTimeline(transactions, dates) {
  const result = new Map()
  const holdings = {}
  let txIdx = 0

  for (const dateMs of dates) {
    // Replay all transactions up to and including this date
    while (txIdx < transactions.length) {
      const txDate = new Date(transactions[txIdx].date).getTime()
      if (txDate > dateMs) break
      const tx = transactions[txIdx]
      const prev = holdings[tx.ticker] || 0
      holdings[tx.ticker] = tx.type === 'buy'
        ? prev + tx.shares
        : Math.max(0, prev - tx.shares)
      txIdx++
    }
    // Snapshot current holdings at this date
    result.set(dateMs, { ...holdings })
  }

  return result
}

/**
 * Get the list of all tickers that were ever held (appear in any transaction).
 * @param {Array} transactions
 * @returns {string[]}
 */
export function getEverHeldTickers(transactions) {
  const set = new Set()
  for (const tx of transactions) {
    if (tx.type === 'buy') set.add(tx.ticker)
  }
  return [...set]
}
