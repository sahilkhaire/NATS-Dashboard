import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'

export function AccountsPage() {
  const { data, error } = useNatsPolling('/accountz', 10000)

  const accounts = data?.accounts ?? []
  const { sortedData: sortedAccounts, sortBy, sortDir, handleSort } = useTableSort(accounts, {
    defaultSortBy: 'account_name',
    getSortValue: (a, key) => {
      if (key === 'account_name') return a.account_name ?? ''
      if (key === 'clients') return a.client_connections ?? 0
      if (key === 'leafnodes') return a.leafnode_connections ?? 0
      if (key === 'subscriptions') return a.subscriptions ?? 0
      return ''
    },
  })

  if (data?._unavailable) return <NatsProtocolNotice endpoint="accountz" />
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
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((a) => (
              <tr key={a.account_name} className="border-b border-nats-border">
                <td className="p-3 font-mono">{a.account_name}</td>
                <td className="p-3">{a.client_connections ?? 0}</td>
                <td className="p-3">{a.leafnode_connections ?? 0}</td>
                <td className="p-3">{a.subscriptions ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
