import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useConfig } from '../context/ConfigContext'
import { setLastConnection } from '../hooks/useSavedConnections'

export function SettingsModal({ open, onClose }) {
  const { serverUrl, setServerUrl, pollInterval, setPollInterval, setSelectedContext, authToken, setAuthToken } = useConfig()
  const [url, setUrl] = useState(serverUrl)
  const [refreshInterval, setRefreshInterval] = useState(pollInterval)
  const [token, setToken] = useState(authToken || '')

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
    setSelectedContext(null) // Manual URL overrides context
    setLastConnection(null) // Clear so refresh doesn't restore old connection
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-nats-card border border-nats-border rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-nats-border rounded">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
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
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border border-nats-border hover:bg-nats-border">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-nats-accent text-nats-bg hover:opacity-90">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
