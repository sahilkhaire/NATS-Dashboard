import { useState } from 'react'
import { Server, Lock } from 'lucide-react'

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await onLogin(username, password)
      if (result.ok) return
      setError(result.error || 'Invalid credentials')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-nats-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Server size={32} className="text-nats-accent" />
          <span className="font-mono text-xl font-semibold text-white">NATS Dashboard</span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-nats-card border border-nats-border rounded-lg p-6 shadow-lg"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Lock size={18} className="text-nats-accent" />
            Sign in
          </h2>
          {error && (
            <div className="mb-4 p-3 rounded bg-nats-error/20 border border-nats-error/50 text-nats-error text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-nats-accent focus:border-transparent"
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-nats-accent focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full py-2 px-4 rounded bg-nats-accent text-nats-bg font-semibold hover:bg-nats-accent/90 focus:outline-none focus:ring-2 focus:ring-nats-accent focus:ring-offset-2 focus:ring-offset-nats-bg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Credentials are validated server-side. Nothing is stored in the browser.
        </p>
      </div>
    </div>
  )
}
