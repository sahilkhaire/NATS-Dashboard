import { useEffect, useState, useCallback, useRef } from 'react'

export function usePolling(url, interval, options = {}) {
  const { enabled = true, onSuccess, onError, headers } = options
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  // Store headers in a ref so changes don't restart the polling loop
  const headersRef = useRef(headers)
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
      setLastFetch(Date.now())
      onSuccess?.(json)
    } catch (e) {
      if (e.name === 'AbortError') return // request cancelled due to URL change, ignore
      setError(e.message)
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
