import { useState } from 'react'
import PacCalculator from '../components/PacCalculator'
import ManualTrade from '../components/ManualTrade'

const modes = [
  { id: 'smart', label: 'Smart PAC' },
  { id: 'manual', label: 'Buy / Sell' },
]

export default function PacPage({ tickers, holdings, prices, cashResiduo, onConfirm, onManualTrade, loading }) {
  const [mode, setMode] = useState('smart')

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-1 pb-4">
      {/* Mode toggle */}
      <div
        className="rounded-2xl p-1 flex mb-5"
        style={{ background: '#F0F0F0' }}
      >
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="flex-1 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all duration-200"
            style={{
              background: mode === m.id ? 'var(--card)' : 'transparent',
              color: mode === m.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: mode === m.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'smart' ? (
        <PacCalculator
          tickers={tickers}
          holdings={holdings}
          prices={prices}
          cashResiduo={cashResiduo}
          onConfirm={onConfirm}
          loading={loading}
        />
      ) : (
        <ManualTrade
          tickers={tickers}
          holdings={holdings}
          prices={prices}
          onTrade={onManualTrade}
        />
      )}
    </div>
  )
}
