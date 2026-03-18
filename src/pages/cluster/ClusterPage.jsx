import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { formatBytes } from '../../utils/byteFormatter'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'

export function ClusterPage() {
  const { data, error } = useNatsPolling('/routez', 5000)

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
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
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
              <tr key={r.remote_id} className="border-b border-nats-border">
                <td className="p-3 font-mono">{r.remote_id}</td>
                <td className="p-3">{r.ip}:{r.port}</td>
                <td className="p-3 font-mono">{(r.in_msgs ?? 0).toLocaleString()}</td>
                <td className="p-3 font-mono">{(r.out_msgs ?? 0).toLocaleString()}</td>
                <td className={`p-3 ${(r.pending_size ?? 0) > 0 ? 'text-nats-error' : ''}`}>{formatBytes(r.pending_size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
