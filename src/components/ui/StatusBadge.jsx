export function StatusBadge({ status, children }) {
  const classes = {
    ok: 'bg-nats-ok/20 text-nats-ok border-nats-ok/40',
    warn: 'bg-nats-warn/20 text-nats-warn border-nats-warn/40',
    error: 'bg-nats-error/20 text-nats-error border-nats-error/40',
    info: 'bg-nats-accent-2/20 text-nats-accent-2 border-nats-accent-2/40',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status] || classes.info}`}>
      {children}
    </span>
  )
}
