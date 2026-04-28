import { useState, useMemo } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider }   from './context/ConfigContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider }   from './context/ThemeContext'
import { LoginScreen }      from './components/shared/LoginScreen'
import { ConfirmDialogProvider } from './components/shared/ConfirmDialogProvider'
import { NotificationProvider } from './context/NotificationContext'
import { AppSidebar }       from './components/app-sidebar'
import { SidebarInset, SidebarProvider } from './components/ui/sidebar'
import { Header }           from './components/layout/Header'
import { useNatsPolling }   from './hooks/useNatsPolling'
import { OverviewPage }     from './pages/overview/OverviewPage'
import { ConnectionsPage }  from './pages/connections/ConnectionsPage'
import { JetStreamPage }    from './pages/jetstream/JetStreamPage'
import { StreamsPage }      from './pages/streams/StreamsPage'
import { StreamDetailPage } from './pages/streams/detail/StreamDetailPage'
import { ConsumersPage }    from './pages/consumers/ConsumersPage'
import { SubscriptionsPage } from './pages/subscriptions/SubscriptionsPage'
import { ClusterPage }      from './pages/cluster/ClusterPage'
import { GatewayPage }      from './pages/gateway/GatewayPage'
import { LeafNodesPage }    from './pages/leafnodes/LeafNodesPage'
import { AccountsPage }     from './pages/accounts/AccountsPage'
import { HealthPage }       from './pages/health/HealthPage'
import { CliPage }          from './pages/cli/CliPage'
import { KvPage }           from './pages/kv/KvPage'
import { ObjectPage }       from './pages/objects/ObjectPage'

function AppContent() {
  const [serverName,   setServerName]   = useState('NATS Dashboard')
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const { data: varz } = useNatsPolling('/varz', 2000)

  const serverMode = useMemo(() => {
    if (!varz) return null
    const routes = varz.routes ?? varz.remotes ?? 0
    const isCluster = routes > 0 || varz.cluster?.name
    return {
      type: isCluster ? 'cluster' : 'standalone',
      routes,
      clusterName: varz.cluster?.name,
    }
  }, [varz])

  const handleOverviewData = ({ varz: v, lastFetch }) => {
    if (v?.server_name) setServerName(v.server_name)
    if (lastFetch)      setLastUpdated(lastFetch)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="page-shell overflow-x-hidden">
        <Header serverName={serverName} lastUpdated={lastUpdated} serverMode={serverMode} />
        <main className="content-shell min-h-[calc(100vh-4rem)] overflow-x-hidden p-6">
          <Routes>
            <Route path="/"            element={<OverviewPage onData={handleOverviewData} />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/jetstream"   element={<JetStreamPage />} />
            <Route path="/streams"     element={<StreamsPage />} />
            <Route path="/streams/:name" element={<StreamDetailPage />} />
            <Route path="/consumers"   element={<ConsumersPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/cluster"     element={<ClusterPage />} />
            <Route path="/gateways"    element={<GatewayPage />} />
            <Route path="/leaf-nodes"  element={<LeafNodesPage />} />
            <Route path="/accounts"    element={<AccountsPage />} />
            <Route path="/health"      element={<HealthPage />} />
            <Route path="/kv"          element={<KvPage />} />
            <Route path="/objects"     element={<ObjectPage />} />
            <Route path="/cli"         element={<CliPage />} />
          </Routes>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppWithAuth() {
  const { authenticated, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-primary">Loading...</div>
      </div>
    )
  }

  if (!authenticated) return <LoginScreen onLogin={login} />
  return <AppContent />
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ConfigProvider>
            <NotificationProvider>
              <ConfirmDialogProvider>
                <AppWithAuth />
              </ConfirmDialogProvider>
            </NotificationProvider>
          </ConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
