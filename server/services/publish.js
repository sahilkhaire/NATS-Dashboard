/**
 * Scheduled publish store — persists in-memory for the lifetime of the server process.
 */

import { randomBytes } from 'crypto'
import { headers as natsHeaders, StringCodec } from 'nats'
import { getConn } from './nats.js'

const sc = StringCodec()
export const scheduledPublishes = new Map()

export async function executePublish(natsServer, token, subject, payload, headersArr, msgTtl) {
  const nc = await getConn(natsServer, token)
  const js = nc.jetstream()

  let hdr
  const allHeaders = [...(headersArr || [])]
  if (msgTtl) allHeaders.push({ key: 'Nats-Msg-Ttl', value: msgTtl })
  if (allHeaders.length) {
    hdr = natsHeaders()
    for (const { key, value } of allHeaders) hdr.append(key, String(value))
  }

  const data = payload ? sc.encode(payload) : new Uint8Array(0)
  const opts = hdr ? { headers: hdr } : {}
  const ack  = await js.publish(subject, data, opts)
  return { stream: ack.stream, seq: ack.seq, duplicate: ack.duplicate }
}

export function schedulePublish({ stream, subject, payload, headers, msgTtl, scheduleAt, natsServer, token }) {
  const targetMs = new Date(scheduleAt).getTime()
  const delay    = Math.max(0, targetMs - Date.now())
  const id       = randomBytes(8).toString('hex')

  const pub = {
    id, stream, subject, payload,
    headers:   headers  || [],
    msgTtl:    msgTtl   || null,
    server:    natsServer,
    token,
    scheduleAt,
    createdAt: new Date().toISOString(),
    status:    'pending',
    result:    null,
    error:     null,
    timerId:   null,
  }

  pub.timerId = setTimeout(async () => {
    const p = scheduledPublishes.get(id)
    if (!p) return
    p.status = 'running'
    try {
      p.result = await executePublish(p.server, p.token, p.subject, p.payload, p.headers, p.msgTtl)
      p.status = 'delivered'
    } catch (err) {
      p.error  = err.message
      p.status = 'error'
    }
    p.timerId = null
  }, delay)

  scheduledPublishes.set(id, pub)
  return pub
}

export function serializePublish(p) {
  // eslint-disable-next-line no-unused-vars
  const { timerId, token, server: _srv, ...rest } = p
  return rest
}
