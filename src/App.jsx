import { useState, useEffect, useMemo } from 'react'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import PacPage from './pages/PacPage'
import RebalancePage from './pages/RebalancePage'
import MonteCarloPage from './pages/MonteCarloPage'
import { usePortfolio } from './hooks/usePortfolio'
import { fetchAllPrices, fetchAllHistory, clearPriceCache } from './utils/api'
import tickers from './data/tickers.json'
import { RefreshCw, Bell } from 'lucide-react'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [prices, setPrices] = useState({})
  const [priceMetadata, setPriceMetadata] = useState({})
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)
  const portfolio = usePortfolio()

  const augmentedTickers = useMemo(() => {
    return tickers.map(t => ({
      ...t,
      sell_threshold: portfolio.customThresholds[t.ticker] ?? t.sell_threshold
    }))
  }, [portfolio.customThresholds])

  const loadPrices = async (force = false) => {
    setLoading(true)
    if (force) clearPriceCache()
    try {
      const [priceData, h] = await Promise.all([
        fetchAllPrices(augmentedTickers),
        fetchAllHistory(augmentedTickers, '6mo'),
      ])
      setPrices(priceData.prices)
      setPriceMetadata(priceData.metadata)
      setHistory(h)
    } catch (e) {
      console.error('Failed to load prices', e)
    }
    setLoading(false)
  }

  const handleRangeChange = async (range) => {
    try {
      const h = await fetchAllHistory(augmentedTickers, range)
      setHistory(h)
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const [priceData, h] = await Promise.all([
          fetchAllPrices(augmentedTickers),
          fetchAllHistory(augmentedTickers, '6mo'),
        ])
        if (!cancelled) {
          setPrices(priceData.prices)
          setPriceMetadata(priceData.metadata)
          setHistory(h)
        }
      } catch (e) {
        console.error('Failed to load prices', e)
      }
      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [])

  // --- Data Export / Import Logic (PWA Resilience) ---
  const handleExportData = () => {
    const dataStr = localStorage.getItem('antigravity_portfolio')
    if (!dataStr) return alert("Nessun dato da esportare.")

    // Create a blob and download link
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `etf_tracker_backup_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportData = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const jsonStr = event.target.result
        // Validate JSON basically
        const parsed = JSON.parse(jsonStr)
        if (parsed && typeof parsed === 'object' && parsed.holdings && parsed.transactions) {
          localStorage.setItem('antigravity_portfolio', jsonStr)
          alert("Dati importati con successo! Ricarico l'applicazione...")
          window.location.reload()
        } else {
          alert("File JSON non valido o corrotto.")
        }
      } catch (err) {
        alert("Errore durante l'importazione: " + err.message)
      }
    }
    reader.readAsText(file)
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-[env(safe-area-inset-top)] py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #34C759, #30B350)' }}
          >
            A
          </div>
          <div>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Welcome back</p>
            <p className="text-sm font-semibold">My Portfolio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPrices(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center border-none cursor-pointer"
            style={{ background: 'var(--card)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            title="Refresh prices"
          >
            <RefreshCw size={16} color="var(--text-secondary)" className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center border-none cursor-pointer"
            style={{ background: 'var(--card)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <Bell size={16} color="var(--text-secondary)" />
          </button>
        </div>
      </header>

      {/* Pages */}
      {tab === 'dashboard' && (
        <Dashboard
          tickers={augmentedTickers}
          holdings={portfolio.holdings}
          transactions={portfolio.transactions}
          prices={prices}
          loading={loading}
          getPortfolioValue={portfolio.getPortfolioValue}
          getWeights={portfolio.getWeights}
          history={history}
          onRangeChange={handleRangeChange}
          priceMetadata={priceMetadata}
        />
      )}
      {tab === 'pac' && (
        <PacPage
          tickers={augmentedTickers}
          holdings={portfolio.holdings}
          prices={prices}
          onConfirm={portfolio.addTransactions}
          onManualTrade={portfolio.manualTrade}
          loading={loading}
        />
      )}
      {tab === 'rebalance' && (
        <RebalancePage
          tickers={augmentedTickers}
          holdings={portfolio.holdings}
          prices={prices}
          getPortfolioValue={portfolio.getPortfolioValue}
          getWeights={portfolio.getWeights}
          updateThreshold={portfolio.updateThreshold}
        />
      )}
      {tab === 'simulator' && (
        <MonteCarloPage
          tickers={augmentedTickers}
          holdings={portfolio.holdings}
          prices={prices}
          getPortfolioValue={portfolio.getPortfolioValue}
          getWeights={portfolio.getWeights}
        />
      )}
      {tab === 'settings' && (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
          <h1 className="text-lg font-bold mb-4">Settings</h1>

          <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              Data Backup (PWA Resilience)
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExportData}
                className="w-full py-3 rounded-xl border border-gray-200 text-sm font-bold bg-white text-[#007AFF] text-center cursor-pointer active:scale-95 transition-transform"
              >
                Esporta Dati (Backup JSON)
              </button>

              <label
                className="w-full py-3 rounded-xl border border-gray-200 text-sm font-bold bg-white text-[#34C759] cursor-pointer text-center block active:scale-95 transition-transform"
              >
                Importa Dati (Ripristino)
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportData}
                />
              </label>
              <p className="text-[10px] text-center mt-1" style={{ color: 'var(--text-secondary)' }}>
                Safari iOS potrebbe cancellare i dati inattivi. Salva spesso un backup del tuo storico.
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              ETF Configurations
            </p>
            {augmentedTickers.map((t) => (
              <div key={t.ticker} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ background: t.category === 'Bond' ? '#5856D6' : t.category === 'Liquidity' ? '#007AFF' : '#34C759' }}
                >
                  {t.ticker.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {t.ticker} · {t.vault ? `Vault ${t.vault}` : 'Cat'}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  {t.target_weight > 0 ? `${(t.target_weight * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomNav active={tab} onChange={setTab} />
    </>
  )
}
