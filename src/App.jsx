import { useState, useEffect, useMemo, useCallback } from 'react'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import PacPage from './pages/PacPage'
import RebalancePage from './pages/RebalancePage'
import PerformancePage from './pages/PerformancePage'
import MonteCarloPage from './pages/MonteCarloPage'
import { usePortfolio } from './hooks/usePortfolio'
import { fetchAllPrices, fetchAllHistory, clearPriceCache } from './utils/api'
import { calculatePerAssetATH } from './utils/rebalance'
import allTickers from './data/tickers.json'
import portfolios from './data/portfolios.json'
import { RefreshCw, Bell, Trash2, ChevronDown } from 'lucide-react'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [prices, setPrices] = useState({})
  const [priceMetadata, setPriceMetadata] = useState({})
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)
  const [resetPhase, setResetPhase] = useState(0)
  const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false)

  // Active portfolio — persisted in localStorage
  const [activePortfolioId, setActivePortfolioId] = useState(() => {
    try {
      return localStorage.getItem('antigravity_active_portfolio') || 'bilanciere'
    } catch { return 'bilanciere' }
  })

  // Persist active portfolio
  useEffect(() => {
    localStorage.setItem('antigravity_active_portfolio', activePortfolioId)
  }, [activePortfolioId])

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId) || portfolios[0]

  // Filter tickers by active portfolio
  const portfolioTickers = useMemo(() => {
    return allTickers.filter(t => t.portfolio === activePortfolioId)
  }, [activePortfolioId])

  const portfolio = usePortfolio(activePortfolioId)

  const augmentedTickers = useMemo(() => {
    return portfolioTickers.map(t => ({
      ...t,
      sell_threshold: portfolio.customThresholds[t.ticker] ?? t.sell_threshold
    }))
  }, [portfolioTickers, portfolio.customThresholds])

  // Asset ATH from price history
  const assetATH = useMemo(() => {
    return calculatePerAssetATH(history, prices)
  }, [history, prices])

  const loadPrices = useCallback(async (force = false) => {
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
  }, [augmentedTickers])

  const handleRangeChange = async (range) => {
    try {
      const h = await fetchAllHistory(augmentedTickers, range)
      setHistory(h)
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }

  const handleResetClick = () => {
    if (resetPhase === 0) setResetPhase(1)
    else if (resetPhase === 1) setResetPhase(2)
    else if (resetPhase === 2) {
      portfolio.erasePortfolio()
      setResetPhase(0)
      setTab('dashboard')
    }
  }

  // Load prices on mount and when portfolio changes
  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
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
  }, [activePortfolioId])

  // --- Data Export / Import Logic (PWA Resilience) ---
  const handleExportData = () => {
    const key = activePortfolioId === 'bilanciere' ? 'antigravity_portfolio' : `antigravity_portfolio_${activePortfolioId}`
    const dataStr = localStorage.getItem(key)
    if (!dataStr) return alert("Nessun dato da esportare.")

    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `etf_tracker_${activePortfolioId}_backup_${new Date().toISOString().split('T')[0]}.json`
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
        const parsed = JSON.parse(jsonStr)
        if (parsed && typeof parsed === 'object' && parsed.holdings && parsed.transactions) {
          const key = activePortfolioId === 'bilanciere' ? 'antigravity_portfolio' : `antigravity_portfolio_${activePortfolioId}`
          localStorage.setItem(key, jsonStr)
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

  const switchPortfolio = (id) => {
    setActivePortfolioId(id)
    setShowPortfolioDropdown(false)
    setResetPhase(0)
  }

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-[env(safe-area-inset-top)] py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: `linear-gradient(135deg, ${activePortfolio.color}, ${activePortfolio.color}dd)` }}
          >
            {activePortfolio.name.charAt(0)}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowPortfolioDropdown(!showPortfolioDropdown)}
              className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0"
            >
              <div>
                <p className="text-[11px] text-left" style={{ color: 'var(--text-secondary)' }}>{activePortfolio.description}</p>
                <p className="text-sm font-semibold text-left flex items-center gap-1">
                  {activePortfolio.name}
                  <ChevronDown size={14} color="var(--text-secondary)" />
                </p>
              </div>
            </button>

            {showPortfolioDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPortfolioDropdown(false)} />
                <div
                  className="absolute top-full left-0 mt-2 z-50 rounded-2xl overflow-hidden min-w-[200px]"
                  style={{ background: 'var(--card)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                >
                  {portfolios.map(p => (
                    <button
                      key={p.id}
                      onClick={() => switchPortfolio(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-none cursor-pointer transition-colors text-left"
                      style={{
                        background: p.id === activePortfolioId ? `${p.color}15` : 'transparent',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: p.color }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{p.description}</p>
                      </div>
                      {p.id === activePortfolioId && (
                        <span className="ml-auto text-xs font-bold" style={{ color: p.color }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
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
          assetATH={assetATH}
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
          portfolioId={activePortfolioId}
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
      {tab === 'performance' && (
        <PerformancePage
          tickers={augmentedTickers}
          transactions={portfolio.transactions}
          prices={prices}
        />
      )}
      {tab === 'settings' && (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
          <h1 className="text-lg font-bold mb-4">Settings</h1>

          <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              Data Backup (PWA Resilience)
            </p>
            <p className="text-[10px] mb-3 font-medium px-1" style={{ color: 'var(--text-secondary)' }}>
              Portfolio attivo: <strong style={{ color: activePortfolio.color }}>{activePortfolio.name}</strong>
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
              ETF Configurations — {activePortfolio.name}
            </p>
            {augmentedTickers.map((t) => (
              <div key={t.ticker} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ background: t.category === 'Cash' || t.category === 'Bond' ? '#5856D6' : t.category === 'Liquidity' ? '#007AFF' : t.category === 'Commodity' ? '#FF9500' : '#34C759' }}
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

          {/* DANGER ZONE */}
          <div className="mt-8 mb-6">
            <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: '#FF3B30' }}>
              Danger Zone
            </p>
            <div className="rounded-2xl p-4" style={{ background: '#fff0f0', border: '1px solid #FF3B30' }}>
              <div className="flex items-center gap-3 mb-3">
                <Trash2 size={20} color="#FF3B30" />
                <h3 className="text-sm font-bold text-[#D70015]">Azzeramento Portafoglio ({activePortfolio.name})</h3>
              </div>
              <p className="text-xs font-medium mb-4" style={{ color: '#FF3B30' }}>
                Questa operazione eliminerà permanentemente tutte le transazioni, le quantità e le soglie dal dispositivo. L'operazione non può essere annullata senza un backup.
              </p>

              <button
                onClick={handleResetClick}
                className="w-full py-3 rounded-xl border-none text-sm font-bold text-white cursor-pointer active:scale-95 transition-all"
                style={{
                  background: resetPhase === 0 ? '#FF3B30' : resetPhase === 1 ? '#D70015' : '#000000',
                  boxShadow: '0 2px 8px rgba(255,59,48,0.3)'
                }}
              >
                {resetPhase === 0 && 'Azzera Dati Portafoglio'}
                {resetPhase === 1 && 'Sei sicuro? Clicca di nuovo per confermare.'}
                {resetPhase === 2 && 'CONFERMA ELIMINAZIONE DEFINITIVA'}
              </button>

              {resetPhase > 0 && (
                <button
                  onClick={() => setResetPhase(0)}
                  className="w-full mt-2 py-2 text-xs font-bold bg-transparent border-none cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Annulla operazione
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav active={tab} onChange={setTab} />
    </>
  )
}
