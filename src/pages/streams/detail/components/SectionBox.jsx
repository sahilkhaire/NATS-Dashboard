export function SectionBox({ title, children, badge }) {
  return (
    <div className="rounded-lg border border-nats-border overflow-hidden">
      <div className="px-4 py-2.5 bg-nats-card border-b border-nats-border flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
        {badge}
      </div>
      {children}
    </div>
  )
}
