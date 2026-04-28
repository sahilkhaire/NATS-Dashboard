import { useTableSort } from '../../../../hooks/useTableSort'
import { AlertBanner } from '../../../../components/AlertBanner'
import { SortableTh } from '../../../../components/ui'

const formatFloor = (floor) => {
  if (!floor) return '—'
  return (floor.stream_seq ?? floor.consumer_seq ?? 0).toLocaleString()
}

const formatPausedUntil = (consumer) => {
  if (!consumer?.paused) return '—'
  const raw =
    consumer.pause_remaining ??
    consumer.paused_until ??
    consumer.pause_until ??
    consumer.config?.pause_until
  if (!raw) return 'Paused'
  if (typeof raw === 'number') return `${raw.toLocaleString()}ns`
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return String(raw)
  return new Date(parsed).toLocaleString()
}

const metricColorClass = (value, warnAt, dangerAt) => {
  if (value >= dangerAt) return 'text-nats-error'
  if (value >= warnAt) return 'text-nats-warn'
  return 'text-muted-foreground'
}

export function ConsumersTab({ consumers }) {
  const { sortedData, sortBy, sortDir, handleSort } = useTableSort(consumers, {
    defaultSortBy: 'name',
    getSortValue: (c, key) => {
      if (key === 'name') return c.name ?? ''
      if (key === 'filter_subjects') return c.config?.filter_subject || c.config?.filter_subjects?.join(',') || ''
      if (key === 'ack_floor') return c.ack_floor?.consumer_seq ?? 0
      if (key === 'pending') return c.num_pending ?? 0
      if (key === 'ack_pending') return c.num_ack_pending ?? 0
      if (key === 'num_waiting') return c.num_waiting ?? 0
      if (key === 'redelivered') return c.num_redelivered ?? 0
      if (key === 'ack_policy') return c.config?.ack_policy ?? ''
      if (key === 'deliver_policy') return c.config?.deliver_policy ?? ''
      if (key === 'paused_until') return c.paused ? 1 : 0
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
              <SortableTh sortKey="filter_subjects" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Filter Subjects</SortableTh>
              <SortableTh sortKey="pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Unprocessed Msgs</SortableTh>
              <SortableTh sortKey="ack_pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Outstanding Acks</SortableTh>
              <SortableTh sortKey="ack_floor" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Ack Floor</SortableTh>
              <SortableTh sortKey="num_waiting" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Waiting Clients</SortableTh>
              <SortableTh sortKey="redelivered" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Redelivered Msgs</SortableTh>
              <SortableTh sortKey="ack_policy" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Ack Policy</SortableTh>
              <SortableTh sortKey="deliver_policy" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Deliver Policy</SortableTh>
              <SortableTh sortKey="paused_until" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Paused Until</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(c => (
              <tr key={c.name} className="border-b border-border hover:bg-muted/30">
                <td className="p-3 font-mono font-medium text-nats-accent">{c.name}</td>
                <td className="p-3 font-mono text-xs text-foreground">
                  {c.config?.filter_subject || c.config?.filter_subjects?.join(', ') || '—'}
                </td>
                <td className={`p-3 font-mono ${metricColorClass(c.num_pending ?? 0, 100, 1000)}`}>
                  {(c.num_pending ?? 0).toLocaleString()}
                </td>
                <td className={`p-3 font-mono ${metricColorClass(c.num_ack_pending ?? 0, 1, 100)}`}>
                  {(c.num_ack_pending ?? 0).toLocaleString()}
                </td>
                <td className="p-3 font-mono text-muted-foreground">{formatFloor(c.ack_floor)}</td>
                <td className={`p-3 font-mono ${metricColorClass(c.num_waiting ?? 0, 1, 100)}`}>{(c.num_waiting ?? 0).toLocaleString()}</td>
                <td className={`p-3 font-mono ${metricColorClass(c.num_redelivered ?? 0, 1, 50)}`}>{c.num_redelivered ?? 0}</td>
                <td className="p-3 text-xs text-foreground">{c.config?.ack_policy ?? '—'}</td>
                <td className="p-3 text-xs text-foreground">{c.config?.deliver_policy ?? '—'}</td>
                <td className="p-3 text-xs text-muted-foreground">{formatPausedUntil(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
