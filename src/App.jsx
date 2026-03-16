import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from './context/ConfigContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { OverviewPage } from './pages/OverviewPage'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { JetStreamPage } from './pages/JetStreamPage'
import { StreamsPage } from './pages/StreamsPage'
import { StreamDetailPage } from './pages/StreamDetailPage'
import { ConsumersPage } from './pages/ConsumersPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { ClusterPage } from './pages/ClusterPage'
import { GatewayPage } from './pages/GatewayPage'
import { LeafNodesPage } from './pages/LeafNodesPage'
import { AccountsPage } from './pages/AccountsPage'
import { HealthPage } from './pages/HealthPage'

function AppContent() {
  const [serverName, setServerName] = useState('NATS Dashboard')
  const [lastUpdated, setLastUpdated] = useState(null)

  const handleOverviewData = ({ varz, lastFetch }) => {
    if (varz?.server_name) setServerName(varz.server_name)
    if (lastFetch) setLastUpdated(lastFetch)
  }

  return (
    <div className="min-h-screen bg-nats-bg">
      <Sidebar />
      <div className="pl-60">
        <Header serverName={serverName} lastUpdated={lastUpdated} />
        <main className="min-h-[calc(100vh-4rem)]">
          <Routes>
            <Route path="/" element={<OverviewPage onData={handleOverviewData} />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/jetstream" element={<JetStreamPage />} />
            <Route path="/streams" element={<StreamsPage />} />
            <Route path="/streams/:name" element={<StreamDetailPage />} />
            <Route path="/consumers" element={<ConsumersPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/cluster" element={<ClusterPage />} />
            <Route path="/gateways" element={<GatewayPage />} />
            <Route path="/leaf-nodes" element={<LeafNodesPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/health" element={<HealthPage />} />
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

  if (!authenticated) {
    return <LoginScreen onLogin={login} />
  }

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
