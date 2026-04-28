export function StatusBadge({ status, children }) {
  const classes = {
    ok: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-400',
    warn: 'bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400',
    error: 'bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-400',
    info: 'bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-400',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes[status] || classes.info}`}>
      {children}
    </span>
  )
}
