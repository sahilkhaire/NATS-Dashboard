import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { useConfig } from '../../context/ConfigContext'
import { useTheme, THEMES } from '../../context/ThemeContext'
import { setLastConnection } from '../../hooks/useSavedConnections'

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-nats-card border border-nats-border rounded-lg p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-nats-border rounded">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Connection */}
          <div>
            <label className="block text-sm text-nats-text-secondary mb-1">NATS Monitoring URL</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://localhost:8222"
              className="w-full bg-nats-bg border border-nats-border rounded px-3 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-nats-text-secondary mb-1">Auth Token (optional)</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Bearer token for secured NATS"
              className="w-full bg-nats-bg border border-nats-border rounded px-3 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-nats-text-secondary mb-1">Poll Interval (ms)</label>
            <input
              type="number"
              value={refreshInterval}
              onChange={e => setRefreshInterval(e.target.value)}
              min={1000}
              max={30000}
              step={1000}
              className="w-full bg-nats-bg border border-nats-border rounded px-3 py-2 font-mono text-sm"
            />
          </div>

          {/* Theme picker */}
          <div>
            <label className="block text-sm text-nats-text-secondary mb-2">Theme</label>
            <div className="grid grid-cols-5 gap-2">
              {THEMES.map((t) => {
                const active = theme === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    title={t.label}
                    className={`group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                      active
                        ? 'border-nats-accent ring-1 ring-nats-accent/50'
                        : 'border-nats-border hover:border-nats-text-muted'
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
                    <span className="text-xs text-nats-text-secondary">{t.label}</span>
                    {active && (
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-nats-accent flex items-center justify-center">
                        <Check size={9} strokeWidth={3} className="text-nats-bg" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border border-nats-border hover:bg-nats-border">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-nats-accent text-nats-bg hover:opacity-90 font-medium">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
