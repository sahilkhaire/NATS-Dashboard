import { useState, useEffect, useRef } from 'react'
import { Settings, Server, Heart, ChevronDown, LogOut } from 'lucide-react'
import { useConfig } from '../context/ConfigContext'
import { useAuth } from '../context/AuthContext'
import { SettingsModal } from './SettingsModal'
import { StatusBadge } from './StatusBadge'
import { useNatsPolling } from '../hooks/useNatsPolling'
import { useNatsContexts } from '../hooks/useNatsContexts'
import { getLastConnection } from '../hooks/useSavedConnections'

export function Header({ serverName, lastUpdated }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const { serverUrl, selectedContext, setServerUrl, setSelectedContext, setAuthToken } = useConfig()
  const { logout } = useAuth()
  const { contexts, current, loading } = useNatsContexts()
  const { data: health, error: healthError } = useNatsPolling('/healthz', 5000)

  const healthy = !healthError && health?.status === 'ok'
  const ago = lastUpdated ? `${Math.round((Date.now() - lastUpdated) / 1000)}s ago` : '-'

  const activeContext = selectedContext ?? current
  const activeCtx = contexts.find((c) => c.name === activeContext)

  const handleSelectContext = (ctx) => {
    if (ctx) {
      setServerUrl(ctx.monitoringUrl)
      setSelectedContext(ctx.name)
      setAuthToken(ctx.token || null)
    }
    setContextOpen(false)
  }

  // Initialize from NATS context on first load, but only if no saved connection exists
  const hasInitializedFromContext = useRef(false)
  useEffect(() => {
    if (hasInitializedFromContext.current || !contexts.length || !current) return
    if (getLastConnection()) return // ConfigContext already restored this from localStorage
    const ctx = contexts.find((c) => c.name === current)
    if (ctx) {
      setServerUrl(ctx.monitoringUrl)
      setSelectedContext(ctx.name)
      setAuthToken(ctx.token || null)
      hasInitializedFromContext.current = true
    }
  }, [contexts, current, setServerUrl, setSelectedContext, setAuthToken])

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-nats-border bg-nats-bg px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Server size={20} className="text-nats-accent" />
            <span className="font-mono font-semibold">{serverName || 'NATS Dashboard'}</span>
          </div>
          <StatusBadge status={healthy ? 'ok' : 'error'}>
            <Heart size={12} className="inline mr-1" />
            {healthy ? 'HEALTHY' : 'UNREACHABLE'}
          </StatusBadge>
          {contexts.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setContextOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-nats-border bg-nats-card text-sm hover:bg-nats-border/50"
                title="Switch NATS context"
              >
                <span className="text-nats-accent font-medium">
                  {loading ? '...' : activeCtx?.description || activeContext || 'Context'}
                </span>
                <ChevronDown size={14} className={contextOpen ? 'rotate-180' : ''} />
              </button>
              {contextOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setContextOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded border border-nats-border bg-nats-card py-1 shadow-lg">
                    {contexts.map((ctx) => (
                      <button
                        key={ctx.name}
                        onClick={() => handleSelectContext(ctx)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-nats-border/50 flex flex-col ${
                          activeContext === ctx.name ? 'bg-nats-accent/10 text-nats-accent' : ''
                        }`}
                      >
                        <span className="font-medium">{ctx.description}</span>
                        <span className="text-xs text-nats-text-muted font-mono">{ctx.monitoringUrl}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-nats-text-secondary">Updated {ago}</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded hover:bg-nats-border text-nats-text-secondary hover:text-nats-text-primary"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={logout}
            className="p-2 rounded hover:bg-nats-border text-nats-text-secondary hover:text-nats-text-primary"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
