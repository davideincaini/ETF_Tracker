import { useState } from 'react'
import { calculatePac } from '../utils/pac'
import { ShoppingCart, Check } from 'lucide-react'

export default function PacCalculator({
  tickers,
  holdings,
  prices,
  onConfirm,
  loading,
}) {
  const [budget, setBudget] = useState('')
  const [result, setResult] = useState(null)

  const handleCalculate = () => {
    const b = parseFloat(budget)
    if (!b || b <= 0) return
    const r = calculatePac(b, holdings, prices, tickers)
    setResult(r)
  }

  const handleConfirm = () => {
    if (!result) return
    onConfirm(result.buys)
    setResult(null)
    setBudget('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Budget input */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <p className="text-sm font-bold mb-4">Monthly PAC</p>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>€</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="500"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-[#34C759] transition-colors"
              style={{ background: 'var(--bg)' }}
            />
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading || !budget}
            className="px-6 py-3 rounded-2xl text-sm font-bold text-white border-none cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ background: '#34C759' }}
          >
            Calculate
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div
          className="rounded-3xl p-5"
          style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          <p className="text-sm font-bold mb-4 flex items-center gap-2">
            <ShoppingCart size={16} color="#34C759" /> Acquisto Mensile Consigliato
          </p>

          {result.buys.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
              Nessun acquisto suggerito. Forse il budget è troppo basso o non ci sono deviazioni.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {result.buys.map((buy) => (
                <div
                  key={buy.ticker}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white"
                  style={{ border: '1px solid #E5E5EA', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: '#34C759' }}
                  >
                    {buy.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{buy.ticker.split('.')[0]}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {buy.shares} quote = €{buy.cost.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-700">
                      Buy
                    </span>
                  </div>
                </div>
              ))}

              <div className="p-3 mt-2 rounded-2xl" style={{ background: 'var(--bg)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Strategia Applicata
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  L'algoritmo ha distribuito il budget proporzionalmente per colmare il deficit degli ETF in maggior ritardo rispetto al target, ripristinando il bilanciamento del portafoglio senza creare inefficienze.
                </p>
              </div>
            </div>
          )}

          {result.buys.length > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-sm font-bold text-white border-none cursor-pointer"
                style={{ background: '#34C759' }}
              >
                <Check size={14} /> Conferma Acquisto PAC
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
