import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'nats-dashboard-connections'
const LAST_CONNECTION_KEY = 'nats-dashboard-last-connection'

/**
 * Normalizes a monitoring URL for storage.
 * Keeps nats:// as-is — the proxy handles converting it to port 4222.
 * Only converts https:// -> http:// (monitoring is plain HTTP).
 */
export function normalizeMonitoringUrl(url) {
  if (!url || typeof url !== 'string') return url
  const u = url.trim().replace(/\/$/, '')
  if (u.startsWith('https://')) return u.replace('https://', 'http://')
  return u
}

export function useSavedConnections() {
  const [connections, setConnections] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  const saveConnections = useCallback((list) => {
    setConnections(list)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
      /* ignore */
    }
  }, [])

  const addConnection = useCallback((conn) => {
    const id = `saved-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const monitoringUrl = normalizeMonitoringUrl(conn.monitoringUrl || conn.url)
    const newConn = {
      id,
      name: conn.name || conn.url || 'Unnamed',
      monitoringUrl,
      token: conn.token || null,
    }
    saveConnections([...connections, newConn])
    return newConn
  }, [connections, saveConnections])

  const removeConnection = useCallback((id) => {
    saveConnections(connections.filter((c) => c.id !== id))
  }, [connections, saveConnections])

  const updateConnection = useCallback((id, updates) => {
    saveConnections(
      connections.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      )
    )
  }, [connections, saveConnections])

  return {
    connections,
    addConnection,
    removeConnection,
    updateConnection,
    saveConnections,
  }
}

export function getLastConnection() {
  try {
    const raw = localStorage.getItem(LAST_CONNECTION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setLastConnection(conn) {
  try {
    if (conn) {
      localStorage.setItem(LAST_CONNECTION_KEY, JSON.stringify(conn))
    } else {
      localStorage.removeItem(LAST_CONNECTION_KEY)
    }
  } catch {
    /* ignore */
  }
}
