import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function axisFormatter(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(Math.round(value))
}

function timeFormatter(ts) {
  return new Date(ts).toLocaleTimeString()
}

export function TrafficFlowChart({ points, refreshInterval }) {
  if (!points || points.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">Traffic Flow</div>
        <div className="mt-2 text-xs text-muted-foreground">Collecting enough points to render chart…</div>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">Traffic Flow</span>
        <span className="text-muted-foreground">Update cadence: {(refreshInterval / 1000).toFixed(1)}s</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis
              dataKey="ts"
              tickFormatter={timeFormatter}
              stroke="#6b7280"
              minTickGap={36}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="rate"
              stroke="#6b7280"
              tickFormatter={axisFormatter}
              tick={{ fontSize: 11 }}
              width={42}
            />
            <YAxis
              yAxisId="depth"
              orientation="right"
              stroke="#6b7280"
              tickFormatter={axisFormatter}
              tick={{ fontSize: 11 }}
              width={42}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#11151f',
                border: '1px solid #2a3140',
                borderRadius: 8,
                color: '#e5e7eb',
                fontSize: 11,
              }}
              labelFormatter={(label) => `Time: ${timeFormatter(label)}`}
            />
            <Line yAxisId="rate" type="monotone" dataKey="msgsPerSec" name="Ingress msg/s" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="depth" type="monotone" dataKey="backlogPending" name="Backlog pending" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="depth" type="monotone" dataKey="ackPending" name="Ack pending" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="depth" type="monotone" dataKey="redeliveredDelta" name="Redeliver delta" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Ingress = new messages per second. Backlog/ack pending are summed across stream consumers.
      </div>
    </div>
  )
}

