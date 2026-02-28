import { AlertTriangle, CheckCircle } from 'lucide-react'

export default function RebalancePage({ tickers, holdings, prices, getPortfolioValue, getWeights }) {
    // Solo Vault B per il ribilanciamento
    const vaultBTickers = tickers.filter(t => t.vault === 'B')
    const vaultBTotal = getPortfolioValue(prices, 'B', tickers)
    const vaultBWeights = getWeights(prices, 'B', tickers)

    // Calcola le violazioni
    const violations = vaultBTickers.map(t => {
        const currentWeight = vaultBWeights[t.ticker] || 0
        const threshold = t.sell_threshold || (t.target_weight + 0.1) // Default asimmetrico basico se manca

        if (currentWeight > threshold) {
            const eccedenzaPct = currentWeight - t.target_weight
            const importoDaVendere = eccedenzaPct * vaultBTotal
            const numQuoteDaVendere = Math.ceil(importoDaVendere / (prices[t.ticker] || 1))

            return {
                ...t,
                currentWeight,
                threshold,
                eccedenzaPct,
                importoDaVendere,
                numQuoteDaVendere
            }
        }
        return null
    }).filter(v => v !== null)

    return (
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
            <div className="mb-5">
                <h1 className="text-xl font-bold mb-1">Check-up Annuale</h1>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Tagliola Ribilanciamento: intercettazione derive strutturali
                </p>
            </div>

            {violations.length === 0 ? (
                <div
                    className="rounded-3xl p-6 flex flex-col items-center justify-center text-center mt-8"
                    style={{ background: '#e8f9ed', border: '1px solid #34C759' }}
                >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#34C759' }}>
                        <CheckCircle size={32} color="#ffffff" />
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: '#1B7A33' }}>Nessun intervento richiesto</h2>
                    <p className="text-sm mt-2 font-medium" style={{ color: '#248A3D' }}>
                        Tutti gli asset del Vault B sono sotto le soglie di tolleranza di vendita. Fai scorrere i profitti.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4 mt-4">
                    <div className="rounded-3xl p-5 mb-2" style={{ background: '#fff0f0', border: '1px solid #FF3B30' }}>
                        <div className="flex items-center gap-3 mb-2">
                            <AlertTriangle size={24} color="#FF3B30" />
                            <h2 className="text-lg font-bold" style={{ color: '#D70015' }}>Allarme Ribilanciamento</h2>
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#FF3B30' }}>
                            Dei pesi reali hanno superato la soglia massima asimmetrica consentita.
                            Vendi l'eccedenza per estrarre liquidità e tornare al target teorico.
                        </p>
                    </div>

                    {violations.map((v) => (
                        <div
                            key={v.ticker}
                            className="rounded-3xl p-5"
                            style={{ background: 'var(--card)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                        >
                            <div className="flex justify-between items-center mb-4 border-b pb-3 border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: '#FF3B30' }}>
                                        {v.ticker.replace('.MI', '')}
                                    </div>
                                    <span className="font-bold">{v.ticker.replace('.MI', '')}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Peso Attuale</p>
                                    <p className="font-bold text-[#FF3B30]">{(v.currentWeight * 100).toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Target Teorico</p>
                                    <p className="font-semibold">{(v.target_weight * 100).toFixed(1)}%</p>
                                </div>
                                <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Soglia Vendita</p>
                                    <p className="font-semibold">&gt;{(v.threshold * 100).toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl flex justify-between items-center" style={{ background: '#fff0f0' }}>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#D70015' }}>Capitale da Vendere</p>
                                    <p className="text-xl font-black" style={{ color: '#FF3B30' }}>€{v.importoDaVendere.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold" style={{ color: '#D70015' }}>~ {v.numQuoteDaVendere} quote</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
