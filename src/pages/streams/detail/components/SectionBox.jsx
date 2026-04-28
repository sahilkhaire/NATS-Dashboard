export function SectionBox({ title, children, badge }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {badge}
      </div>
      {children}
    </div>
  )
}
