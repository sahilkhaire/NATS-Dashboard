import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'

export function AccountsPage() {
  // /accstatz provides per-account connection, subscription, and traffic stats.
  // Falls back to /accountz (which only returns account names) if accstatz is unavailable.
  const { data, error } = useNatsPolling('/accstatz', 10000)

  // /accstatz returns { account_statz: [ { acc, name, conns, leafnodes, num_subscriptions, ... } ] }
  // Map to a normalized shape so the table columns are consistent.
  const accounts = (data?.account_statz ?? []).map(a => ({
    account_name:       a.acc ?? a.name ?? '',
    client_connections: a.conns ?? 0,
    leafnode_connections: a.leafnodes ?? 0,
    subscriptions:      a.num_subscriptions ?? 0,
    sent_msgs:          a.sent?.msgs ?? 0,
    recv_msgs:          a.received?.msgs ?? 0,
  }))

  const { sortedData: sortedAccounts, sortBy, sortDir, handleSort } = useTableSort(accounts, {
    defaultSortBy: 'account_name',
    getSortValue: (a, key) => {
      if (key === 'account_name') return a.account_name ?? ''
      if (key === 'clients') return a.client_connections ?? 0
      if (key === 'leafnodes') return a.leafnode_connections ?? 0
      if (key === 'subscriptions') return a.subscriptions ?? 0
      if (key === 'sent_msgs') return a.sent_msgs ?? 0
      if (key === 'recv_msgs') return a.recv_msgs ?? 0
      return ''
    },
  })

  if (data?._unavailable) return <NatsProtocolNotice endpoint="accstatz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <SortableTh sortKey="account_name" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Account</SortableTh>
              <SortableTh sortKey="clients" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Clients</SortableTh>
              <SortableTh sortKey="leafnodes" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Leafnodes</SortableTh>
              <SortableTh sortKey="subscriptions" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subscriptions</SortableTh>
              <SortableTh sortKey="sent_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Msgs Sent</SortableTh>
              <SortableTh sortKey="recv_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Msgs Recv</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((a) => (
              <tr key={a.account_name} className="border-b border-nats-border hover:bg-nats-border/30">
                <td className="p-3 font-mono font-medium text-nats-accent">{a.account_name}</td>
                <td className="p-3">{a.client_connections}</td>
                <td className="p-3">{a.leafnode_connections}</td>
                <td className="p-3">{a.subscriptions.toLocaleString()}</td>
                <td className="p-3 font-mono">{a.sent_msgs.toLocaleString()}</td>
                <td className="p-3 font-mono">{a.recv_msgs.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
