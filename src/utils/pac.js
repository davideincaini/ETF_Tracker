/**
 * Smart PAC rebalancing: allocate budget proportionally to underweight ETFs,
 * and recursively consume leftover cash to ensure maximum budget efficiency.
 */
export function calculatePac(budget, holdings, prices, ObjectTickers) {
  let available = budget
  const tickers = ObjectTickers.filter(t => t.vault === 'B')
  const validTickers = tickers.filter(t => (prices[t.ticker] || 0) > 0)

  if (validTickers.length === 0) return { buys: [], deviations: [] }

  const portfolioValue = validTickers.reduce(
    (sum, t) => sum + (holdings[t.ticker] || 0) * prices[t.ticker],
    0
  )
  const totalAfter = portfolioValue + available

  let totalDeficit = 0
  const etfStats = validTickers.map((t) => {
    const currentVal = (holdings[t.ticker] || 0) * prices[t.ticker]
    const targetVal = totalAfter * t.target_weight
    let deficit = targetVal - currentVal
    if (deficit < 0) deficit = 0
    totalDeficit += deficit

    const currentWeight = portfolioValue > 0 ? (currentVal / portfolioValue) : 0
    const deviation = t.target_weight - currentWeight

    return { ...t, currentVal, targetVal, deficit, deviation, price: prices[t.ticker] }
  })

  const buys = []

  etfStats.forEach((t) => {
    // Proportional theoretical allocation
    const allocation = totalDeficit > 0
      ? available * (t.deficit / totalDeficit)
      : available * t.target_weight

    const shares = Math.floor(allocation / t.price)

    if (shares > 0) {
      buys.push({
        ticker: t.ticker,
        name: t.name,
        shares,
        cost: shares * t.price,
        deviation: t.deviation
      })
    }
  })

  // Second pass: use leftover cash to buy ETFs with highest remaining deficit
  let currentAvailable = available - buys.reduce((s, b) => s + b.cost, 0);
  let canBuyMore = true;

  while (canBuyMore && currentAvailable > 0) {
    canBuyMore = false;
    let maxDeficitETF = null;
    let maxDeficitVal = -Infinity;

    etfStats.forEach(t => {
      const buyNode = buys.find(b => b.ticker === t.ticker);
      const boughtShares = buyNode ? buyNode.shares : 0;
      const newVal = t.currentVal + (boughtShares * t.price);
      const newDeficit = totalAfter * t.target_weight - newVal;

      if (newDeficit > maxDeficitVal && currentAvailable >= t.price) {
        maxDeficitVal = newDeficit;
        maxDeficitETF = t;
      }
    });

    if (maxDeficitETF) {
      canBuyMore = true;
      const buyNode = buys.find(b => b.ticker === maxDeficitETF.ticker);
      if (buyNode) {
        buyNode.shares += 1;
        buyNode.cost += maxDeficitETF.price;
      } else {
        buys.push({
          ticker: maxDeficitETF.ticker,
          name: maxDeficitETF.name,
          shares: 1,
          cost: maxDeficitETF.price,
          deviation: maxDeficitETF.deviation
        });
      }
      currentAvailable -= maxDeficitETF.price;
    }
  }

  // Sort descending by cost so the biggest buys appear first
  buys.sort((a, b) => b.cost - a.cost)

  return { buys, deviations: etfStats.map(t => ({ ticker: t.ticker, deviation: t.deviation })) }
}
