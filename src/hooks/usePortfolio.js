import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'antigravity_portfolio'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted localStorage, use defaults */ }
  return { holdings: {}, transactions: [] }
}

export function usePortfolio() {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const addTransactions = useCallback((buys) => {
    setState((prev) => {
      const holdings = { ...prev.holdings }
      const newTxns = buys.map((b) => {
        holdings[b.ticker] = (holdings[b.ticker] || 0) + b.shares
        return { ...b, type: 'buy', date: new Date().toISOString() }
      })
      return {
        holdings,
        transactions: [...prev.transactions, ...newTxns],
      }
    })
  }, [])

  const manualTrade = useCallback((ticker, name, shares, price, type) => {
    setState((prev) => {
      const holdings = { ...prev.holdings }
      const currentQty = holdings[ticker] || 0

      if (type === 'sell' && shares > currentQty) return prev

      holdings[ticker] = type === 'buy'
        ? currentQty + shares
        : currentQty - shares

      if (holdings[ticker] === 0) delete holdings[ticker]

      const cost = shares * price
      const txn = { ticker, name, shares, cost, type, date: new Date().toISOString() }

      return {
        holdings,
        transactions: [...prev.transactions, txn],
      }
    })
  }, [])

  // Get Vault definitions from tickers configuration
  const getVaultHoldings = useCallback((vaultId, allTickers) => {
    if (!vaultId) return state.holdings

    // Create a map of ticker -> vault for fast lookup
    const vaultMap = {}
    allTickers.forEach(t => vaultMap[t.ticker] = t.vault)

    // Filter holdings by vault
    const filtered = {}
    for (const [ticker, qty] of Object.entries(state.holdings)) {
      if (vaultMap[ticker] === vaultId) {
        filtered[ticker] = qty
      }
    }
    return filtered
  }, [state.holdings])

  const getPortfolioValue = useCallback(
    (prices, vaultId = null, allTickers = []) => {
      const activeHoldings = vaultId ? getVaultHoldings(vaultId, allTickers) : state.holdings

      return Object.entries(activeHoldings).reduce(
        (sum, [ticker, qty]) => sum + qty * (prices[ticker] || 0),
        0
      )
    },
    [state.holdings, getVaultHoldings]
  )

  const getWeights = useCallback(
    (prices, vaultId = null, allTickers = []) => {
      const total = getPortfolioValue(prices, vaultId, allTickers)
      if (total === 0) return {}

      const activeHoldings = vaultId ? getVaultHoldings(vaultId, allTickers) : state.holdings
      const w = {}

      for (const [ticker, qty] of Object.entries(activeHoldings)) {
        w[ticker] = (qty * (prices[ticker] || 0)) / total
      }
      return w
    },
    [state.holdings, getPortfolioValue, getVaultHoldings]
  )

  return {
    holdings: state.holdings,
    transactions: state.transactions,
    addTransactions,
    manualTrade,
    getPortfolioValue,
    getWeights,
    getVaultHoldings,
  }
}
