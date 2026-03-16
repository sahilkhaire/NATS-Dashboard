import { useNatsPolling } from '../../hooks/useNatsPolling'
import { StatusBadge } from '../../components/StatusBadge'
import { AlertBanner } from '../../components/AlertBanner'

export function HealthPage() {
  const { data, error, lastFetch } = useNatsPolling('/healthz', 5000)

  const healthy = !error && data?.status === 'ok'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${healthy ? 'bg-nats-ok/20' : 'bg-nats-error/20'}`}>
          <StatusBadge status={healthy ? 'ok' : 'error'}>
            {healthy ? 'OK' : 'ERROR'}
          </StatusBadge>
        </div>
        <div>
          <div className="text-lg font-semibold">{healthy ? 'NATS server is healthy' : 'NATS server unreachable'}</div>
          <div className="text-sm text-nats-text-secondary">Last check: {lastFetch ? new Date(lastFetch).toLocaleTimeString() : '-'}</div>
        </div>
      </div>
      {error && <AlertBanner variant="error" title="Health check failed">{error}</AlertBanner>}
      {data && <pre className="bg-nats-card p-4 rounded text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}
