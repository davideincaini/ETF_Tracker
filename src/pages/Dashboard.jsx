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

const CATEGORY_COLORS = {
  Equity: '#34C759',
  Cash: '#5856D6',
  Bond: '#5856D6',
  Commodity: '#FF9500',
  Liquidity: '#007AFF',
}

export default function Dashboard({ tickers, holdings, transactions, prices, loading, getPortfolioValue, getWeights, history, onRangeChange, priceMetadata = {}, assetATH = {} }) {
  const [selectedEtf, setSelectedEtf] = useState(null)

  // Vault calculations
  const vaultBTotal = getPortfolioValue(prices, 'B', tickers)
  const vaultBWeights = getWeights(prices, 'B', tickers)
  const vaultATotal = getPortfolioValue(prices, 'A', tickers)
  const totalValue = vaultBTotal + vaultATotal
  const invested = transactions.reduce((s, tx) => s + (tx.type === 'sell' ? -tx.cost : tx.cost), 0)

  // Filter out Liquidity ETFs for allocation calculations (Vault B only)
  const allocTickers = tickers.filter((t) => t.category !== 'Liquidity' && t.vault === 'B')

  // Calculate Cash / Equity / Commodity percentage based on Vault B only
  const cashPct = allocTickers
    .filter((t) => t.category === 'Cash' || t.category === 'Bond')
    .reduce((s, t) => s + (vaultBWeights[t.ticker] || 0), 0)
  const equityPct = allocTickers
    .filter((t) => t.category === 'Equity')
    .reduce((s, t) => s + (vaultBWeights[t.ticker] || 0), 0)
  const commPct = allocTickers
    .filter((t) => t.category === 'Commodity')
    .reduce((s, t) => s + (vaultBWeights[t.ticker] || 0), 0)

  // Normalize assets to 100% (excluding Vault B liquidity)
  const sumAll = cashPct + equityPct + commPct
  const normalizedCashPct = sumAll > 0 ? cashPct / sumAll : 0.2
  const normalizedEquityPct = sumAll > 0 ? equityPct / sumAll : 0.7
  const normalizedCommPct = sumAll > 0 ? commPct / sumAll : 0.1

  const selectedTicker = selectedEtf ? tickers.find((t) => t.ticker === selectedEtf) : null

  // Only Vault B tickers for HoldingsList
  const vaultBTickers = tickers.filter(t => t.vault === 'B')

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
          Cash {vaultBTotal > 0 ? (normalizedCashPct * 100).toFixed(0) : 20}%
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-2xl"
          style={{ background: '#e8f9ed', color: '#1B7A33' }}
        >
          <TrendingUp size={13} />
          Equity {vaultBTotal > 0 ? (normalizedEquityPct * 100).toFixed(0) : 70}%
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
        tickers={vaultBTickers}
        holdings={holdings}
        prices={prices}
        weights={vaultBWeights}
        history={history}
        onSelect={setSelectedEtf}
        priceMetadata={priceMetadata}
        assetATH={assetATH}
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
          color={CATEGORY_COLORS[selectedTicker.category] || '#8E8E93'}
          transactions={transactions}
          targetWeight={selectedTicker.target_weight}
          totalValue={selectedTicker.vault === 'B' ? vaultBTotal : vaultATotal}
          onClose={() => setSelectedEtf(null)}
        />
      )}
    </div>
  )
}
