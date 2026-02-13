import { TrendingUp, TrendingDown, Eye } from 'lucide-react'

export default function PortfolioCard({ totalValue, invested, loading, priceMetadata = {}, prices = {} }) {
  const pl = totalValue - invested
  const plPct = invested > 0 ? (pl / invested) * 100 : 0
  const isUp = pl >= 0

  // Check if any prices are stale or unavailable
  const stalePrices = Object.values(priceMetadata).filter(m => m?.stale).length
  const unavailablePrices = Object.entries(prices).filter(([_, p]) => !p || p === 0).length

  return (
    <div
      className="rounded-3xl p-6 mb-5"
      style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Total Balance
        </p>
        <Eye size={16} color="var(--text-secondary)" />
      </div>
      {loading ? (
        <div className="h-10 w-48 rounded-xl bg-gray-100 animate-pulse" />
      ) : (
        <p className="text-[36px] font-extrabold tracking-tight leading-tight">
          €{totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      )}
      {!loading && invested > 0 ? (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: isUp ? '#e8f9ed' : '#FFE5E5',
              color: isUp ? '#1B7A33' : '#FF3B30',
            }}
          >
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isUp ? '+' : ''}{plPct.toFixed(1)}%
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {isUp ? '+' : ''}€{pl.toFixed(2)}
          </span>
          {(stalePrices > 0 || unavailablePrices > 0) && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FFF3CD', color: '#856404' }}>
              {unavailablePrices > 0 ? `${unavailablePrices} price${unavailablePrices > 1 ? 's' : ''} unavailable` : `${stalePrices} cached`}
            </span>
          )}
        </div>
      ) : !loading ? (
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          Start investing to track your returns
        </p>
      ) : null}
    </div>
  )
}
