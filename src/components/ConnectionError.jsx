import { useConfig } from '../context/ConfigContext'
import { AlertCircle, Terminal, Wifi } from 'lucide-react'

function Code({ children }) {
  return (
    <code className="block bg-black/30 text-nats-accent font-mono text-xs px-3 py-2 rounded mt-1 select-all whitespace-pre-wrap break-all">
      {children}
    </code>
  )
}

export function ConnectionError({ error }) {
  const { serverUrl } = useConfig()

  // Parse hint from the proxy error JSON if embedded
  let hint = 'UNKNOWN'
  let cleanError = error
  try {
    const parsed = JSON.parse(error)
    if (parsed?.hint) { hint = parsed.hint; cleanError = parsed.error }
  } catch { /* plain string error */ }

  // Try to extract hostname from serverUrl
  let host = serverUrl
  let hostname = serverUrl
  try {
    const u = new URL(serverUrl)
    hostname = u.hostname
    host = u.host
  } catch { /* ignore */ }

  const isPortBlocked = hint === 'PORT_BLOCKED' || hint === 'PORT_CLOSED' ||
    (cleanError || '').includes('timed out') ||
    (cleanError || '').includes('refused') ||
    (cleanError || '').includes('fetch failed')

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-3 rounded-lg border border-nats-error bg-nats-error/10 p-4">
        <AlertCircle size={20} className="text-nats-error mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-nats-error">Cannot reach NATS server</div>
          <div className="text-sm mt-1 font-mono text-nats-error/80">{cleanError || error}</div>
        </div>
      </div>

      {isPortBlocked && (
        <div className="rounded-lg border border-nats-border bg-nats-card p-4 space-y-4">
          <div className="flex items-center gap-2 font-semibold">
            <Wifi size={18} className="text-nats-warn" />
            Port 8222 (NATS monitoring) is not reachable
          </div>
          <p className="text-sm text-nats-text-secondary">
            NATS exposes monitoring data on HTTP port 8222. Port 4222 (the NATS protocol) may be working,
            but the monitoring port is either firewalled or bound to localhost only on the server.
          </p>

          <div>
            <div className="flex items-center gap-2 text-sm font-semibold mb-1">
              <Terminal size={15} className="text-nats-accent" />
              Fix 1 — SSH tunnel (quickest, no server changes)
            </div>
            <p className="text-xs text-nats-text-secondary mb-1">
              Run this in a terminal. Keep it open while using the dashboard:
            </p>
            <Code>{`ssh -L 8222:localhost:8222 user@${hostname} -N`}</Code>
            <p className="text-xs text-nats-text-secondary mt-2">
              Then set the connection URL to:
            </p>
            <Code>http://localhost:8222</Code>
          </div>

          <div>
            <div className="text-sm font-semibold mb-1">Fix 2 — Open port 8222 on the server</div>
            <p className="text-xs text-nats-text-secondary mb-1">
              If the NATS server is started with <code className="text-nats-accent">-m 8222</code> but the
              port is blocked by a firewall:
            </p>
            <Code>{`# On the server (example for ufw):
sudo ufw allow 8222/tcp

# Or for iptables:
sudo iptables -A INPUT -p tcp --dport 8222 -j ACCEPT`}</Code>
          </div>

          <div>
            <div className="text-sm font-semibold mb-1">Fix 3 — Verify NATS monitoring is enabled</div>
            <p className="text-xs text-nats-text-secondary mb-1">
              The NATS server must be started with monitoring enabled:
            </p>
            <Code>{`nats-server -m 8222
# or in config:
http_port: 8222`}</Code>
            <p className="text-xs text-nats-text-secondary mt-1">
              Then verify from the server machine: <code className="text-nats-accent">curl localhost:8222/healthz</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
