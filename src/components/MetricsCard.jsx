import { DollarSign, TrendingUp, TrendingDown, Target, BarChart3, Calendar, Scale } from 'lucide-react'
import { computeCostBasis } from '../utils/costBasis'

export default function MetricsCard({ tickers, holdings, prices, transactions, history, totalValue }) {
  if (totalValue === 0) return null

  const basis = computeCostBasis(transactions)
  const totalInvested = Object.values(basis).reduce((s, b) => s + Math.max(0, b.totalCost), 0)
  const totalPL = totalValue - totalInvested
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

  // Max drift from target
  const totalVal = totalValue
  let maxDrift = 0
  let maxDriftTicker = ''
  for (const t of tickers) {
    const actualWeight = holdings[t.ticker]
      ? (holdings[t.ticker] * (prices[t.ticker] || 0)) / totalVal
      : 0
    const drift = Math.abs(actualWeight - t.target_weight) * 100
    if (drift > maxDrift) {
      maxDrift = drift
      maxDriftTicker = t.ticker.replace('.MI', '')
    }
  }

  // Best and worst performer (by P/L %)
  let bestPerf = { ticker: '', pct: -Infinity }
  let worstPerf = { ticker: '', pct: Infinity }
  for (const t of tickers) {
    const qty = holdings[t.ticker] || 0
    if (qty === 0) continue
    const b = basis[t.ticker]
    if (!b || b.totalShares === 0) continue
    const avgCost = b.totalCost / b.totalShares
    const currentPrice = prices[t.ticker] || 0
    const pct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0
    if (pct > bestPerf.pct) bestPerf = { ticker: t.ticker.replace('.MI', ''), pct }
    if (pct < worstPerf.pct) worstPerf = { ticker: t.ticker.replace('.MI', ''), pct }
  }

  // Daily change from history
  let dailyChange = 0
  for (const t of tickers) {
    const qty = holdings[t.ticker] || 0
    if (qty === 0) continue
    const h = history?.[t.ticker]
    if (h && h.length >= 2) {
      const prev = h[h.length - 2].price
      const curr = h[h.length - 1].price
      dailyChange += qty * (curr - prev)
    }
  }

  // Number of ETFs held
  const etfsHeld = tickers.filter((t) => (holdings[t.ticker] || 0) > 0).length

  const metrics = [
    {
      label: 'Total Invested',
      value: `€${totalInvested.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: '#007AFF',
      bg: '#E3F2FD',
    },
    {
      label: 'Total P/L',
      value: `${totalPL >= 0 ? '+' : ''}€${totalPL.toFixed(2)}`,
      sub: `${totalPLPct >= 0 ? '+' : ''}${totalPLPct.toFixed(2)}%`,
      icon: totalPL >= 0 ? TrendingUp : TrendingDown,
      color: totalPL >= 0 ? '#34C759' : '#FF3B30',
      bg: totalPL >= 0 ? '#e8f9ed' : '#FFE5E5',
    },
    {
      label: 'Daily Change',
      value: `${dailyChange >= 0 ? '+' : ''}€${dailyChange.toFixed(2)}`,
      icon: Calendar,
      color: dailyChange >= 0 ? '#34C759' : '#FF3B30',
      bg: dailyChange >= 0 ? '#e8f9ed' : '#FFE5E5',
    },
    {
      label: 'Max Drift',
      value: `${maxDrift.toFixed(1)}%`,
      sub: maxDriftTicker,
      icon: Target,
      color: maxDrift > 5 ? '#FF9500' : '#34C759',
      bg: maxDrift > 5 ? '#FFF3E0' : '#e8f9ed',
    },
    {
      label: 'Best Performer',
      value: bestPerf.ticker || '—',
      sub: bestPerf.pct !== -Infinity ? `${bestPerf.pct >= 0 ? '+' : ''}${bestPerf.pct.toFixed(1)}%` : '',
      icon: TrendingUp,
      color: '#34C759',
      bg: '#e8f9ed',
    },
    {
      label: 'Worst Performer',
      value: worstPerf.ticker || '—',
      sub: worstPerf.pct !== Infinity ? `${worstPerf.pct >= 0 ? '+' : ''}${worstPerf.pct.toFixed(1)}%` : '',
      icon: TrendingDown,
      color: '#FF3B30',
      bg: '#FFE5E5',
    },
    {
      label: 'ETFs Held',
      value: `${etfsHeld} / ${tickers.length}`,
      icon: BarChart3,
      color: '#5856D6',
      bg: '#EDE7F6',
    },
    {
      label: 'Diversification',
      value: etfsHeld === tickers.length ? 'Full' : `${Math.round((etfsHeld / tickers.length) * 100)}%`,
      icon: Scale,
      color: '#AF52DE',
      bg: '#F3E5F5',
    },
  ]

  return (
    <div
      className="rounded-3xl p-5 mb-4"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <p className="text-sm font-bold mb-4">Key Metrics</p>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="flex items-start gap-2.5 p-3 rounded-2xl" style={{ background: m.bg }}>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: m.color + '20' }}
              >
                <Icon size={15} color={m.color} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
                <p className="text-sm font-bold truncate" style={{ color: m.color }}>{m.value}</p>
                {m.sub && (
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{m.sub}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
