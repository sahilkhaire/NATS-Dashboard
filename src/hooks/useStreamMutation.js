import { useCallback } from 'react'
import { useConfig } from '../context/ConfigContext'

export function useStreamMutation() {
  const { serverUrl, authToken } = useConfig()

  const deleteStream = useCallback(async (streamName) => {
    const res = await fetch('/api/stream/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        stream: streamName,
        server: serverUrl,
        token: authToken,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Delete failed')
    return data
  }, [serverUrl, authToken])

  const updateStream = useCallback(async (streamName, config) => {
    const res = await fetch('/api/stream/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        stream: streamName,
        config,
        server: serverUrl,
        token: authToken,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Update failed')
    return data
  }, [serverUrl, authToken])

  return { deleteStream, updateStream }
}
