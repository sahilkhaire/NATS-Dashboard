import { useState, useEffect, useRef } from 'react'
import { Settings, Server, Heart, LogOut, GitMerge, ServerCog, Moon, Sun } from 'lucide-react'
import { useConfig } from '../../context/ConfigContext'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { SettingsModal } from '../modals/SettingsModal'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useNatsContexts } from '../../hooks/useNatsContexts'
import { getLastConnection } from '../../hooks/useSavedConnections'

export function Header({ serverName, lastUpdated, serverMode }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { serverUrl, selectedContext, setServerUrl, setSelectedContext, setAuthToken } = useConfig()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
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
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/80 bg-card/90 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2">
            <Server size={20} className="text-foreground/80" />
            <span className="font-mono text-[13px] font-semibold tracking-wide">{serverName || 'NATS Dashboard'}</span>
          </div>
          <StatusBadge status={healthy ? 'ok' : 'error'}>
            <Heart size={12} className="inline mr-1" />
            {healthy ? 'HEALTHY' : 'UNREACHABLE'}
          </StatusBadge>
          {serverMode && (
            <Badge
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                serverMode.type === 'cluster'
                  ? 'border border-foreground/30 bg-foreground/10 text-foreground'
                  : 'border border-border bg-border/50 text-muted-foreground'
              }`}
              title={serverMode.type === 'cluster' ? `Cluster: ${serverMode.clusterName || `${serverMode.routes} routes`}` : 'Standalone mode'}
            >
              {serverMode.type === 'cluster' ? (
                <>
                  <GitMerge size={12} />
                  Cluster{serverMode.routes > 0 ? ` (${serverMode.routes})` : ''}
                </>
              ) : (
                <>
                  <ServerCog size={12} />
                  Standalone
                </>
              )}
            </Badge>
          )}
          {contexts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="Switch NATS context" className="h-8">
                  <span className="font-medium text-foreground">
                  {loading ? '...' : activeCtx?.description || activeContext || 'Context'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {contexts.map((ctx) => (
                  <DropdownMenuItem
                    key={ctx.name}
                    onSelect={() => handleSelectContext(ctx)}
                    className={activeContext === ctx.name ? 'bg-accent text-accent-foreground' : ''}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{ctx.description}</span>
                      <span className="font-mono text-xs text-muted-foreground">{ctx.monitoringUrl}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Updated {ago}</span>
          <Button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span className="text-xs">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </Button>
          <Button
            onClick={() => setSettingsOpen(true)}
            variant="ghost"
            size="icon"
            title="Settings"
          >
            <Settings size={18} />
          </Button>
          <Button
            onClick={logout}
            variant="ghost"
            size="icon"
            title="Sign out"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
