import { useState, useEffect } from 'react'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import PacPage from './pages/PacPage'
import { usePortfolio } from './hooks/usePortfolio'
import { fetchAllPrices, fetchAllHistory, clearPriceCache } from './utils/api'
import tickers from './data/tickers.json'
import { RefreshCw, Bell } from 'lucide-react'

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [prices, setPrices] = useState({})
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)
  const portfolio = usePortfolio()

  const loadPrices = async (force = false) => {
    setLoading(true)
    if (force) clearPriceCache()
    try {
      const [p, h] = await Promise.all([
        fetchAllPrices(tickers),
        fetchAllHistory(tickers, '6mo'),
      ])
      setPrices(p)
      setHistory(h)
    } catch (e) {
      console.error('Failed to load prices', e)
    }
    setLoading(false)
  }

  const handleRangeChange = async (range) => {
    try {
      const h = await fetchAllHistory(tickers, range)
      setHistory(h)
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }

  useEffect(() => {
    loadPrices()
  }, [])

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
          tickers={tickers}
          holdings={portfolio.holdings}
          transactions={portfolio.transactions}
          prices={prices}
          loading={loading}
          getPortfolioValue={portfolio.getPortfolioValue}
          getWeights={portfolio.getWeights}
          history={history}
          onRangeChange={handleRangeChange}
        />
      )}
      {tab === 'pac' && (
        <PacPage
          tickers={tickers}
          holdings={portfolio.holdings}
          prices={prices}
          cashResiduo={portfolio.cashResiduo}
          onConfirm={portfolio.addTransactions}
          onManualTrade={portfolio.manualTrade}
          loading={loading}
        />
      )}
      {tab === 'settings' && (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
          <h1 className="text-lg font-bold mb-4">Settings</h1>
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              ETF Targets
            </p>
            {tickers.map((t) => (
              <div key={t.ticker} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ background: t.category === 'Bond' ? '#5856D6' : '#34C759' }}
                >
                  {t.ticker.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {t.ticker} · {t.category}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  {(t.target_weight * 100).toFixed(0)}%
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
