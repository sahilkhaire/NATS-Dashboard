import { useEffect, useState, useCallback, useRef } from 'react'

export function usePolling(url, interval, options = {}) {
  const { enabled = true, onSuccess, onError, headers } = options
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  // Store headers in a ref so changes don't restart the polling loop
  const headersRef = useRef(headers)
  const lastErrorRef = useRef('')
  const lastWarningRef = useRef('')
  headersRef.current = headers

  const fetchData = useCallback(async (signal) => {
    if (!url || !enabled) return
    try {
      const fetchOpts = { credentials: 'include' }
      if (signal) fetchOpts.signal = signal
      if (headersRef.current) fetchOpts.headers = headersRef.current
      const res = await fetch(url, fetchOpts)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
      lastErrorRef.current = ''
      setLastFetch(Date.now())
      if (json?._unavailable || json?._note) {
        const warningMsg = json._note || 'Some monitoring information is unavailable.'
        if (lastWarningRef.current !== warningMsg) {
          lastWarningRef.current = warningMsg
          window.dispatchEvent(new CustomEvent('app-notify', {
            detail: {
              level: 'warning',
              title: 'Monitoring warning',
              message: warningMsg,
              source: 'polling',
            },
          }))
        }
      }
      onSuccess?.(json)
    } catch (e) {
      if (e.name === 'AbortError') return // request cancelled due to URL change, ignore
      setError(e.message)
      if (lastErrorRef.current !== e.message) {
        lastErrorRef.current = e.message
        window.dispatchEvent(new CustomEvent('app-notify', {
          detail: {
            level: 'error',
            title: 'Request failed',
            message: e.message || 'Unexpected polling error',
            source: 'polling',
          },
        }))
      }
      if (e.message === 'HTTP 401') window.dispatchEvent(new CustomEvent('auth-required'))
      onError?.(e)
    }
  }, [url, enabled, onSuccess, onError])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    fetchData(signal)
    const timer = setInterval(() => fetchData(signal), interval)
    return () => {
      controller.abort() // cancel any in-flight requests when URL/interval changes
      clearInterval(timer)
    }
  }, [fetchData, interval])

  return { data, error, lastFetch, refetch: () => fetchData() }
}
