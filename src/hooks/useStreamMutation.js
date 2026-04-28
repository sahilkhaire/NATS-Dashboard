import { useCallback } from 'react'
import { useConfig } from '../context/ConfigContext'

export function useStreamMutation() {
  const { serverUrl, authToken } = useConfig()

  const parseResponse = useCallback(async (res, fallbackError) => {
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || fallbackError)
      return data
    }
    const text = await res.text()
    if (!res.ok) throw new Error(fallbackError)
    throw new Error(text?.startsWith('<!DOCTYPE') ? 'Unexpected server response. Please retry.' : fallbackError)
  }, [])

  const post = useCallback(async (path, body) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ server: serverUrl, token: authToken, ...body }),
    })
    return parseResponse(res, `Request to ${path} failed`)
  }, [serverUrl, authToken, parseResponse])

  const get = useCallback(async (path) => {
    const params = new URLSearchParams()
    if (serverUrl) params.set('server', serverUrl)
    if (authToken) params.set('token', authToken)
    const sep = path.includes('?') ? '&' : '?'
    const url = `${path}${params.size > 0 ? `${sep}${params.toString()}` : ''}`
    const res = await fetch(url, { credentials: 'include' })
    return parseResponse(res, `Request to ${path} failed`)
  }, [serverUrl, authToken, parseResponse])

  // ── Stream mutations ───────────────────────────────────────────────────────

  const deleteStream = useCallback(
    (streamName) => post('/api/stream/delete', { stream: streamName }),
    [post]
  )

  const updateStream = useCallback(
    (streamName, config) => post('/api/stream/update', { stream: streamName, config }),
    [post]
  )

  const purgeStream = useCallback(
    (streamName, subject) => post('/api/stream/purge', { stream: streamName, subject: subject || undefined }),
    [post]
  )

  const duplicateStream = useCallback(
    (streamName, target, config) => post('/api/stream/duplicate', { stream: streamName, target, config }),
    [post]
  )

  const createMirrorStream = useCallback(
    (streamName, target, mirror, config) => post('/api/stream/mirror', { stream: streamName, target, mirror, config }),
    [post]
  )

  const stepDownLeader = useCallback(
    (streamName) => post('/api/stream/step-down', { stream: streamName }),
    [post]
  )

  const removeFollowers = useCallback(
    (streamName, peers) => post('/api/stream/remove-followers', { stream: streamName, peers }),
    [post]
  )

  const sealStream = useCallback(
    (streamName) => post('/api/stream/seal', { stream: streamName }),
    [post]
  )

  const getStreamCliConfig = useCallback(
    (streamName) => get(`/api/stream/config-cli?stream=${encodeURIComponent(streamName)}`),
    [get]
  )

  const getStreamTerraformConfig = useCallback(
    (streamName) => get(`/api/stream/config-terraform?stream=${encodeURIComponent(streamName)}`),
    [get]
  )

  // ── Scheduled purges ───────────────────────────────────────────────────────

  const listSchedules = useCallback(async (streamName) => {
    const res = await fetch(`/api/stream/schedules?stream=${encodeURIComponent(streamName)}`, {
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load schedules')
    return data.schedules ?? []
  }, [])

  const createSchedule = useCallback(
    (params) => post('/api/stream/schedule', params),
    [post]
  )

  const deleteSchedule = useCallback(async (id) => {
    const res = await fetch(`/api/stream/schedule/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to delete schedule')
    return data
  }, [])

  // ── Message publish ────────────────────────────────────────────────────────

  /**
   * Publish a message to a JetStream stream.
   * @param {object} params
   * @param {string} params.stream       - Stream name
   * @param {string} params.subject      - Target subject (must match stream subjects)
   * @param {string} [params.payload]    - Message body (string or JSON)
   * @param {Array}  [params.headers]    - [{ key, value }, ...] extra NATS headers
   * @param {string} [params.msgTtl]     - e.g. "1h" — requires allow_msg_ttl on stream
   * @param {string} [params.scheduleAt] - ISO datetime string — delay delivery until this time
   */
  const publishMessage = useCallback(
    (params) => post('/api/stream/publish', params),
    [post]
  )

  const listScheduledPublishes = useCallback(async (streamName) => {
    const res = await fetch(`/api/stream/publishes?stream=${encodeURIComponent(streamName)}`, {
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load scheduled publishes')
    return data.publishes ?? []
  }, [])

  const cancelScheduledPublish = useCallback(async (id) => {
    const res = await fetch(`/api/stream/publish/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to cancel')
    return data
  }, [])

  return {
    deleteStream, updateStream, purgeStream,
    duplicateStream, createMirrorStream, stepDownLeader, removeFollowers, sealStream,
    getStreamCliConfig, getStreamTerraformConfig,
    listSchedules, createSchedule, deleteSchedule,
    publishMessage, listScheduledPublishes, cancelScheduledPublish,
  }
}
