import { AlertTriangle, CloudOff } from 'lucide-react'
import { summarizePriceStatus, formatPriceDate, cleanTicker } from '../utils/priceStatus'

/**
 * A small notice under the header that appears ONLY when prices need attention.
 *
 * Why it exists: the app broke in October 2026 and the only symptom was a long
 * spinner followed by old numbers that looked normal. The rule now is that a
 * degraded state must always be visible, on every tab, in plain words, and
 * must say what to do about it.
 */
export default function DataFreshnessBanner({ tickers, priceMetadata, offline }) {
  const { missing, rejected, stale } = summarizePriceStatus(tickers, priceMetadata)

  // Build the list of messages, most serious first. Each one says what is
  // wrong AND what you can do, otherwise a warning is just anxiety.
  const messages = []

  if (missing.length > 0) {
    messages.push({
      tone: 'danger',
      text: `Prezzo non disponibile: ${missing.map(cleanTicker).join(', ')}. Nel PAC puoi inserirlo a mano dal tuo broker.`,
    })
  }
  if (rejected.length > 0) {
    messages.push({
      tone: 'warning',
      text: `Prezzo anomalo scartato per ${rejected.map(cleanTicker).join(', ')}: uso l'ultimo valore valido.`,
    })
  }
  // Only report "old prices" when the problem is age, not when it is already
  // explained by the two messages above.
  const onlyOld = stale.filter((t) => !rejected.includes(t))
  // Date shown = the oldest among the old prices themselves
  const { oldest } = summarizePriceStatus(onlyOld.map((ticker) => ({ ticker })), priceMetadata)
  if (onlyOld.length > 0 && oldest) {
    messages.push({
      tone: 'warning',
      text: `Prezzi fermi al ${formatPriceDate(oldest, false)}. L'aggiornamento automatico potrebbe essersi interrotto: controlla la scheda Actions su GitHub.`,
    })
  }
  if (offline) {
    messages.push({
      tone: 'info',
      text: 'Server non raggiungibile: sto usando l\'ultima copia salvata dei prezzi.',
    })
  }

  if (messages.length === 0) return null

  // Light-theme palette consistent with the rest of the app's badges
  const TONES = {
    danger: { bg: '#FFE5E5', fg: '#C62828' },
    warning: { bg: '#FFF3CD', fg: '#856404' },
    info: { bg: '#E8F1FD', fg: '#0B5CAD' },
  }

  return (
    <div className="px-5 pb-3 flex flex-col gap-2" role="status" aria-live="polite">
      {messages.map((m) => {
        const { bg, fg } = TONES[m.tone]
        const Icon = m.tone === 'info' ? CloudOff : AlertTriangle
        return (
          <div
            key={m.text}
            className="flex items-start gap-2 rounded-2xl px-4 py-3 text-xs font-medium leading-snug"
            style={{ background: bg, color: fg }}
          >
            <Icon size={14} className="shrink-0 mt-[1px]" />
            <span>{m.text}</span>
          </div>
        )
      })}
    </div>
  )
}
