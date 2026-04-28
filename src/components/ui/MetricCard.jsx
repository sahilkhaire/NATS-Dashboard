export function MetricCard({ label, value, subtext, variant = 'default', children }) {
  const variantClasses = {
    default: 'border-border bg-card',
    error: 'border-destructive/50 bg-destructive/10',
    warn: 'border-muted-foreground/40 bg-muted/50',
  }
  return (
    <div className={`surface-card p-4 ${variantClasses[variant]}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      {subtext && <div className="mt-1 text-xs text-muted-foreground">{subtext}</div>}
      {children}
    </div>
  )
}
