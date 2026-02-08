import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { buildHoldingsTimeline, getEverHeldTickers } from '../utils/holdings'

const RANGES = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
]

export default function GrowthChart({ history, holdings, onRangeChange, transactions }) {
  const [activeRange, setActiveRange] = useState('6mo')

  // Build portfolio value over time from historical prices
  const historyTickers = Object.keys(history || {})
  if (historyTickers.length === 0 || Object.keys(holdings).length === 0) return null
  if (!transactions || transactions.length === 0) return null

  // Use all tickers that were ever held (not just currently held)
  const everHeldTickers = getEverHeldTickers(transactions).filter((t) => history[t])
  if (everHeldTickers.length === 0) return null

  // Use first transaction date as start
  const firstTxDate = new Date(transactions[0].date).getTime()
  const refTicker = everHeldTickers[0]
  const refHistory = (history[refTicker] || []).filter((p) => p.date >= firstTxDate)
  if (refHistory.length < 2) return null

  // Build point-in-time holdings for each chart date
  const chartDates = refHistory.map((p) => p.date)
  const holdingsTimeline = buildHoldingsTimeline(transactions, chartDates)

  const chartData = refHistory.map((point) => {
    const holdingsAtDate = holdingsTimeline.get(point.date) || {}
    let totalValue = 0
    for (const ticker of everHeldTickers) {
      const qty = holdingsAtDate[ticker] || 0
      if (qty === 0) continue
      const tickerHist = history[ticker] || []
      // Find closest date
      const match = tickerHist.reduce((prev, curr) =>
        Math.abs(curr.date - point.date) < Math.abs(prev.date - point.date) ? curr : prev
      , tickerHist[0])
      if (match) {
        totalValue += qty * match.price
      }
    }
    return {
      date: new Date(point.date).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
      value: Math.round(totalValue * 100) / 100,
    }
  })

  const firstVal = chartData[0]?.value || 0
  const lastVal = chartData[chartData.length - 1]?.value || 0
  const isUp = lastVal >= firstVal

  const handleRange = (range) => {
    setActiveRange(range)
    if (onRangeChange) onRangeChange(range)
  }

  return (
    <div
      className="rounded-3xl p-5 mb-4"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold">Portfolio Trend</p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRange(r.value)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer border-none"
              style={{
                background: activeRange === r.value ? (isUp ? '#34C759' : '#FF3B30') : 'transparent',
                color: activeRange === r.value ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? '#34C759' : '#FF3B30'} stopOpacity={0.25} />
              <stop offset="100%" stopColor={isUp ? '#34C759' : '#FF3B30'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#8E8E93' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8E8E93' }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v) => [`€${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Value']}
            contentStyle={{
              borderRadius: 12,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={isUp ? '#34C759' : '#FF3B30'}
            strokeWidth={2.5}
            fill="url(#portfolioGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
