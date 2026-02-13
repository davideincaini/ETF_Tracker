import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react'

export default function PerformanceOverview({ totalValue, invested }) {
  const gain = totalValue - invested
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0
  const isPositive = gain >= 0

  if (invested === 0) return null

  return (
    <div
      className="rounded-3xl p-5 mb-5"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <p className="text-sm font-bold mb-4">Performance Overview</p>

      {/* Visual bars comparison */}
      <div className="space-y-3 mb-4">
        {/* Invested bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <PiggyBank size={14} color="#007AFF" />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Invested
              </span>
            </div>
            <span className="text-sm font-bold">
              €{invested.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full" style={{ background: '#E5E5EA' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: '#007AFF',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Current value bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Wallet size={14} color="#34C759" />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Current Value
              </span>
            </div>
            <span className="text-sm font-bold">
              €{totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full" style={{ background: '#E5E5EA' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: isPositive ? '#34C759' : '#FF3B30',
                width: `${Math.min(100, (totalValue / Math.max(invested, totalValue)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Gain/Loss summary */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{
          background: isPositive ? '#e8f9ed' : '#FFE5E5',
        }}
      >
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUp size={20} color="#1B7A33" />
          ) : (
            <TrendingDown size={20} color="#FF3B30" />
          )}
          <div>
            <p className="text-xs font-medium" style={{ color: isPositive ? '#1B7A33' : '#FF3B30' }}>
              {isPositive ? 'Total Gain' : 'Total Loss'}
            </p>
            <p className="text-lg font-bold" style={{ color: isPositive ? '#1B7A33' : '#FF3B30' }}>
              {isPositive ? '+' : ''}€{gain.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium" style={{ color: isPositive ? '#1B7A33' : '#FF3B30' }}>
            Return
          </p>
          <p className="text-2xl font-extrabold" style={{ color: isPositive ? '#1B7A33' : '#FF3B30' }}>
            {isPositive ? '+' : ''}{gainPct.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  )
}
