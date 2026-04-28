import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { formatBytes } from '../../utils/byteFormatter'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { EmptyState } from '../../components/shared/EmptyState'
import { SortableTh } from '../../components/ui'
import { GitMerge, ServerCog } from 'lucide-react'

export function ClusterPage() {
  const { data, error } = useNatsPolling('/routez', 2000)

  const routes = data?.routes ?? []
  const { sortedData: sortedRoutes, sortBy, sortDir, handleSort } = useTableSort(routes, {
    defaultSortBy: 'remote_id',
    getSortValue: (r, key) => {
      if (key === 'remote_id') return r.remote_id ?? ''
      if (key === 'ip_port') return `${r.ip ?? ''}:${r.port ?? ''}`
      if (key === 'in_msgs') return r.in_msgs ?? 0
      if (key === 'out_msgs') return r.out_msgs ?? 0
      if (key === 'pending') return r.pending_size ?? 0
      return ''
    },
  })

  if (data?._unavailable) return <NatsProtocolNotice endpoint="routez" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-muted-foreground">Loading...</div>

  if (routes.length === 0) {
    return (
      <div className="p-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <EmptyState
            icon={ServerCog}
            title="Standalone mode"
            description="This NATS server is running standalone with no cluster routes. Cluster routes appear when you connect multiple NATS servers in a cluster."
            hint="To run in cluster mode, configure multiple NATS servers with route URLs."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="premium-table-wrap">
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
          <GitMerge size={14} className="text-foreground/70" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cluster routes ({routes.length})</span>
        </div>
        <table className="premium-table">
          <thead>
            <tr>
              <SortableTh sortKey="remote_id" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Remote ID</SortableTh>
              <SortableTh sortKey="ip_port" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>IP:Port</SortableTh>
              <SortableTh sortKey="in_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Msgs In</SortableTh>
              <SortableTh sortKey="out_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Msgs Out</SortableTh>
              <SortableTh sortKey="pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Pending</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedRoutes.map((r) => (
              <tr key={r.rid ?? `${r.remote_id}-${r.ip}-${r.port}`}>
                <td className="p-3 font-mono">{r.remote_id}</td>
                <td className="p-3">{r.ip}:{r.port}</td>
                <td className="p-3 font-mono">{(r.in_msgs ?? 0).toLocaleString()}</td>
                <td className="p-3 font-mono">{(r.out_msgs ?? 0).toLocaleString()}</td>
                <td className={`p-3 ${(r.pending_size ?? 0) > 0 ? 'text-foreground' : ''}`}>{formatBytes(r.pending_size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
