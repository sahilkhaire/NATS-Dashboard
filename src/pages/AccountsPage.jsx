import { useNatsPolling } from '../hooks/useNatsPolling'
import { AlertBanner } from '../components/AlertBanner'
import { NatsProtocolNotice } from '../components/NatsProtocolNotice'

export function AccountsPage() {
  const { data, error } = useNatsPolling('/accountz', 10000)

  if (data?._unavailable) return <NatsProtocolNotice endpoint="accountz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  const accounts = data.accounts ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Account</th>
              <th className="text-left p-3">Clients</th>
              <th className="text-left p-3">Leafnodes</th>
              <th className="text-left p-3">Subscriptions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
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
