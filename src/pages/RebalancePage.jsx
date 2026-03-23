import { useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Clock, TrendingDown, TrendingUp, Shield, Crosshair, Zap, Scale, Gem } from 'lucide-react'
import { analyzePortfolio, DRAWDOWN_TRIGGERS, EUPHORIA_THRESHOLD, GOLD_LOWER_BAND, GOLD_UPPER_BAND, EQUITY_TARGET, CASH_TARGET, GOLD_TARGET } from '../utils/rebalance'

function cleanTicker(ticker) {
  return ticker.replace('.MI', '').replace('.PA', '').replace('.L', '')
}

// ─── Drawdown Gauge (visual semicircle) ──────────────────────────────
function DrawdownGauge({ drawdownPct }) {
  const pct = Math.abs(drawdownPct * 100)
  const maxPct = 50
  const ratio = Math.min(pct / maxPct, 1)
  const angle = -90 + ratio * 180
  const color = pct < 15 ? '#34C759' : pct < 25 ? '#FF9500' : '#FF3B30'

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#E5E5EA" strokeWidth="8" strokeLinecap="round" />
        {/* Trigger marks */}
        {DRAWDOWN_TRIGGERS.map((t, i) => {
          const trigAngle = -90 + (Math.abs(t.threshold) / 0.5) * 180
          const rad = (trigAngle * Math.PI) / 180
          const x = 60 + 50 * Math.cos(rad)
          const y = 65 + 50 * Math.sin(rad)
          return <circle key={i} cx={x} cy={y} r="3" fill={drawdownPct <= t.threshold ? '#FF3B30' : '#C7C7CC'} />
        })}
        {/* Needle */}
        {pct > 0 && (
          <line
            x1="60" y1="65"
            x2={60 + 40 * Math.cos((angle * Math.PI) / 180)}
            y2={65 + 40 * Math.sin((angle * Math.PI) / 180)}
            stroke={color} strokeWidth="3" strokeLinecap="round"
          />
        )}
        <circle cx="60" cy="65" r="4" fill={color} />
      </svg>
      <p className="text-lg font-black mt-1" style={{ color }}>
        {drawdownPct === 0 ? '0.0' : (drawdownPct * 100).toFixed(1)}%
      </p>
      <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
        dal massimo equity
      </p>
    </div>
  )
}

// ─── Bullet Indicator ────────────────────────────────────────────────
function BulletIndicator({ level, active, available, threshold }) {
  const fired = active
  const canFire = available
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{
      background: fired ? '#FFE5E5' : canFire ? '#FFF9E6' : 'var(--bg)',
      border: fired ? '1px solid #FF3B30' : '1px solid transparent'
    }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black"
        style={{ background: fired ? '#FF3B30' : canFire ? '#FF9500' : '#C7C7CC' }}>
        {level}
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-bold" style={{ color: fired ? '#D70015' : 'var(--text-primary)' }}>
          Proiettile {level}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          Soglia: {(threshold * 100).toFixed(0)}%
        </p>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
        background: fired ? '#FF3B30' : canFire ? '#FF9500' : '#E5E5EA',
        color: fired || canFire ? '#fff' : '#8E8E93'
      }}>
        {fired ? 'FIRE' : canFire ? 'READY' : 'LOCKED'}
      </span>
    </div>
  )
}

// ─── Order Card ──────────────────────────────────────────────────────
function OrderCard({ order }) {
  const isSell = order.type === 'sell'
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl" style={{
      background: isSell ? '#FFF0F0' : '#E8F9ED',
      border: `1px solid ${isSell ? '#FFD4D4' : '#B8E6C8'}`
    }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
        style={{ background: isSell ? '#FF3B30' : '#34C759' }}>
        {isSell ? '−' : '+'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: isSell ? '#D70015' : '#1B7A33' }}>
          {isSell ? 'VENDI' : 'COMPRA'} {cleanTicker(order.ticker)}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {order.reason}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black" style={{ color: isSell ? '#FF3B30' : '#34C759' }}>
          {order.shares} quote
        </p>
        <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          ~€{order.amount.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  )
}

// ─── Sensor Section (collapsible) ────────────────────────────────────
function SensorSection({ icon: Icon, title, subtitle, color, isActive, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen || isActive)

  return (
    <div className="rounded-3xl overflow-hidden" style={{
      background: 'var(--card)',
      boxShadow: isActive ? `0 4px 16px ${color}20` : '0 2px 12px rgba(0,0,0,0.06)',
      border: isActive ? `1px solid ${color}40` : '1px solid transparent'
    }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 border-none cursor-pointer bg-transparent text-left"
      >
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: isActive ? `${color}20` : '#F0F0F0' }}>
          <Icon size={20} color={isActive ? color : '#8E8E93'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">{title}</p>
            {isActive && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                ATTIVO
              </span>
            )}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
        </div>
        {open ? <ChevronUp size={18} color="#C7C7CC" /> : <ChevronDown size={18} color="#C7C7CC" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function RebalancePage({ tickers, holdings, prices, getPortfolioValue, getWeights, updateThreshold, portfolioId }) {
  const analysis = useMemo(() => {
    return analyzePortfolio({ tickers, holdings, prices, portfolioId })
  }, [tickers, holdings, prices, portfolioId])

  const {
    totalValue, equityValue, equityWeight, equityATH, equityDrawdown,
    cashValue, cashWeight, goldValue, goldWeight,
    equityInternals, drawdownSignals, euphoriaSignal, internalSignal, goldSignal, timeWindow
  } = analysis

  const hasAnyAlert = drawdownSignals.activeLevel > 0 || euphoriaSignal.isTriggered ||
    (internalSignal.needsRebalance) || goldSignal.isLow || goldSignal.isHigh

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold mb-1">Sensori Antifragili</h1>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Motore di ribilanciamento automatico — Vault B
        </p>
      </div>

      {/* Time Window Banner */}
      <div className="rounded-2xl p-3.5 mb-5 flex items-center gap-3" style={{
        background: timeWindow.isOpen ? '#E8F9ED' : '#FFF9E6',
        border: `1px solid ${timeWindow.isOpen ? '#34C759' : '#FFCC00'}`
      }}>
        <Clock size={18} color={timeWindow.isOpen ? '#34C759' : '#FF9500'} />
        <div>
          <p className="text-xs font-bold" style={{ color: timeWindow.isOpen ? '#1B7A33' : '#A25F00' }}>
            {timeWindow.message}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>CET {timeWindow.cetTime}</p>
        </div>
      </div>

      {/* Macro Overview */}
      {totalValue > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 rounded-2xl text-center" style={{ background: '#E8F9ED' }}>
            <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: '#1B7A33' }}>Equity</p>
            <p className="text-lg font-black" style={{ color: '#34C759' }}>{(equityWeight * 100).toFixed(1)}%</p>
            <p className="text-[9px]" style={{ color: '#248A3D' }}>target {(EQUITY_TARGET * 100).toFixed(0)}%</p>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: '#EDE7F6' }}>
            <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: '#5856D6' }}>Cash</p>
            <p className="text-lg font-black" style={{ color: '#5856D6' }}>{(cashWeight * 100).toFixed(1)}%</p>
            <p className="text-[9px]" style={{ color: '#7B7ADE' }}>target {(CASH_TARGET * 100).toFixed(0)}%</p>
          </div>
          <div className="p-3 rounded-2xl text-center" style={{ background: '#FFF4E5' }}>
            <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: '#FF9500' }}>Oro</p>
            <p className="text-lg font-black" style={{ color: '#FF9500' }}>{(goldWeight * 100).toFixed(1)}%</p>
            <p className="text-[9px]" style={{ color: '#C77700' }}>target {(GOLD_TARGET * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}

      {/* All Clear */}
      {!hasAnyAlert && totalValue > 0 && (
        <div className="rounded-3xl p-6 flex flex-col items-center justify-center text-center mb-5"
          style={{ background: '#e8f9ed', border: '1px solid #34C759' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#34C759' }}>
            <CheckCircle size={32} color="#ffffff" />
          </div>
          <h2 className="text-lg font-bold" style={{ color: '#1B7A33' }}>Tutti i sensori OK</h2>
          <p className="text-sm mt-2 font-medium" style={{ color: '#248A3D' }}>
            Nessuna azione richiesta. Il portafoglio è nei parametri.
          </p>
        </div>
      )}

      {/* Sensors */}
      <div className="flex flex-col gap-4">
        {/* Sensor A: Drawdown */}
        <SensorSection
          icon={Crosshair}
          title="Drawdown Sensor"
          subtitle={`Equity dal ATH: ${(equityDrawdown * 100).toFixed(1)}%`}
          color="#FF3B30"
          isActive={drawdownSignals.activeLevel > 0}
          defaultOpen={drawdownSignals.activeLevel > 0}
        >
          <DrawdownGauge drawdownPct={equityDrawdown} />

          {/* Bullets */}
          <div className="flex flex-col gap-2 mt-4">
            {drawdownSignals.triggers.map((t, i) => (
              <BulletIndicator
                key={i}
                level={t.level}
                active={t.active}
                available={i < drawdownSignals.bulletsAvailable}
                threshold={t.threshold}
              />
            ))}
          </div>

          {/* Buy breakdown per ETF */}
          {drawdownSignals.buyBreakdown.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                Distribuzione proiettile per deficit
              </p>
              <div className="flex flex-col gap-1.5">
                {drawdownSignals.buyBreakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'var(--bg)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{cleanTicker(b.ticker)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#FFE5E5', color: '#FF3B30' }}>
                        drift {(b.drift * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{b.shares} quote</p>
                      <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                        ({(b.share * 100).toFixed(0)}% del bullet)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {drawdownSignals.orders.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#D70015' }}>Ordini Suggeriti</p>
              {drawdownSignals.orders.map((o, i) => <OrderCard key={i} order={o} />)}
            </div>
          )}
        </SensorSection>

        {/* Sensor B: Euphoria */}
        <SensorSection
          icon={Zap}
          title="Euphoria Sensor"
          subtitle={`Equity weight: ${(equityWeight * 100).toFixed(1)}% (soglia ≥${(EUPHORIA_THRESHOLD * 100).toFixed(0)}%)`}
          color="#FF9500"
          isActive={euphoriaSignal.isTriggered}
          defaultOpen={euphoriaSignal.isTriggered}
        >
          <div className="p-4 rounded-2xl mb-3" style={{ background: 'var(--bg)' }}>
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Peso Equity Attuale</p>
              <p className="text-lg font-black" style={{ color: euphoriaSignal.isTriggered ? '#FF9500' : '#34C759' }}>
                {(equityWeight * 100).toFixed(1)}%
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full mt-2" style={{ background: '#E5E5EA' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(equityWeight / 0.9 * 100, 100)}%`,
                background: equityWeight >= EUPHORIA_THRESHOLD ? '#FF9500' : '#34C759'
              }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>0%</span>
              <span className="text-[9px] font-bold" style={{ color: '#FF9500' }}>{(EUPHORIA_THRESHOLD * 100).toFixed(0)}% soglia</span>
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>90%</span>
            </div>
          </div>

          {euphoriaSignal.isTriggered && euphoriaSignal.orders.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#FF9500' }}>Ordini Suggeriti</p>
              {euphoriaSignal.orders.map((o, i) => <OrderCard key={i} order={o} />)}
            </div>
          )}
        </SensorSection>

        {/* Sensor C: Internal Maintenance */}
        <SensorSection
          icon={Scale}
          title="Manutenzione Interna"
          subtitle={`Max drift interno: ${internalSignal.maxDrift ? (internalSignal.maxDrift * 100).toFixed(1) : '0.0'}%`}
          color="#5856D6"
          isActive={internalSignal.needsRebalance}
          defaultOpen={internalSignal.needsRebalance}
        >
          <div className="flex flex-col gap-2">
            {equityInternals.map((e) => (
              <div key={e.ticker} className="flex items-center justify-between p-3 rounded-2xl" style={{ background: 'var(--bg)' }}>
                <div>
                  <p className="text-xs font-bold">{cleanTicker(e.ticker)}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    Target: {(e.internalTarget * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{(e.internalWeight * 100).toFixed(1)}%</p>
                  <p className="text-[10px] font-semibold" style={{
                    color: Math.abs(e.drift) > 0.05 ? '#FF3B30' : Math.abs(e.drift) > 0.02 ? '#FF9500' : '#34C759'
                  }}>
                    {e.drift >= 0 ? '+' : ''}{(e.drift * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>

          {internalSignal.orders.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#5856D6' }}>Ordini Suggeriti</p>
              {internalSignal.orders.map((o, i) => <OrderCard key={i} order={o} />)}
            </div>
          )}
        </SensorSection>

        {/* Sensor D: Gold Shield */}
        <SensorSection
          icon={Gem}
          title="Gold Shield"
          subtitle={`Peso oro: ${(goldWeight * 100).toFixed(1)}% (banda ${(GOLD_LOWER_BAND * 100).toFixed(0)}%–${(GOLD_UPPER_BAND * 100).toFixed(0)}%)`}
          color="#FF9500"
          isActive={goldSignal.isLow || goldSignal.isHigh}
          defaultOpen={goldSignal.isLow || goldSignal.isHigh}
        >
          <div className="p-4 rounded-2xl mb-3" style={{ background: 'var(--bg)' }}>
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Peso Oro</p>
              <p className="text-lg font-black" style={{
                color: goldSignal.isLow ? '#FF3B30' : goldSignal.isHigh ? '#FF9500' : '#34C759'
              }}>
                {(goldWeight * 100).toFixed(1)}%
              </p>
            </div>
            {/* Band visualization */}
            <div className="relative w-full h-6 mt-3 rounded-full overflow-hidden" style={{ background: '#E5E5EA' }}>
              {/* Safe zone */}
              <div className="absolute h-full" style={{
                left: `${GOLD_LOWER_BAND / 0.25 * 100}%`,
                width: `${(GOLD_UPPER_BAND - GOLD_LOWER_BAND) / 0.25 * 100}%`,
                background: '#E8F9ED'
              }} />
              {/* Current position marker */}
              <div className="absolute top-0 h-full w-1 rounded-full" style={{
                left: `${Math.min(goldWeight / 0.25, 1) * 100}%`,
                background: goldSignal.isLow ? '#FF3B30' : goldSignal.isHigh ? '#FF9500' : '#34C759'
              }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>0%</span>
              <span className="text-[9px] font-bold" style={{ color: '#FF3B30' }}>{(GOLD_LOWER_BAND * 100).toFixed(0)}%</span>
              <span className="text-[9px] font-bold" style={{ color: '#34C759' }}>{(GOLD_TARGET * 100).toFixed(0)}%</span>
              <span className="text-[9px] font-bold" style={{ color: '#FF9500' }}>{(GOLD_UPPER_BAND * 100).toFixed(0)}%</span>
              <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>25%</span>
            </div>
          </div>

          {goldSignal.orders.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#FF9500' }}>Ordini Suggeriti</p>
              {goldSignal.orders.map((o, i) => <OrderCard key={i} order={o} />)}
            </div>
          )}
        </SensorSection>
      </div>

      {/* ATH Info */}
      {equityATH > 0 && (
        <div className="mt-5 p-4 rounded-2xl" style={{ background: 'var(--bg)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
            Equity ATH (Vault B)
          </p>
          <p className="text-sm font-bold">
            €{equityATH.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      )}
    </div>
  )
}
