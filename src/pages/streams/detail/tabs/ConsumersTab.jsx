import { useTableSort } from '../../../../hooks/useTableSort'
import { AlertBanner } from '../../../../components/AlertBanner'
import { SortableTh } from '../../../../components/ui'

export function ConsumersTab({ consumers }) {
  const { sortedData, sortBy, sortDir, handleSort } = useTableSort(consumers, {
    defaultSortBy: 'name',
    getSortValue: (c, key) => {
      if (key === 'name') return c.name ?? ''
      if (key === 'type') return c.config?.durable_name ? 'Durable' : 'Ephemeral'
      if (key === 'filter_subject') return c.config?.filter_subject || c.config?.filter_subjects?.join(',') || ''
      if (key === 'pending') return c.num_pending ?? 0
      if (key === 'ack_pending') return c.num_ack_pending ?? 0
      if (key === 'redelivered') return c.num_redelivered ?? 0
      if (key === 'deliver_policy') return c.config?.deliver_policy ?? ''
      return ''
    },
  })

  if (consumers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        No consumers on this stream.
      </div>
    )
  }

  const lagging = consumers.filter(c => (c.num_pending ?? 0) > 1000 || (c.num_ack_pending ?? 0) > 0)

  return (
    <div className="space-y-4">
      {lagging.length > 0 && (
        <AlertBanner variant="warn" title="Consumers with lag">
          {lagging.length} consumer(s) have pending or unacked messages.
        </AlertBanner>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              <SortableTh sortKey="name" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Name</SortableTh>
              <SortableTh sortKey="type" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Type</SortableTh>
              <SortableTh sortKey="filter_subject" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Filter Subject</SortableTh>
              <SortableTh sortKey="pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Pending</SortableTh>
              <SortableTh sortKey="ack_pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Ack Pending</SortableTh>
              <SortableTh sortKey="redelivered" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Redelivered</SortableTh>
              <SortableTh sortKey="deliver_policy" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Deliver Policy</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(c => (
              <tr key={c.name} className="border-b border-border hover:bg-muted/30">
                <td className="p-3 font-mono font-medium text-nats-accent">{c.name}</td>
                <td className="p-3">
                  <span className="rounded bg-border px-1.5 py-0.5 text-xs text-foreground">
                    {c.config?.durable_name ? 'Durable' : 'Ephemeral'}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-foreground">
                  {c.config?.filter_subject || c.config?.filter_subjects?.join(', ') || '—'}
                </td>
                <td className={`p-3 font-mono ${(c.num_pending ?? 0) > 1000 ? 'text-nats-error' : ''}`}>
                  {(c.num_pending ?? 0).toLocaleString()}
                </td>
                <td className={`p-3 font-mono ${(c.num_ack_pending ?? 0) > 0 ? 'text-nats-error' : ''}`}>
                  {(c.num_ack_pending ?? 0).toLocaleString()}
                </td>
                <td className="p-3 font-mono">{c.num_redelivered ?? 0}</td>
                <td className="p-3 text-xs text-foreground">{c.config?.deliver_policy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
