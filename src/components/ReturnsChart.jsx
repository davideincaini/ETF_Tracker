import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { computeAssetReturns, computePortfolioReturns } from '../utils/returns'
import { getEverHeldTickers } from '../utils/holdings'

const RANGES = [
  { label: '1M', ms: 30 * 86400000 },
  { label: '3M', ms: 90 * 86400000 },
  { label: '6M', ms: 180 * 86400000 },
  { label: '1Y', ms: 365 * 86400000 },
  { label: '2Y', ms: 2 * 365 * 86400000 },
  { label: '3Y', ms: 3 * 365 * 86400000 },
  { label: '5Y', ms: 5 * 365 * 86400000 },
  { label: '10Y', ms: 10 * 365 * 86400000 },
  { label: 'MAX', ms: 0 },
]

const ASSET_COLORS = [
  '#34C759', // green
  '#007AFF', // blue
  '#FF9500', // orange
  '#5856D6', // purple
  '#FF3B30', // red
  '#AF52DE', // magenta
  '#00C7BE', // teal
  '#FF2D55', // pink
]

function cleanTicker(ticker) {
  return ticker.replace('.MI', '').replace('.PA', '').replace('.L', '')
}

export default function ReturnsChart({ historyData, transactions, tickers }) {
  const [activeRange, setActiveRange] = useState('MAX')
  const [logarithmic, setLogarithmic] = useState(false)
  const [visibleLines, setVisibleLines] = useState(() => {
    const set = new Set(['portfolio'])
    return set
  })

  // Get tickers that have transactions
  const assetTickers = useMemo(() => {
    if (!transactions || transactions.length === 0) return []
    return getEverHeldTickers(transactions).filter(t => historyData && historyData[t])
  }, [transactions, historyData])

  // Initialize visible lines with all assets on first render
  useMemo(() => {
    if (assetTickers.length > 0 && visibleLines.size === 1 && visibleLines.has('portfolio')) {
      const newSet = new Set(['portfolio', ...assetTickers])
      setVisibleLines(newSet)
    }
  }, [assetTickers])

  // Compute individual asset returns
  const assetReturns = useMemo(() => {
    if (!historyData || assetTickers.length === 0) return {}
    const result = {}
    for (const ticker of assetTickers) {
      result[ticker] = computeAssetReturns(ticker, transactions, historyData[ticker], logarithmic)
    }
    return result
  }, [historyData, transactions, assetTickers, logarithmic])

  // Compute portfolio returns
  const portfolioReturns = useMemo(() => {
    if (!historyData || !transactions || transactions.length === 0) return []
    return computePortfolioReturns(transactions, historyData, tickers, logarithmic)
  }, [historyData, transactions, tickers, logarithmic])

  // Merge all data into a unified timeline and filter by range
  const chartData = useMemo(() => {
    // Collect all unique dates
    const dateSet = new Set()
    if (visibleLines.has('portfolio')) {
      portfolioReturns.forEach(p => dateSet.add(p.date))
    }
    for (const ticker of assetTickers) {
      if (visibleLines.has(ticker) && assetReturns[ticker]) {
        assetReturns[ticker].forEach(p => dateSet.add(p.date))
      }
    }

    let dates = [...dateSet].sort((a, b) => a - b)

    // Apply range filter
    if (activeRange !== 'MAX' && dates.length > 0) {
      const rangeObj = RANGES.find(r => r.label === activeRange)
      if (rangeObj) {
        const cutoff = Date.now() - rangeObj.ms
        dates = dates.filter(d => d >= cutoff)
      }
    }

    if (dates.length === 0) return []

    // Build lookup maps for fast access
    const portfolioMap = new Map(portfolioReturns.map(p => [p.date, p]))
    const assetMaps = {}
    for (const ticker of assetTickers) {
      if (assetReturns[ticker]) {
        assetMaps[ticker] = new Map(assetReturns[ticker].map(p => [p.date, p]))
      }
    }

    // Merge into chart-friendly format
    return dates.map(date => {
      const point = {
        date,
        dateLabel: new Date(date).toLocaleDateString('it-IT', { month: 'short', day: 'numeric', year: '2-digit' }),
      }

      if (visibleLines.has('portfolio')) {
        const p = portfolioMap.get(date)
        if (p) point.portfolio = p.return
        // Store value/invested for tooltip
        if (p) {
          point._portfolioValue = p.value
          point._portfolioInvested = p.invested
        }
      }

      for (const ticker of assetTickers) {
        if (visibleLines.has(ticker) && assetMaps[ticker]) {
          const p = assetMaps[ticker].get(date)
          if (p) {
            point[ticker] = p.return
            point[`_${ticker}Value`] = p.value
            point[`_${ticker}Invested`] = p.invested
          }
        }
      }

      return point
    })
  }, [assetReturns, portfolioReturns, assetTickers, visibleLines, activeRange])

  const toggleLine = (key) => {
    setVisibleLines(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!historyData || assetTickers.length === 0) return null

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div style={{
        background: 'var(--card, #fff)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        fontSize: 11,
        lineHeight: 1.6,
      }}>
        <p style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #1C1C1E)' }}>{label}</p>
        {payload.map(entry => {
          const key = entry.dataKey
          const isPortfolio = key === 'portfolio'
          const displayName = isPortfolio ? 'Portafoglio' : cleanTicker(key)

          // Get value/invested from the data point
          const point = entry.payload
          const valueKey = isPortfolio ? '_portfolioValue' : `_${key}Value`
          const investedKey = isPortfolio ? '_portfolioInvested' : `_${key}Invested`
          const value = point[valueKey]
          const invested = point[investedKey]

          return (
            <div key={key} style={{ marginBottom: 2 }}>
              <span style={{ color: entry.color, fontWeight: 600 }}>
                {displayName}: {entry.value > 0 ? '+' : ''}{entry.value?.toFixed(2)}%
              </span>
              {value != null && invested != null && (
                <span style={{ color: '#8E8E93', marginLeft: 6, fontSize: 10 }}>
                  (€{value.toLocaleString('it-IT', { maximumFractionDigits: 0 })} / €{invested.toLocaleString('it-IT', { maximumFractionDigits: 0 })})
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="rounded-3xl p-5 mb-5"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold">Rendimenti Personali</p>
        {/* Lin/Log toggle */}
        <div
          className="flex rounded-full overflow-hidden"
          style={{ border: '1px solid #E5E5EA', fontSize: 10 }}
        >
          <button
            onClick={() => setLogarithmic(false)}
            className="px-2.5 py-1 font-semibold border-none cursor-pointer"
            style={{
              background: !logarithmic ? '#1C1C1E' : 'transparent',
              color: !logarithmic ? '#fff' : '#8E8E93',
            }}
          >
            Lin
          </button>
          <button
            onClick={() => setLogarithmic(true)}
            className="px-2.5 py-1 font-semibold border-none cursor-pointer"
            style={{
              background: logarithmic ? '#1C1C1E' : 'transparent',
              color: logarithmic ? '#fff' : '#8E8E93',
            }}
          >
            Log
          </button>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {RANGES.map(r => (
          <button
            key={r.label}
            onClick={() => setActiveRange(r.label)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer border-none"
            style={{
              background: activeRange === r.label ? '#1C1C1E' : 'transparent',
              color: activeRange === r.label ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 9, fill: '#8E8E93' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#8E8E93' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#E5E5EA" strokeWidth={1} />

            {/* Portfolio line */}
            {visibleLines.has('portfolio') && (
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="#1C1C1E"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
              />
            )}

            {/* Asset lines */}
            {assetTickers.map((ticker, i) =>
              visibleLines.has(ticker) ? (
                <Line
                  key={ticker}
                  type="monotone"
                  dataKey={ticker}
                  stroke={ASSET_COLORS[i % ASSET_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              ) : null
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-32 text-xs text-gray-400">
          Nessun dato per il periodo selezionato
        </div>
      )}

      {/* Toggle chips */}
      <div className="flex gap-1.5 mt-3 flex-wrap">
        <button
          onClick={() => toggleLine('portfolio')}
          className="text-[10px] font-semibold px-3 py-1.5 rounded-full cursor-pointer border-none"
          style={{
            background: visibleLines.has('portfolio') ? '#1C1C1E' : '#F2F2F7',
            color: visibleLines.has('portfolio') ? '#fff' : '#8E8E93',
          }}
        >
          Portafoglio
        </button>
        {assetTickers.map((ticker, i) => (
          <button
            key={ticker}
            onClick={() => toggleLine(ticker)}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-full cursor-pointer border-none"
            style={{
              background: visibleLines.has(ticker) ? ASSET_COLORS[i % ASSET_COLORS.length] : '#F2F2F7',
              color: visibleLines.has(ticker) ? '#fff' : '#8E8E93',
            }}
          >
            {cleanTicker(ticker)}
          </button>
        ))}
      </div>
    </div>
  )
}
