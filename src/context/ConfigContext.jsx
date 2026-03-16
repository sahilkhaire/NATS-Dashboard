import { createContext, useContext, useState, useEffect } from 'react'
import { getLastConnection } from '../hooks/useSavedConnections'

const ConfigContext = createContext(null)

export function ConfigProvider({ children }) {
  // Start empty so no polls fire before a real connection is chosen.
  // VITE_NATS_URL can pre-seed a URL for production deployments.
  const defaultUrl = import.meta.env.VITE_NATS_URL || ''
  const [serverUrl, setServerUrl] = useState(defaultUrl)
  const [pollInterval, setPollInterval] = useState(2000)
  const [selectedContext, setSelectedContext] = useState(null)
  const [authToken, setAuthToken] = useState(null)

  // Restore last connection from localStorage on mount
  useEffect(() => {
    const last = getLastConnection()
    if (last?.monitoringUrl) {
      setServerUrl(last.monitoringUrl)  // keep as-is; proxy normalizes at request time
      setAuthToken(last.token || null)
      setSelectedContext(last.id || last.name)
    }
  }, [])

  const getNatsUrl = (path) => {
    const p = path.startsWith('/') ? path : `/${path}`
    const tokenParam = authToken ? `&token=${encodeURIComponent(authToken)}` : ''
    return `/api/nats-proxy?server=${encodeURIComponent(serverUrl)}&path=${encodeURIComponent(p)}${tokenParam}`
  }

  return (
    <ConfigContext.Provider
      value={{
        serverUrl,
        setServerUrl,
        pollInterval,
        setPollInterval,
        selectedContext,
        setSelectedContext,
        authToken,
        setAuthToken,
        getNatsUrl,
      }}
    >
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}
