import { useNatsPolling } from '../../hooks/useNatsPolling'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'

export function LeafNodesPage() {
  const { data, error } = useNatsPolling('/leafz', 5000)

  if (data?._unavailable) return <NatsProtocolNotice endpoint="leafz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  const leafs = data.leafs ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Account</th>
              <th className="text-left p-3">IP:Port</th>
              <th className="text-left p-3">Msgs In</th>
              <th className="text-left p-3">Msgs Out</th>
            </tr>
          </thead>
          <tbody>
            {leafs.map((l) => (
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
