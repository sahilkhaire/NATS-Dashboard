import { RefreshCw } from 'lucide-react'

const OPTIONS = [
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
]

/**
 * Compact refresh-interval picker + last-updated badge.
 * Props:
 *   interval   – current interval in ms
 *   onChange   – called with new interval value in ms
 *   lastFetch  – timestamp (ms) of the last successful fetch
 */
export function RefreshSelector({ interval, onChange, lastFetch }) {
  const ago = lastFetch
    ? `${Math.round((Date.now() - lastFetch) / 1000)}s ago`
    : 'waiting…'

  return (
    <div className="flex items-center gap-2">
      <RefreshCw size={14} className="text-nats-text-muted" />
      <span className="text-xs text-nats-text-muted hidden sm:inline">Refresh:</span>
      <div className="flex rounded border border-nats-border overflow-hidden text-xs">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 transition-colors ${
              interval === opt.value
                ? 'bg-nats-accent text-white font-semibold'
                : 'bg-nats-card text-nats-text-secondary hover:bg-nats-border/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {lastFetch && (
        <span className="text-xs text-nats-text-muted hidden md:inline">
          updated {ago}
        </span>
      )}
    </div>
  )
}
