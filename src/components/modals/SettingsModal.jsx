import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { useConfig } from '../../context/ConfigContext'
import { useTheme, THEMES } from '../../context/ThemeContext'
import { setLastConnection } from '../../hooks/useSavedConnections'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'

export function SettingsModal({ open, onClose }) {
  const { serverUrl, setServerUrl, pollInterval, setPollInterval, setSelectedContext, authToken, setAuthToken } = useConfig()
  const { theme, setTheme } = useTheme()

  const [url,             setUrl]             = useState(serverUrl)
  const [refreshInterval, setRefreshInterval] = useState(pollInterval)
  const [token,           setToken]           = useState(authToken || '')

  useEffect(() => {
    if (open) {
      setUrl(serverUrl)
      setRefreshInterval(pollInterval)
      setToken(authToken || '')
    }
  }, [open, serverUrl, pollInterval, authToken])

  const handleSave = () => {
    setServerUrl(url)
    setPollInterval(Number(refreshInterval) || 2000)
    setAuthToken(token.trim() || null)
    setSelectedContext(null)
    setLastConnection(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Connection, polling interval, and dashboard theme settings.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {/* Connection */}
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">NATS Monitoring URL</label>
            <Input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://localhost:8222"
              className="font-mono"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Auth Token (optional)</label>
            <Input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Bearer token for secured NATS"
              className="font-mono"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Poll Interval (ms)</label>
            <Input
              type="number"
              value={refreshInterval}
              onChange={e => setRefreshInterval(e.target.value)}
              min={1000}
              max={30000}
              step={1000}
              className="font-mono"
            />
          </div>

          {/* Theme picker */}
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => {
                const active = theme === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    title={t.label}
                    className={`group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                      active
                        ? 'border-primary ring-1 ring-primary/40'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {/* Mini preview swatch */}
                    <div
                      className="w-full h-10 rounded overflow-hidden relative"
                      style={{ background: t.swatch.bg }}
                    >
                      {/* card strip */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-5 rounded-t"
                        style={{ background: t.swatch.card }}
                      />
                      {/* accent dot */}
                      <div
                        className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: t.swatch.accent }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                    {active && (
                      <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                        <Check size={9} strokeWidth={3} className="text-nats-bg" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
