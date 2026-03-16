export function GaugeBar({ value, max, label, showPercent = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const isHigh = pct > 80
  const isCritical = pct > 95
  return (
    <div>
      {label && <div className="text-sm text-nats-text-secondary mb-1">{label}</div>}
      <div className="h-2 w-full rounded-full bg-nats-border overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isCritical ? 'bg-nats-error' : isHigh ? 'bg-nats-warn' : 'bg-nats-accent'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && <div className="text-xs text-nats-text-muted mt-1">{pct.toFixed(0)}%</div>}
    </div>
  )
}
