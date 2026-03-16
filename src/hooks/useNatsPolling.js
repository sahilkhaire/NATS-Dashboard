import { useMemo } from 'react'
import { useConfig } from '../context/ConfigContext'
import { usePolling } from './usePolling'

/**
 * Polls a NATS monitoring endpoint.
 * In dev: proxied through Vite plugin (uses NATS protocol, port 4222).
 * In prod: direct HTTP to monitoring port 8222.
 */
export function useNatsPolling(path, interval, options = {}) {
  const { getNatsUrl, authToken, serverUrl } = useConfig()
  // Don't generate a URL (and therefore don't poll) until a real server URL is set
  const url = serverUrl ? getNatsUrl(path) : null
  const headers = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken]
  )
  return usePolling(url, interval, { ...options, headers })
}
