import { TrendingUp, Target, AlertCircle } from 'lucide-react'

export default function SimulationMetrics({ results, targetValue, totalContributions }) {
    if (!results || !results.percentiles) return null

    const { percentiles, mean } = results
    const median = percentiles.p50
    const probability = targetValue ?
        (results.finalValues.filter(v => v >= targetValue).length / results.finalValues.length) * 100 :
        null

    const expectedGain = median - totalContributions
    const expectedReturn = totalContributions > 0 ? ((median / totalContributions - 1) * 100) : 0

    return (
        <div
            className="rounded-3xl p-5 mb-4"
            style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
            <p className="text-sm font-bold mb-4">Metriche Simulazione</p>

            {/* Main metrics grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Median value */}
                <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} style={{ color: '#34C759' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                            Valore Mediano
                        </p>
                    </div>
                    <p className="text-lg font-bold" style={{ color: '#34C759' }}>
                        €{median.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </p>
                </div>

                {/* Expected gain */}
                <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} style={{ color: expectedGain >= 0 ? '#34C759' : '#FF3B30' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                            Guadagno Atteso
                        </p>
                    </div>
                    <p className="text-lg font-bold" style={{ color: expectedGain >= 0 ? '#34C759' : '#FF3B30' }}>
                        €{expectedGain.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(1)}%
                    </p>
                </div>

                {/* Total contributions */}
                <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={14} style={{ color: '#007AFF' }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                            Investimento Totale
                        </p>
                    </div>
                    <p className="text-lg font-bold" style={{ color: '#007AFF' }}>
                        €{totalContributions.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                    </p>
                </div>

                {/* Probability of target */}
                {targetValue && (
                    <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <Target size={14} style={{ color: '#FF9500' }} />
                            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                                Prob. Obiettivo
                            </p>
                        </div>
                        <p className="text-lg font-bold" style={{ color: '#FF9500' }}>
                            {probability.toFixed(1)}%
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                            Target: €{targetValue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                )}
            </div>

            {/* Range info */}
            <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Range Proiezioni (10° - 90° percentile)
                </p>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pessimistico</p>
                        <p className="text-sm font-bold" style={{ color: '#FF3B30' }}>
                            €{percentiles.p10.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Mediano</p>
                        <p className="text-sm font-bold">
                            €{percentiles.p50.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ottimistico</p>
                        <p className="text-sm font-bold" style={{ color: '#34C759' }}>
                            €{percentiles.p90.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
