const PROXY = 'https://corsproxy.io/?'
const CACHE_KEY = 'etf_prices_cache'
const HISTORY_CACHE_KEY = 'etf_history_cache'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function fetchPrice(ticker) {
  const url = `${PROXY}${encodeURIComponent(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`
  )}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${ticker}`)
  const json = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${ticker}`)
  return result.meta.regularMarketPrice
}

export async function fetchAllPrices(tickers) {
  const cached = getCached(CACHE_KEY)
  if (cached) return cached

  const prices = {}
  const results = await Promise.allSettled(
    tickers.map(async (t) => {
      prices[t.ticker] = await fetchPrice(t.ticker)
    })
  )
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`Price fetch failed for ${tickers[i].ticker}:`, r.reason)
    }
  })

  if (Object.keys(prices).length > 0) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: prices }))
  }
  return prices
}

export async function fetchHistory(ticker, range = '6mo', interval = '1d') {
  const url = `${PROXY}${encodeURIComponent(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`
  )}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch history for ${ticker}`)
  const json = await res.json()
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
  if (cached) return cached

  const history = {}
  await Promise.allSettled(
    tickers.map(async (t) => {
      history[t.ticker] = await fetchHistory(t.ticker, range)
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
    if (Date.now() - ts < CACHE_TTL) return data
  } catch {}
  return null
}

export function clearPriceCache() {
  localStorage.removeItem(CACHE_KEY)
  // Also clear history caches
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(HISTORY_CACHE_KEY)) localStorage.removeItem(key)
  }
}
