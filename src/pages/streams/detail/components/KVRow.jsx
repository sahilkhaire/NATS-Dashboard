export function KVRow({ label, children }) {
  return (
    <div className="flex items-start justify-between py-3 px-4 border-b border-nats-border last:border-0 hover:bg-nats-border/10 transition-colors">
      <div className="text-sm text-gray-400 w-52 shrink-0 pt-0.5">{label}</div>
      <div className="flex-1 min-w-0 text-sm font-mono text-white">{children}</div>
    </div>
  )
}
