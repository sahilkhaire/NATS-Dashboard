import { useState, useEffect } from 'react'

const CONTEXTS_API = '/api/nats-contexts'
const CONTEXTS_JSON = '/nats-contexts.json'

export function useNatsContexts() {
  const [contexts, setContexts] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchContexts() {
      setLoading(true)
      setError(null)
      try {
        // Dev: Vite plugin serves /api/nats-contexts
        // Prod: use synced /nats-contexts.json (from npm run sync-context)
        const urls = [CONTEXTS_API, CONTEXTS_JSON]
        for (const url of urls) {
          const res = await fetch(url, { credentials: 'include' })
          if (res.status === 401) {
            window.dispatchEvent(new CustomEvent('auth-required'))
            return
          }
          if (res.ok) {
            const data = await res.json()
            if (!cancelled) {
              setContexts(data.contexts || [])
              setCurrent(data.current || null)
            }
            return
          }
        }
        if (!cancelled) setContexts([])
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setContexts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchContexts()
    return () => { cancelled = true }
  }, [])

  return { contexts, current, loading, error }
}
