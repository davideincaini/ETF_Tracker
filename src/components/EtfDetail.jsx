import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { computeCostBasis } from './MetricsCard'

export default function EtfDetail({ ticker, name, history, holdings, price, color, onClose, transactions, targetWeight, totalValue }) {
  const qty = holdings[ticker] || 0
  const points = history?.[ticker] || []

  const chartData = points.map((p) => ({
    date: new Date(p.date).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
    price: Math.round(p.price * 100) / 100,
  }))

  const firstPrice = chartData[0]?.price || 0
  const lastPrice = chartData[chartData.length - 1]?.price || 0
  const change6m = lastPrice - firstPrice
  const change6mPct = firstPrice > 0 ? (change6m / firstPrice) * 100 : 0
  const isUp6m = change6m >= 0

  // Cost basis
  const basis = transactions ? computeCostBasis(transactions) : {}
  const etfBasis = basis[ticker] || { totalCost: 0, totalShares: 0 }
  const avgCost = etfBasis.totalShares > 0 ? etfBasis.totalCost / etfBasis.totalShares : 0
  const currentValue = qty * price
  const costBasisTotal = qty * avgCost
  const pl = currentValue - costBasisTotal
  const plPct = costBasisTotal > 0 ? (pl / costBasisTotal) * 100 : 0
  const isUpPL = pl >= 0

  // Weight & drift
  const actualWeight = totalValue > 0 ? currentValue / totalValue : 0
  const drift = targetWeight != null ? (actualWeight - targetWeight) * 100 : 0

  // Daily change
  let dailyChange = 0
  let dailyChangePct = 0
  if (points.length >= 2) {
    const prev = points[points.length - 2].price
    dailyChange = price - prev
    dailyChangePct = prev > 0 ? (dailyChange / prev) * 100 : 0
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] rounded-t-3xl p-5 pb-8 overflow-y-auto"
        style={{ background: 'var(--card)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: color }}
            >
              {ticker.replace('.MI', '').slice(0, 2)}
            </div>
            <div>
              <p className="text-base font-bold">{ticker.replace('.MI', '')}</p>
              <p className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer"
            style={{ background: '#F0F0F0' }}
          >
            <X size={16} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Price + 6M change */}
        <div className="mb-4">
          <p className="text-2xl font-extrabold">€{price.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: isUp6m ? '#e8f9ed' : '#FFE5E5',
                color: isUp6m ? '#1B7A33' : '#FF3B30',
              }}
            >
              {isUp6m ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {change6mPct >= 0 ? '+' : ''}{change6mPct.toFixed(1)}% · 6M
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: dailyChange >= 0 ? '#e8f9ed' : '#FFE5E5',
                color: dailyChange >= 0 ? '#1B7A33' : '#FF3B30',
              }}
            >
              {dailyChange >= 0 ? '+' : ''}{dailyChangePct.toFixed(2)}% today
            </span>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 1 && (
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isUp6m ? '#34C759' : '#FF3B30'} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={isUp6m ? '#34C759' : '#FF3B30'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#8E8E93' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#8E8E93' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(v) => [`€${v}`, 'Price']}
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isUp6m ? '#34C759' : '#FF3B30'}
                  strokeWidth={2.5}
                  fill={`url(#grad-${ticker})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Metrics grid */}
        {qty > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Shares</p>
              <p className="text-sm font-bold">{qty}</p>
            </div>
            <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Current Value</p>
              <p className="text-sm font-bold">€{currentValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Avg Cost</p>
              <p className="text-sm font-bold">€{avgCost.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-2xl" style={{ background: isUpPL ? '#e8f9ed' : '#FFE5E5' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>P/L</p>
              <p className="text-sm font-bold" style={{ color: isUpPL ? '#1B7A33' : '#FF3B30' }}>
                {pl >= 0 ? '+' : ''}€{pl.toFixed(2)} ({plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%)
              </p>
            </div>
            <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Weight</p>
              <p className="text-sm font-bold">{(actualWeight * 100).toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-2xl" style={{ background: Math.abs(drift) > 5 ? '#FFF3E0' : 'var(--bg)' }}>
              <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Drift from Target
              </p>
              <p className="text-sm font-bold" style={{ color: Math.abs(drift) > 5 ? '#FF9500' : 'var(--text-primary)' }}>
                {drift >= 0 ? '+' : ''}{drift.toFixed(1)}%
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                Target: {((targetWeight || 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
