import { useMemo, useRef } from 'react'

const DEFAULT_MAX_POINTS = 60

/**
 * Maintains bounded, per-stream rolling timeseries computed from /jsz snapshots.
 *
 * Each point shape:
 * { ts, msgsPerSec, bytesPerSec, backlogPending, ackPending, redeliveredDelta }
 */
export function useStreamTimeseries(streams, options = {}) {
  const maxPoints = Math.max(10, options.maxPoints ?? DEFAULT_MAX_POINTS)
  const stateRef = useRef({ prevAt: null, prevByName: new Map(), seriesByName: new Map() })

  return useMemo(() => {
    const now = Date.now()
    const prevAt = stateRef.current.prevAt
    const elapsed = prevAt != null ? (now - prevAt) / 1000 : 0
    const nextPrevByName = new Map()
    const nextSeriesByName = new Map()

    for (const stream of streams ?? []) {
      const name = stream.name
      const messages = stream.state?.messages ?? 0
      const bytes = stream.state?.bytes ?? 0
      const consumers = stream.consumer_detail ?? []

      let backlogPending = 0
      let ackPending = 0
      let redeliveredTotal = 0
      for (const consumer of consumers) {
        backlogPending += consumer.num_pending ?? 0
        ackPending += consumer.num_ack_pending ?? 0
        redeliveredTotal += consumer.num_redelivered ?? 0
      }

      const prev = stateRef.current.prevByName.get(name)

      // Counter resets (stream recreated/server restart) are treated as zero-delta.
      const msgDelta = prev ? Math.max(0, messages - prev.messages) : 0
      const byteDelta = prev ? Math.max(0, bytes - prev.bytes) : 0
      const redeliveredDelta = prev ? Math.max(0, redeliveredTotal - prev.redeliveredTotal) : 0

      const msgsPerSec = elapsed > 0 ? msgDelta / elapsed : 0
      const bytesPerSec = elapsed > 0 ? byteDelta / elapsed : 0

      const priorSeries = stateRef.current.seriesByName.get(name) ?? []
      const point = {
        ts: now,
        msgsPerSec,
        bytesPerSec,
        backlogPending,
        ackPending,
        redeliveredDelta,
      }
      const merged = [...priorSeries, point]
      const bounded = merged.length > maxPoints ? merged.slice(merged.length - maxPoints) : merged

      nextPrevByName.set(name, { messages, bytes, redeliveredTotal })
      nextSeriesByName.set(name, bounded)
    }

    stateRef.current = {
      prevAt: now,
      prevByName: nextPrevByName,
      seriesByName: nextSeriesByName,
    }

    return nextSeriesByName
  }, [streams, maxPoints])
}

