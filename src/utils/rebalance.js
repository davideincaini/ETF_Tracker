/**
 * Rebalancing Engine — "Bilanciere 70/20/10"
 *
 * Architecture:
 *   Motore Azionario (70%): XDPU (50%), EXUS (40%), EIMI (10%)
 *   Parte difensiva  (20%): EM710 — obbligazioni governative euro 7-10 anni
 *                           (nel portafoglio Global: XEON)
 *   Scudo Fiat       (10%): SGLN — Oro fisico, bande ampie (7%–15%)
 *
 * Sensors:
 *   B. Euphoria Sensor — taglia eccedenza azionaria quando peso ≥ 78%
 *   C. Internal Maintenance — ribilanciamento a somma zero tra equity ETFs
 *   D. Gold Shield — bande 7%–15% per SGLN: sopra il 15% vende l'eccesso;
 *      sotto il 7% nessun ordine, lo riporta in banda il PAC mensile
 *
 * Removed in October 2026: the "A. Drawdown Sensor", which sold a cash bunker
 * (C3M) in three "bullets" during equity crashes. The defensive 20% is now a
 * 7-10Y government bond ETF, which can itself be down ~20% when it would be
 * sold (EM710 lost 19.5% in 2022), so spending it as dry powder no longer made
 * sense. Letters B–D are kept so old notes still match.
 *
 * The equity drawdown is still MEASURED (from the equity ATH) because sensors
 * C and D use it as a condition: see DRAWDOWN_ALERT below.
 */

const ATH_STORAGE_PREFIX = 'antigravity_equity_ath'

function athKey(portfolioId) {
  if (!portfolioId || portfolioId === 'bilanciere') return ATH_STORAGE_PREFIX
  return `${ATH_STORAGE_PREFIX}_${portfolioId}`
}

// ─── Constants ───────────────────────────────────────────────────────
export const EQUITY_TARGET = 0.70
export const DEFENSIVE_TARGET = 0.20      // Bond (EM710) or Cash (XEON in Global)
export const GOLD_TARGET = 0.10

export const EUPHORIA_THRESHOLD = 0.78    // Peso equity ≥ 78% → taglia (+8pp dal target 70%)
export const GOLD_LOWER_BAND = 0.07       // Peso oro ≤ 7% → compra
export const GOLD_UPPER_BAND = 0.15       // Peso oro ≥ 15% → vendi

// Equity drawdown (from its all-time high) at which the market counts as
// "in a crash": internal equity rebalancing pauses, and excess gold goes to
// equity instead of the defensive ETF. Same value the first bullet used (−15%).
export const DRAWDOWN_ALERT = -0.15

/**
 * The defensive ETF is the Bond or Cash ETF that has a real target weight.
 * The target filter matters: a "legacy" ETF kept only because you may still
 * hold it (C3M, target 0) must never be picked as the destination of new money.
 */
function findDefensiveETF(vaultB) {
  return vaultB.find(t => (t.category === 'Bond' || t.category === 'Cash') && t.target_weight > 0)
}

/** "EM710.MI" -> "EM710", for order descriptions */
const shortTicker = (ticker) => ticker.split('.')[0]

// ─── ATH Tracking ────────────────────────────────────────────────────
export function loadEquityATH(portfolioId) {
  try {
    const raw = localStorage.getItem(athKey(portfolioId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { value: 0, date: null }
}

export function saveEquityATH(value, date = new Date().toISOString(), portfolioId) {
  localStorage.setItem(athKey(portfolioId), JSON.stringify({ value, date }))
}

/**
 * Calculates ATH for individual ETFs from their price history.
 * Returns { [ticker]: { ath: number, athDate: number, drawdown: number } }
 */
export function calculatePerAssetATH(history, prices) {
  const result = {}
  for (const [ticker, points] of Object.entries(history || {})) {
    if (!points || points.length === 0) continue
    let ath = 0
    let athDate = 0
    for (const p of points) {
      if (p.price > ath) {
        ath = p.price
        athDate = p.date
      }
    }
    // Also check current price
    const currentPrice = prices[ticker] || 0
    if (currentPrice > ath) {
      ath = currentPrice
      athDate = Date.now()
    }
    const drawdown = ath > 0 ? (currentPrice - ath) / ath : 0
    result[ticker] = { ath, athDate, drawdown }
  }
  return result
}

// ─── Core Analysis ───────────────────────────────────────────────────

/**
 * Computes the full rebalancing state.
 *
 * @param {Object} params
 * @param {Array} params.tickers - Ticker configurations
 * @param {Object} params.holdings - { ticker: quantity }
 * @param {Object} params.prices - { ticker: price }
 * @returns {Object} Full rebalancing state with all sensor outputs
 */
export function analyzePortfolio({ tickers, holdings, prices, portfolioId }) {
  const vaultB = tickers.filter(t => t.vault === 'B')
  const equityETFs = vaultB.filter(t => t.category === 'Equity')
  const defensiveETF = findDefensiveETF(vaultB)
  const goldETF = vaultB.find(t => t.category === 'Commodity')

  // ── Total portfolio value (Vault B only for rebalancing) ──
  const totalValue = vaultB.reduce((sum, t) => {
    return sum + (holdings[t.ticker] || 0) * (prices[t.ticker] || 0)
  }, 0)

  // ── Equity block ("Monolite Virtuale") ──
  const equityValue = equityETFs.reduce((sum, t) => {
    return sum + (holdings[t.ticker] || 0) * (prices[t.ticker] || 0)
  }, 0)
  const equityWeight = totalValue > 0 ? equityValue / totalValue : 0

  // ── Defensive block (bond or cash ETF) ──
  const defensiveValue = defensiveETF ? (holdings[defensiveETF.ticker] || 0) * (prices[defensiveETF.ticker] || 0) : 0
  const defensiveWeight = totalValue > 0 ? defensiveValue / totalValue : 0

  // ── Gold block ──
  const goldValue = goldETF ? (holdings[goldETF.ticker] || 0) * (prices[goldETF.ticker] || 0) : 0
  const goldWeight = totalValue > 0 ? goldValue / totalValue : 0

  // ── ATH tracking for equity block ──
  const storedATH = loadEquityATH(portfolioId)
  let equityATH = storedATH.value
  let equityATHDate = storedATH.date

  if (equityValue > equityATH) {
    equityATH = equityValue
    equityATHDate = new Date().toISOString()
    saveEquityATH(equityATH, equityATHDate, portfolioId)
  }

  const equityDrawdown = equityATH > 0 ? (equityValue - equityATH) / equityATH : 0

  // ── Internal equity weights ──
  const equityInternals = equityETFs.map(t => {
    const val = (holdings[t.ticker] || 0) * (prices[t.ticker] || 0)
    const internalWeight = equityValue > 0 ? val / equityValue : 0
    const internalTarget = t.equity_internal_target || 0
    const drift = internalWeight - internalTarget
    return {
      ticker: t.ticker,
      name: t.name,
      value: val,
      internalWeight,
      internalTarget,
      drift,
      price: prices[t.ticker] || 0,
      shares: holdings[t.ticker] || 0,
    }
  })

  // ── Sensor B: Euphoria (taglio eccedenza) ──
  const euphoriaSignal = computeEuphoriaSignal({
    equityWeight,
    equityValue,
    totalValue,
    equityInternals,
    defensiveETF,
    prices,
  })

  // ── Sensor C: Internal Maintenance ──
  const internalSignal = computeInternalMaintenance({
    equityInternals,
    equityDrawdown,
    equityWeight,
  })

  // ── Sensor D: Gold Shield ──
  const goldSignal = computeGoldSignal({
    goldWeight,
    goldValue,
    totalValue,
    goldETF,
    defensiveETF,
    equityDrawdown,
    equityInternals,
    prices,
  })

  // ── Time window check (15:30–16:30 CET) ──
  const timeWindow = checkTimeWindow()

  return {
    totalValue,
    equityValue,
    equityWeight,
    equityATH,
    equityATHDate,
    equityDrawdown,
    defensiveETF,
    defensiveValue,
    defensiveWeight,
    goldValue,
    goldWeight,
    equityInternals,
    euphoriaSignal,
    internalSignal,
    goldSignal,
    timeWindow,
  }
}

// ─── Sensor B: Euphoria ─────────────────────────────────────────────

function computeEuphoriaSignal({ equityWeight, equityValue, totalValue, equityInternals, defensiveETF, prices }) {
  const isTriggered = equityWeight >= EUPHORIA_THRESHOLD
  const orders = []

  if (isTriggered && totalValue > 0) {
    // Excess to sell: bring equity back to 60%
    const targetEquityValue = totalValue * EQUITY_TARGET
    const excess = equityValue - targetEquityValue

    if (excess > 0) {
      // Find the most overweight equity ETF (highest positive drift)
      const mostOverweight = [...equityInternals].sort((a, b) => b.drift - a.drift)[0]

      if (mostOverweight && mostOverweight.price > 0) {
        const sharesToSell = Math.ceil(excess / mostOverweight.price)

        orders.push({
          type: 'sell',
          ticker: mostOverweight.ticker,
          name: mostOverweight.name,
          shares: sharesToSell,
          amount: sharesToSell * mostOverweight.price,
          reason: `Decapitazione eccedenza (${mostOverweight.ticker.replace('.MI', '').replace('.PA', '').replace('.L', '')} più sovrappesato)`,
        })

        // The proceeds go to the defensive ETF: plain rebalancing from the
        // asset that ran up into the one that lagged behind.
        if (defensiveETF) {
          const sharesToBuyDefensive = Math.floor(excess / (prices[defensiveETF.ticker] || 1))
          orders.push({
            type: 'buy',
            ticker: defensiveETF.ticker,
            name: defensiveETF.name,
            shares: sharesToBuyDefensive,
            amount: sharesToBuyDefensive * (prices[defensiveETF.ticker] || 0),
            reason: `Riallocazione in ${shortTicker(defensiveETF.ticker)}`,
          })
        }
      }
    }
  }

  return {
    isTriggered,
    equityWeight,
    threshold: EUPHORIA_THRESHOLD,
    excess: isTriggered ? equityValue - totalValue * EQUITY_TARGET : 0,
    orders,
  }
}

// ─── Sensor C: Internal Maintenance ─────────────────────────────────

function computeInternalMaintenance({ equityInternals, equityDrawdown, equityWeight }) {
  // Only if no drawdown or euphoria triggers are active
  const drawdownActive = equityDrawdown <= DRAWDOWN_ALERT
  const euphoriaActive = equityWeight >= EUPHORIA_THRESHOLD

  if (drawdownActive || euphoriaActive) {
    return { needsRebalance: false, drifts: equityInternals, orders: [] }
  }

  // Check if any internal weight is off by more than 5% relative
  const maxDrift = Math.max(...equityInternals.map(e => Math.abs(e.drift)))
  const needsRebalance = maxDrift > 0.05  // 5% internal drift threshold

  const orders = []
  if (needsRebalance) {
    // Zero-sum rebalance: sell overweight, buy underweight
    const overweight = [...equityInternals].filter(e => e.drift > 0.02).sort((a, b) => b.drift - a.drift)
    const underweight = [...equityInternals].filter(e => e.drift < -0.02).sort((a, b) => a.drift - b.drift)

    if (overweight.length > 0 && underweight.length > 0) {
      const seller = overweight[0]
      const buyer = underweight[0]
      // Amount to transfer: bring the seller closer to its target
      const transferAmount = Math.abs(seller.drift) * seller.value / (seller.internalWeight || 1)
      const cappedAmount = Math.min(transferAmount, seller.value * 0.1) // Cap at 10% of position

      if (cappedAmount > Math.max(seller.price, buyer.price)) {
        orders.push({
          type: 'sell',
          ticker: seller.ticker,
          name: seller.name,
          shares: Math.ceil(cappedAmount / seller.price),
          amount: cappedAmount,
          reason: `Riduzione sovrappeso interno`,
        })
        orders.push({
          type: 'buy',
          ticker: buyer.ticker,
          name: buyer.name,
          shares: Math.floor(cappedAmount / buyer.price),
          amount: Math.floor(cappedAmount / buyer.price) * buyer.price,
          reason: `Compensazione sottopeso interno`,
        })
      }
    }
  }

  return { needsRebalance, drifts: equityInternals, orders, maxDrift }
}

// ─── Sensor D: Gold Shield ──────────────────────────────────────────

function computeGoldSignal({ goldWeight, goldValue, totalValue, goldETF, defensiveETF, equityDrawdown, equityInternals, prices }) {
  const isLow = goldWeight <= GOLD_LOWER_BAND && goldWeight > 0
  const isHigh = goldWeight >= GOLD_UPPER_BAND
  const orders = []

  if (!goldETF) return { isLow: false, isHigh: false, handledByPac: false, goldWeight, orders }

  // Gold below the band: NO orders. This portfolio is fed by a monthly PAC,
  // and the PAC already sends new money to whatever is furthest below target,
  // so selling another asset to buy gold would only add costs (commissions,
  // taxes on gains) for a gap the next contribution closes anyway.
  // The UI shows `handledByPac` as a note instead of orders.
  const handledByPac = isLow

  if (isHigh && totalValue > 0) {
    // Sell gold excess
    const targetGoldValue = totalValue * GOLD_TARGET
    const excess = goldValue - targetGoldValue
    const goldPrice = prices[goldETF.ticker] || 0

    if (excess > 0 && goldPrice > 0) {
      const sharesToSell = Math.ceil(excess / goldPrice)

      orders.push({
        type: 'sell',
        ticker: goldETF.ticker,
        shares: sharesToSell,
        amount: sharesToSell * goldPrice,
        reason: 'Decapitazione eccedenza Oro',
      })

      // Destination: the defensive ETF, unless equity is in a crash
      const equityInDrawdown = equityDrawdown <= DRAWDOWN_ALERT
      if (equityInDrawdown) {
        const mostUnderweight = [...equityInternals].sort((a, b) => a.drift - b.drift)[0]
        if (mostUnderweight && mostUnderweight.price > 0) {
          orders.push({
            type: 'buy',
            ticker: mostUnderweight.ticker,
            name: mostUnderweight.name,
            shares: Math.floor(excess / mostUnderweight.price),
            amount: excess,
            reason: `Iniezione in azionario (drawdown attivo)`,
          })
        }
      } else if (defensiveETF) {
        orders.push({
          type: 'buy',
          ticker: defensiveETF.ticker,
          name: defensiveETF.name,
          shares: Math.floor(excess / (prices[defensiveETF.ticker] || 1)),
          amount: excess,
          reason: `Riallocazione in ${shortTicker(defensiveETF.ticker)}`,
        })
      }
    }
  }

  return { isLow, isHigh, handledByPac, goldWeight, orders }
}

// ─── Time Window ────────────────────────────────────────────────────

export function checkTimeWindow() {
  const now = new Date()
  // Convert to CET (UTC+1 or UTC+2 in summer)
  const cetOffset = getCETOffset()
  const cetHours = now.getUTCHours() + cetOffset
  const cetMinutes = now.getUTCMinutes()
  const cetTime = cetHours + cetMinutes / 60

  const isOpen = cetTime >= 15.5 && cetTime <= 16.5  // 15:30–16:30

  return {
    isOpen,
    cetTime: `${Math.floor(cetTime)}:${String(cetMinutes).padStart(2, '0')}`,
    message: isOpen
      ? 'Finestra operativa attiva (15:30–16:30 CET)'
      : 'Fuori finestra operativa — nessun ordine consigliato',
  }
}

function getCETOffset() {
  // Determine if DST (CEST = UTC+2) or CET (UTC+1)
  const now = new Date()
  const jan = new Date(now.getFullYear(), 0, 1)
  const jul = new Date(now.getFullYear(), 6, 1)
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset())
  const isDST = now.getTimezoneOffset() < stdOffset
  // For CET/CEST
  return isDST ? 2 : 1
}
