import { useRef, useMemo } from 'react'

/**
 * Computes per-stream message and byte rates from successive poll snapshots.
 * No extra API calls — reuses the streams array from the existing /jsz poll.
 *
 * @param {Array} streams - Array of stream objects with { name, state: { messages, bytes } }
 * @returns {Map<string, { msgsPerSec: number, bytesPerSec: number }>}
 */
export function useStreamRates(streams) {
  const prevRef = useRef({ snapshot: new Map(), ts: null })

  return useMemo(() => {
    const now = Date.now()
    const prev = prevRef.current
    const rates = new Map()

    if (streams && Array.isArray(streams)) {
      const elapsed = prev.ts != null ? (now - prev.ts) / 1000 : 0
      const nextSnapshot = new Map()

      for (const s of streams) {
        const name = s.name
        const messages = s.state?.messages ?? 0
        const bytes = s.state?.bytes ?? 0
        nextSnapshot.set(name, { messages, bytes })

        if (elapsed > 0 && prev.snapshot.has(name)) {
          const p = prev.snapshot.get(name)
          const msgsPerSec = Math.max(0, (messages - p.messages) / elapsed)
          const bytesPerSec = Math.max(0, (bytes - p.bytes) / elapsed)
          rates.set(name, { msgsPerSec, bytesPerSec })
        } else {
          rates.set(name, { msgsPerSec: 0, bytesPerSec: 0 })
        }
      }

      prevRef.current = { snapshot: nextSnapshot, ts: now }
    }

    return rates
  }, [streams])
}
