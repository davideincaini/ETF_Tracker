// Statistical utilities for Monte Carlo simulation

/**
 * Calculate daily returns from price history
 */
export function calculateReturns(priceHistory) {
    const returns = []
    for (let i = 1; i < priceHistory.length; i++) {
        const ret = (priceHistory[i].price - priceHistory[i - 1].price) / priceHistory[i - 1].price
        returns.push(ret)
    }
    return returns
}

/**
 * Calculate mean (average) of an array
 */
export function mean(values) {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values) {
    if (values.length < 2) return 0
    const avg = mean(values)
    const squareDiffs = values.map(value => Math.pow(value - avg, 2))
    const avgSquareDiff = mean(squareDiffs)
    return Math.sqrt(avgSquareDiff)
}

/**
 * Annualize daily returns (assuming 252 trading days per year)
 */
export function annualizeReturn(dailyReturn) {
    return dailyReturn * 252
}

/**
 * Annualize daily volatility
 */
export function annualizeVolatility(dailyVolatility) {
    return dailyVolatility * Math.sqrt(252)
}

/**
 * Calculate statistical parameters for an asset from its price history
 * Returns: { meanReturn, volatility, dataPoints }
 */
export function calculateAssetStats(priceHistory) {
    if (!priceHistory || priceHistory.length < 2) {
        return { meanReturn: 0, volatility: 0, dataPoints: 0 }
    }

    const returns = calculateReturns(priceHistory)
    const dailyMean = mean(returns)
    const dailyVol = standardDeviation(returns)

    return {
        meanReturn: annualizeReturn(dailyMean),
        volatility: annualizeVolatility(dailyVol),
        dataPoints: priceHistory.length,
    }
}

/**
 * Calculate statistics for all assets in a portfolio
 * Returns object: { ticker: { meanReturn, volatility, dataPoints } }
 */
export function calculatePortfolioStats(historyData) {
    const stats = {}

    for (const [ticker, history] of Object.entries(historyData)) {
        stats[ticker] = calculateAssetStats(history)
    }

    return stats
}

/**
 * Calculate percentiles from an array of values
 */
export function calculatePercentiles(values, percentiles = [10, 25, 50, 75, 90]) {
    if (values.length === 0) return {}

    const sorted = [...values].sort((a, b) => a - b)
    const result = {}

    for (const p of percentiles) {
        const index = Math.ceil((p / 100) * sorted.length) - 1
        result[`p${p}`] = sorted[Math.max(0, index)]
    }

    return result
}

/**
 * Box-Muller transform to generate normally distributed random numbers
 */
export function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * stdDev
}
