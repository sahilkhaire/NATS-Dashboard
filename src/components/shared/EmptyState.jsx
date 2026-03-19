/**
 * Reusable empty state for pages with no data.
 * Used for standalone mode (Cluster, Gateways) or when a feature has no items.
 */
export function EmptyState({ icon: Icon, title, description, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-nats-border/50 text-nats-text-muted">
          <Icon size={32} />
        </div>
      )}
      <h3 className="text-base font-semibold text-nats-text-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-nats-text-secondary max-w-md mb-2">{description}</p>}
      {hint && <p className="text-xs text-nats-text-muted">{hint}</p>}
    </div>
  )
}
