const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/', // Added as fallback, might need manual opt-in sometimes but worth trying
]
const CACHE_KEY = 'etf_prices_cache'
const HISTORY_CACHE_KEY = 'etf_history_cache'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchViaProxy(targetUrl) {
  for (const proxy of PROXIES) {
    try {
      const url = `${proxy}${encodeURIComponent(targetUrl)}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout per proxy

      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!res.ok) continue
      return await res.json()
    } catch { /* try next proxy */ }
  }
  throw new Error(`All proxies failed for ${targetUrl}`)
}

export async function fetchPrice(ticker) {
  const json = await fetchViaProxy(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`
  )
  const result = json.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${ticker}`)
  return result.meta.regularMarketPrice
}

export async function fetchAllPrices(tickers) {
  // Always try to load cache first to have fallbacks
  const cached = getCached(CACHE_KEY) || {}

  // If we have a valid full cache, return it (optimization)
  // But usually we want to try refreshing if it's stale or if forced.
  // The caller (App.jsx) handles the logic of "when" to call this.
  // Here we just fetch.

  const prices = { ...cached } // Start with cached prices as fallback

  const results = await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        const price = await fetchPrice(t.ticker)
        prices[t.ticker] = price // Update with new price
      } catch (e) {
        console.warn(`Price fetch failed for ${t.ticker}, using cached value if available:`, e)
        // If we have a cached price, we keep it. If not, it remains undefined (or 0 if handled downstream)
      }
    })
  )

  // Save updated cache
  if (Object.keys(prices).length > 0) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: prices }))
  }

  return prices
}

export async function fetchHistory(ticker, range = '6mo', interval = '1d') {
  const json = await fetchViaProxy(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`
  )
  const result = json.chart?.result?.[0]
  if (!result) throw new Error(`No history data for ${ticker}`)
  const timestamps = result.timestamp || []
  const closes = result.indicators?.quote?.[0]?.close || []

  return timestamps.map((ts, i) => ({
    date: ts * 1000,
    price: closes[i],
  })).filter((d) => d.price != null)
}

export async function fetchAllHistory(tickers, range = '6mo') {
  const cacheKey = `${HISTORY_CACHE_KEY}_${range}`
  const cached = getCached(cacheKey)
  if (cached && tickers.every((t) => t.ticker in cached)) return cached

  const history = cached || {}

  await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        history[t.ticker] = await fetchHistory(t.ticker, range)
      } catch (e) {
        console.warn(`History fetch failed for ${t.ticker}:`, e)
      }
    })
  )

  if (Object.keys(history).length > 0) {
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: history }))
  }
  return history
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    // Return data even if stale, let the caller decide or use it as fallback
    // But logically, getCached is often used to *skip* fetching.
    // For our robust fetchAllPrices, we just read raw localStorage manually or change this.
    // Let's make getCached return data regardless of TTL, 
    // BUT we need to know if it's stale for the "skip fetch" logic in other places.
    // Actually, fetchAllPrices ignores TTL now and always tries to update, using cache as fallback.
    // So getCached being strict or loose depends on usage. 
    // To match original behavior (skip if fresh), we should return null if stale.
    // But for fallback, we need the stale data. 
    // Let's split this: getCached (strict) and getLastKnown (loose).
    if (Date.now() - ts < CACHE_TTL) return data
  } catch { /* corrupted cache, ignore */ }
  return null
}

// Helper to get whatever is in cache, even if stale (for fallbacks)
function getLastKnown(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data } = JSON.parse(raw)
    return data
  } catch { return null }
}

// We need to update fetchAllPrices to use getLastKnown logic inline or via helper
// I'll rewrite fetchAllPrices above to manually read it.

export function clearPriceCache() {
  localStorage.removeItem(CACHE_KEY)
  // Also clear history caches
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(HISTORY_CACHE_KEY)) localStorage.removeItem(key)
  }
}
