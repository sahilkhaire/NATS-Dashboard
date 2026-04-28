import { useState, useEffect } from 'react'
import { useConfig } from '../../context/ConfigContext'
import { setLastConnection } from '../../hooks/useSavedConnections'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'

export function SettingsModal({ open, onClose }) {
  const { serverUrl, setServerUrl, pollInterval, setPollInterval, setSelectedContext, authToken, setAuthToken } = useConfig()

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
          <DialogDescription>Connection and polling interval settings.</DialogDescription>
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
