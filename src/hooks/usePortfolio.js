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

  const getPortfolioValue = useCallback(
    (prices) =>
      Object.entries(state.holdings).reduce(
        (sum, [ticker, qty]) => sum + qty * (prices[ticker] || 0),
        0
      ),
    [state.holdings]
  )

  const getWeights = useCallback(
    (prices) => {
      const total = getPortfolioValue(prices)
      if (total === 0) return {}
      const w = {}
      for (const [ticker, qty] of Object.entries(state.holdings)) {
        w[ticker] = (qty * (prices[ticker] || 0)) / total
      }
      return w
    },
    [state.holdings, getPortfolioValue]
  )

  return {
    holdings: state.holdings,
    transactions: state.transactions,
    addTransactions,
    manualTrade,
    getPortfolioValue,
    getWeights,
  }
}
