import { useNatsPolling } from '../hooks/useNatsPolling'
import { formatBytes } from '../utils/byteFormatter'
import { AlertBanner } from '../components/AlertBanner'
import { NatsProtocolNotice } from '../components/NatsProtocolNotice'

export function ClusterPage() {
  const { data, error } = useNatsPolling('/routez', 5000)

  if (data?._unavailable) return <NatsProtocolNotice endpoint="routez" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  const routes = data.routes ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Remote ID</th>
              <th className="text-left p-3">IP:Port</th>
              <th className="text-left p-3">Msgs In</th>
              <th className="text-left p-3">Msgs Out</th>
              <th className="text-left p-3">Pending</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
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
