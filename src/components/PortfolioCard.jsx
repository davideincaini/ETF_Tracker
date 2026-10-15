import { TrendingUp, TrendingDown, Eye } from 'lucide-react'
import { summarizePriceStatus, formatPriceDate } from '../utils/priceStatus'

export default function PortfolioCard({ totalValue, invested, loading, priceMetadata = {} }) {
  const pl = totalValue - invested
  const plPct = invested > 0 ? (pl / invested) * 100 : 0
  const isUp = pl >= 0

  // Count problems from the metadata, not from `prices`: a missing price is now
  // ABSENT from `prices` (never a fake 0), so counting zeros would find nothing.
  const allTickers = Object.keys(priceMetadata).map((ticker) => ({ ticker }))
  const { missing, stale, newest } = summarizePriceStatus(allTickers, priceMetadata)
  const unavailablePrices = missing.length
  const stalePrices = stale.length

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
              {unavailablePrices > 0
                ? `${unavailablePrices} prezz${unavailablePrices > 1 ? 'i' : 'o'} mancant${unavailablePrices > 1 ? 'i' : 'e'}`
                : `${stalePrices} da verificare`}
            </span>
          )}
        </div>
      ) : !loading ? (
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          Start investing to track your returns
        </p>
      ) : null}
      {/* Always say how old the numbers are: a total without a date is a guess */}
      {!loading && newest && (
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
          Prezzi al {formatPriceDate(newest)}
        </p>
      )}
    </div>
  )
}
