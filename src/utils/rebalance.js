/**
 * Antifragile Rebalancing Engine — "Bilanciere 70/20/10"
 *
 * Architecture:
 *   Motore Azionario (70%): XDPU (50%), EXUS (40%), EIMI (10%)
 *   Bunker Liquidità (20%): C3M — 3 "proiettili" da ~6.67% ciascuno
 *   Scudo Fiat (10%): SGLN — Oro fisico, bande ampie (7%–15%)
 *
 * Sensors:
 *   A. Drawdown Sensor — sblocca liquidità C3M durante crolli azionari
 *   B. Euphoria Sensor — taglia eccedenza azionaria quando peso ≥ 78%
 *   C. Internal Maintenance — ribilanciamento a somma zero tra equity ETFs
 *   D. Gold Shield — bande 7%–15% per SGLN
 */

const ATH_STORAGE_PREFIX = 'antigravity_equity_ath'

function athKey(portfolioId) {
  if (!portfolioId || portfolioId === 'bilanciere') return ATH_STORAGE_PREFIX
  return `${ATH_STORAGE_PREFIX}_${portfolioId}`
}

// ─── Constants ───────────────────────────────────────────────────────
export const EQUITY_TARGET = 0.70
export const CASH_TARGET = 0.20
export const GOLD_TARGET = 0.10

export const EUPHORIA_THRESHOLD = 0.78    // Peso equity ≥ 78% → taglia (+8pp dal target 70%)
export const GOLD_LOWER_BAND = 0.07       // Peso oro ≤ 7% → compra
export const GOLD_UPPER_BAND = 0.15       // Peso oro ≥ 15% → vendi

export const DRAWDOWN_TRIGGERS = [
  { level: 1, threshold: -0.15, label: '1° Proiettile', pctOfTotal: CASH_TARGET / 3 },
  { level: 2, threshold: -0.25, label: '2° Proiettile', pctOfTotal: CASH_TARGET / 3 },
  { level: 3, threshold: -0.40, label: '3° Proiettile', pctOfTotal: CASH_TARGET / 3 },
]

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
  const cashETF = vaultB.find(t => t.category === 'Cash')
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

  // ── Cash block ──
  const cashValue = cashETF ? (holdings[cashETF.ticker] || 0) * (prices[cashETF.ticker] || 0) : 0
  const cashWeight = totalValue > 0 ? cashValue / totalValue : 0

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

  // ── Sensor A: Drawdown (sblocco liquidità) ──
  const drawdownSignals = computeDrawdownSignals({
    equityDrawdown,
    cashValue,
    totalValue,
    equityInternals,
    prices,
    cashETF,
  })

  // ── Sensor B: Euphoria (taglio eccedenza) ──
  const euphoriaSignal = computeEuphoriaSignal({
    equityWeight,
    equityValue,
    totalValue,
    equityInternals,
    cashETF,
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
    cashETF,
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
    cashValue,
    cashWeight,
    goldValue,
    goldWeight,
    equityInternals,
    drawdownSignals,
    euphoriaSignal,
    internalSignal,
    goldSignal,
    timeWindow,
  }
}

// ─── Sensor A: Drawdown ─────────────────────────────────────────────

function computeDrawdownSignals({ equityDrawdown, cashValue, totalValue, equityInternals, prices, cashETF }) {
  const bulletSize = totalValue * (CASH_TARGET / 3)  // Each bullet = 1/3 of C3M (≈6.67% of total)
  const bulletsAvailable = cashValue > 0 ? Math.min(3, Math.floor(cashValue / bulletSize + 0.5)) : 0

  const triggered = DRAWDOWN_TRIGGERS.filter(t => equityDrawdown <= t.threshold)
  const activeLevel = triggered.length

  // How many bullets to fire
  const bulletsToFire = Math.min(activeLevel, bulletsAvailable)

  const orders = []
  const buyBreakdown = [] // Per-ETF detail of how the bullet is distributed

  if (bulletsToFire > 0 && cashETF) {
    const amountToInject = bulletSize * bulletsToFire

    // Find ETFs below their internal target (negative drift = underweight)
    const underweightETFs = equityInternals.filter(e => e.drift < 0)

    // Distribution: proportional to each ETF's deficit (absolute drift)
    // If no ETF is underweight (unlikely during drawdown), distribute by target weight
    let recipients = []
    if (underweightETFs.length > 0) {
      const totalDeficit = underweightETFs.reduce((s, e) => s + Math.abs(e.drift), 0)
      recipients = underweightETFs.map(e => ({
        ...e,
        share: Math.abs(e.drift) / totalDeficit,
      }))
    } else {
      // Fallback: distribute to all equity ETFs by internal target
      const totalTarget = equityInternals.reduce((s, e) => s + e.internalTarget, 0)
      recipients = equityInternals.map(e => ({
        ...e,
        share: totalTarget > 0 ? e.internalTarget / totalTarget : 1 / equityInternals.length,
      }))
    }

    let totalBuyAmount = 0
    for (const r of recipients) {
      const allocation = amountToInject * r.share
      const shares = Math.floor(allocation / r.price)
      if (shares > 0) {
        const amount = shares * r.price
        totalBuyAmount += amount
        orders.push({
          type: 'buy',
          ticker: r.ticker,
          name: r.name,
          shares,
          amount,
          reason: `Quota proiettile (${(r.share * 100).toFixed(0)}% — deficit ${(r.drift * 100).toFixed(1)}%)`,
        })
        buyBreakdown.push({
          ticker: r.ticker,
          name: r.name,
          shares,
          amount,
          share: r.share,
          drift: r.drift,
          internalWeight: r.internalWeight,
          internalTarget: r.internalTarget,
        })
      }
    }

    // Single sell order for C3M covering the total injection
    if (totalBuyAmount > 0) {
      const sharesToSellCash = Math.ceil(totalBuyAmount / (prices[cashETF.ticker] || 1))
      orders.unshift({
        type: 'sell',
        ticker: cashETF.ticker,
        shares: sharesToSellCash,
        amount: totalBuyAmount,
        reason: `Sblocco ${bulletsToFire} proiettile/i — distribuito su ${buyBreakdown.length} ETF`,
      })
    }
  }

  return {
    equityDrawdown,
    activeLevel,
    bulletsAvailable,
    bulletsToFire,
    buyBreakdown,
    orders,
    triggers: DRAWDOWN_TRIGGERS.map(t => ({
      ...t,
      active: equityDrawdown <= t.threshold,
    })),
  }
}

// ─── Sensor B: Euphoria ─────────────────────────────────────────────

function computeEuphoriaSignal({ equityWeight, equityValue, totalValue, equityInternals, cashETF, prices }) {
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

        if (cashETF) {
          const sharesToBuyCash = Math.floor(excess / (prices[cashETF.ticker] || 1))
          orders.push({
            type: 'buy',
            ticker: cashETF.ticker,
            shares: sharesToBuyCash,
            amount: sharesToBuyCash * (prices[cashETF.ticker] || 0),
            reason: 'Ricarica polveriera C3M',
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
  const drawdownActive = equityDrawdown <= DRAWDOWN_TRIGGERS[0].threshold
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

function computeGoldSignal({ goldWeight, goldValue, totalValue, goldETF, cashETF, equityDrawdown, equityInternals, prices }) {
  const isLow = goldWeight <= GOLD_LOWER_BAND && goldWeight > 0
  const isHigh = goldWeight >= GOLD_UPPER_BAND
  const orders = []

  if (!goldETF) return { isLow: false, isHigh: false, goldWeight, orders }

  if (isLow && cashETF && totalValue > 0) {
    // Buy gold from cash to bring back to 10%
    const targetGoldValue = totalValue * GOLD_TARGET
    const deficit = targetGoldValue - goldValue
    const goldPrice = prices[goldETF.ticker] || 0

    if (deficit > 0 && goldPrice > 0) {
      const sharesToBuy = Math.floor(deficit / goldPrice)
      const cashSharestoSell = Math.ceil(deficit / (prices[cashETF.ticker] || 1))

      if (sharesToBuy > 0) {
        orders.push({
          type: 'sell',
          ticker: cashETF.ticker,
          shares: cashSharestoSell,
          amount: deficit,
          reason: 'Prelievo da C3M per Scudo Oro',
        })
        orders.push({
          type: 'buy',
          ticker: goldETF.ticker,
          shares: sharesToBuy,
          amount: sharesToBuy * goldPrice,
          reason: 'Ricostituzione Scudo Oro al 10%',
        })
      }
    }
  }

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

      // Destination: cash, unless equity is also in drawdown
      const equityInDrawdown = equityDrawdown <= DRAWDOWN_TRIGGERS[0].threshold
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
      } else if (cashETF) {
        orders.push({
          type: 'buy',
          ticker: cashETF.ticker,
          shares: Math.floor(excess / (prices[cashETF.ticker] || 1)),
          amount: excess,
          reason: 'Ricarica polveriera C3M',
        })
      }
    }
  }

  return { isLow, isHigh, goldWeight, orders }
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
