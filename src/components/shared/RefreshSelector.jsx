import { RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'

const OPTIONS = [
  { label: '1s',  value: 1000 },
  { label: '2s',  value: 2000 },
  { label: '3s',  value: 3000 },
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
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
    <div className="flex items-center gap-2 flex-wrap">
      <RefreshCw size={14} className="text-muted-foreground" />
      <span className="hidden text-xs text-muted-foreground sm:inline">Refresh:</span>
      <div className="flex overflow-hidden rounded-md border border-border text-xs">
        {OPTIONS.map(opt => (
          <Button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            variant={interval === opt.value ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none border-0"
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {lastFetch && (
        <span className="hidden text-xs text-muted-foreground md:inline">
          updated {ago}
        </span>
      )}
    </div>
  )
}
