export function KVRow({ label, children }) {
  return (
    <div className="flex items-start justify-between border-b border-border px-4 py-3 transition-colors hover:bg-muted/10 last:border-0">
      <div className="w-52 shrink-0 pt-0.5 text-sm text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1 font-mono text-sm text-foreground">{children}</div>
    </div>
  )
}
