export function AlertBanner({ variant = 'error', title, children }) {
  const classes = {
    error: 'bg-nats-error/20 border-nats-error text-nats-error',
    warn: 'bg-nats-warn/20 border-nats-warn text-nats-warn',
    info: 'bg-nats-accent-2/20 border-nats-accent-2 text-nats-accent-2',
  }
  return (
    <div className={`rounded-lg border p-4 ${classes[variant]}`}>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1 text-sm opacity-90">{children}</div>}
    </div>
  )
}
