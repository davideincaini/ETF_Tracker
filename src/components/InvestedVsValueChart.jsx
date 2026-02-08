import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { buildHoldingsTimeline, getEverHeldTickers } from '../utils/holdings'

export default function InvestedVsValueChart({ history, holdings, transactions }) {
  const historyTickers = Object.keys(history || {})
  if (historyTickers.length === 0 || !transactions || transactions.length === 0) return null

  // Use all tickers that were ever held (not just currently held)
  const everHeldTickers = getEverHeldTickers(transactions).filter((t) => history[t])
  if (everHeldTickers.length === 0) return null

  // Use first transaction date as start filter
  const firstTxDate = new Date(transactions[0].date).getTime()
  const refTicker = everHeldTickers[0]
  const refHistory = (history[refTicker] || []).filter((p) => p.date >= firstTxDate)
  if (refHistory.length < 2) return null

  // Helper: get day-only timestamp (midnight local)
  const toDay = (ts) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }

  // Compute cumulative invested at each transaction day
  let cumInvested = 0
  const investedByDay = []
  for (const tx of transactions) {
    cumInvested += tx.type === 'sell' ? -tx.cost : tx.cost
    investedByDay.push({ day: toDay(new Date(tx.date).getTime()), invested: Math.max(0, cumInvested) })
  }
  const finalInvested = investedByDay.length > 0 ? investedByDay[investedByDay.length - 1].invested : 0
  const firstTxDay = investedByDay.length > 0 ? investedByDay[0].day : Infinity

  // Build point-in-time holdings for each chart date
  const chartDates = refHistory.map((p) => p.date)
  const holdingsTimeline = buildHoldingsTimeline(transactions, chartDates)

  // For each history date, compute invested amount + portfolio value using actual holdings at that date
  const chartData = refHistory.map((point) => {
    const pointDay = toDay(point.date)
    const holdingsAtDate = holdingsTimeline.get(point.date) || {}

    // Portfolio value at this date using point-in-time holdings
    let value = 0
    for (const ticker of everHeldTickers) {
      const qty = holdingsAtDate[ticker] || 0
      if (qty === 0) continue
      const tickerHist = history[ticker] || []
      const match = tickerHist.reduce((prev, curr) =>
        Math.abs(curr.date - point.date) < Math.abs(prev.date - point.date) ? curr : prev
      , tickerHist[0])
      if (match) value += qty * match.price
    }

    // Invested at this date: find last transaction on or before this day
    let invested = 0
    if (pointDay >= firstTxDay) {
      invested = finalInvested
      for (let i = investedByDay.length - 1; i >= 0; i--) {
        if (investedByDay[i].day <= pointDay) {
          invested = investedByDay[i].invested
          break
        }
      }
    }

    return {
      date: new Date(point.date).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' }),
      value: Math.round(value * 100) / 100,
      invested: Math.round(invested * 100) / 100,
    }
  })

  const lastValue = chartData[chartData.length - 1]?.value || 0
  const lastInvested = chartData[chartData.length - 1]?.invested || 0
  const isUp = lastValue >= lastInvested

  return (
    <div
      className="rounded-3xl p-5 mb-4"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold">Invested vs Value</p>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: isUp ? '#e8f9ed' : '#FFE5E5',
            color: isUp ? '#1B7A33' : '#FF3B30',
          }}
        >
          {isUp ? '+' : ''}€{(lastValue - lastInvested).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#34C759' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Value €{lastValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#007AFF' }} />
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Invested €{lastInvested.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34C759" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#34C759" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007AFF" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#007AFF" stopOpacity={0} />
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
            formatter={(v, name) => [
              `€${v.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
              name === 'value' ? 'Value' : 'Invested',
            ]}
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
            stroke="#34C759"
            strokeWidth={2.5}
            fill="url(#valueGrad)"
          />
          <Area
            type="monotone"
            dataKey="invested"
            stroke="#007AFF"
            strokeWidth={2}
            strokeDasharray="6 3"
            fill="url(#investedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
