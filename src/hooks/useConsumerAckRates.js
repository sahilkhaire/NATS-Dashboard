import { useEffect, useRef, useState } from 'react'

/** Stable id for maps — LIST payloads sometimes omit top-level `name`. */
export function consumerRowKey(c) {
  const n = c?.name ?? c?.config?.durable_name
  return n != null && String(n) !== '' ? String(n) : null
}

function seqScalar(obj) {
  if (!obj) return null
  const v = obj.stream_seq ?? obj.consumer_seq
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Incoming: messages delivered to the consumer. */
function deliveredScalar(consumer) {
  return seqScalar(consumer?.delivered)
}

/** Outgoing: messages acknowledged (ack floor). */
function ackFloorScalar(consumer) {
  return seqScalar(consumer?.ack_floor)
}

export function formatAckRate(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 100) return `${Math.round(n)} msg/s`
  return `${n.toFixed(1)} msg/s`
}

/**
 * Per-consumer incoming (delivered) and outgoing (ack) rates between polls.
 *
 * rate = (current - previous) / (refreshIntervalMs / 1000)
 *
 * Consumers with sequence 0 or no positive delta are omitted (shown as —),
 * so idle rows do not pull combined rates to 0.0.
 */
export function useConsumerAckRates(consumers, lastFetch, streamKey, refreshIntervalMs) {
  const [result, setResult] = useState({
    inRatesByName: new Map(),
    outRatesByName: new Map(),
    combinedInRate: null,
    combinedOutRate: null,
    // back-compat aliases used by older call sites
    ratesByName: new Map(),
    combinedRate: null,
  })
  const prevByKey = useRef(new Map()) // key -> { delivered, ackFloor }
  const lastPollTs = useRef(null)
  const streamKeyRef = useRef(streamKey)

  useEffect(() => {
    if (streamKeyRef.current !== streamKey) {
      streamKeyRef.current = streamKey
      prevByKey.current = new Map()
      lastPollTs.current = null
    }

    if (lastFetch == null || !consumers?.length || !Number.isFinite(refreshIntervalMs) || refreshIntervalMs <= 0) {
      if (!consumers?.length) {
        prevByKey.current = new Map()
        lastPollTs.current = null
      }
      const empty = {
        inRatesByName: new Map(),
        outRatesByName: new Map(),
        combinedInRate: null,
        combinedOutRate: null,
        ratesByName: new Map(),
        combinedRate: null,
      }
      setResult(empty)
      return
    }

    if (lastPollTs.current === lastFetch) {
      return
    }
    lastPollTs.current = lastFetch

    const dtSec = refreshIntervalMs / 1000
    const inRatesByName = new Map()
    const outRatesByName = new Map()
    const seen = new Set()
    let anyIn = false
    let anyOut = false
    let sumIn = 0
    let sumOut = 0

    for (const c of consumers) {
      const key = consumerRowKey(c)
      if (!key) continue
      seen.add(key)

      const delivered = deliveredScalar(c)
      const ackFloor = ackFloorScalar(c)
      const previous = prevByKey.current.get(key)

      // Incoming (delivered)
      if (delivered != null && delivered > 0 && previous?.delivered != null && previous.delivered > 0) {
        const delta = delivered - previous.delivered
        if (delta > 0) {
          const rate = delta / dtSec
          inRatesByName.set(key, rate)
          anyIn = true
          sumIn += rate
        } else {
          inRatesByName.set(key, null)
        }
      } else {
        inRatesByName.set(key, null)
      }

      // Outgoing (ack floor)
      if (ackFloor != null && ackFloor > 0 && previous?.ackFloor != null && previous.ackFloor > 0) {
        const delta = ackFloor - previous.ackFloor
        if (delta > 0) {
          const rate = delta / dtSec
          outRatesByName.set(key, rate)
          anyOut = true
          sumOut += rate
        } else {
          outRatesByName.set(key, null)
        }
      } else {
        outRatesByName.set(key, null)
      }

      // Baselines only for sequences that have started
      const nextPrev = {
        delivered: delivered != null && delivered > 0 ? delivered : undefined,
        ackFloor: ackFloor != null && ackFloor > 0 ? ackFloor : undefined,
      }
      if (nextPrev.delivered != null || nextPrev.ackFloor != null) {
        prevByKey.current.set(key, {
          delivered: nextPrev.delivered ?? previous?.delivered,
          ackFloor: nextPrev.ackFloor ?? previous?.ackFloor,
        })
      } else {
        prevByKey.current.delete(key)
      }
    }

    for (const k of [...prevByKey.current.keys()]) {
      if (!seen.has(k)) prevByKey.current.delete(k)
    }

    const combinedInRate = anyIn ? sumIn : null
    const combinedOutRate = anyOut ? sumOut : null

    setResult({
      inRatesByName,
      outRatesByName,
      combinedInRate,
      combinedOutRate,
      ratesByName: outRatesByName,
      combinedRate: combinedOutRate,
    })
  }, [consumers, lastFetch, streamKey, refreshIntervalMs])

  return result
}
