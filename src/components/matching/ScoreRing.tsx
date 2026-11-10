/** Circular match-score indicator. */
export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const value = Math.max(0, Math.min(100, Math.round(score)))
  const stroke = Math.max(5, size / 11)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const tone = value >= 80 ? 'high' : value >= 60 ? 'mid' : 'low'

  return (
    <div className={`score-ring score-${tone}`} style={{ width: size, height: size }} role="img" aria-label={`${value}% match`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="score-ring-track" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="score-ring-value"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-ring-label" style={{ fontSize: size * 0.26 }}>
        {value}%
      </span>
    </div>
  )
}
