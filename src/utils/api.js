/**
 * Market data access layer.
 *
 * WHERE THE DATA COMES FROM
 * The app no longer talks to Yahoo Finance. A GitHub Action
 * (scripts/update_market_data.py) downloads and validates prices every weekday
 * and publishes two static files next to the app:
 *
 *   <site>/data/prices.json   latest price per ticker + status + timestamps
 *   <site>/data/history.json  full daily closing prices per ticker
 *
 * Reading files from our own origin means: no CORS, no third-party proxies, no
 * API keys in the bundle, and nobody in the middle who could alter a price.
 *
 * HOW FAILURES ARE HANDLED
 * - The service worker (vite.config.js) caches both files "network first", so
 *   the app keeps working offline with the last copy it saw.
 * - prices.json is also kept in localStorage as a second, independent copy.
 * - Every price carries its market timestamp: the UI shows its age and warns
 *   when it is old, instead of silently using it.
 *
 * The functions keep the same names and return shapes as the old proxy-based
 * version, so components did not need to change how they read prices/history.
 */

// BASE_URL comes from `base` in vite.config.js ('/ETF_Tracker/' on GitHub
// Pages, '/' in dev). Building URLs from it keeps them correct in both.
const BASE = import.meta.env.BASE_URL
const PRICES_URL = `${BASE}data/prices.json`
const HISTORY_URL = `${BASE}data/history.json`

// Must match SCHEMA_VERSION in the Python script. If the file format ever
// changes, an old app refuses the new file instead of misreading it.
const SCHEMA_VERSION = 1

// A price older than this is flagged. 4 calendar days covers a normal weekend
// plus one bank holiday without false alarms.
export const STALE_AFTER_DAYS = 4

const OFFLINE_PRICES_KEY = 'etf_market_prices_v1'
// Caches written by the old proxy-based version. The "max" history cache could
// take megabytes; localStorage has ~5 MB in total and the portfolio itself
// (holdings + transactions) also lives there, so freeing it protects your data.
const LEGACY_KEY_PREFIXES = ['etf_prices_cache', 'etf_history_cache']

// Chart ranges offered by the UI, translated to days of history to keep.
const RANGE_DAYS = { '1mo': 31, '3mo': 92, '6mo': 183, '1y': 366 }
const DAY_MS = 24 * 60 * 60 * 1000

// history.json is ~0.5 MB: download and parse it once per session and share
// the same promise between all callers (dashboard, performance, Monte Carlo).
let historyPromise = null

/** Fetch one of our JSON files and check it is in a format we understand. */
async function getMarketFile(url) {
  // 'no-cache' = always ask the server whether the file changed (cheap: the
  // server answers "304 not modified" if it didn't). Without it the browser
  // could keep serving yesterday's prices for up to 10 minutes.
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const doc = await res.json()
  if (!doc || doc.schema !== SCHEMA_VERSION || typeof doc.tickers !== 'object' || doc.tickers === null) {
    throw new Error(`Unexpected format in ${url}`)
  }
  return doc
}

/** Age of an ISO timestamp in days (Infinity if missing or unparsable). */
export function ageInDays(isoString, now = Date.now()) {
  const t = Date.parse(isoString)
  return Number.isFinite(t) ? (now - t) / DAY_MS : Infinity
}

/** A usable price is a finite number strictly greater than zero. */
function isValidPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Turn prices.json into what the components expect:
 *   prices:   { ticker: number }  (tickers without a usable price are absent)
 *   metadata: { ticker: { status, marketTime, stale, error, timestamp } }
 */
function toPriceState(doc, tickers, offline) {
  const prices = {}
  const metadata = {}

  for (const t of tickers) {
    const entry = doc.tickers[t.ticker]
    const price = isValidPrice(entry?.price) ? entry.price : null
    const marketTime = entry?.market_time ?? null
    if (price !== null) prices[t.ticker] = price

    metadata[t.ticker] = {
      // ok | stale | rejected | missing — set by the Python script
      status: price === null ? 'missing' : (entry?.status ?? 'missing'),
      marketTime,
      error: entry?.error ?? null,
      // Kept for compatibility with components that read `timestamp`
      timestamp: marketTime ? Date.parse(marketTime) : 0,
      // One flag the UI can rely on: "do not trust this price blindly".
      // It is true if the script could not refresh it, OR if it is simply old
      // (e.g. the scheduled workflow stopped running).
      stale: price === null || entry?.status !== 'ok' || ageInDays(marketTime) > STALE_AFTER_DAYS,
    }
  }
  return { prices, metadata, generatedAt: doc.generated_at ?? null, offline }
}

function saveOfflineCopy(doc) {
  try {
    localStorage.setItem(OFFLINE_PRICES_KEY, JSON.stringify(doc))
  } catch { /* storage full or disabled: the service worker cache still covers us */ }
}

function loadOfflineCopy() {
  try {
    const doc = JSON.parse(localStorage.getItem(OFFLINE_PRICES_KEY))
    return doc && doc.schema === SCHEMA_VERSION && typeof doc.tickers === 'object' ? doc : null
  } catch {
    return null
  }
}

function removeLegacyCaches() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    }
  } catch { /* nothing to clean, or storage unavailable */ }
}

/**
 * Latest prices for the given tickers.
 * Never throws: on failure it returns the offline copy, or an empty state with
 * every ticker marked "missing" so the UI can ask for manual prices.
 */
export async function fetchAllPrices(tickers) {
  try {
    const doc = await getMarketFile(PRICES_URL)
    saveOfflineCopy(doc)
    // Only clean up the old caches once the new source has proven it works.
    removeLegacyCaches()
    return toPriceState(doc, tickers, false)
  } catch (err) {
    console.warn('prices.json unavailable, falling back to the offline copy:', err.message)
    const offlineDoc = loadOfflineCopy()
    return toPriceState(offlineDoc ?? { tickers: {} }, tickers, true)
  }
}

function loadHistoryDoc() {
  if (!historyPromise) {
    historyPromise = getMarketFile(HISTORY_URL).catch((err) => {
      // Forget the failed attempt so the next call (or the refresh button)
      // retries instead of reusing the error forever.
      historyPromise = null
      throw err
    })
  }
  return historyPromise
}

/**
 * Daily closing prices, as { ticker: [{ date: ms, price }] } sorted by date.
 * range: '1mo' | '3mo' | '6mo' | '1y' | 'max'.
 * Never throws: on failure it returns {} and the charts show their empty state.
 */
export async function fetchAllHistory(tickers, range = '6mo') {
  let doc
  try {
    doc = await loadHistoryDoc()
  } catch (err) {
    console.warn('history.json unavailable:', err.message)
    return {}
  }

  const days = RANGE_DAYS[range]
  const cutoff = days ? Date.now() - days * DAY_MS : -Infinity
  const out = {}

  for (const t of tickers) {
    const points = doc.tickers[t.ticker]?.points
    if (!Array.isArray(points)) continue
    out[t.ticker] = points
      // Dates are calendar days ("2026-10-15"); parsing them as UTC midnight
      // gives every ETF the same timestamp for the same day, so series from
      // different exchanges line up exactly when charts merge them.
      .map(([day, price]) => ({ date: Date.parse(`${day}T00:00:00Z`), price }))
      .filter((p) => p.date >= cutoff && isValidPrice(p.price))
  }
  return out
}

/** Full daily history, used by the Monte Carlo simulator and Performance page. */
export function fetchAllMaxHistory(tickers) {
  return fetchAllHistory(tickers, 'max')
}

/**
 * Called by the refresh button. Unlike the old clearPriceCache(), it does NOT
 * delete anything: it only forgets the in-memory copy so the next calls ask the
 * server again. If the server is unreachable, the last good data is still there.
 */
export function refreshMarketData() {
  historyPromise = null
}
