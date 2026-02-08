import { useState, useEffect } from 'react'
import { Loader2, Play, Settings2 } from 'lucide-react'
import { fetchAllMaxHistory } from '../utils/api'
import { calculatePortfolioStats } from '../utils/statistics'
import { MonteCarloSimulator } from '../utils/montecarlo'
import FanChart from '../components/FanChart'
import DistributionChart from '../components/DistributionChart'
import SimulationMetrics from '../components/SimulationMetrics'

export default function MonteCarloPage({ tickers, holdings, prices, getPortfolioValue, getWeights }) {
    const [loading, setLoading] = useState(false)
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [simulating, setSimulating] = useState(false)
    const [progress, setProgress] = useState(0)
    const [maxHistory, setMaxHistory] = useState(null)
    const [results, setResults] = useState(null)

    // Simulation parameters
    const [timeHorizon, setTimeHorizon] = useState(10)
    const [monthlyContribution, setMonthlyContribution] = useState(500)
    const [numSimulations, setNumSimulations] = useState(10000)
    const [targetValue, setTargetValue] = useState('')

    const currentValue = getPortfolioValue(prices)
    const currentWeights = getWeights(prices)

    // Load max history on mount
    useEffect(() => {
        async function loadMaxHistory() {
            setLoadingHistory(true)
            try {
                const history = await fetchAllMaxHistory(tickers)
                setMaxHistory(history)
            } catch (e) {
                console.error('Failed to load max history:', e)
            }
            setLoadingHistory(false)
        }
        loadMaxHistory()
    }, [tickers])

    const runSimulation = async () => {
        if (!maxHistory) return

        setSimulating(true)
        setProgress(0)
        setResults(null)

        try {
            // Calculate asset statistics from max history
            const assetStats = calculatePortfolioStats(maxHistory)

            // Run Monte Carlo simulation
            const simulator = new MonteCarloSimulator()
            const simulationResults = await simulator.runSimulations(
                {
                    portfolioWeights: currentWeights,
                    assetStats,
                    timeHorizonYears: timeHorizon,
                    monthlyContribution,
                    currentValue,
                    numSimulations,
                },
                (prog) => setProgress(prog)
            )

            // Create histogram
            const histogram = MonteCarloSimulator.createHistogram(simulationResults.finalValues, 40)

            setResults({
                ...simulationResults,
                histogram,
            })
        } catch (e) {
            console.error('Simulation failed:', e)
        }

        setSimulating(false)
    }

    const totalContributions = currentValue + (monthlyContribution * 12 * timeHorizon)

    return (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
            <h1 className="text-lg font-bold mb-1">Simulatore Monte Carlo</h1>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                Proiezioni probabilistiche del portafoglio
            </p>

            {loadingHistory && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
                    <p className="ml-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Caricamento dati storici...
                    </p>
                </div>
            )}

            {!loadingHistory && maxHistory && (
                <>
                    {/* Input Controls */}
                    <div
                        className="rounded-3xl p-5 mb-4"
                        style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Settings2 size={16} style={{ color: 'var(--accent)' }} />
                            <p className="text-sm font-bold">Parametri Simulazione</p>
                        </div>

                        {/* Time Horizon */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                    Orizzonte Temporale
                                </label>
                                <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                                    {timeHorizon} {timeHorizon === 1 ? 'anno' : 'anni'}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="30"
                                value={timeHorizon}
                                onChange={(e) => setTimeHorizon(parseInt(e.target.value))}
                                className="w-full"
                                style={{ accentColor: 'var(--accent)' }}
                            />
                        </div>

                        {/* Monthly Contribution */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Contributo Mensile
                            </label>
                            <input
                                type="number"
                                value={monthlyContribution}
                                onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-2 rounded-xl text-sm"
                                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                                placeholder="€500"
                            />
                        </div>

                        {/* Number of Simulations */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Numero Simulazioni
                            </label>
                            <select
                                value={numSimulations}
                                onChange={(e) => setNumSimulations(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-xl text-sm"
                                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                            >
                                <option value="1000">1,000</option>
                                <option value="5000">5,000</option>
                                <option value="10000">10,000</option>
                                <option value="50000">50,000</option>
                            </select>
                        </div>

                        {/* Target Value (Optional) */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Valore Obiettivo (opzionale)
                            </label>
                            <input
                                type="number"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl text-sm"
                                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                                placeholder="€100,000"
                            />
                        </div>

                        {/* Run Button */}
                        <button
                            onClick={runSimulation}
                            disabled={simulating}
                            className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border-none cursor-pointer"
                            style={{
                                background: simulating ? 'var(--bg)' : 'var(--accent)',
                                color: simulating ? 'var(--text-secondary)' : '#fff',
                            }}
                        >
                            {simulating ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Simulazione in corso... {Math.round(progress * 100)}%
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    Avvia Simulazione
                                </>
                            )}
                        </button>
                    </div>

                    {/* Results */}
                    {results && (
                        <>
                            <SimulationMetrics
                                results={results}
                                targetValue={targetValue ? parseFloat(targetValue) : null}
                                totalContributions={totalContributions}
                            />

                            <FanChart
                                percentileTimelines={results.percentileTimelines}
                                timeHorizonYears={timeHorizon}
                                currentValue={currentValue}
                            />

                            <DistributionChart
                                histogramData={results.histogram}
                                median={results.percentiles.p50}
                                targetValue={targetValue ? parseFloat(targetValue) : null}
                            />
                        </>
                    )}

                    {/* Info about data */}
                    {maxHistory && !simulating && (
                        <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--bg)' }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Dati Storici Caricati
                            </p>
                            {Object.entries(maxHistory).map(([ticker, data]) => (
                                <div key={ticker} className="flex justify-between text-xs mb-1">
                                    <span>{ticker}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                        {data.length} punti dati ({Math.round(data.length / 252)} anni)
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
