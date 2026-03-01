import { useState } from 'react'
import PortfolioCard from '../components/PortfolioCard'
import PerformanceOverview from '../components/PerformanceOverview'
import AllocationChart from '../components/AllocationChart'
import GrowthChart from '../components/GrowthChart'
import HoldingsList from '../components/HoldingsList'
import EtfDetail from '../components/EtfDetail'
import MetricsCard from '../components/MetricsCard'
import InvestedVsValueChart from '../components/InvestedVsValueChart'
import { Shield, TrendingUp, Coins } from 'lucide-react'

const COLORS = ['#5856D6', '#34C759', '#FF9500', '#FF2D55', '#007AFF', '#AF52DE']

export default function Dashboard({ tickers, holdings, transactions, prices, loading, getPortfolioValue, getWeights, history, onRangeChange, priceMetadata = {} }) {
  const [selectedEtf, setSelectedEtf] = useState(null)

  // Vault calculations
  const vaultBTotal = getPortfolioValue(prices, 'B', tickers)
  const vaultBWeights = getWeights(prices, 'B', tickers)
  const vaultATotal = getPortfolioValue(prices, 'A', tickers)
  const totalValue = vaultBTotal + vaultATotal
  const invested = transactions.reduce((s, tx) => s + (tx.type === 'sell' ? -tx.cost : tx.cost), 0)

  // Filter out Liquidity ETFs for allocation calculations (assuming Vault B only)
  const allocTickers = tickers.filter((t) => t.category !== 'Liquidity' && t.vault === 'B')

  // Calculate Bond / Equity / Commodity percentage based on Vault B only
  const bondPct = allocTickers
    .filter((t) => t.category === 'Bond')
    .reduce((s, t) => s + (vaultBWeights[t.ticker] || 0), 0)
  const equityPct = allocTickers
    .filter((t) => t.category === 'Equity')
    .reduce((s, t) => s + (vaultBWeights[t.ticker] || 0), 0)
  const commPct = allocTickers
    .filter((t) => t.category === 'Commodity')
    .reduce((s, t) => s + (vaultBWeights[t.ticker] || 0), 0)

  // Normalize assets to 100% (excluding Vault B liquidity)
  const sumAll = bondPct + equityPct + commPct
  const normalizedBondPct = sumAll > 0 ? bondPct / sumAll : 0.3
  const normalizedEquityPct = sumAll > 0 ? equityPct / sumAll : 0.6
  const normalizedCommPct = sumAll > 0 ? commPct / sumAll : 0.1

  const selectedTicker = selectedEtf ? tickers.find((t) => t.ticker === selectedEtf) : null
  const selectedIdx = selectedTicker ? tickers.indexOf(selectedTicker) : 0

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-1 pb-4">
      {/* Visualizziamo il patrimonio totale come somma dei Vault, ma specifichiamo */}
      <PortfolioCard totalValue={totalValue} invested={invested} loading={loading} priceMetadata={priceMetadata} prices={prices} />

      <PerformanceOverview totalValue={totalValue} invested={invested} />

      {/* Recap Vaults */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Shield size={12} /> Vault A (Emergenza)
          </p>
          <p className="text-lg font-bold" style={{ color: '#007AFF' }}>
            €{vaultATotal.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="p-3 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <TrendingUp size={12} /> Vault B (Investito)
          </p>
          <p className="text-lg font-bold" style={{ color: '#34C759' }}>
            €{vaultBTotal.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {invested > 0 && totalValue === 0 && !loading && (
        <div className="rounded-2xl p-4 mb-5 flex gap-3 items-start" style={{ background: '#fff0f0', border: '1px solid #FF3B30' }}>
          <Shield size={20} color="#FF3B30" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold" style={{ color: '#D70015' }}>Errore di Rete / API</p>
            <p className="text-xs mt-1" style={{ color: '#FF3B30' }}>
              Impossibile recuperare i prezzi live da Yahoo Finance. Attendi qualche minuto o controlla la connessione. I tuoi dati sono salvi.
            </p>
          </div>
        </div>
      )}

      {/* Category badges (basati solo su Vault B) */}
      <div className="flex gap-2 mb-5">
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-2xl"
          style={{ background: '#EDE7F6', color: '#5856D6' }}
        >
          <Shield size={13} />
          Bond {vaultBTotal > 0 ? (normalizedBondPct * 100).toFixed(0) : 30}%
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-2xl"
          style={{ background: '#e8f9ed', color: '#1B7A33' }}
        >
          <TrendingUp size={13} />
          Equity {vaultBTotal > 0 ? (normalizedEquityPct * 100).toFixed(0) : 60}%
        </div>
        {(commPct > 0 || totalValue === 0) && (
          <div
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-2xl"
            style={{ background: '#FFF4E5', color: '#FF9500' }}
          >
            <Coins size={13} />
            Gold {vaultBTotal > 0 ? (normalizedCommPct * 100).toFixed(0) : 10}%
          </div>
        )}
      </div>

      <GrowthChart history={history} holdings={holdings} onRangeChange={onRangeChange} transactions={transactions} />

      <MetricsCard
        tickers={tickers}
        holdings={holdings}
        prices={prices}
        transactions={transactions}
        history={history}
        totalValue={totalValue}
      />

      {/* Mostriamo i pesi relativi solo per gli allocation tickers nel Vault B */}
      <AllocationChart tickers={allocTickers} weights={vaultBWeights} holdings={holdings} />

      <HoldingsList
        tickers={tickers}
        holdings={holdings}
        prices={prices}
        weights={getWeights(prices)} // Passiamo tutti i pesi basati sul total value per la lista generale
        history={history}
        onSelect={setSelectedEtf}
        priceMetadata={priceMetadata}
      />

      <InvestedVsValueChart
        history={history}
        transactions={transactions}
      />

      {/* ETF detail bottom sheet */}
      {selectedEtf && selectedTicker && (
        <EtfDetail
          ticker={selectedEtf}
          name={selectedTicker.name}
          history={history}
          holdings={holdings}
          price={prices[selectedEtf] || 0}
          color={COLORS[selectedIdx % COLORS.length]}
          transactions={transactions}
          targetWeight={selectedTicker.target_weight}
          totalValue={selectedTicker.vault === 'B' ? vaultBTotal : vaultATotal} // Targets sono relativi al loro vault
          onClose={() => setSelectedEtf(null)}
        />
      )}
    </div>
  )
}
