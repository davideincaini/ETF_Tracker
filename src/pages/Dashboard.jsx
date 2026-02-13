import { useState } from 'react'
import PortfolioCard from '../components/PortfolioCard'
import PerformanceOverview from '../components/PerformanceOverview'
import AllocationChart from '../components/AllocationChart'
import GrowthChart from '../components/GrowthChart'
import HoldingsList from '../components/HoldingsList'
import EtfDetail from '../components/EtfDetail'
import MetricsCard from '../components/MetricsCard'
import InvestedVsValueChart from '../components/InvestedVsValueChart'
import { Shield, TrendingUp } from 'lucide-react'

const COLORS = ['#5856D6', '#34C759', '#FF9500', '#FF2D55', '#007AFF', '#AF52DE']

export default function Dashboard({ tickers, holdings, transactions, prices, loading, getPortfolioValue, getWeights, history, onRangeChange, priceMetadata = {} }) {
  const [selectedEtf, setSelectedEtf] = useState(null)

  const totalValue = getPortfolioValue(prices)
  const invested = transactions.reduce((s, tx) => s + (tx.type === 'sell' ? -tx.cost : tx.cost), 0)
  const weights = getWeights(prices)

  // Filter out Liquidity ETFs for allocation calculations
  const allocTickers = tickers.filter((t) => t.category !== 'Liquidity')

  // Recalculate weights excluding Liquidity for allocation display
  const allocTotal = allocTickers.reduce((s, t) => s + (holdings[t.ticker] || 0) * (prices[t.ticker] || 0), 0)
  const allocWeights = {}
  if (allocTotal > 0) {
    for (const t of allocTickers) {
      allocWeights[t.ticker] = ((holdings[t.ticker] || 0) * (prices[t.ticker] || 0)) / allocTotal
    }
  }

  const bondPct = allocTickers
    .filter((t) => t.category === 'Bond')
    .reduce((s, t) => s + (allocWeights[t.ticker] || 0), 0)
  const equityPct = 1 - bondPct

  const selectedTicker = selectedEtf ? tickers.find((t) => t.ticker === selectedEtf) : null
  const selectedIdx = selectedTicker ? tickers.indexOf(selectedTicker) : 0

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-1 pb-4">
      <PortfolioCard totalValue={totalValue} invested={invested} loading={loading} priceMetadata={priceMetadata} prices={prices} />

      <PerformanceOverview totalValue={totalValue} invested={invested} />

      {/* Category badges */}
      <div className="flex gap-2 mb-5">
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-2xl"
          style={{ background: '#EDE7F6', color: '#5856D6' }}
        >
          <Shield size={13} />
          Bond {totalValue > 0 ? (bondPct * 100).toFixed(0) : 30}%
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-2xl"
          style={{ background: '#e8f9ed', color: '#1B7A33' }}
        >
          <TrendingUp size={13} />
          Equity {totalValue > 0 ? (equityPct * 100).toFixed(0) : 70}%
        </div>
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

      <AllocationChart tickers={allocTickers} weights={allocWeights} holdings={holdings} />
      <HoldingsList
        tickers={tickers}
        holdings={holdings}
        prices={prices}
        weights={weights}
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
          totalValue={totalValue}
          onClose={() => setSelectedEtf(null)}
        />
      )}
    </div>
  )
}
