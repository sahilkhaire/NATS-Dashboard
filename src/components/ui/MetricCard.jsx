export function MetricCard({ label, value, subtext, variant = 'default', children }) {
  const variantClasses = {
    default: 'border-nats-border',
    error: 'border-nats-error/50 bg-nats-error/10',
    warn: 'border-nats-warn/50 bg-nats-warn/10',
  }
  return (
    <div className={`rounded-lg border bg-nats-card p-4 ${variantClasses[variant]}`}>
      <div className="text-sm text-nats-accent font-medium">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      {subtext && <div className="mt-1 text-xs text-nats-text-secondary">{subtext}</div>}
      {children}
    </div>
  )
}
