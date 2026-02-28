import { useState } from 'react'
import { AlertTriangle, CheckCircle, Settings2, ChevronDown, ChevronUp, Save } from 'lucide-react'

function ThresholdInput({ ticker, initialThreshold, onSave }) {
    const [val, setVal] = useState(String(Math.round(initialThreshold * 1000) / 10))
    const [savePhase, setSavePhase] = useState(0) // 0 = idle, 1 = confirm

    const handleChange = (e) => {
        setVal(e.target.value)
        setSavePhase(1)
    }

    const handleSave = () => {
        if (savePhase === 1) {
            setSavePhase(2)
        } else if (savePhase === 2) {
            const num = parseFloat(val)
            if (!isNaN(num)) onSave(ticker, num / 100)
            setSavePhase(0)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <input
                    type="number"
                    step="0.1"
                    className="w-20 px-2 py-1.5 text-sm font-bold border rounded-lg text-right focus:outline-none transition-colors"
                    style={{
                        borderColor: savePhase > 0 ? '#FF9500' : '#E5E5EA',
                        background: 'var(--bg)',
                        color: savePhase > 0 ? '#FF9500' : 'inherit'
                    }}
                    value={val}
                    onChange={handleChange}
                />
            </div>
            <span className="text-sm font-bold text-gray-500">%</span>

            {savePhase > 0 && (
                <button
                    onClick={handleSave}
                    className="h-8 px-3 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-colors cursor-pointer border-none"
                    style={{ background: savePhase === 1 ? '#FF9500' : '#FF3B30' }}
                >
                    {savePhase === 1 ? 'Salva' : 'Conferma'}
                </button>
            )}
        </div>
    )
}

export default function RebalancePage({ tickers, holdings, prices, getPortfolioValue, getWeights, updateThreshold }) {
    const [showSettings, setShowSettings] = useState(false)

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

            <div className="mt-8 mb-6">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border-none cursor-pointer transition-all active:scale-95"
                    style={{ border: '1px solid #E5E5EA', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <Settings2 size={16} className="text-gray-600" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-800">Soglie Asimmetriche</h2>
                    </div>
                    {showSettings ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </button>

                {showSettings && (
                    <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="p-4 rounded-2xl mb-4" style={{ background: '#fff9e6', border: '1px solid #FFCC00' }}>
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={16} color="#FF9500" className="mt-0.5 shrink-0" />
                                <p className="text-xs leading-relaxed" style={{ color: '#A25F00' }}>
                                    <strong className="block mb-1">Zona di Pericolo</strong>
                                    Modificare le soglie altera pesantemente la sensibilità dell'algoritmo di Ribilanciamento. Richiede doppia conferma per il salvataggio.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            {vaultBTickers.map((t) => {
                                const currentWeight = vaultBWeights[t.ticker] || 0
                                const threshold = t.sell_threshold || (t.target_weight + 0.1)

                                return (
                                    <div key={t.ticker} className="flex justify-between items-center p-3.5 rounded-2xl bg-white" style={{ border: '1px solid #E5E5EA', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-sm text-gray-800">{t.ticker.split('.')[0]}</span>
                                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded text-white" style={{ background: t.category === 'Bond' ? '#5856D6' : t.category === 'Liquidity' ? '#007AFF' : '#34C759' }}>{t.category.substring(0, 3)}</span>
                                            </div>
                                            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                                Target: {(t.target_weight * 100).toFixed(0)}% | Attuale: <span style={{ color: currentWeight > threshold ? '#FF3B30' : 'inherit' }}>{(currentWeight * 100).toFixed(1)}%</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 relative">
                                            <span className="absolute -left-3 text-xs font-bold text-gray-400">&gt;</span>
                                            <ThresholdInput
                                                ticker={t.ticker}
                                                initialThreshold={threshold}
                                                onSave={updateThreshold}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
