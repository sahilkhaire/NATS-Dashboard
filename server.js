/**
 * Production HTTP server for NATS Dashboard.
 * Serves static files from dist/ and provides /api/nats-contexts + /api/nats-proxy.
 * All NATS credentials come from environment variables.
 *
 * Env vars:
 *   NATS_URL          - NATS server URL (e.g. nats://host:4222) [required]
 *   NATS_TOKEN       - Auth token [required if server uses token auth]
 *   NATS_NAME        - Context name (default: docker)
 *   NATS_DESCRIPTION  - Human label (default: Docker NATS Server)
 *   PORT             - HTTP port (default: 3000)
 *   DASHBOARD_USERNAME - Login username (when set, auth is required)
 *   DASHBOARD_PASSWORD - Login password (required when DASHBOARD_USERNAME is set)
 */

import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'
import { connect, StringCodec, headers as natsHeaders } from 'nats'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const sc = StringCodec()

const PORT = parseInt(process.env.PORT || '3000', 10)
const NATS_URL = process.env.NATS_URL || ''
const NATS_TOKEN = process.env.NATS_TOKEN || null
const NATS_NAME = process.env.NATS_NAME || 'docker'
const NATS_DESCRIPTION = process.env.NATS_DESCRIPTION || 'Docker NATS Server'
const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME || ''
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''

const AUTH_ENABLED = !!(DASHBOARD_USERNAME && DASHBOARD_PASSWORD)
const SESSION_COOKIE = 'nats-dashboard-session'
const SESSION_MAX_AGE = 86400 // 24 hours

const DIST_DIR = join(__dirname, 'dist')

// ─── Session store (in-memory) ─────────────────────────────────────────────────

const sessions = new Map()

function getSessionId(req) {
  const cookie = req.headers.cookie || ''
  const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  return m ? m[1] : null
}

function isAuthenticated(req) {
  if (!AUTH_ENABLED) return true
  const sid = getSessionId(req)
  if (!sid) return false
  const s = sessions.get(sid)
  if (!s || s.exp < Date.now()) {
    if (s) sessions.delete(sid)
    return false
  }
  return true
}

function createSession() {
  const sid = randomBytes(24).toString('hex')
  sessions.set(sid, { exp: Date.now() + SESSION_MAX_AGE * 1000 })
  return sid
}

function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`)
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`)
}

// ─── Context from env (Docker mode) ────────────────────────────────────────────

function loadNatsContextsFromEnv() {
  if (!NATS_URL) return { contexts: [], current: null }
  return {
    contexts: [{
      name: NATS_NAME,
      description: NATS_DESCRIPTION,
      url: NATS_URL,
      monitoringUrl: NATS_URL,
      token: NATS_TOKEN,
    }],
    current: NATS_NAME,
  }
}

// ─── NATS connection pool ──────────────────────────────────────────────────────

const pool = new Map()

async function getConn(natsUrl, token) {
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

async function natsRequest(nc, subject, data = {}) {
  const msg = await nc.request(subject, sc.encode(JSON.stringify(data)), { timeout: 10000 })
  return JSON.parse(sc.decode(msg.data))
}

// ─── Monitoring handlers ────────────────────────────────────────────────────────

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

const NOT_AVAILABLE = (endpoint) => ({
  _via: 'nats_protocol',
  _note: `${endpoint} requires HTTP monitoring port 8222 or NATS system account.`,
  _unavailable: true,
})

function parseQuery(path) {
  const [, qs = ''] = path.split('?')
  return Object.fromEntries(
    qs.split('&').filter(Boolean).map((kv) => {
      const [k, v = 'true'] = kv.split('=')
      return [decodeURIComponent(k), decodeURIComponent(v)]
    })
  )
}

async function handlePath(nc, path) {
  const endpoint = path.split('?')[0].replace(/^\//, '')
  const options = parseQuery(path)
  switch (endpoint) {
    case 'varz': return handleVarz(nc)
    case 'healthz': return handleHealthz(nc)
    case 'jsz': return handleJsz(nc, {
      accounts: options.accounts === 'true',
      streams: options.streams === 'true',
      consumers: options.consumers === 'true',
    })
    case 'connz': return NOT_AVAILABLE('connz')
    case 'routez': return NOT_AVAILABLE('routez')
    case 'gatewayz': return NOT_AVAILABLE('gatewayz')
    case 'leafz': return NOT_AVAILABLE('leafz')
    case 'subsz': return NOT_AVAILABLE('subsz')
    case 'accountz': return NOT_AVAILABLE('accountz')
    case 'accstatz': return NOT_AVAILABLE('accstatz')
    default: throw new Error(`Unknown endpoint: ${endpoint}`)
  }
}

// ─── Scheduled purge store ────────────────────────────────────────────────────

const schedules = new Map() // id -> schedule object

function newScheduleId() {
  return randomBytes(8).toString('hex')
}

async function executePurge(streamName, subject, natsServer, token) {
  const nc = await getConn(natsServer, token)
  const body = subject ? { filter: subject } : {}
  const resp = await natsRequest(nc, `$JS.API.STREAM.PURGE.${streamName}`, body)
  if (resp.error) throw new Error(resp.error.description || 'Purge failed')
  return resp
}

function computeNextRun(schedule) {
  if (schedule.type === 'once') return new Date(schedule.runAt)
  // recurring: next = now + interval
  return new Date(Date.now() + schedule.intervalMs)
}

function armSchedule(schedule) {
  const now = Date.now()
  const target = new Date(schedule.nextRun).getTime()
  const delay = Math.max(0, target - now)

  const fire = async () => {
    const s = schedules.get(schedule.id)
    if (!s) return
    s.status = 'running'
    try {
      await executePurge(s.stream, s.subject, s.server, s.token)
      s.lastRun = new Date().toISOString()
      s.error = null
      if (s.type === 'once') {
        s.status = 'done'
        s.timerId = null
      } else {
        s.status = 'active'
        s.nextRun = new Date(Date.now() + s.intervalMs).toISOString()
        s.timerId = setTimeout(fire, s.intervalMs)
      }
    } catch (err) {
      s.lastRun = new Date().toISOString()
      s.error = err.message
      if (s.type === 'once') {
        s.status = 'error'
        s.timerId = null
      } else {
        s.status = 'active'
        s.nextRun = new Date(Date.now() + s.intervalMs).toISOString()
        s.timerId = setTimeout(fire, s.intervalMs)
      }
    }
  }

  schedule.timerId = setTimeout(fire, delay)
}

function serializeSchedule(s) {
  // eslint-disable-next-line no-unused-vars
  const { timerId, token, server: _srv, ...rest } = s
  return rest
}

// ─── Scheduled publish store ──────────────────────────────────────────────────

const scheduledPublishes = new Map() // id -> publish object

async function executePublish(natsServer, token, subject, payload, headersArr, msgTtl) {
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
  const ack = await js.publish(subject, data, opts)
  return { stream: ack.stream, seq: ack.seq, duplicate: ack.duplicate }
}

function serializePublish(p) {
  // eslint-disable-next-line no-unused-vars
  const { timerId, token, server: _srv, ...rest } = p
  return rest
}

// ─── Static file serving ───────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function serveStatic(pathname, res) {
  let filePath = join(DIST_DIR, pathname === '/' ? 'index.html' : pathname)
  if (!existsSync(filePath) && !extname(filePath)) {
    filePath = join(DIST_DIR, 'index.html')
  }
  if (!existsSync(filePath)) return false
  const ext = extname(filePath)
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  res.end(readFileSync(filePath))
  return true
}

// ─── Read JSON body ───────────────────────────────────────────────────────────

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  // Auth endpoints (no auth required)
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    if (!AUTH_ENABLED) {
      res.end(JSON.stringify({ authenticated: true }))
      return
    }
    if (isAuthenticated(req)) {
      res.end(JSON.stringify({ authenticated: true }))
    } else {
      res.statusCode = 401
      res.end(JSON.stringify({ authenticated: false }))
    }
    return
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    if (!AUTH_ENABLED) {
      res.end(JSON.stringify({ ok: true }))
      return
    }
    try {
      const body = await readJsonBody(req)
      const { username, password } = body
      if (username === DASHBOARD_USERNAME && password === DASHBOARD_PASSWORD) {
        const sid = createSession()
        setSessionCookie(res, sid)
        res.end(JSON.stringify({ ok: true }))
      } else {
        res.statusCode = 401
        res.end(JSON.stringify({ error: 'Invalid username or password' }))
      }
    } catch (err) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: err.message || 'Bad request' }))
    }
    return
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    const sid = getSessionId(req)
    if (sid) sessions.delete(sid)
    clearSessionCookie(res)
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // Protected API routes
  if (AUTH_ENABLED && (pathname.startsWith('/api/nats') || pathname.startsWith('/api/nats-proxy') || pathname.startsWith('/api/stream'))) {
    if (!isAuthenticated(req)) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
      return
    }
  }

  if (pathname === '/api/stream/delete' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, server: serverParam, token: tokenParam } = body
      if (!stream || typeof stream !== 'string') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing or invalid stream name' }))
        return
      }
      const natsServer = serverParam || NATS_URL
      const token = tokenParam || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing server and NATS_URL env not set' }))
        return
      }
      const nc = await getConn(natsServer, token)
      const resp = await natsRequest(nc, `$JS.API.STREAM.DELETE.${stream}`, {})
      if (resp.error) throw new Error(resp.error.description || 'Delete failed')
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream delete failed' }))
    }
    return
  }

  if (pathname === '/api/stream/update' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, config, server: serverParam, token: tokenParam } = body
      if (!stream || typeof stream !== 'string') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing or invalid stream name' }))
        return
      }
      if (!config || typeof config !== 'object') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing or invalid config' }))
        return
      }
      const natsServer = serverParam || NATS_URL
      const token = tokenParam || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing server and NATS_URL env not set' }))
        return
      }
      const nc = await getConn(natsServer, token)
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
      const current = infoResp.config || {}
      const merged = { ...current, ...config, name: stream }
      const resp = await natsRequest(nc, `$JS.API.STREAM.UPDATE.${stream}`, merged)
      if (resp.error) throw new Error(resp.error.description || 'Update failed')
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true, config: resp.config }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream update failed' }))
    }
    return
  }

  // ── Stream publish (immediate or scheduled) ───────────────────────────────
  if (pathname === '/api/stream/publish' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, subject, payload = '', headers: headersArr = [], scheduleAt, msgTtl, server: serverParam, token: tokenParam } = body
      if (!stream || !subject) { res.statusCode = 400; res.end(JSON.stringify({ error: 'stream and subject are required' })); return }
      const natsServer = serverParam || NATS_URL
      const token = tokenParam || NATS_TOKEN
      if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server' })); return }

      if (scheduleAt) {
        const targetMs = new Date(scheduleAt).getTime()
        const delay = Math.max(0, targetMs - Date.now())
        const id = randomBytes(8).toString('hex')
        const pub = {
          id, stream, subject, payload, headers: headersArr, msgTtl: msgTtl || null,
          server: natsServer, token,
          scheduleAt, createdAt: new Date().toISOString(),
          status: 'pending', result: null, error: null, timerId: null,
        }
        pub.timerId = setTimeout(async () => {
          const p = scheduledPublishes.get(id)
          if (!p) return
          p.status = 'running'
          try {
            p.result = await executePublish(p.server, p.token, p.subject, p.payload, p.headers, p.msgTtl)
            p.status = 'delivered'
          } catch (err) {
            p.error = err.message; p.status = 'error'
          }
          p.timerId = null
        }, delay)
        scheduledPublishes.set(id, pub)
        res.statusCode = 201
        res.end(JSON.stringify({ ok: true, scheduled: true, id, scheduleAt }))
      } else {
        const result = await executePublish(natsServer, token, subject, payload, headersArr, msgTtl)
        res.end(JSON.stringify({ ok: true, scheduled: false, ...result }))
      }
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Publish failed' }))
    }
    return
  }

  // ── Scheduled publishes list ───────────────────────────────────────────────
  if (pathname === '/api/stream/publishes' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    const stream = url.searchParams.get('stream')
    const list = [...scheduledPublishes.values()]
      .filter(p => !stream || p.stream === stream)
      .map(serializePublish)
    res.end(JSON.stringify({ publishes: list }))
    return
  }

  // ── Cancel scheduled publish ───────────────────────────────────────────────
  if (pathname.startsWith('/api/stream/publish/') && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json')
    const id = pathname.replace('/api/stream/publish/', '')
    const p = scheduledPublishes.get(id)
    if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Publish not found' })); return }
    if (p.timerId) clearTimeout(p.timerId)
    scheduledPublishes.delete(id)
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // ── Stream purge (immediate) ──────────────────────────────────────────────
  if (pathname === '/api/stream/purge' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, subject, server: serverParam, token: tokenParam } = body
      if (!stream || typeof stream !== 'string') {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream name' })); return
      }
      const natsServer = serverParam || NATS_URL
      const token = tokenParam || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server and NATS_URL env not set' })); return
      }
      const result = await executePurge(stream, subject || null, natsServer, token)
      res.end(JSON.stringify({ ok: true, purged: result.purged ?? 0 }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Purge failed' }))
    }
    return
  }

  // ── Schedule list ─────────────────────────────────────────────────────────
  if (pathname === '/api/stream/schedules' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    const stream = url.searchParams.get('stream')
    const list = [...schedules.values()]
      .filter(s => !stream || s.stream === stream)
      .map(serializeSchedule)
    res.end(JSON.stringify({ schedules: list }))
    return
  }

  // ── Schedule create ───────────────────────────────────────────────────────
  if (pathname === '/api/stream/schedule' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, type, runAt, intervalMs, intervalLabel, subject, server: serverParam, token: tokenParam } = body
      if (!stream) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream' })); return }
      if (type !== 'once' && type !== 'recurring') { res.statusCode = 400; res.end(JSON.stringify({ error: 'type must be once|recurring' })); return }
      if (type === 'once' && !runAt) { res.statusCode = 400; res.end(JSON.stringify({ error: 'runAt required for once schedule' })); return }
      if (type === 'recurring' && (!intervalMs || intervalMs < 60000)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'intervalMs required and must be ≥ 60000 for recurring' })); return }

      const id = newScheduleId()
      const natsServer = serverParam || NATS_URL
      const token = tokenParam || NATS_TOKEN
      const nextRun = type === 'once' ? runAt : new Date(Date.now() + Number(intervalMs)).toISOString()

      const schedule = {
        id,
        stream,
        type,
        runAt: type === 'once' ? runAt : null,
        intervalMs: type === 'recurring' ? Number(intervalMs) : null,
        intervalLabel: type === 'recurring' ? (intervalLabel || `${Math.round(Number(intervalMs)/60000)}m`) : null,
        subject: subject || null,
        server: natsServer,
        token,
        createdAt: new Date().toISOString(),
        lastRun: null,
        nextRun,
        status: 'active',
        error: null,
        timerId: null,
      }

      schedules.set(id, schedule)
      armSchedule(schedule)
      res.statusCode = 201
      res.end(JSON.stringify({ ok: true, schedule: serializeSchedule(schedule) }))
    } catch (err) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // ── Schedule delete ───────────────────────────────────────────────────────
  if (pathname.startsWith('/api/stream/schedule/') && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json')
    const id = pathname.split('/').pop()
    const s = schedules.get(id)
    if (!s) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Schedule not found' })); return }
    if (s.timerId) clearTimeout(s.timerId)
    schedules.delete(id)
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (pathname === '/api/nats-contexts' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(loadNatsContextsFromEnv()))
    return
  }

  if (pathname.startsWith('/api/nats-proxy') && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    const serverParam = url.searchParams.get('server')
    const pathParam = url.searchParams.get('path') || '/'
    let token = url.searchParams.get('token') || req.headers['authorization']?.replace(/^Bearer\s+/i, '')

    const natsServer = serverParam || NATS_URL
    if (!natsServer) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Missing server param and NATS_URL env not set' }))
      return
    }
    if (!token && NATS_TOKEN) token = NATS_TOKEN

    try {
      const nc = await getConn(natsServer, token)
      const data = await handlePath(nc, pathParam)
      res.statusCode = 200
      res.end(JSON.stringify(data))
    } catch (err) {
      res.statusCode = 502
      const msg = err.message === 'TIMEOUT'
        ? 'NATS request timed out. Check server URL and token.'
        : err.code === '503'
          ? 'Permission denied. System account not enabled for this token.'
          : err.message || 'NATS query failed'
      res.end(JSON.stringify({ error: msg, hint: 'NATS_ERROR' }))
    }
    return
  }

  if (!serveStatic(pathname, res)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain')
    res.end('Not Found')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NATS Dashboard listening on http://0.0.0.0:${PORT}`)
  if (AUTH_ENABLED) console.log('Login protection enabled (DASHBOARD_USERNAME/DASHBOARD_PASSWORD)')
  if (!NATS_URL) console.warn('WARNING: NATS_URL not set. Set NATS_URL and NATS_TOKEN (if needed) to connect.')
})
