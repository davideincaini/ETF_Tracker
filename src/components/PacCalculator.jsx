import { useMemo, useState } from 'react'
import { calculatePac } from '../utils/pac'
import { ShoppingCart, Check, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { formatPriceDate, cleanTicker } from '../utils/priceStatus'

/**
 * Parse a price typed on a phone. Italian keyboards type a comma ("13,35"),
 * and parseFloat("13,35") would silently return 13, so we normalise first.
 * Returns null for anything that is not a positive number.
 */
function parseManualPrice(raw) {
  const n = parseFloat(String(raw ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function PacCalculator({
  tickers,
  holdings,
  prices,
  priceMetadata = {},
  onConfirm,
  loading,
}) {
  const [budget, setBudget] = useState('')
  const [result, setResult] = useState(null)
  // Prices typed by hand, kept as the raw strings the user typed: { 'XDPU.MI': '13,35' }.
  // They are a one-off for this PAC: cleared after confirming.
  const [overrides, setOverrides] = useState({})
  const [pricesOpen, setPricesOpen] = useState(false)

  // Only vault B ETFs take part in the PAC (same filter as utils/pac.js)
  const pacTickers = useMemo(() => tickers.filter((t) => t.vault === 'B'), [tickers])

  // One row per ETF: where its price comes from and whether to trust it.
  const rows = pacTickers.map((t) => {
    const manual = parseManualPrice(overrides[t.ticker])
    const fetched = prices[t.ticker] > 0 ? prices[t.ticker] : null
    const meta = priceMetadata[t.ticker]
    return {
      ticker: t.ticker,
      fetched,
      manual,
      // A typed price wins: you just read it on your broker, so it is current
      effective: manual ?? fetched,
      needsCheck: manual === null && (fetched === null || Boolean(meta?.stale)),
      marketTime: meta?.marketTime ?? null,
    }
  })

  const missing = rows.filter((r) => r.effective === null)
  const toVerify = rows.filter((r) => r.effective !== null && r.needsCheck)
  const usesManual = rows.some((r) => r.manual !== null)
  // The price panel opens by itself when something needs your attention
  const showPrices = pricesOpen || missing.length > 0 || toVerify.length > 0

  const handleOverride = (ticker, value) => {
    setOverrides((prev) => ({ ...prev, [ticker]: value }))
    // A result computed with the old price is no longer valid
    setResult(null)
  }

  const handleBudget = (value) => {
    setBudget(value)
    setResult(null)
  }

  const handleCalculate = () => {
    const b = parseFloat(String(budget).replace(',', '.'))
    if (!b || b <= 0 || missing.length > 0) return
    const effectivePrices = { ...prices }
    for (const r of rows) {
      if (r.effective !== null) effectivePrices[r.ticker] = r.effective
    }
    // `toVerify` is captured with the result, so the warning shown matches the
    // prices that were actually used for THIS calculation.
    setResult({
      ...calculatePac(b, holdings, effectivePrices, tickers),
      verifyTickers: toVerify.map((r) => r.ticker),
      usedManual: usesManual,
    })
  }

  const handleConfirm = () => {
    if (!result) return
    onConfirm(result.buys)
    setResult(null)
    setBudget('')
    setOverrides({})
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
              onChange={(e) => handleBudget(e.target.value)}
              className="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-[#34C759] transition-colors"
              style={{ background: 'var(--bg)' }}
            />
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading || !budget || missing.length > 0}
            className="px-6 py-3 rounded-2xl text-sm font-bold text-white border-none cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ background: '#34C759' }}
          >
            Calculate
          </button>
        </div>
        {!loading && missing.length > 0 && (
          <p className="text-xs font-medium mt-3" style={{ color: '#C62828' }}>
            Manca il prezzo di {missing.map((r) => cleanTicker(r.ticker)).join(', ')}: inseriscilo qui sotto per poter calcolare.
          </p>
        )}
      </div>

      {/* Prices used by the calculation: visible, dated and editable */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <button
          onClick={() => setPricesOpen(!showPrices)}
          className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer p-0 text-left"
          aria-expanded={showPrices}
        >
          <div>
            <p className="text-sm font-bold">Prezzi usati per il calcolo</p>
            <p className="text-[11px] mt-0.5" style={{ color: missing.length || toVerify.length ? '#856404' : 'var(--text-secondary)' }}>
              {missing.length > 0
                ? `${missing.length} mancant${missing.length > 1 ? 'i' : 'e'}`
                : toVerify.length > 0
                  ? `${toVerify.length} da verificare`
                  : usesManual
                    ? 'Include prezzi inseriti a mano'
                    : 'Aggiornati, tocca per vederli o correggerli'}
            </p>
          </div>
          {showPrices ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
        </button>

        {showPrices && (
          <div className="flex flex-col gap-2 mt-4">
            {rows.map((r) => {
              // Label under the ticker: where the number comes from
              const label = r.manual !== null
                ? { text: 'inserito a mano', color: '#0B5CAD' }
                : r.fetched === null
                  ? { text: 'mancante', color: '#C62828' }
                  : r.needsCheck
                    ? { text: `del ${formatPriceDate(r.marketTime)} · da verificare`, color: '#856404' }
                    : { text: formatPriceDate(r.marketTime), color: 'var(--text-secondary)' }
              return (
                <div key={r.ticker} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{cleanTicker(r.ticker)}</p>
                    <p className="text-[10px] truncate" style={{ color: label.color }}>{label.text}</p>
                  </div>
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-secondary)' }}>€</span>
                    {/* type="text" + inputMode="decimal": numeric keypad on iPhone,
                        but the comma is accepted (type="number" may reject it) */}
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Prezzo ${cleanTicker(r.ticker)}`}
                      placeholder={r.fetched !== null ? r.fetched.toLocaleString('it-IT', { maximumFractionDigits: 4 }) : 'prezzo'}
                      value={overrides[r.ticker] ?? ''}
                      onChange={(e) => handleOverride(r.ticker, e.target.value)}
                      className="w-full pl-7 pr-2 py-2 rounded-xl border text-sm text-right focus:outline-none focus:border-[#34C759] transition-colors"
                      style={{
                        background: 'var(--bg)',
                        borderColor: r.effective === null ? '#FF3B30' : '#E5E7EB',
                      }}
                    />
                  </div>
                </div>
              )
            })}
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              Lascia vuoto per usare il prezzo automatico. Se un prezzo manca o è vecchio, copia quello attuale dal tuo broker: vale solo per questo calcolo.
            </p>
          </div>
        )}
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

          {/* Never present a calculation on unverified prices as if it were clean */}
          {result.verifyTickers.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl px-3 py-2.5 mb-3 text-xs" style={{ background: '#FFF3CD', color: '#856404' }}>
              <AlertTriangle size={14} className="shrink-0 mt-[1px]" />
              <span>
                Calcolato con prezzi non aggiornati per {result.verifyTickers.map(cleanTicker).join(', ')}. Controlla il prezzo sul broker prima di comprare.
              </span>
            </div>
          )}

          {result.missing.length > 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: '#C62828' }}>
              Impossibile calcolare: manca il prezzo di {result.missing.map(cleanTicker).join(', ')}.
            </p>
          ) : result.buys.length === 0 ? (
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
                  {result.usedManual && ' Alcuni prezzi sono stati inseriti a mano.'}
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
