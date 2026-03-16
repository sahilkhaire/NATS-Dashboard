import { useConfig } from '../context/ConfigContext'
import { useNatsPolling } from '../hooks/useNatsPolling'
import { MetricCard } from '../components/MetricCard'
import { GaugeBar } from '../components/GaugeBar'
import { AlertBanner } from '../components/AlertBanner'
import { ConnectionError } from '../components/ConnectionError'
import { formatBytes } from '../utils/byteFormatter'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect, useRef } from 'react'

export function OverviewPage({ onData }) {
  const { pollInterval } = useConfig()
  const { data: varz, error, lastFetch } = useNatsPolling('/varz', pollInterval)
  const { data: jsz } = useNatsPolling('/jsz', 3000)

  const [history, setHistory] = useState([])
  const prevRef = useRef(null)
  const MAX_HISTORY = 60

  useEffect(() => {
    if (!varz) return
    const prev = prevRef.current
    const elapsed = prev ? (Date.now() - prev.time) / 1000 : pollInterval / 1000
    const inRate = prev ? (varz.in_msgs - prev.inMsgs) / elapsed : 0
    const outRate = prev ? (varz.out_msgs - prev.outMsgs) / elapsed : 0
    prevRef.current = { inMsgs: varz.in_msgs, outMsgs: varz.out_msgs, time: Date.now() }
    const point = {
      time: Date.now(),
      inRate: Math.max(0, Math.round(inRate)),
      outRate: Math.max(0, Math.round(outRate)),
    }
    setHistory(prevH => [...prevH.slice(-(MAX_HISTORY - 1)), point])
  }, [varz, pollInterval])

  useEffect(() => {
    onData?.({ varz, lastFetch })
  }, [varz, lastFetch, onData])

  if (error) {
    return <ConnectionError error={error} />
  }

  if (!varz) {
    return <div className="p-6 text-nats-text-secondary">Loading...</div>
  }

  const slowConsumers = varz.slow_consumers ?? 0
  const apiErrors = jsz?.api?.errors ?? 0

  return (
    <div className="p-6 space-y-6">
      {slowConsumers > 0 && (
        <AlertBanner variant="error" title={`${slowConsumers} Slow Consumer(s) Detected`}>
          Clients are not consuming fast enough. Check the Connections page for pending_bytes.
        </AlertBanner>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Server Status" value={varz.uptime || '-'} subtext="Uptime" />
        <MetricCard label="Version" value={varz.version || '-'} />
        <MetricCard label="JetStream" value={jsz ? 'Enabled' : 'Disabled'} />
        <MetricCard label="Connections" value={`${varz.connections ?? 0} / ${varz.max_connections ?? 0}`} subtext="Active / Max" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          <div className="text-sm font-medium text-nats-accent mb-4">Messages/sec In</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="time" hide />
                <YAxis />
                <Tooltip formatter={v => [v, 'msgs/s']} />
                <Line type="monotone" dataKey="inRate" stroke="#00c8b4" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          <div className="text-sm font-medium text-nats-accent mb-4">Messages/sec Out</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="time" hide />
                <YAxis />
                <Tooltip formatter={v => [v, 'msgs/s']} />
                <Line type="monotone" dataKey="outRate" stroke="#4d8ff5" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Connections" value={varz.connections ?? 0} />
        <MetricCard label="Subscriptions" value={varz.subscriptions ?? 0} />
        <MetricCard label="Slow Consumers" value={slowConsumers} variant={slowConsumers > 0 ? 'error' : 'default'} />
        <MetricCard label="Streams" value={jsz?.total_streams ?? 0} />
        <MetricCard label="Consumers" value={jsz?.total_consumers ?? 0} />
        <MetricCard label="JS API Errors" value={apiErrors} variant={apiErrors > 0 ? 'error' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          <GaugeBar value={varz.cpu ?? 0} max={100} label="CPU Usage" />
        </div>
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          <div className="text-sm text-nats-text-secondary mb-2">Memory</div>
          <div className="font-mono text-lg">{formatBytes(varz.mem)}</div>
        </div>
      </div>

      <div className="rounded-lg border border-nats-border bg-nats-card p-4">
        <div className="text-sm font-medium text-nats-accent mb-2">Server Info</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-nats-text-muted">Server ID:</span> {varz.server_id}</div>
          <div><span className="text-nats-text-muted">Name:</span> {varz.server_name}</div>
          <div><span className="text-nats-text-muted">Host:</span> {varz.host}:{varz.port}</div>
          <div><span className="text-nats-text-muted">Cores:</span> {varz.cores}</div>
        </div>
      </div>
    </div>
  )
}
