import { useEffect, useRef, useState } from 'react'

/** Stable id for maps — LIST payloads sometimes omit top-level `name`. */
export function consumerRowKey(c) {
  const n = c?.name ?? c?.config?.durable_name
  return n != null && String(n) !== '' ? String(n) : null
}

/** Same single value as the Ack Floor column: stream sequence first, then consumer sequence. */
function ackFloorScalar(consumer) {
  const f = consumer?.ack_floor
  if (!f) return null
  const v = f.stream_seq ?? f.consumer_seq
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function formatAckRate(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 100) return `${Math.round(n)} msg/s`
  return `${n.toFixed(1)} msg/s`
}

/**
 * Keeps previous ack floor per consumer in a ref. On each new poll (`lastFetch` change),
 * delta = newFloor - previousFloor, rate = delta / (refreshIntervalMs / 1000), then store new floor.
 *
 * Consumers with ack floor 0 (unused) or no positive delta this interval are omitted from
 * per-row rates and the combined sum (shown as — instead of 0.0 msg/s).
 */
export function useConsumerAckRates(consumers, lastFetch, streamKey, refreshIntervalMs) {
  const [result, setResult] = useState({ ratesByName: new Map(), combinedRate: null })
  const prevFloorByKey = useRef(new Map())
  const lastPollTs = useRef(null)
  const streamKeyRef = useRef(streamKey)

  useEffect(() => {
    if (streamKeyRef.current !== streamKey) {
      streamKeyRef.current = streamKey
      prevFloorByKey.current = new Map()
      lastPollTs.current = null
    }

    if (lastFetch == null || !consumers?.length || !Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
      if (!consumers?.length) {
        prevFloorByKey.current = new Map()
        lastPollTs.current = null
      }
      setResult({ ratesByName: new Map(), combinedRate: null })
      return
    }

    if (lastPollTs.current === lastFetch) {
      return
    }
    lastPollTs.current = lastFetch

    const dtSec = refreshIntervalMs / 1000
    const ratesByName = new Map()
    const seen = new Set()
    let anyActive = false
    let sum = 0

    for (const c of consumers) {
      const key = consumerRowKey(c)
      if (!key) continue
      seen.add(key)

      const floor = ackFloorScalar(c)
      const previous = prevFloorByKey.current.get(key)

      // Unused / never-acked consumers (floor 0) — omit from rates and combined sum.
      // Also require a positive delta so idle (0.0) rows do not poison combined throughput.
      if (floor != null && floor > 0 && previous != null && previous > 0) {
        const delta = floor - previous
        if (delta > 0) {
          const rate = delta / dtSec
          ratesByName.set(key, rate)
          anyActive = true
          sum += rate
        } else {
          ratesByName.set(key, null)
        }
      } else {
        ratesByName.set(key, null)
      }

      // Keep baseline only for consumers that have started acking
      if (floor != null && floor > 0) {
        prevFloorByKey.current.set(key, floor)
      } else {
        prevFloorByKey.current.delete(key)
      }
    }

    for (const k of [...prevFloorByKey.current.keys()]) {
      if (!seen.has(k)) prevFloorByKey.current.delete(k)
    }

    setResult({
      ratesByName,
      combinedRate: anyActive ? sum : null,
    })
  }, [consumers, lastFetch, streamKey, refreshIntervalMs])

  return result
}
