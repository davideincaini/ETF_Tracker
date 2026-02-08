import { LayoutDashboard, Calculator, Settings, TrendingUp } from 'lucide-react'

const tabs = [
  { id: 'dashboard', label: 'Portfolio', icon: LayoutDashboard },
  { id: 'pac', label: 'PAC', icon: Calculator },
  { id: 'simulator', label: 'Simulator', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav
      className="flex justify-around items-center px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]"
      style={{ background: 'var(--card)', boxShadow: '0 -1px 8px rgba(0,0,0,0.06)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border-none cursor-pointer transition-all duration-200"
            style={{
              background: isActive ? '#34C759' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Icon size={18} strokeWidth={isActive ? 2.2 : 1.6} />
            {isActive && (
              <span className="text-xs font-semibold">{tab.label}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
