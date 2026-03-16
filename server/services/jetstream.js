/**
 * JetStream message-fetching service.
 * Creates an ephemeral pull consumer, fetches messages, then cleans up.
 */

import { natsRequest } from './nats.js'

export async function fetchStreamMessages(nc, streamName, opts = {}) {
  const { limit = 50, startSeq, afterSeq, startTime, subject } = opts

  const streamInfo = await natsRequest(nc, `$JS.API.STREAM.INFO.${streamName}`, {})
  if (streamInfo.error) throw new Error(streamInfo.error.description || 'Stream not found')
  const state = streamInfo.state || {}
  const firstSeq = state.first_seq || 1
  const lastSeq  = state.last_seq  || 0

  if (lastSeq === 0) return { messages: [], firstSeq, lastSeq, hasMore: false }

  const consumerConfig = { ack_policy: 'none' }
  if (subject && subject.trim()) consumerConfig.filter_subject = subject.trim()

  const afterSeqNum  = afterSeq  != null ? Number(afterSeq)  : null
  const startSeqNum  = startSeq  != null ? Number(startSeq)  : null

  if (afterSeqNum != null) {
    const nextSeq = afterSeqNum + 1
    if (nextSeq > lastSeq) return { messages: [], firstSeq, lastSeq, hasMore: false }
    consumerConfig.deliver_policy = 'by_start_sequence'
    consumerConfig.opt_start_seq  = nextSeq
  } else if (startSeqNum != null) {
    if (startSeqNum > lastSeq) return { messages: [], firstSeq, lastSeq, hasMore: false }
    consumerConfig.deliver_policy = 'by_start_sequence'
    consumerConfig.opt_start_seq  = Math.max(1, startSeqNum)
  } else if (startTime) {
    consumerConfig.deliver_policy  = 'by_start_time'
    consumerConfig.opt_start_time  = new Date(startTime).toISOString()
  } else {
    const startFrom = Math.max(firstSeq, lastSeq - limit + 1)
    consumerConfig.deliver_policy = 'by_start_sequence'
    consumerConfig.opt_start_seq  = startFrom
  }

  const createResp = await natsRequest(nc, `$JS.API.CONSUMER.CREATE.${streamName}`, consumerConfig)
  if (createResp.error) throw new Error(createResp.error.description || 'Failed to create consumer')
  const consumerName = createResp.name

  const messages = []
  try {
    const js = nc.jetstream()
    const consumer = await js.consumers.get(streamName, consumerName)
    const msgs = await consumer.fetch({ max_messages: limit, expires: 5000 })

    for await (const m of msgs) {
      let timeStr = null
      try {
        const tsHdr = m.headers?.get('Nats-Time-Stamp')
        if (tsHdr) {
          timeStr = new Date(tsHdr).toISOString()
        } else {
          const tsNs = m.info?.timestampNanos
          if (tsNs != null) {
            const ms = typeof tsNs === 'bigint'
              ? Number(tsNs / 1000000n)
              : Math.floor(Number(tsNs) / 1e6)
            timeStr = new Date(ms).toISOString()
          }
        }
      } catch {}

      let data = ''
      try { data = m.string() } catch { data = '[binary data]' }

      const hdrs = {}
      try {
        if (m.headers) {
          for (const k of m.headers.keys()) {
            if (!k.startsWith('Nats-')) hdrs[k] = m.headers.values(k).join(', ')
          }
        }
      } catch {}

      messages.push({ seq: m.seq, subject: m.subject, data, headers: hdrs, time: timeStr })
    }
  } finally {
    try {
      await natsRequest(nc, `$JS.API.CONSUMER.DELETE.${streamName}.${consumerName}`, {})
    } catch {}
  }

  const lastMsg = messages[messages.length - 1]
  return {
    messages,
    firstSeq,
    lastSeq,
    hasMore: messages.length >= limit && (lastMsg?.seq ?? 0) < lastSeq,
  }
}
