import { useState, useEffect, useMemo } from 'react'
import { fetchAllMaxHistory } from '../utils/api'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

export default function PerformancePage({ tickers, transactions, prices }) {
    const [historyData, setHistoryData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        async function loadHistory() {
            try {
                const data = await fetchAllMaxHistory(tickers)
                if (active) setHistoryData(data)
            } catch (e) {
                console.error('Failed to load max history', e)
            } finally {
                if (active) setLoading(false)
            }
        }
        loadHistory()
        return () => { active = false }
    }, [tickers])

    const yearlyData = useMemo(() => {
        if (!historyData || transactions.length === 0) return []

        // 1. Group transactions by year to calculate invested capital
        const txByYear = {}
        const holdingsByYearAndTicker = {}

        // Sort transactions chronologically
        const sortedTxns = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))

        // Current running state
        let runningHoldings = {}
        let runningInvested = 0

        // Get the range of years
        const startYear = new Date(sortedTxns[0].date).getFullYear()
        const currentYear = new Date().getFullYear()

        for (let year = startYear; year <= currentYear; year++) {
            txByYear[year] = { invested: runningInvested, txns: [] }
            holdingsByYearAndTicker[year] = { ...runningHoldings }
        }

        sortedTxns.forEach(tx => {
            const year = new Date(tx.date).getFullYear()
            const isBuy = tx.type === 'buy'

            // Update running state
            runningHoldings[tx.ticker] = (runningHoldings[tx.ticker] || 0) + (isBuy ? tx.shares : -tx.shares)
            if (runningHoldings[tx.ticker] === 0) delete runningHoldings[tx.ticker]

            runningInvested += isBuy ? tx.cost : -tx.cost // very basic tracking of net invested

            // Fast forward updating subsequent years' starting state
            for (let y = year; y <= currentYear; y++) {
                txByYear[y].invested = runningInvested
                holdingsByYearAndTicker[y] = { ...runningHoldings }
            }
        })

        // 2. Find the last price of each year for each ticker
        const getEndOfYearPrice = (ticker, year) => {
            if (year === currentYear) return prices[ticker] || 0 // Use real-time price for current year

            const tHistory = historyData[ticker]
            if (!tHistory || tHistory.length === 0) return prices[ticker] || 0

            // Find the last recorded price in that year
            const yearEndTimestamp = new Date(`${year}-12-31T23:59:59Z`).getTime()

            let lastPrice = null
            for (let i = tHistory.length - 1; i >= 0; i--) {
                if (tHistory[i].date <= yearEndTimestamp) {
                    lastPrice = tHistory[i].price
                    break
                }
            }
            return lastPrice !== null ? lastPrice : (prices[ticker] || 0)
        }

        // 3. Assemble the yearly view
        const result = []

        for (let year = currentYear; year >= startYear; year--) {
            const holdings = holdingsByYearAndTicker[year]
            if (Object.keys(holdings).length === 0 && year !== currentYear) continue

            let yearEndValue = 0
            const etfBreakdown = []

            for (const [ticker, shares] of Object.entries(holdings)) {
                if (shares <= 0) continue
                const price = getEndOfYearPrice(ticker, year)
                const value = shares * price

                // Find previous year value for this ETF to calculate YoY return
                const prevHoldings = holdingsByYearAndTicker[year - 1] || {}
                const prevShares = prevHoldings[ticker] || 0
                const prevPrice = getEndOfYearPrice(ticker, year - 1)
                const prevValue = prevShares * prevPrice

                let etfYoyPct = 0
                if (prevValue > 0) {
                    etfYoyPct = ((value - prevValue) / prevValue) * 100
                }

                yearEndValue += value
                etfBreakdown.push({
                    ticker,
                    shares,
                    price,
                    value,
                    prevValue,
                    etfYoyPct
                })
            }

            const invested = txByYear[year].invested
            const profit = yearEndValue - invested
            const profitPct = invested > 0 ? (profit / invested) * 100 : 0

            // Compute YoY Portfolio Return
            let yoyReturn = 0
            const prevYearData = holdingsByYearAndTicker[year - 1]

            if (prevYearData) {
                let prevYearValue = 0
                for (const [ticker, shares] of Object.entries(prevYearData)) {
                    prevYearValue += shares * getEndOfYearPrice(ticker, year - 1)
                }
                if (prevYearValue > 0) {
                    // Rough YoY calculation (Value End / Value Start) - this ignores cashflows during the year for simplicity
                    yoyReturn = ((yearEndValue - prevYearValue) / prevYearValue) * 100
                }
            }

            result.push({
                year,
                invested,
                yearEndValue,
                profit,
                profitPct,
                yoyReturn,
                etfs: etfBreakdown.sort((a, b) => b.value - a.value)
            })
        }

        return result
    }, [historyData, transactions, prices])

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <Clock size={32} className="text-gray-300 mb-4 animate-spin" />
                <p className="text-sm font-semibold text-gray-400">Calcolo Crescita Storica...</p>
                <p className="text-xs text-gray-400 mt-2 text-center">Analizzando i prezzi di chiusura annuali</p>
            </div>
        )
    }

    if (yearlyData.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <p className="font-semibold text-lg">Nessun dato storico</p>
                <p className="text-sm mt-2">Aggiungi delle transazioni per visualizzare la crescita anno per anno.</p>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
            <div className="mb-6">
                <h1 className="text-xl font-bold mb-1">Performance</h1>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Crescita del capitale anno su anno
                </p>
            </div>

            <div className="flex flex-col gap-5">
                {yearlyData.map(data => {
                    const isCurrentYear = data.year === new Date().getFullYear();
                    return (
                        <div
                            key={data.year}
                            className="rounded-3xl p-5"
                            style={{
                                background: 'var(--card)',
                                boxShadow: isCurrentYear ? '0 4px 16px rgba(0,122,255,0.1)' : '0 2px 12px rgba(0,0,0,0.06)',
                                border: isCurrentYear ? '1px solid rgba(0,122,255,0.2)' : 'none'
                            }}
                        >
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl flex flex-col items-center justify-center font-bold text-white text-sm" style={{ background: isCurrentYear ? '#007AFF' : '#1C1C1E' }}>
                                        {data.year}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            {isCurrentYear ? 'Valore Attuale' : 'Valore di Chiusura'}
                                        </p>
                                        <p className="text-xl font-black">€{data.yearEndValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Capitale Netto</p>
                                    <p className="font-semibold text-sm">€{data.invested.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="p-3 rounded-2xl" style={{ background: data.profit >= 0 ? '#e8f9ed' : '#fff0f0' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: data.profit >= 0 ? '#1B7A33' : '#D70015' }}>Profitto (All time)</p>
                                    <div className="flex items-center gap-1">
                                        {data.profit >= 0 ? <TrendingUp size={14} color="#34C759" /> : <TrendingDown size={14} color="#FF3B30" />}
                                        <p className="font-semibold text-sm" style={{ color: data.profit >= 0 ? '#34C759' : '#FF3B30' }}>
                                            {data.profit >= 0 ? '+' : ''}{data.profitPct.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold mb-3 px-1" style={{ color: 'var(--text-secondary)' }}>Breakdown Asset ({data.year})</p>
                                <div className="flex flex-col gap-2">
                                    {data.etfs.map(etf => (
                                        <div key={etf.ticker} className="flex justify-between items-center p-3 rounded-2xl bg-white" style={{ border: '1px solid #E5E5EA' }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] text-gray-600 bg-gray-100">
                                                    {etf.ticker.replace('.MI', '')}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">
                                                        €{(etf.value).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </p>
                                                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                                        {etf.shares} quote
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-1.5">
                                                {etf.etfYoyPct !== 0 && (
                                                    <>
                                                        {etf.etfYoyPct > 0 ? <TrendingUp size={12} color="#34C759" /> : <TrendingDown size={12} color="#FF3B30" />}
                                                        <span className="text-xs font-bold" style={{ color: etf.etfYoyPct > 0 ? '#34C759' : '#FF3B30' }}>
                                                            {etf.etfYoyPct > 0 ? '+' : ''}{etf.etfYoyPct.toFixed(1)}%
                                                        </span>
                                                    </>
                                                )}
                                                {etf.etfYoyPct === 0 && <span className="text-xs font-bold text-gray-400">—</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
