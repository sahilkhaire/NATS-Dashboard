export function NatsProtocolNotice({ endpoint }) {
  return (
    <div className="p-6">
      <div className="rounded-lg border border-nats-warn/40 bg-nats-warn/10 p-4 text-sm max-w-lg">
        <div className="font-semibold text-nats-warn mb-1">Not available via NATS protocol</div>
        <p className="text-nats-text-secondary">
          <span className="font-mono text-nats-accent">/{endpoint}</span> requires the HTTP monitoring port (8222)
          or the NATS system account, neither of which is available for this connection.
        </p>
        <p className="mt-2 text-nats-text-secondary">
          To enable: open port 8222 on the server or create an SSH tunnel:{' '}
          <code className="text-nats-accent font-mono text-xs">ssh -L 8222:localhost:8222 user@server -N</code>
          {' '}then add a connection with <code className="text-nats-accent font-mono text-xs">http://localhost:8222</code>.
        </p>
      </div>
    </div>
  )
}
