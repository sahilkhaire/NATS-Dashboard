import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider }   from './context/ConfigContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginScreen }      from './components/shared/LoginScreen'
import { Sidebar }          from './components/layout/Sidebar'
import { Header }           from './components/layout/Header'
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

function AppContent() {
  const [serverName,   setServerName]   = useState('NATS Dashboard')
  const [lastUpdated,  setLastUpdated]  = useState(null)

  const handleOverviewData = ({ varz, lastFetch }) => {
    if (varz?.server_name) setServerName(varz.server_name)
    if (lastFetch)          setLastUpdated(lastFetch)
  }

  return (
    <div className="min-h-screen bg-nats-bg">
      <Sidebar />
      <div className="pl-60">
        <Header serverName={serverName} lastUpdated={lastUpdated} />
        <main className="min-h-[calc(100vh-4rem)]">
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
          </Routes>
        </main>
      </div>
    </div>
  )
}

function AppWithAuth() {
  const { authenticated, loading, login } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-nats-bg flex items-center justify-center">
        <div className="text-nats-accent font-mono">Loading...</div>
      </div>
    )
  }

  if (!authenticated) return <LoginScreen onLogin={login} />
  return <AppContent />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfigProvider>
          <AppWithAuth />
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
