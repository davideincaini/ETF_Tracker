/**
 * Compute per-ETF cost basis from transactions.
 * Uses average cost method: total cost of buys / total shares bought,
 * adjusted for sells (reduces qty but not avg cost).
 */
export function computeCostBasis(transactions) {
  const basis = {} // { ticker: { totalCost, totalShares } }
  for (const tx of transactions) {
    if (!basis[tx.ticker]) basis[tx.ticker] = { totalCost: 0, totalShares: 0 }
    if (tx.type === 'sell') {
      // reduce shares at avg cost
      const avg = basis[tx.ticker].totalShares > 0
        ? basis[tx.ticker].totalCost / basis[tx.ticker].totalShares
        : 0
      basis[tx.ticker].totalShares -= tx.shares
      basis[tx.ticker].totalCost -= avg * tx.shares
    } else {
      basis[tx.ticker].totalCost += tx.cost
      basis[tx.ticker].totalShares += tx.shares
    }
  }
  return basis
}
