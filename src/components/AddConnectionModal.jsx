import { useState } from 'react'
import { X, Plus } from 'lucide-react'

export function AddConnectionModal({ open, onClose, onAdd }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const monitoringUrl = url.trim().replace(/\/$/, '')
    if (!monitoringUrl) return
    onAdd({
      name: name.trim() || monitoringUrl,
      monitoringUrl: monitoringUrl,
      token: token.trim() || null,
    })
    setName('')
    setUrl('')
    setToken('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-nats-card border border-nats-border rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plus size={20} />
            Add Connection
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-nats-border rounded">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-nats-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My NATS Server"
              className="w-full bg-nats-bg border border-nats-border rounded px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-nats-text-secondary mb-1">Monitoring URL *</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="nats://host:4222 or http://host:8222"
              className="w-full bg-nats-bg border border-nats-border rounded px-3 py-2 font-mono text-sm"
              required
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border border-nats-border hover:bg-nats-border">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded bg-nats-accent text-nats-bg hover:opacity-90 flex items-center gap-2">
              <Plus size={16} />
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
