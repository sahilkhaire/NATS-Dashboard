import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { MetricCard } from '../../components/MetricCard'
import { GaugeBar } from '../../components/GaugeBar'
import { formatBytes } from '../../utils/byteFormatter'
import { AlertBanner } from '../../components/AlertBanner'
import { Activity, ExternalLink } from 'lucide-react'

export function JetStreamPage() {
  const { data, error } = useNatsPolling('/jsz?accounts=true', 3000)
  const apiRateRef = useRef({ total: null, ts: null })
  const apiTotal = data?.api?.total ?? 0

  useEffect(() => {
    apiRateRef.current = { total: apiTotal, ts: Date.now() }
  }, [apiTotal])

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-muted-foreground">Loading...</div>

  const mem = data.memory ?? 0
  const rawMaxMem = data.config?.max_memory
  const maxMem = rawMaxMem == null ? null : rawMaxMem === 0 ? null : rawMaxMem
  const storage = data.storage ?? 0
  const rawMaxStorage = data.config?.max_storage
  const maxStorage = rawMaxStorage == null ? null : rawMaxStorage === 0 ? null : rawMaxStorage

  const prev = apiRateRef.current
  const now = Date.now()
  const elapsed = prev.ts != null ? (now - prev.ts) / 1000 : 0
  const apiCallsPerSec = elapsed > 0 && prev.total != null
    ? Math.max(0, Math.round((apiTotal - prev.total) / elapsed))
    : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          {maxMem != null
            ? <><GaugeBar value={mem} max={maxMem} label="Memory Used" /><div className="text-xs mt-1">{formatBytes(mem)} / {formatBytes(maxMem)}</div></>
            : <><div className="mb-1 text-sm text-muted-foreground">Memory Used</div><div className="font-mono text-lg text-foreground">{formatBytes(mem)}</div><div className="text-xs text-muted-foreground">Unlimited</div></>
          }
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          {maxStorage != null
            ? <><GaugeBar value={storage} max={maxStorage} label="Storage Used" /><div className="text-xs mt-1">{formatBytes(storage)} / {formatBytes(maxStorage)}</div></>
            : <><div className="mb-1 text-sm text-muted-foreground">Storage Used</div><div className="font-mono text-lg text-foreground">{formatBytes(storage)}</div><div className="text-xs text-muted-foreground">Unlimited</div></>
          }
        </div>
        <MetricCard label="API Calls" value={(data.api?.total ?? 0).toLocaleString()} />
        <MetricCard label="API Errors" value={data.api?.errors ?? 0} variant={(data.api?.errors ?? 0) > 0 ? 'error' : 'default'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Streams"      value={(data.total_streams  ?? data.streams   ?? 0).toLocaleString()} />
        <MetricCard label="Consumers"    value={(data.total_consumers ?? data.consumers ?? 0).toLocaleString()} />
        <MetricCard label="Messages"     value={(data.total_messages  ?? data.messages  ?? 0).toLocaleString()} />
        <MetricCard label="Bytes Stored" value={formatBytes(data.total_message_bytes ?? data.bytes)} />
      </div>

      {/* JetStream internal traffic */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-nats-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">JetStream Internal Traffic</span>
          </div>
          <Link
            to="/subscriptions?filter=js"
            className="text-xs text-nats-accent hover:underline inline-flex items-center gap-1"
          >
            View $JS.* subscriptions <ExternalLink size={10} />
          </Link>
        </div>
        <div className="p-4">
          <p className="mb-4 text-xs text-muted-foreground">
            JetStream uses internal subjects (<code className="text-foreground">$JS.*</code>) for stream/consumer operations, heartbeats, and acks.
            API Calls below reflect this internal traffic.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="mb-0.5 text-xs text-muted-foreground">API Calls (total)</div>
              <div className="font-mono text-lg text-foreground">{(data.api?.total ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-muted-foreground">API Calls/sec</div>
              <div className="font-mono text-lg text-nats-accent">
                {apiCallsPerSec != null ? `${apiCallsPerSec.toLocaleString()} /s` : '—'}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-muted-foreground">API Errors</div>
              <div className={`font-mono text-lg ${(data.api?.errors ?? 0) > 0 ? 'text-nats-error' : 'text-foreground'}`}>
                {data.api?.errors ?? 0}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-muted-foreground">API Level</div>
              <div className="font-mono text-lg text-foreground">{data.api?.level ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
