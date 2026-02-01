import Sparkline from './Sparkline'

const COLORS = ['#5856D6', '#34C759', '#FF9500', '#FF2D55', '#007AFF', '#AF52DE']

export default function HoldingsList({ tickers, holdings, prices, weights, history, onSelect }) {
  const hasHoldings = Object.values(holdings).some((q) => q > 0)

  return (
    <div
      className="rounded-3xl p-5 mb-4"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold">Overview</p>
        {hasHoldings && (
          <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
            Tap for detail
          </span>
        )}
      </div>

      {!hasHoldings ? (
        <div className="py-6 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--accent-light)' }}
          >
            <span className="text-lg">📊</span>
          </div>
          <p className="text-sm font-medium mb-1">No holdings yet</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Use the PAC tab to start investing
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {tickers.map((t, i) => {
            const qty = holdings[t.ticker] || 0
            if (qty === 0) return null
            const price = prices[t.ticker] || 0
            const value = qty * price
            const weight = weights[t.ticker] || 0
            const color = COLORS[i % COLORS.length]
            const sparkData = history ? history[t.ticker] : null

            return (
              <button
                key={t.ticker}
                onClick={() => onSelect && onSelect(t.ticker)}
                className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-b-0 bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer text-left w-full"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: color }}
                >
                  {t.ticker.replace('.MI', '').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.ticker.replace('.MI', '')}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {qty} shares
                  </p>
                </div>
                {sparkData && sparkData.length > 1 && (
                  <Sparkline data={sparkData.slice(-30)} width={50} height={24} />
                )}
                <div className="text-right min-w-[70px]">
                  <p className="text-sm font-bold">€{value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {(weight * 100).toFixed(1)}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
