export function GaugeBar({ value, max, label, showPercent = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const isHigh = pct > 80
  const isCritical = pct > 95
  return (
    <div>
      {label && <div className="mb-1 text-sm text-muted-foreground">{label}</div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-border/70">
        <div
          className={`h-full transition-all duration-300 ${
            isCritical ? 'bg-nats-error' : isHigh ? 'bg-nats-warn' : 'bg-nats-accent'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && <div className="mt-1 text-xs text-muted-foreground">{pct.toFixed(0)}%</div>}
    </div>
  )
}
