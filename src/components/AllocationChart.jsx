import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState } from 'react'

const COLORS = ['#5856D6', '#34C759', '#FF9500', '#FF2D55', '#007AFF', '#AF52DE']
const VIEWS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'equity', label: 'Equity' },
  { id: 'target', label: 'vs Target' },
]

export default function AllocationChart({ tickers, weights, holdings }) {
  const [view, setView] = useState('portfolio')

  // Portfolio allocation: all ETFs
  const portfolioData = tickers
    .map((t, i) => {
      const pct = Math.round((weights[t.ticker] || 0) * 1000) / 10
      return {
        name: t.ticker.replace('.MI', ''),
        value: pct,
        color: COLORS[i % COLORS.length],
        category: t.category,
        qty: holdings?.[t.ticker] || 0,
      }
    })
    .filter((d) => d.value > 0)

  // Equity-only allocation: re-normalize equity ETFs to 100%
  const equityTickers = tickers.filter((t) => t.category === 'Equity')
  const equityTotal = equityTickers.reduce((s, t) => s + (weights[t.ticker] || 0), 0)
  const equityData = equityTickers
    .map((t) => {
      const idx = tickers.indexOf(t)
      const pct = equityTotal > 0
        ? Math.round(((weights[t.ticker] || 0) / equityTotal) * 1000) / 10
        : 0
      return {
        name: t.ticker.replace('.MI', ''),
        value: pct,
        color: COLORS[idx % COLORS.length],
        category: t.category,
        qty: holdings?.[t.ticker] || 0,
      }
    })
    .filter((d) => d.value > 0)

  // Target bar chart data
  const barData = tickers.map((t) => ({
    name: t.ticker.replace('.MI', ''),
    Actual: Math.round((weights[t.ticker] || 0) * 1000) / 10,
    Target: Math.round(t.target_weight * 1000) / 10,
  }))

  const pieData = view === 'portfolio' ? portfolioData : equityData
  const hasPieData = pieData.length > 0

  // Fallback targets for empty state
  const targetPortfolio = tickers.map((t, i) => ({
    name: t.ticker.replace('.MI', ''),
    value: Math.round(t.target_weight * 1000) / 10,
    color: COLORS[i % COLORS.length],
    category: t.category,
    qty: 0,
  }))
  const equityTargetTotal = tickers.filter((t) => t.category === 'Equity').reduce((s, t) => s + t.target_weight, 0)
  const targetEquity = tickers
    .filter((t) => t.category === 'Equity')
    .map((t) => {
      const idx = tickers.indexOf(t)
      return {
        name: t.ticker.replace('.MI', ''),
        value: Math.round((t.target_weight / equityTargetTotal) * 1000) / 10,
        color: COLORS[idx % COLORS.length],
        category: t.category,
        qty: 0,
      }
    })

  const displayPieData = hasPieData ? pieData : (view === 'portfolio' ? targetPortfolio : targetEquity)

  return (
    <div
      className="rounded-3xl p-5 mb-4"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold">Allocation</p>
        <div className="flex rounded-xl p-0.5" style={{ background: '#F0F0F0' }}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border-none cursor-pointer transition-all"
              style={{
                background: view === v.id ? 'var(--card)' : 'transparent',
                color: view === v.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: view === v.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'target' ? (
        /* Bar chart: Actual vs Target */
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} barGap={4} barSize={16}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#8E8E93' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#8E8E93' }}
              unit="%"
              domain={[0, 50]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => `${v}%`}
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: 12,
              }}
            />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Actual" fill="#34C759" radius={[6, 6, 6, 6]} />
            <Bar dataKey="Target" fill="#E5E5EA" radius={[6, 6, 6, 6]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        /* Pie charts: Portfolio or Equity */
        <>
          {!hasPieData && (
            <p className="text-[10px] text-center mb-2" style={{ color: 'var(--text-secondary)' }}>
              Showing target allocation
            </p>
          )}
          <div className="flex items-center gap-4">
            <div className="w-[140px] h-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {displayPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {displayPieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: entry.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{entry.name}</span>
                      <span className="text-xs font-bold">{entry.value}%</span>
                    </div>
                    {entry.qty > 0 && (
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {entry.qty} shares
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
