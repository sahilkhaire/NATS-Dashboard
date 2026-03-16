import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useConfig }       from '../../context/ConfigContext'
import { useNatsPolling }  from '../../hooks/useNatsPolling'
import { MetricCard }      from '../../components/MetricCard'
import { GaugeBar }        from '../../components/GaugeBar'
import { AlertBanner }     from '../../components/AlertBanner'
import { ConnectionError } from '../../components/ConnectionError'
import { formatBytes }     from '../../utils/byteFormatter'
import {
  LineChart, AreaChart, Line, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Shield, ShieldOff, Lock, Unlock, Server, Cpu, MemoryStick,
  Network, AlertTriangle, Activity, Database, Info,
  ArrowDownToLine, ArrowUpFromLine, MessageSquare, HardDrive,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, subValue, icon: Icon, variant = 'default', to }) {
  const colors = {
    default: 'border-nats-border',
    error:   'border-nats-error/50 bg-nats-error/10',
    warn:    'border-nats-warn/50 bg-nats-warn/10',
    ok:      'border-nats-ok/40 bg-nats-ok/10',
  }
  const inner = (
    <div className={`rounded-lg border bg-nats-card p-4 ${colors[variant]} ${to ? 'hover:border-nats-accent/50 transition-colors cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
        {Icon && <Icon size={14} className="text-gray-600" />}
      </div>
      <div className={`font-mono text-2xl font-semibold tabular-nums ${
        variant === 'error' ? 'text-nats-error' : variant === 'warn' ? 'text-nats-warn' : variant === 'ok' ? 'text-nats-ok' : 'text-white'
      }`}>
        {value ?? <span className="text-gray-600 text-base">—</span>}
      </div>
      {subValue && <div className="mt-1 text-xs text-gray-500">{subValue}</div>}
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function MiniChart({ data, dataKey, color, label, unit = '' }) {
  return (
    <div className="rounded-lg border border-nats-border bg-nats-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        {data.length > 0 && (
          <span className="ml-auto text-xs font-mono text-gray-400">
            {(data[data.length - 1]?.[dataKey] ?? 0).toLocaleString()}{unit}
          </span>
        )}
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ display: 'none' }}
              formatter={v => [`${v.toLocaleString()}${unit}`, label]}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#grad-${dataKey})`} dot={false} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function InfoRow({ label, children, mono = false }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-nats-border last:border-0">
      <span className="text-xs text-gray-400 w-36 shrink-0">{label}</span>
      <span className={`text-xs text-gray-200 text-right ${mono ? 'font-mono' : ''}`}>{children ?? '—'}</span>
    </div>
  )
}

function Badge({ children, color = 'gray', icon: Icon }) {
  const colors = {
    green: 'bg-nats-ok/20 text-nats-ok border-nats-ok/30',
    red:   'bg-nats-error/20 text-nats-error border-nats-error/30',
    gray:  'bg-nats-border text-gray-300 border-transparent',
    warn:  'bg-nats-warn/20 text-nats-warn border-nats-warn/30',
    blue:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium ${colors[color]}`}>
      {Icon && <Icon size={10} />}
      {children}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OverviewPage({ onData }) {
  const { pollInterval } = useConfig()
  const { data: varz, error, lastFetch } = useNatsPolling('/varz', pollInterval)
  const { data: jsz }  = useNatsPolling('/jsz', 3000)
  const { data: healthData } = useNatsPolling('/healthz', 5000)

  const [history, setHistory] = useState([])
  const prevRef = useRef(null)
  const MAX_HISTORY = 60

  useEffect(() => {
    if (!varz) return
    const prev    = prevRef.current
    const elapsed = prev ? (Date.now() - prev.time) / 1000 : pollInterval / 1000

    const safeRate = (cur, prevVal) =>
      (cur != null && prevVal != null) ? Math.max(0, Math.round((cur - prevVal) / elapsed)) : null

    const inMsgRate  = safeRate(varz.in_msgs,   prev?.inMsgs)
    const outMsgRate = safeRate(varz.out_msgs,  prev?.outMsgs)
    const inByteRate = safeRate(varz.in_bytes,  prev?.inBytes)
    const outByteRate = safeRate(varz.out_bytes, prev?.outBytes)

    prevRef.current = {
      inMsgs:   varz.in_msgs,
      outMsgs:  varz.out_msgs,
      inBytes:  varz.in_bytes,
      outBytes: varz.out_bytes,
      time:     Date.now(),
    }

    const point = {
      time:        Date.now(),
      inMsgRate:   inMsgRate  ?? 0,
      outMsgRate:  outMsgRate ?? 0,
      inByteRate:  inByteRate  ?? 0,
      outByteRate: outByteRate ?? 0,
    }
    setHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), point])
  }, [varz, pollInterval])

  useEffect(() => { onData?.({ varz, lastFetch }) }, [varz, lastFetch, onData])

  if (error) return <ConnectionError error={error} />
  if (!varz) return <div className="p-6 text-gray-400">Loading...</div>

  const viaProtocol   = varz._via === 'nats_protocol'
  const slowConsumers = varz.slow_consumers ?? 0
  const apiErrors     = jsz?.api?.errors ?? 0
  const jsMem         = jsz?.memory     ?? 0
  const jsMemMax      = jsz?.config?.max_memory ?? 0
  const jsStore       = jsz?.storage    ?? 0
  const jsStoreMax    = jsz?.config?.max_storage ?? 0
  const healthy       = !error && healthData?.status === 'ok'

  const totalMsgsIn  = varz.in_msgs   != null ? varz.in_msgs.toLocaleString()  : null
  const totalMsgsOut = varz.out_msgs  != null ? varz.out_msgs.toLocaleString()  : null
  const totalBytesIn = varz.in_bytes  != null ? formatBytes(varz.in_bytes)      : null
  const totalBytesOut= varz.out_bytes != null ? formatBytes(varz.out_bytes)     : null

  return (
    <div className="p-6 space-y-6">

      {/* Protocol-mode notice */}
      {viaProtocol && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border border-nats-warn/30 bg-nats-warn/10 text-xs text-nats-warn">
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Connected via NATS protocol (port 4222).</span>{' '}
            Real-time CPU, memory, connections, subscriptions and slow-consumer metrics require the HTTP monitoring port 8222
            (<span className="font-mono">nats-server -m 8222</span>).
            JetStream, stream and consumer data is fully available.
          </div>
        </div>
      )}

      {/* Slow consumer alert */}
      {slowConsumers > 0 && (
        <AlertBanner variant="error" title={`${slowConsumers} Slow Consumer${slowConsumers > 1 ? 's' : ''} Detected`}>
          Client(s) cannot consume fast enough — the server is buffering data. Check the Connections page for pending_bytes.
        </AlertBanner>
      )}
      {apiErrors > 0 && (
        <AlertBanner variant="warn" title={`${apiErrors} JetStream API Error${apiErrors > 1 ? 's' : ''}`}>
          JetStream has logged API errors. Check your stream and consumer configurations.
        </AlertBanner>
      )}

      {/* ── Row 1: Health cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          label="Server Status"
          icon={Activity}
          value={healthy ? <span className="text-nats-ok">Healthy</span> : <span className="text-gray-400">Unknown</span>}
          subValue={varz.uptime ?? 'uptime via HTTP only'}
          variant={healthy ? 'default' : 'default'}
        />
        <StatBox
          label="Version"
          icon={Server}
          value={<span className="text-lg">{varz.version ?? '—'}</span>}
          subValue={varz.go ? `Go ${varz.go}` : undefined}
        />
        <StatBox
          label="JetStream"
          icon={Database}
          value={jsz ? <span className="text-nats-ok">Enabled</span> : <span className="text-gray-400">—</span>}
          subValue={jsz ? `${jsz.total_streams ?? 0} streams · ${jsz.total_consumers ?? 0} consumers` : undefined}
          to="/jetstream"
        />
        <StatBox
          label="Connections"
          icon={Network}
          value={varz.connections ?? (viaProtocol ? '—' : '0')}
          subValue={varz.max_connections ? `max ${varz.max_connections.toLocaleString()}` : undefined}
          to="/connections"
        />
      </div>

      {/* ── Row 2: Charts (msgs/sec + bytes/sec) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniChart data={history} dataKey="inMsgRate"   color="#00c8b4" label="Msgs/sec In"     unit=" msg/s" />
        <MiniChart data={history} dataKey="outMsgRate"  color="#4d8ff5" label="Msgs/sec Out"    unit=" msg/s" />
        <MiniChart data={history} dataKey="inByteRate"  color="#a78bfa" label="Bytes/sec In"    unit=" B/s" />
        <MiniChart data={history} dataKey="outByteRate" color="#f59e0b" label="Bytes/sec Out"   unit=" B/s" />
      </div>

      {/* ── Row 3: Key counters ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBox label="Active Connections" value={varz.connections ?? '—'} icon={Network} to="/connections" />
        <StatBox label="Subscriptions"      value={varz.subscriptions ?? '—'} icon={MessageSquare} to="/subscriptions" />
        <StatBox
          label="Slow Consumers"
          value={varz.slow_consumers ?? '—'}
          icon={AlertTriangle}
          variant={slowConsumers > 0 ? 'error' : 'default'}
          to="/connections"
        />
        <StatBox label="Streams"     value={jsz?.total_streams   ?? '—'} icon={Database}     to="/streams" />
        <StatBox label="Consumers"   value={jsz?.total_consumers ?? '—'} icon={MessageSquare} to="/streams" />
        <StatBox
          label="JS API Errors"
          value={jsz?.api?.errors ?? '—'}
          icon={AlertTriangle}
          variant={apiErrors > 0 ? 'error' : 'default'}
        />
      </div>

      {/* ── Row 4: Cumulative throughput ─────────────────────────────────────── */}
      {(totalMsgsIn || totalMsgsOut || totalBytesIn || totalBytesOut) && (
        <div className="rounded-lg border border-nats-border bg-nats-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-nats-border flex items-center gap-2">
            <ArrowDownToLine size={13} className="text-nats-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cumulative Throughput (since server start)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Total Msgs In',   value: totalMsgsIn,   icon: ArrowDownToLine,  color: 'text-nats-ok' },
              { label: 'Total Msgs Out',  value: totalMsgsOut,  icon: ArrowUpFromLine,  color: 'text-blue-400' },
              { label: 'Total Bytes In',  value: totalBytesIn,  icon: ArrowDownToLine,  color: 'text-purple-400' },
              { label: 'Total Bytes Out', value: totalBytesOut, icon: ArrowUpFromLine,  color: 'text-amber-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="p-4 border-r border-nats-border last:border-r-0">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <Icon size={11} className={color} /> {label}
                </div>
                <div className={`font-mono text-lg font-semibold ${color}`}>{value ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 5: JetStream storage/memory gauges ───────────────────────────── */}
      {jsz && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-nats-border bg-nats-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">JetStream Memory</span>
              <span className="text-xs font-mono text-gray-400">
                {formatBytes(jsMem)} {jsMemMax > 0 ? `/ ${formatBytes(jsMemMax)}` : '/ unlimited'}
              </span>
            </div>
            <GaugeBar value={jsMem} max={jsMemMax > 0 ? jsMemMax : jsMem || 1} label="" showPercent={jsMemMax > 0} />
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Reserved: {formatBytes(jsz.reserved_memory ?? 0)}</span>
              <span>Messages: {(jsz.total_messages ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-lg border border-nats-border bg-nats-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">JetStream Storage</span>
              <span className="text-xs font-mono text-gray-400">
                {formatBytes(jsStore)} {jsStoreMax > 0 ? `/ ${formatBytes(jsStoreMax)}` : '/ unlimited'}
              </span>
            </div>
            <GaugeBar value={jsStore} max={jsStoreMax > 0 ? jsStoreMax : jsStore || 1} label="" showPercent={jsStoreMax > 0} />
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Reserved: {formatBytes(jsz.reserved_storage ?? 0)}</span>
              <span>Bytes stored: {formatBytes(jsz.total_message_bytes ?? 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 6: Server resources (CPU + Memory) ───────────────────────────── */}
      {!viaProtocol && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-nats-border bg-nats-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu size={13} className="text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">CPU Usage</span>
              {varz.cores != null && <span className="ml-auto text-xs text-gray-500">{varz.cores} cores</span>}
            </div>
            {varz.cpu != null
              ? <GaugeBar value={varz.cpu} max={100} label={`${varz.cpu.toFixed(1)}%`} />
              : <div className="text-xs text-gray-600 py-2">CPU data unavailable</div>}
          </div>
          <div className="rounded-lg border border-nats-border bg-nats-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MemoryStick size={13} className="text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Memory</span>
              {varz.mem != null && <span className="ml-auto text-xs font-mono text-gray-300">{formatBytes(varz.mem)}</span>}
            </div>
            {varz.mem != null
              ? <GaugeBar value={varz.mem} max={varz.mem} label="" showPercent={false} />
              : <div className="text-xs text-gray-600 py-2">Memory data unavailable</div>}
          </div>
        </div>
      )}

      {/* ── Row 7: Server info + topology ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Server Info */}
        <div className="rounded-lg border border-nats-border bg-nats-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-nats-border flex items-center gap-2">
            <Server size={13} className="text-nats-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Server Info</span>
          </div>
          <div className="px-4 py-1">
            <InfoRow label="Server ID"   mono>{varz.server_id ? `${varz.server_id.slice(0, 24)}…` : '—'}</InfoRow>
            <InfoRow label="Name"        mono>{varz.server_name}</InfoRow>
            <InfoRow label="Host"        mono>{varz.host && varz.port ? `${varz.host}:${varz.port}` : '—'}</InfoRow>
            <InfoRow label="Go Runtime"  mono>{varz.go}</InfoRow>
            <InfoRow label="CPU Cores"        >{varz.cores}</InfoRow>
            <InfoRow label="Max Payload" mono>{varz.max_payload ? formatBytes(varz.max_payload) : '—'}</InfoRow>
            <InfoRow label="Started">
              {varz.start ? new Date(varz.start).toLocaleString() : varz.uptime ?? '—'}
            </InfoRow>
            <InfoRow label="Security">
              <div className="flex gap-1 flex-wrap justify-end">
                <Badge color={varz.auth_required ? 'green' : 'gray'} icon={varz.auth_required ? Lock : Unlock}>
                  {varz.auth_required ? 'Auth required' : 'No auth'}
                </Badge>
                <Badge color={varz.tls_required ? 'green' : 'gray'} icon={varz.tls_required ? Shield : ShieldOff}>
                  {varz.tls_required ? 'TLS required' : 'No TLS'}
                </Badge>
              </div>
            </InfoRow>
          </div>
        </div>

        {/* Topology */}
        <div className="rounded-lg border border-nats-border bg-nats-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-nats-border flex items-center gap-2">
            <Network size={13} className="text-nats-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Topology</span>
          </div>
          <div className="grid grid-cols-2 gap-0 divide-x divide-nats-border divide-y">
            {[
              { label: 'Cluster Routes',  value: varz.routes,    to: '/cluster' },
              { label: 'Remote Servers',  value: varz.remotes,   to: '/cluster' },
              { label: 'Leaf Nodes',      value: varz.leafnodes, to: '/leaf-nodes' },
              { label: 'Gateways',        value: varz.gateways,  to: '/gateways' },
              { label: 'Total Conns',     value: varz.total_connections != null ? varz.total_connections.toLocaleString() : null },
              { label: 'Max Conns',       value: varz.max_connections != null ? varz.max_connections.toLocaleString() : null },
            ].map(({ label, value, to }) => (
              <div key={label} className="p-3">
                <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                {to
                  ? <Link to={to} className="font-mono text-sm text-nats-accent hover:underline">{value ?? '—'}</Link>
                  : <div className="font-mono text-sm text-white">{value ?? '—'}</div>
                }
              </div>
            ))}
          </div>

          {/* Cluster name + JetStream domain */}
          {(varz.cluster?.name || jsz?.domain) && (
            <div className="px-4 py-3 border-t border-nats-border flex flex-wrap gap-3 text-xs">
              {varz.cluster?.name && (
                <span className="text-gray-400">Cluster: <span className="font-mono text-gray-200">{varz.cluster.name}</span></span>
              )}
              {jsz?.domain && (
                <span className="text-gray-400">JS Domain: <span className="font-mono text-gray-200">{jsz.domain}</span></span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Protocol-mode detail note ─────────────────────────────────────────── */}
      {viaProtocol && (
        <div className="rounded-lg border border-nats-border bg-nats-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Available vs Unavailable Metrics</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-nats-ok font-medium mb-1.5">✓ Available via NATS protocol</div>
              <ul className="space-y-1 text-gray-400">
                <li>Server identity (ID, name, version)</li>
                <li>JetStream streams, consumers, state</li>
                <li>Message rates (calculated from JS API)</li>
                <li>All stream &amp; consumer operations</li>
                <li>JetStream storage &amp; memory limits</li>
              </ul>
            </div>
            <div>
              <div className="text-nats-warn font-medium mb-1.5">✗ Requires HTTP port 8222</div>
              <ul className="space-y-1 text-gray-400">
                <li>CPU &amp; memory usage</li>
                <li>Active connections list</li>
                <li>Subscription details</li>
                <li>Slow consumer detection</li>
                <li>Cluster routes &amp; leaf nodes detail</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
