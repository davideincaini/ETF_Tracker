import { useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Check } from 'lucide-react'

const COLORS = ['#5856D6', '#34C759', '#FF9500', '#FF2D55']

export default function ManualTrade({ tickers, holdings, prices, onTrade }) {
  const [selected, setSelected] = useState(null)
  const [side, setSide] = useState('buy')
  const [qty, setQty] = useState('')
  const [manualPrice, setManualPrice] = useState('')

  const handleConfirm = () => {
    const shares = parseInt(qty)
    if (!selected || !shares || shares <= 0) return
    const t = tickers.find((tk) => tk.ticker === selected)
    const price = parseFloat(manualPrice) || prices[selected] || 0
    if (price === 0) return

    // Validations
    if (side === 'sell' && shares > (holdings[selected] || 0)) return

    onTrade(selected, t.name, shares, price, side)
    setQty('')
    setManualPrice('')
    setSelected(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Buy / Sell toggle */}
      <div
        className="rounded-3xl p-1.5 flex"
        style={{ background: '#F0F0F0' }}
      >
        <button
          onClick={() => setSide('buy')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border-none cursor-pointer transition-all duration-200"
          style={{
            background: side === 'buy' ? '#34C759' : 'transparent',
            color: side === 'buy' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <ArrowDownCircle size={16} />
          Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-sm font-bold border-none cursor-pointer transition-all duration-200"
          style={{
            background: side === 'sell' ? '#FF3B30' : 'transparent',
            color: side === 'sell' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          <ArrowUpCircle size={16} />
          Sell
        </button>
      </div>

      {/* ETF selector */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <p className="text-sm font-bold mb-3">Select ETF</p>
        <div className="flex flex-col gap-1">
          {tickers.map((t, i) => {
            const price = prices[t.ticker] || 0
            const held = holdings[t.ticker] || 0
            const isSelected = selected === t.ticker
            const disabled = side === 'sell' && held === 0

            return (
              <button
                key={t.ticker}
                onClick={() => !disabled && setSelected(t.ticker)}
                disabled={disabled}
                className="flex items-center gap-3 py-3 px-3 rounded-2xl border-2 cursor-pointer transition-all duration-150 bg-transparent text-left disabled:opacity-30"
                style={{
                  borderColor: isSelected
                    ? (side === 'buy' ? '#34C759' : '#FF3B30')
                    : 'transparent',
                  background: isSelected ? (side === 'buy' ? '#e8f9ed' : '#FFE5E5') : 'transparent',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {t.ticker.replace('.MI', '').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.ticker.replace('.MI', '')}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {held} held · €{price.toFixed(2)}/share
                  </p>
                </div>
                {isSelected && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: side === 'buy' ? '#34C759' : '#FF3B30' }}
                  >
                    <Check size={14} color="#fff" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quantity & confirm */}
      {selected && (
        <div
          className="rounded-3xl p-5"
          style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          <p className="text-sm font-bold mb-3">
            {side === 'buy' ? 'Buy' : 'Sell'} {selected.replace('.MI', '')}
          </p>
          {/* Price input (pre-filled from API, editable) */}
          <div className="mb-3">
            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Price per share</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>€</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder={prices[selected] ? prices[selected].toFixed(2) : '0.00'}
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none transition-colors"
                style={{ background: 'var(--bg)' }}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>#</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Shares"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none transition-colors"
                style={{
                  background: 'var(--bg)',
                  borderColor: qty ? (side === 'buy' ? '#34C759' : '#FF3B30') : undefined,
                }}
              />
            </div>
            <button
              onClick={handleConfirm}
              disabled={
                !qty ||
                parseInt(qty) <= 0 ||
                ((parseFloat(manualPrice) || prices[selected] || 0) === 0) ||
                (side === 'sell' && parseInt(qty) > (holdings[selected] || 0))
              }
              className="px-6 py-3 rounded-2xl text-sm font-bold text-white border-none cursor-pointer disabled:opacity-40 transition-opacity"
              style={{ background: side === 'buy' ? '#34C759' : '#FF3B30' }}
            >
              Confirm
            </button>
          </div>
          {qty && (parseFloat(manualPrice) || prices[selected]) > 0 && (
            <div className="text-xs mt-3 flex flex-col gap-1" style={{ color: 'var(--text-secondary)' }}>
              <p>Total: <strong>€{(parseInt(qty || 0) * (parseFloat(manualPrice) || prices[selected])).toFixed(2)}</strong></p>
              {side === 'sell' && parseInt(qty) > (holdings[selected] || 0) && (
                <span style={{ color: '#FF3B30' }}> — exceeds holdings</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

