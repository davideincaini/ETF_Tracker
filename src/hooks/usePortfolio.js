import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_PREFIX = 'antigravity_portfolio'

function getStorageKey(portfolioId) {
  // Legacy key for backward compatibility with existing data
  if (!portfolioId || portfolioId === 'bilanciere') return STORAGE_PREFIX
  return `${STORAGE_PREFIX}_${portfolioId}`
}

function loadState(portfolioId) {
  try {
    const key = getStorageKey(portfolioId)
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        holdings: parsed.holdings || {},
        transactions: parsed.transactions || [],
        customThresholds: parsed.customThresholds || {}
      }
    }
  } catch { /* corrupted localStorage, use defaults */ }
  return { holdings: {}, transactions: [], customThresholds: {} }
}

export function usePortfolio(portfolioId = 'bilanciere') {
  const [state, setState] = useState(() => loadState(portfolioId))
  const currentPortfolioRef = useRef(portfolioId)

  // Reload state when portfolioId changes
  useEffect(() => {
    if (currentPortfolioRef.current !== portfolioId) {
      currentPortfolioRef.current = portfolioId
      setState(loadState(portfolioId))
    }
  }, [portfolioId])

  // Persist to localStorage
  useEffect(() => {
    const key = getStorageKey(portfolioId)
    localStorage.setItem(key, JSON.stringify(state))
  }, [state, portfolioId])

  const addTransactions = useCallback((buys) => {
    setState((prev) => {
      const holdings = { ...prev.holdings }
      const newTxns = buys.map((b) => {
        holdings[b.ticker] = (holdings[b.ticker] || 0) + b.shares
        return { ...b, type: 'buy', date: new Date().toISOString() }
      })
      return {
        ...prev,
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
        ...prev,
        holdings,
        transactions: [...prev.transactions, txn],
      }
    })
  }, [])

  const updateThreshold = useCallback((ticker, newThreshold) => {
    setState((prev) => {
      const customThresholds = { ...prev.customThresholds }
      customThresholds[ticker] = newThreshold
      return {
        ...prev,
        customThresholds
      }
    })
  }, [])

  const erasePortfolio = useCallback(() => {
    setState((prev) => ({
      holdings: {},
      transactions: [],
      customThresholds: { ...prev.customThresholds }
    }))
  }, [])

  // Get Vault definitions from tickers configuration
  const getVaultHoldings = useCallback((vaultId, allTickers) => {
    if (!vaultId) return state.holdings

    const vaultMap = {}
    allTickers.forEach(t => vaultMap[t.ticker] = t.vault)

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
    holdings: state.holdings || {},
    transactions: state.transactions || [],
    customThresholds: state.customThresholds || {},
    addTransactions,
    manualTrade,
    updateThreshold,
    erasePortfolio,
    getPortfolioValue,
    getWeights,
    getVaultHoldings,
  }
}
