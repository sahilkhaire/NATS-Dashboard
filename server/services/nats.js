/**
 * NATS connection pool and low-level request helpers.
 * All server-side NATS communication flows through this module.
 */

import { connect, StringCodec } from 'nats'
import { parseQuery } from '../utils/http.js'

const sc = StringCodec()
const pool = new Map()

export async function getConn(natsUrl, token) {
  let url = natsUrl
  if (url.startsWith('http://')) {
    const u = new URL(url)
    url = `nats://${u.hostname}:4222`
  } else if (url.startsWith('https://')) {
    const u = new URL(url)
    url = `nats://${u.hostname}:4222`
  }

  const key = `${url}::${token || ''}`
  let nc = pool.get(key)
  if (nc && !nc.isClosed()) return nc

  const opts = { servers: url, reconnect: true, reconnectTimeWait: 2000, maxReconnectAttempts: 5 }
  if (token) opts.token = token

  nc = await connect(opts)
  pool.set(key, nc)
  nc.closed().then(() => pool.delete(key))
  return nc
}

export async function natsRequest(nc, subject, data = {}) {
  const msg = await nc.request(subject, sc.encode(JSON.stringify(data)), { timeout: 10000 })
  return JSON.parse(sc.decode(msg.data))
}

// ─── Monitoring handlers ───────────────────────────────────────────────────────

async function handleVarz(nc) {
  const info = nc.info || {}
  return {
    server_id: info.server_id,
    server_name: info.server_name || info.name,
    version: info.version,
    go: info.go,
    host: info.host,
    port: info.port,
    auth_required: info.auth_required,
    tls_required: info.tls_required,
    max_payload: info.max_payload,
    max_connections: info.max_connections || 65536,
    jetstream: info.jetstream,
    uptime: null,
    connections: null,
    slow_consumers: null,
    subscriptions: null,
    in_msgs: null,
    out_msgs: null,
    in_bytes: null,
    out_bytes: null,
    cpu: null,
    mem: null,
    now: new Date().toISOString(),
    _via: 'nats_protocol',
    _note: 'Connected via NATS protocol (port 4222). CPU/mem/connection metrics require HTTP monitoring port 8222.',
  }
}

async function handleHealthz(nc) {
  if (!nc.isClosed()) return { status: 'ok' }
  return { status: 'unavailable' }
}

async function handleJsz(nc, options = {}) {
  const apiInfo = await natsRequest(nc, '$JS.API.INFO')
  if (apiInfo.error) throw new Error(apiInfo.error.description || 'JetStream API error')

  const result = {
    server_id: nc.info?.server_id,
    now: new Date().toISOString(),
    domain: apiInfo.domain,
    config: {
      max_memory: apiInfo.limits?.max_memory,
      max_storage: apiInfo.limits?.max_store,
    },
    memory: apiInfo.memory,
    storage: apiInfo.storage,
    reserved_memory: apiInfo.reserved_memory,
    reserved_storage: apiInfo.reserved_storage,
    accounts: 1,
    ha_assets: apiInfo.ha_assets,
    api: apiInfo.api,
    total_streams: apiInfo.streams,
    total_consumers: apiInfo.consumers,
    total_messages: apiInfo.messages,
    total_message_bytes: apiInfo.bytes,
    _via: 'nats_protocol',
  }

  if (options.streams || options.accounts) {
    const listResp = await natsRequest(nc, '$JS.API.STREAM.LIST', { offset: 0 })
    const streams = listResp.streams || []

    const streamDetails = await Promise.all(
      streams.map(async (s) => {
        const detail = {
          name: s.config.name,
          created: s.created,
          config: s.config,
          state: s.state,
          cluster: s.cluster,
          consumer_count: s.state?.consumer_count || 0,
        }
        if (options.consumers) {
          try {
            const cListResp = await natsRequest(nc, `$JS.API.CONSUMER.LIST.${s.config.name}`, { offset: 0 })
            detail.consumer_detail = cListResp.consumers || []
          } catch {
            detail.consumer_detail = []
          }
        }
        return detail
      })
    )
    result.account_details = [{ name: 'default', stream_detail: streamDetails }]
  }
  return result
}

export const NOT_AVAILABLE = (endpoint) => ({
  _via: 'nats_protocol',
  _note: `${endpoint} requires HTTP monitoring port 8222 or NATS system account.`,
  _unavailable: true,
})

export async function handlePath(nc, path) {
  const endpoint = path.split('?')[0].replace(/^\//, '')
  const options = parseQuery(path)
  switch (endpoint) {
    case 'varz':     return handleVarz(nc)
    case 'healthz':  return handleHealthz(nc)
    case 'jsz':      return handleJsz(nc, {
      accounts: options.accounts === 'true',
      streams:  options.streams  === 'true',
      consumers: options.consumers === 'true',
    })
    case 'connz':    return NOT_AVAILABLE('connz')
    case 'routez':   return NOT_AVAILABLE('routez')
    case 'gatewayz': return NOT_AVAILABLE('gatewayz')
    case 'leafz':    return NOT_AVAILABLE('leafz')
    case 'subsz':    return NOT_AVAILABLE('subsz')
    case 'accountz': return NOT_AVAILABLE('accountz')
    case 'accstatz': return NOT_AVAILABLE('accstatz')
    default: throw new Error(`Unknown endpoint: ${endpoint}`)
  }
}
