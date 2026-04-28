/**
 * Reusable empty state for pages with no data.
 * Used for standalone mode (Cluster, Gateways) or when a feature has no items.
 */
export function EmptyState({ icon: Icon, title, description, hint }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-muted/40 p-4 text-muted-foreground">
          <Icon size={32} />
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mb-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
