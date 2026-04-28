import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

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

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus size={20} />
            Add Connection
          </DialogTitle>
          <DialogDescription>Create a reusable monitoring endpoint profile.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Name</label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My NATS Server"
              className="font-mono"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Monitoring URL *</label>
            <Input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="nats://host:4222 or http://host:8222"
              className="font-mono"
              required
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
          <DialogFooter className="pt-2">
            <Button type="button" onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button type="submit" className="flex items-center gap-2">
              <Plus size={16} />
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
