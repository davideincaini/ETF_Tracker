const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/',
  'https://cors-anywhere.herokuapp.com/', // Added as fallback, might need manual opt-in sometimes but worth trying
]
const CACHE_KEY = 'etf_prices_cache'
const HISTORY_CACHE_KEY = 'etf_history_cache'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchViaProxy(targetUrl, retries = 2) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const proxy of PROXIES) {
      try {
        const url = `${proxy}${encodeURIComponent(targetUrl)}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout per proxy

        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (!res.ok) continue
        return await res.json()
      } catch (err) {
        lastError = err
        /* try next proxy */
      }
    }
    // Wait 1s before retry (only if not the last attempt)
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  throw lastError || new Error(`All proxies failed for ${targetUrl}`)
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
  // Load last known prices from cache (even if stale) as fallback
  const lastKnown = getLastKnown(CACHE_KEY) || {}
  const prices = { ...lastKnown }
  const metadata = {}

  // Try to fetch fresh prices for all tickers
  await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        const price = await fetchPrice(t.ticker)
        if (price && price > 0) {
          prices[t.ticker] = price
          metadata[t.ticker] = { timestamp: Date.now(), stale: false }
        }
      } catch (e) {
        console.warn(`Price fetch failed for ${t.ticker}, using cached value if available:`, e.message)
        // If we have a cached price, mark it as stale
        if (prices[t.ticker]) {
          metadata[t.ticker] = { timestamp: 0, stale: true }
        }
      }
    })
  )

  // Save updated cache with metadata
  if (Object.keys(prices).length > 0) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      data: prices,
      metadata: metadata
    }))
  }

  return { prices, metadata }
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

  // If we have fresh cache with all tickers, return it
  if (cached && cached.data && tickers.every((t) => t.ticker in cached.data)) {
    return cached.data
  }

  // Otherwise, start with last known and try to update
  const history = getLastKnown(cacheKey) || {}

  await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        history[t.ticker] = await fetchHistory(t.ticker, range)
      } catch (e) {
        console.warn(`History fetch failed for ${t.ticker}:`, e.message)
        // Keep cached history if available
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
    const { ts, data, metadata } = JSON.parse(raw)
    // Return data only if fresh (within TTL)
    if (Date.now() - ts < CACHE_TTL) {
      return { data, metadata: metadata || {} }
    }
  } catch { /* corrupted cache, ignore */ }
  return null
}

// Helper to get whatever is in cache, even if stale (for fallbacks)
function getLastKnown(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.data || null
  } catch { return null }
}

// Fetch maximum available history for Monte Carlo simulations
export async function fetchMaxHistory(ticker, interval = '1d') {
  const json = await fetchViaProxy(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=max&interval=${interval}`
  )
  const result = json.chart?.result?.[0]
  if (!result) throw new Error(`No max history data for ${ticker}`)
  const timestamps = result.timestamp || []
  const closes = result.indicators?.quote?.[0]?.close || []

  return timestamps.map((ts, i) => ({
    date: ts * 1000,
    price: closes[i],
  })).filter((d) => d.price != null)
}

export async function fetchAllMaxHistory(tickers) {
  const cacheKey = `${HISTORY_CACHE_KEY}_max`
  const cached = getCached(cacheKey)

  // If we have fresh cache with all tickers, return it
  if (cached && cached.data && tickers.every((t) => t.ticker in cached.data)) {
    return cached.data
  }

  // Otherwise, start with last known and try to update
  const history = getLastKnown(cacheKey) || {}

  await Promise.allSettled(
    tickers.map(async (t) => {
      try {
        history[t.ticker] = await fetchMaxHistory(t.ticker)
        console.log(`Loaded ${history[t.ticker].length} data points for ${t.ticker}`)
      } catch (e) {
        console.warn(`Max history fetch failed for ${t.ticker}:`, e.message)
        // Keep cached history if available
      }
    })
  )

  if (Object.keys(history).length > 0) {
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: history }))
  }
  return history
}

export function clearPriceCache() {
  localStorage.removeItem(CACHE_KEY)
  // Also clear history caches
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(HISTORY_CACHE_KEY)) localStorage.removeItem(key)
  }
}
