import { useState } from 'react'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { RefreshSelector } from '../../components/RefreshSelector'
import { SortableTh } from '../../components/ui'

export function ConsumersPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const { data, error, lastFetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true', refreshInterval)

  const consumers = []
  if (data) {
    for (const acc of data.account_details ?? []) {
      for (const sd of acc.stream_detail ?? []) {
        for (const c of sd.consumer_detail ?? []) {
          consumers.push({ ...c, stream: sd.name })
        }
      }
    }
  }

  const { sortedData: sortedConsumers, sortBy, sortDir, handleSort } = useTableSort(consumers, {
    defaultSortBy: 'stream',
    getSortValue: (c, key) => {
      if (key === 'stream') return c.stream ?? ''
      if (key === 'consumer') return c.name ?? ''
      if (key === 'pending') return c.num_pending ?? 0
      if (key === 'ack_pending') return c.num_ack_pending ?? 0
      if (key === 'redelivered') return c.num_redelivered ?? 0
      return ''
    },
  })

  const lagging = consumers.filter(c => (c.num_pending ?? 0) > 1000 || (c.num_ack_pending ?? 0) > 0)

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

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
              <SortableTh sortKey="stream" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Stream</SortableTh>
              <SortableTh sortKey="consumer" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Consumer</SortableTh>
              <SortableTh sortKey="pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Pending</SortableTh>
              <SortableTh sortKey="ack_pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Ack Pending</SortableTh>
              <SortableTh sortKey="redelivered" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Redelivered</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sortedConsumers.map((c) => (
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
