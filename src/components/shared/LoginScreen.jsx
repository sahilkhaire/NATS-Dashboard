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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Server size={32} className="text-nats-accent" />
          <span className="font-mono text-xl font-semibold text-foreground">NATS Dashboard</span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-6 shadow-lg"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
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
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-muted-foreground">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-enterprise w-full"
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-enterprise w-full"
                placeholder="Enter password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Credentials are validated server-side. Nothing is stored in the browser.
        </p>
      </div>
    </div>
  )
}
