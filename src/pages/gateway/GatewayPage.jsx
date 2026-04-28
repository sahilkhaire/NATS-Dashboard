import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { EmptyState } from '../../components/shared/EmptyState'
import { SortableTh } from '../../components/ui'
import { ArrowDownToLine, ArrowUpFromLine, Globe } from 'lucide-react'

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
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
          <Icon size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
          <span className="ml-1 text-xs text-muted-foreground">(0)</span>
        </div>
        <div className="p-4 text-center text-sm text-muted-foreground">No connections</div>
      </div>
    )
  }

  return (
    <div className="premium-table-wrap">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="ml-1 text-xs text-muted-foreground">({connections.length})</span>
      </div>
      <table className="premium-table">
        <thead>
          <tr>
            <SortableTh sortKey="name" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Name</SortableTh>
            <SortableTh sortKey="num_connections" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Num Connections</SortableTh>
            <SortableTh sortKey="total_connections" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Total Connections</SortableTh>
            <SortableTh sortKey="status" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Status</SortableTh>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((gw) => (
            <tr key={gw.name}>
              <td className="p-3 font-mono font-medium text-foreground">{gw.name}</td>
              <td className="p-3 font-mono">{gw.num_connections ?? 0}</td>
              <td className="p-3 font-mono">{gw.total_connections ?? 0}</td>
              <td className="p-3">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  gw.connection_attempts != null && gw.connection_attempts > 0
                    ? 'bg-muted text-foreground'
                    : 'bg-muted text-foreground'
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
  const { data, error } = useNatsPolling('/gatewayz', 2000)

  if (data?._unavailable) return <NatsProtocolNotice endpoint="gatewayz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-muted-foreground">Loading...</div>

  const inbound = data.inbound_gateways
    ? Object.entries(data.inbound_gateways).map(([name, info]) => ({ name, ...info }))
    : []

  const outbound = data.outbound_gateways
    ? Object.entries(data.outbound_gateways).map(([name, info]) => ({ name, ...info }))
    : []

  const hasGateways = inbound.length > 0 || outbound.length > 0

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="mb-0.5 text-xs text-muted-foreground">Gateway Name</div>
            <div className="font-mono font-semibold text-foreground">{data.name || '—'}</div>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-muted-foreground">Host</div>
            <div className="font-mono text-foreground">{data.host || '—'}:{data.port || '—'}</div>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-muted-foreground">Inbound Gateways</div>
            <div className="font-mono text-foreground">{inbound.length}</div>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-muted-foreground">Outbound Gateways</div>
            <div className="font-mono text-foreground">{outbound.length}</div>
          </div>
        </div>
      </div>

      {!hasGateways ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <EmptyState
            icon={Globe}
            title="No gateways configured"
            description="This NATS server is not part of a supercluster. Gateways connect separate NATS clusters into a supercluster (e.g., across data centers)."
            hint="Configure gateways in your NATS config to connect multiple clusters."
          />
        </div>
      ) : (
        <>
          <ConnectionsTable connections={outbound} title="Outbound Gateways" icon={ArrowUpFromLine} />
          <ConnectionsTable connections={inbound} title="Inbound Gateways" icon={ArrowDownToLine} />
        </>
      )}
    </div>
  )
}
