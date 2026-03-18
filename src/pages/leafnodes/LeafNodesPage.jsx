import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'

export function LeafNodesPage() {
  const { data, error } = useNatsPolling('/leafz', 5000)

  const leafs = data?.leafs ?? []
  const { sortedData: sortedLeafs, sortBy, sortDir, handleSort } = useTableSort(leafs, {
    defaultSortBy: 'account',
    getSortValue: (l, key) => {
      if (key === 'account') return l.account ?? ''
      if (key === 'ip_port') return `${l.ip ?? ''}:${l.port ?? ''}`
      if (key === 'in_msgs') return l.in_msgs ?? 0
      if (key === 'out_msgs') return l.out_msgs ?? 0
      return ''
    },
  })

  if (data?._unavailable) return <NatsProtocolNotice endpoint="leafz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <SortableTh sortKey="account" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Account</SortableTh>
              <SortableTh sortKey="ip_port" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>IP:Port</SortableTh>
              <SortableTh sortKey="in_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Msgs In</SortableTh>
              <SortableTh sortKey="out_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Msgs Out</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedLeafs.map((l) => (
              <tr key={`${l.account}-${l.ip}:${l.port}`} className="border-b border-nats-border">
                <td className="p-3">{l.account}</td>
                <td className="p-3 font-mono">{l.ip}:{l.port}</td>
                <td className="p-3 font-mono">{(l.in_msgs ?? 0).toLocaleString()}</td>
                <td className="p-3 font-mono">{(l.out_msgs ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
