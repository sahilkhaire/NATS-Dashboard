import { AlertBanner } from '../../../../components/AlertBanner'

export function ConsumersTab({ consumers }) {
  if (consumers.length === 0) {
    return (
      <div className="rounded-lg border border-nats-border bg-nats-card p-8 text-center text-gray-400">
        No consumers on this stream.
      </div>
    )
  }

  const lagging = consumers.filter(c => (c.num_pending ?? 0) > 1000 || (c.num_ack_pending ?? 0) > 0)

  return (
    <div className="space-y-4">
      {lagging.length > 0 && (
        <AlertBanner variant="warn" title="Consumers with lag">
          {lagging.length} consumer(s) have pending or unacked messages.
        </AlertBanner>
      )}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Filter Subject</th>
              <th className="text-left p-3">Pending</th>
              <th className="text-left p-3">Ack Pending</th>
              <th className="text-left p-3">Redelivered</th>
              <th className="text-left p-3">Deliver Policy</th>
            </tr>
          </thead>
          <tbody>
            {consumers.map(c => (
              <tr key={c.name} className="border-b border-nats-border hover:bg-nats-border/30">
                <td className="p-3 font-mono font-medium text-nats-accent">{c.name}</td>
                <td className="p-3">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-nats-border text-gray-300">
                    {c.config?.durable_name ? 'Durable' : 'Ephemeral'}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-gray-300">
                  {c.config?.filter_subject || c.config?.filter_subjects?.join(', ') || '—'}
                </td>
                <td className={`p-3 font-mono ${(c.num_pending ?? 0) > 1000 ? 'text-nats-error' : ''}`}>
                  {(c.num_pending ?? 0).toLocaleString()}
                </td>
                <td className={`p-3 font-mono ${(c.num_ack_pending ?? 0) > 0 ? 'text-nats-error' : ''}`}>
                  {(c.num_ack_pending ?? 0).toLocaleString()}
                </td>
                <td className="p-3 font-mono">{c.num_redelivered ?? 0}</td>
                <td className="p-3 text-xs text-gray-300">{c.config?.deliver_policy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
