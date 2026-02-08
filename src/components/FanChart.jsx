import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function FanChart({ percentileTimelines, timeHorizonYears, currentValue }) {
    if (!percentileTimelines || !percentileTimelines.p50) return null

    const months = timeHorizonYears * 12

    // Create chart data
    const chartData = []
    for (let month = 0; month <= months; month++) {
        chartData.push({
            month,
            year: (month / 12).toFixed(1),
            p10: percentileTimelines.p10[month] || 0,
            p25: percentileTimelines.p25[month] || 0,
            p50: percentileTimelines.p50[month] || 0,
            p75: percentileTimelines.p75[month] || 0,
            p90: percentileTimelines.p90[month] || 0,
        })
    }

    const isPositive = (percentileTimelines.p50[months] || 0) > currentValue

    return (
        <div
            className="rounded-3xl p-5 mb-4"
            style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
            <div className="mb-4">
                <p className="text-sm font-bold mb-1">Proiezione Monte Carlo</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Simulazione su {timeHorizonYears} {timeHorizonYears === 1 ? 'anno' : 'anni'}
                </p>
            </div>

            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="grad90" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0.1} />
                            <stop offset="100%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="grad75" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={isPositive ? '#34C759' : '#FF3B30'} stopOpacity={0.1} />
                        </linearGradient>
                    </defs>

                    <XAxis
                        dataKey="year"
                        tick={{ fontSize: 10, fill: '#8E8E93' }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Anni', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#8E8E93' }}
                    />

                    <YAxis
                        tick={{ fontSize: 10, fill: '#8E8E93' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                    />

                    <Tooltip
                        formatter={(value) => [`€${value.toLocaleString('it-IT', { minimumFractionDigits: 0 })}`, '']}
                        labelFormatter={(label) => `Anno ${label}`}
                        contentStyle={{
                            borderRadius: 12,
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            fontSize: 11,
                        }}
                    />

                    {/* 10th-90th percentile band (lightest) */}
                    <Area
                        type="monotone"
                        dataKey="p90"
                        stroke="none"
                        fill="url(#grad90)"
                    />
                    <Area
                        type="monotone"
                        dataKey="p10"
                        stroke="none"
                        fill="var(--card)"
                    />

                    {/* 25th-75th percentile band (medium) */}
                    <Area
                        type="monotone"
                        dataKey="p75"
                        stroke="none"
                        fill="url(#grad75)"
                    />
                    <Area
                        type="monotone"
                        dataKey="p25"
                        stroke="none"
                        fill="var(--card)"
                    />

                    {/* Median line (bold) */}
                    <Area
                        type="monotone"
                        dataKey="p50"
                        stroke={isPositive ? '#34C759' : '#FF3B30'}
                        strokeWidth={2.5}
                        fill="none"
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: isPositive ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)' }} />
                    <span>10°-90° percentile</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: isPositive ? 'rgba(52, 199, 89, 0.2)' : 'rgba(255, 59, 48, 0.2)' }} />
                    <span>25°-75° percentile</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5" style={{ background: isPositive ? '#34C759' : '#FF3B30' }} />
                    <span>Mediana</span>
                </div>
            </div>
        </div>
    )
}
