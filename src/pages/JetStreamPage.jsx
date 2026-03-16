import { useNatsPolling } from '../hooks/useNatsPolling'
import { MetricCard } from '../components/MetricCard'
import { GaugeBar } from '../components/GaugeBar'
import { formatBytes } from '../utils/byteFormatter'
import { AlertBanner } from '../components/AlertBanner'

export function JetStreamPage() {
  const { data, error } = useNatsPolling('/jsz?accounts=true', 3000)

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  const mem = data.memory ?? 0
  const rawMaxMem = data.config?.max_memory
  const maxMem = rawMaxMem == null ? null : rawMaxMem === 0 ? null : rawMaxMem
  const storage = data.storage ?? 0
  const rawMaxStorage = data.config?.max_storage
  const maxStorage = rawMaxStorage == null ? null : rawMaxStorage === 0 ? null : rawMaxStorage

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          {maxMem != null
            ? <><GaugeBar value={mem} max={maxMem} label="Memory Used" /><div className="text-xs mt-1">{formatBytes(mem)} / {formatBytes(maxMem)}</div></>
            : <><div className="text-sm text-nats-text-secondary mb-1">Memory Used</div><div className="font-mono text-lg">{formatBytes(mem)}</div><div className="text-xs text-gray-500">Unlimited</div></>
          }
        </div>
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          {maxStorage != null
            ? <><GaugeBar value={storage} max={maxStorage} label="Storage Used" /><div className="text-xs mt-1">{formatBytes(storage)} / {formatBytes(maxStorage)}</div></>
            : <><div className="text-sm text-nats-text-secondary mb-1">Storage Used</div><div className="font-mono text-lg">{formatBytes(storage)}</div><div className="text-xs text-gray-500">Unlimited</div></>
          }
        </div>
        <MetricCard label="API Calls" value={(data.api?.total ?? 0).toLocaleString()} />
        <MetricCard label="API Errors" value={data.api?.errors ?? 0} variant={(data.api?.errors ?? 0) > 0 ? 'error' : 'default'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Streams" value={data.total_streams ?? 0} />
        <MetricCard label="Consumers" value={data.total_consumers ?? 0} />
        <MetricCard label="Messages" value={(data.total_messages ?? 0).toLocaleString()} />
        <MetricCard label="Bytes Stored" value={formatBytes(data.total_message_bytes)} />
      </div>
    </div>
  )
}
