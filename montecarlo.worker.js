// Monte Carlo Web Worker
// Runs simulations in background thread to keep UI responsive

// Box-Muller transform for normal distribution
function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * stdDev
}

// Calculate percentiles from sorted array
function calculatePercentiles(values, percentiles = [10, 25, 50, 75, 90]) {
    if (values.length === 0) return {}

    const sorted = [...values].sort((a, b) => a - b)
    const result = {}

    for (const p of percentiles) {
        const index = Math.ceil((p / 100) * sorted.length) - 1
        result[`p${p}`] = sorted[Math.max(0, index)]
    }

    return result
}

// Run a single Monte Carlo simulation
function runSimulation(params) {
    const {
        portfolioWeights,  // { ticker: weight }
        assetStats,        // { ticker: { meanReturn, volatility } }
        timeHorizonYears,
        monthlyContribution,
        currentValue,
    } = params

    const months = timeHorizonYears * 12
    let portfolioValue = currentValue
    const timeline = [portfolioValue]

    for (let month = 0; month < months; month++) {
        // Add monthly contribution
        portfolioValue += monthlyContribution

        // Calculate portfolio return for this month
        let portfolioReturn = 0

        for (const [ticker, weight] of Object.entries(portfolioWeights)) {
            const stats = assetStats[ticker]
            if (!stats) continue

            // Generate random monthly return
            const monthlyMean = stats.meanReturn / 12
            const monthlyVol = stats.volatility / Math.sqrt(12)
            const assetReturn = randomNormal(monthlyMean, monthlyVol)

            portfolioReturn += weight * assetReturn
        }

        // Apply return to portfolio
        portfolioValue *= (1 + portfolioReturn)
        timeline.push(portfolioValue)
    }

    return { finalValue: portfolioValue, timeline }
}

// Main worker message handler
self.onmessage = function (e) {
    const { type, params } = e.data

    if (type === 'RUN_SIMULATIONS') {
        const {
            portfolioWeights,
            assetStats,
            timeHorizonYears,
            monthlyContribution,
            currentValue,
            numSimulations = 10000,
        } = params

        const results = []
        const timelineData = [] // Store some timelines for visualization
        const storeSampleTimelines = Math.min(100, numSimulations) // Store up to 100 timelines

        // Run simulations
        for (let i = 0; i < numSimulations; i++) {
            const result = runSimulation({
                portfolioWeights,
                assetStats,
                timeHorizonYears,
                monthlyContribution,
                currentValue,
            })

            results.push(result.finalValue)

            // Store some sample timelines for visualization
            if (i < storeSampleTimelines) {
                timelineData.push(result.timeline)
            }

            // Send progress updates every 1000 simulations
            if ((i + 1) % 1000 === 0) {
                self.postMessage({
                    type: 'PROGRESS',
                    progress: (i + 1) / numSimulations,
                })
            }
        }

        // Calculate percentiles
        const percentiles = calculatePercentiles(results)

        // Calculate percentile timelines (for fan chart)
        const months = timeHorizonYears * 12
        const percentileTimelines = {
            p10: [],
            p25: [],
            p50: [],
            p75: [],
            p90: [],
        }

        for (let month = 0; month <= months; month++) {
            const valuesAtMonth = timelineData.map(timeline => timeline[month])
            const percentilesAtMonth = calculatePercentiles(valuesAtMonth)

            percentileTimelines.p10.push(percentilesAtMonth.p10)
            percentileTimelines.p25.push(percentilesAtMonth.p25)
            percentileTimelines.p50.push(percentilesAtMonth.p50)
            percentileTimelines.p75.push(percentilesAtMonth.p75)
            percentileTimelines.p90.push(percentilesAtMonth.p90)
        }

        // Send final results
        self.postMessage({
            type: 'COMPLETE',
            results: {
                finalValues: results,
                percentiles,
                percentileTimelines,
                mean: results.reduce((a, b) => a + b, 0) / results.length,
                min: Math.min(...results),
                max: Math.max(...results),
            },
        })
    }
}
