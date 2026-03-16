import { useState } from 'react'
import { useNatsPolling } from '../hooks/useNatsPolling'
import { AlertBanner } from '../components/AlertBanner'
import { RefreshSelector } from '../components/RefreshSelector'

export function ConsumersPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const { data, error, lastFetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true', refreshInterval)

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  const consumers = []
  for (const acc of data.account_details ?? []) {
    for (const sd of acc.stream_detail ?? []) {
      for (const c of sd.consumer_detail ?? []) {
        consumers.push({ ...c, stream: sd.name })
      }
    }
  }

  const lagging = consumers.filter(c => (c.num_pending ?? 0) > 1000 || (c.num_ack_pending ?? 0) > 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-nats-text-secondary uppercase tracking-wide">
          {consumers.length} Consumer{consumers.length !== 1 ? 's' : ''}
        </h2>
        <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
      </div>
      {lagging.length > 0 && (
        <AlertBanner variant="warn" title="Consumers with lag or unacked messages">
          {lagging.length} consumer(s) need attention.
        </AlertBanner>
      )}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Stream</th>
              <th className="text-left p-3">Consumer</th>
              <th className="text-left p-3">Pending</th>
              <th className="text-left p-3">Ack Pending</th>
              <th className="text-left p-3">Redelivered</th>
            </tr>
          </thead>
          <tbody>
            {consumers.map((c) => (
              <tr key={`${c.stream}-${c.name}`} className="border-b border-nats-border">
                <td className="p-3 font-mono">{c.stream}</td>
                <td className="p-3 font-mono">{c.name}</td>
                <td className={`p-3 font-mono ${(c.num_pending ?? 0) > 1000 ? 'text-nats-error' : ''}`}>{c.num_pending ?? 0}</td>
                <td className={`p-3 font-mono ${(c.num_ack_pending ?? 0) > 0 ? 'text-nats-error' : ''}`}>{c.num_ack_pending ?? 0}</td>
                <td className="p-3 font-mono">{c.num_redelivered ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
