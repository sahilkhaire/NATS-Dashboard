import { useNatsPolling } from '../hooks/useNatsPolling'
import { MetricCard } from '../components/MetricCard'
import { AlertBanner } from '../components/AlertBanner'
import { NatsProtocolNotice } from '../components/NatsProtocolNotice'

export function SubscriptionsPage() {
  const { data, error } = useNatsPolling('/subsz', 5000)

  if (data?._unavailable) return <NatsProtocolNotice endpoint="subsz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Subscriptions" value={(data.num_subscriptions ?? 0).toLocaleString()} />
        <MetricCard label="Cache Hit Rate" value={`${((data.cache_hit_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Max Fanout" value={data.max_fanout ?? 0} />
        <MetricCard label="Avg Fanout" value={(data.avg_fanout ?? 0).toFixed(2)} />
      </div>
    </div>
  )
}
