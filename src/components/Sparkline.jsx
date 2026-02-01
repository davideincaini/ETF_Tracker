export default function Sparkline({ data, width = 50, height = 24, color }) {
  if (!data || data.length < 2) return null

  const prices = data.map((d) => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - ((p - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const isUp = prices[prices.length - 1] >= prices[0]
  const strokeColor = color || (isUp ? '#34C759' : '#FF3B30')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
