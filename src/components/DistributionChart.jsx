import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DistributionChart({ histogramData, median, targetValue }) {
    if (!histogramData || histogramData.length === 0) return null

    return (
        <div
            className="rounded-3xl p-5 mb-4"
            style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
            <div className="mb-4">
                <p className="text-sm font-bold mb-1">Distribuzione Risultati</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Frequenza dei valori finali del portafoglio
                </p>
            </div>

            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={histogramData}>
                    <XAxis
                        dataKey="range"
                        tick={{ fontSize: 9, fill: '#8E8E93' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />

                    <YAxis
                        tick={{ fontSize: 10, fill: '#8E8E93' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                    />

                    <Tooltip
                        formatter={(value) => [`${value.toFixed(2)}%`, 'Frequenza']}
                        labelFormatter={(label) => `Range: ${label}`}
                        contentStyle={{
                            borderRadius: 12,
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            fontSize: 11,
                        }}
                    />

                    <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                        {histogramData.map((entry, index) => {
                            let color = '#5856D6'

                            // Highlight median bin
                            if (median && Math.abs(entry.midpoint - median) < (histogramData[1]?.midpoint - histogramData[0]?.midpoint || 1000)) {
                                color = '#34C759'
                            }

                            // Highlight target bin if provided
                            if (targetValue && Math.abs(entry.midpoint - targetValue) < (histogramData[1]?.midpoint - histogramData[0]?.midpoint || 1000)) {
                                color = '#FF9500'
                            }

                            return <Cell key={`cell-${index}`} fill={color} />
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex justify-center gap-3 mt-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: '#5856D6' }} />
                    <span>Distribuzione</span>
                </div>
                {median && (
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm" style={{ background: '#34C759' }} />
                        <span>Mediana</span>
                    </div>
                )}
                {targetValue && (
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm" style={{ background: '#FF9500' }} />
                        <span>Obiettivo</span>
                    </div>
                )}
            </div>
        </div>
    )
}
