import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Database,
  Layers,
  User,
  GitMerge,
  Globe,
  Leaf,
  Radio,
  Heart,
  FileText,
} from 'lucide-react'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/connections', icon: Users, label: 'Connections' },
  { to: '/jetstream', icon: Database, label: 'JetStream' },
  { to: '/streams', icon: Layers, label: 'Streams' },
  { to: '/consumers', icon: User, label: 'Consumers' },
  { to: '/subscriptions', icon: Radio, label: 'Subscriptions' },
  { to: '/cluster', icon: GitMerge, label: 'Cluster' },
  { to: '/gateways', icon: Globe, label: 'Gateways' },
  { to: '/leaf-nodes', icon: Leaf, label: 'Leaf Nodes' },
  { to: '/accounts', icon: FileText, label: 'Accounts' },
  { to: '/health', icon: Heart, label: 'Health' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 h-screen w-60 border-r border-nats-border bg-nats-card">
      <div className="flex h-16 items-center border-b border-nats-border px-4">
        <span className="font-mono font-semibold text-nats-accent">NATS</span>
      </div>
      <nav className="p-2 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-nats-accent/20 text-nats-accent' : 'text-nats-text-secondary hover:bg-nats-border hover:text-nats-text-primary'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
