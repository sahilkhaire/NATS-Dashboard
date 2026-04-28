import { TrafficFlowChart } from '../components/TrafficFlowChart'

function formatRate(value) {
  if (!Number.isFinite(value)) return '0.0'
  return value >= 1 ? value.toFixed(1) : value.toFixed(2)
}

export function AnalyticsTab({ points, refreshInterval }) {
  const latest = points?.[points.length - 1]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded border border-border bg-card p-3">
          <div className="text-[11px] text-muted-foreground">Ingress</div>
          <div className="text-sm font-semibold text-primary">{formatRate(latest?.msgsPerSec)} msg/s</div>
        </div>
        <div className="rounded border border-border bg-card p-3">
          <div className="text-[11px] text-muted-foreground">Bytes Ingress</div>
          <div className="text-sm font-semibold text-primary">{formatRate(latest?.bytesPerSec)} B/s</div>
        </div>
        <div className="rounded border border-border bg-card p-3">
          <div className="text-[11px] text-muted-foreground">Backlog Pending</div>
          <div className="text-sm font-semibold text-foreground">{(latest?.backlogPending ?? 0).toLocaleString()}</div>
        </div>
        <div className="rounded border border-border bg-card p-3">
          <div className="text-[11px] text-muted-foreground">Ack Pending</div>
          <div className="text-sm font-semibold text-foreground">{(latest?.ackPending ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <TrafficFlowChart points={points} refreshInterval={refreshInterval} />
    </div>
  )
}

