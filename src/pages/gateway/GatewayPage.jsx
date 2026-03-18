import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'

function ConnectionsTable({ connections, title, icon: Icon }) {
  const { sortedData, sortBy, sortDir, handleSort } = useTableSort(connections ?? [], {
    defaultSortBy: 'name',
    getSortValue: (gw, key) => {
      if (key === 'name') return gw.name ?? ''
      if (key === 'num_connections') return gw.num_connections ?? 0
      if (key === 'total_connections') return gw.total_connections ?? 0
      if (key === 'status') return (gw.connection_attempts != null && gw.connection_attempts > 0) ? 'attempts' : 'connected'
      return ''
    },
  })

  if (!connections || connections.length === 0) {
    return (
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
          <Icon size={14} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
          <span className="text-xs text-gray-500 ml-1">(0)</span>
        </div>
        <div className="p-4 text-sm text-gray-500 text-center">No connections</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-nats-border overflow-hidden">
      <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
        <span className="text-xs text-gray-500 ml-1">({connections.length})</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-nats-card/60 border-b border-nats-border">
          <tr>
            <SortableTh sortKey="name" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Name</SortableTh>
            <SortableTh sortKey="num_connections" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Num Connections</SortableTh>
            <SortableTh sortKey="total_connections" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Total Connections</SortableTh>
            <SortableTh sortKey="status" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Status</SortableTh>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((gw) => (
            <tr key={gw.name} className="border-b border-nats-border hover:bg-nats-border/30">
              <td className="p-3 font-mono font-medium text-nats-accent">{gw.name}</td>
              <td className="p-3 font-mono">{gw.num_connections ?? 0}</td>
              <td className="p-3 font-mono">{gw.total_connections ?? 0}</td>
              <td className="p-3">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  gw.connection_attempts != null && gw.connection_attempts > 0
                    ? 'bg-nats-warn/20 text-nats-warn'
                    : 'bg-nats-ok/20 text-nats-ok'
                }`}>
                  {gw.connection_attempts != null && gw.connection_attempts > 0
                    ? `${gw.connection_attempts} attempts`
                    : 'Connected'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GatewayPage() {
  const { data, error } = useNatsPolling('/gatewayz', 5000)

  if (data?._unavailable) return <NatsProtocolNotice endpoint="gatewayz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-gray-400">Loading...</div>

  const inbound = data.inbound_gateways
    ? Object.entries(data.inbound_gateways).map(([name, info]) => ({ name, ...info }))
    : []

  const outbound = data.outbound_gateways
    ? Object.entries(data.outbound_gateways).map(([name, info]) => ({ name, ...info }))
    : []

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-lg border border-nats-border bg-nats-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Gateway Name</div>
            <div className="font-mono font-semibold text-white">{data.name || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Host</div>
            <div className="font-mono text-white">{data.host || '—'}:{data.port || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Inbound Gateways</div>
            <div className="font-mono text-white">{inbound.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Outbound Gateways</div>
            <div className="font-mono text-white">{outbound.length}</div>
          </div>
        </div>
      </div>

      <ConnectionsTable connections={outbound} title="Outbound Gateways" icon={ArrowUpFromLine} />
      <ConnectionsTable connections={inbound} title="Inbound Gateways" icon={ArrowDownToLine} />
    </div>
  )
}
