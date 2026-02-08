// Monte Carlo simulation interface
// Manages Web Worker lifecycle and provides promise-based API

// Import worker using Vite's syntax
import MonteCarloWorker from '/public/montecarlo.worker.js?worker'

export class MonteCarloSimulator {
    constructor() {
        this.worker = null
    }

    /**
     * Run Monte Carlo simulations
     * @param {Object} params - Simulation parameters
     * @param {Object} params.portfolioWeights - Asset weights { ticker: weight }
     * @param {Object} params.assetStats - Asset statistics { ticker: { meanReturn, volatility } }
     * @param {number} params.timeHorizonYears - Simulation horizon in years
     * @param {number} params.monthlyContribution - Monthly contribution amount
     * @param {number} params.currentValue - Current portfolio value
     * @param {number} params.numSimulations - Number of simulations to run
     * @param {Function} onProgress - Progress callback (0-1)
     * @returns {Promise<Object>} Simulation results
     */
    async runSimulations(params, onProgress = null) {
        return new Promise((resolve, reject) => {
            // Create worker using Vite's imported worker
            this.worker = new MonteCarloWorker()

            // Handle messages from worker
            this.worker.onmessage = (e) => {
                const { type, results, progress } = e.data

                if (type === 'PROGRESS' && onProgress) {
                    onProgress(progress)
                } else if (type === 'COMPLETE') {
                    this.terminate()
                    resolve(results)
                }
            }

            // Handle errors
            this.worker.onerror = (error) => {
                console.error('Worker error:', error)
                this.terminate()
                reject(error)
            }

            // Start simulations
            this.worker.postMessage({
                type: 'RUN_SIMULATIONS',
                params,
            })
        })
    }

    /**
     * Terminate the worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate()
            this.worker = null
        }
    }

    /**
     * Calculate probability of reaching a target value
     * @param {Array<number>} finalValues - Array of simulation final values
     * @param {number} targetValue - Target value to reach
     * @returns {number} Probability (0-1)
     */
    static calculateProbability(finalValues, targetValue) {
        if (finalValues.length === 0) return 0
        const successes = finalValues.filter(v => v >= targetValue).length
        return successes / finalValues.length
    }

    /**
     * Create histogram bins from final values
     * @param {Array<number>} finalValues - Array of simulation final values
     * @param {number} numBins - Number of bins
     * @returns {Array<Object>} Histogram data
     */
    static createHistogram(finalValues, numBins = 50) {
        if (finalValues.length === 0) return []

        const min = Math.min(...finalValues)
        const max = Math.max(...finalValues)

        // Handle edge case where all values are the same
        if (min === max) {
            return [{
                range: `€${Math.round(min / 1000)}k`,
                count: finalValues.length,
                percentage: 100,
                midpoint: min,
            }]
        }

        const binSize = (max - min) / numBins

        const bins = Array(numBins).fill(0).map((_, i) => ({
            min: min + i * binSize,
            max: min + (i + 1) * binSize,
            count: 0,
        }))

        // Count values in each bin
        finalValues.forEach(value => {
            const binIndex = Math.min(Math.floor((value - min) / binSize), numBins - 1)
            if (bins[binIndex]) {
                bins[binIndex].count++
            }
        })

        // Convert to percentage
        return bins.map(bin => ({
            range: `€${Math.round(bin.min / 1000)}k`,
            count: bin.count,
            percentage: (bin.count / finalValues.length) * 100,
            midpoint: (bin.min + bin.max) / 2,
        }))
    }
}

