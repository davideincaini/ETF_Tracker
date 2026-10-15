/**
 * Shared helpers to describe how trustworthy the current prices are.
 *
 * Banner, portfolio card and PAC all need the same answers ("which prices are
 * missing? how old is the oldest one?"). Computing them in ONE place guarantees
 * the three never disagree, e.g. the banner saying "all fine" while the PAC
 * warns about stale prices.
 */

/** "15 ott, 18:23" (or "15 ott" with withTime=false); "—" if unknown. */
export function formatPriceDate(isoString, withTime = true) {
  const t = Date.parse(isoString)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleString('it-IT', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/** "XDPU.MI" -> "XDPU": the exchange suffix is noise for the user. */
export const cleanTicker = (ticker) => ticker.split('.')[0]

/**
 * Classify the prices of `tickers` using the metadata built in utils/api.js.
 * Returns lists of tickers per problem, plus the oldest/newest market times
 * among the prices we do have.
 */
export function summarizePriceStatus(tickers, priceMetadata) {
  const missing = []
  const rejected = []
  const stale = []
  let oldest = null
  let newest = null

  for (const { ticker } of tickers) {
    const meta = priceMetadata[ticker]
    if (!meta || meta.status === 'missing') {
      missing.push(ticker)
      continue
    }
    if (meta.status === 'rejected') rejected.push(ticker)
    if (meta.stale) stale.push(ticker)

    const t = Date.parse(meta.marketTime)
    if (Number.isFinite(t)) {
      if (oldest === null || t < Date.parse(oldest)) oldest = meta.marketTime
      if (newest === null || t > Date.parse(newest)) newest = meta.marketTime
    }
  }
  return { missing, rejected, stale, oldest, newest }
}
