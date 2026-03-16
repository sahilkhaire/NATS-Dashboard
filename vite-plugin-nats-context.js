import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { connect, StringCodec, headers as natsHeaders } from 'nats'

const sc = StringCodec()

const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME || ''
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''
const AUTH_ENABLED = !!(DASHBOARD_USERNAME && DASHBOARD_PASSWORD)
const SESSION_COOKIE = 'nats-dashboard-session'
const SESSION_MAX_AGE = 86400
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

// ─── Context loading ──────────────────────────────────────────────────────────

function loadNatsContexts() {
  const home = process.env.HOME || process.env.USERPROFILE
  const configDir = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'nats')
    : join(home, '.config', 'nats')
  const contextDir = join(configDir, 'context')

  if (!existsSync(contextDir)) return { contexts: [], current: null }

  let current = null
  const contextTxt = join(configDir, 'context.txt')
  if (existsSync(contextTxt)) current = readFileSync(contextTxt, 'utf8').trim()

  const contexts = []
  for (const file of readdirSync(contextDir).filter(f => f.endsWith('.json'))) {
    const name = file.replace('.json', '')
    try {
      const ctx = JSON.parse(readFileSync(join(contextDir, file), 'utf8'))
      if (!ctx.url) continue
      contexts.push({
        name,
        description: ctx.description || name,
        url: ctx.url,
        monitoringUrl: ctx.url,   // NATS url — we use port 4222 directly
        token: ctx.token || ctx.password || null,
      })
    } catch { /* skip */ }
  }

  return { contexts, current }
}

// ─── NATS connection pool ─────────────────────────────────────────────────────

const pool = new Map()

async function getConn(natsUrl, token) {
  // Normalize to nats:// — accept http://host:8222 input too
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

// ─── Monitoring data handlers ─────────────────────────────────────────────────

async function handleVarz(nc) {
  const info = nc.info || {}
  return {
    server_id:        info.server_id,
    server_name:      info.server_name || info.name,
    version:          info.version,
    go:               info.go,
    host:             info.host,
    port:             info.port,
    auth_required:    info.auth_required,
    tls_required:     info.tls_required,
    max_payload:      info.max_payload,
    max_connections:  info.max_connections || 65536,
    jetstream:        info.jetstream,
    uptime:           null,
    connections:      null,
    slow_consumers:   null,
    subscriptions:    null,
    in_msgs:          null,
    out_msgs:         null,
    in_bytes:         null,
    out_bytes:        null,
    cpu:              null,
    mem:              null,
    now:              new Date().toISOString(),
    _via:             'nats_protocol',
    _note:            'Connected via NATS protocol (port 4222). CPU/mem/connection metrics require HTTP monitoring port 8222.',
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
    server_id:            nc.info?.server_id,
    now:                  new Date().toISOString(),
    domain:               apiInfo.domain,
    config: {
      max_memory:         apiInfo.limits?.max_memory,
      max_storage:        apiInfo.limits?.max_store,
    },
    memory:               apiInfo.memory,
    storage:              apiInfo.storage,
    reserved_memory:      apiInfo.reserved_memory,
    reserved_storage:     apiInfo.reserved_storage,
    accounts:             1,
    ha_assets:            apiInfo.ha_assets,
    api:                  apiInfo.api,
    total_streams:        apiInfo.streams,
    total_consumers:      apiInfo.consumers,
    total_messages:       apiInfo.messages,
    total_message_bytes:  apiInfo.bytes,
    _via:                 'nats_protocol',
  }

  if (options.streams || options.accounts) {
    // $JS.API.STREAM.LIST returns full StreamInfo in NATS 2.10+
    const listResp = await natsRequest(nc, '$JS.API.STREAM.LIST', { offset: 0 })
    const streams = listResp.streams || []

    const streamDetails = await Promise.all(
      streams.map(async (s) => {
        const detail = {
          name:           s.config.name,
          created:        s.created,
          config:         s.config,
          state:          s.state,
          cluster:        s.cluster,
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

    result.account_details = [{
      name:          'default',
      stream_detail: streamDetails,
    }]
  }

  return result
}

// Healthz only, connz/routez/etc. not available via NATS protocol without system account
const NOT_AVAILABLE = (endpoint) => ({
  _via:  'nats_protocol',
  _note: `${endpoint} requires HTTP monitoring port 8222 or NATS system account.`,
  _unavailable: true,
})

// ─── Path router ─────────────────────────────────────────────────────────────

function parseQuery(path) {
  const [, qs = ''] = path.split('?')
  return Object.fromEntries(
    qs.split('&').filter(Boolean).map(kv => {
      const [k, v = 'true'] = kv.split('=')
      return [decodeURIComponent(k), decodeURIComponent(v)]
    })
  )
}

async function handlePath(nc, path) {
  const endpoint = path.split('?')[0].replace(/^\//, '')
  const options = parseQuery(path)

  switch (endpoint) {
    case 'varz':      return handleVarz(nc)
    case 'healthz':   return handleHealthz(nc)
    case 'jsz':       return handleJsz(nc, {
      accounts:  options.accounts  === 'true',
      streams:   options.streams   === 'true',
      consumers: options.consumers === 'true',
    })
    case 'connz':     return NOT_AVAILABLE('connz')
    case 'routez':    return NOT_AVAILABLE('routez')
    case 'gatewayz':  return NOT_AVAILABLE('gatewayz')
    case 'leafz':     return NOT_AVAILABLE('leafz')
    case 'subsz':     return NOT_AVAILABLE('subsz')
    case 'accountz':  return NOT_AVAILABLE('accountz')
    case 'accstatz':  return NOT_AVAILABLE('accstatz')
    default:          throw new Error(`Unknown endpoint: ${endpoint}`)
  }
}

// ─── Scheduled purge store (shared across dev server requests) ────────────────

const schedules = new Map()

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

function armSchedule(schedule) {
  const target = new Date(schedule.nextRun).getTime()
  const delay = Math.max(0, target - Date.now())

  const fire = async () => {
    const s = schedules.get(schedule.id)
    if (!s) return
    s.status = 'running'
    try {
      await executePurge(s.stream, s.subject, s.server, s.token)
      s.lastRun = new Date().toISOString()
      s.error = null
      if (s.type === 'once') {
        s.status = 'done'; s.timerId = null
      } else {
        s.status = 'active'
        s.nextRun = new Date(Date.now() + s.intervalMs).toISOString()
        s.timerId = setTimeout(fire, s.intervalMs)
      }
    } catch (err) {
      s.lastRun = new Date().toISOString()
      s.error = err.message
      if (s.type === 'once') {
        s.status = 'error'; s.timerId = null
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

// ─── Scheduled publish store (dev) ───────────────────────────────────────────

const scheduledPublishes = new Map()

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

// ─── Vite plugin ──────────────────────────────────────────────────────────────

export function natsContextPlugin() {
  return {
    name: 'nats-context',
    configureServer(server) {
      // Auth endpoints
      server.middlewares.use('/api/auth/me', (req, res, next) => {
        if (req.method !== 'GET') return next()
        res.setHeader('Content-Type', 'application/json')
        if (!AUTH_ENABLED) {
          res.end(JSON.stringify({ authenticated: true }))
          return
        }
        res.end(JSON.stringify({ authenticated: isAuthenticated(req) }))
      })

      server.middlewares.use('/api/login', async (req, res, next) => {
        if (req.method !== 'POST') return next()
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
            res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`)
            res.end(JSON.stringify({ ok: true }))
          } else {
            res.statusCode = 401
            res.end(JSON.stringify({ error: 'Invalid username or password' }))
          }
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: err.message || 'Bad request' }))
        }
      })

      server.middlewares.use('/api/logout', (req, res, next) => {
        if (req.method !== 'POST') return next()
        res.setHeader('Content-Type', 'application/json')
        const sid = getSessionId(req)
        if (sid) sessions.delete(sid)
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`)
        res.end(JSON.stringify({ ok: true }))
      })

      server.middlewares.use('/api/stream/delete', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
          return
        }
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, server: serverParam, token: tokenParam } = body
          if (!stream || typeof stream !== 'string') {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing or invalid stream name' }))
            return
          }
          let natsServer = serverParam
          let token = tokenParam
          if (!natsServer) {
            const { contexts } = loadNatsContexts()
            const ctx = contexts[0]
            if (ctx) { natsServer = ctx.url; token = token || ctx.token }
          }
          if (!natsServer) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing server' }))
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
      })

      server.middlewares.use('/api/stream/update', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
          return
        }
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
          let natsServer = serverParam
          let token = tokenParam
          if (!natsServer) {
            const { contexts } = loadNatsContexts()
            const ctx = contexts[0]
            if (ctx) { natsServer = ctx.url; token = token || ctx.token }
          }
          if (!natsServer) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing server' }))
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
      })

      // ── Stream publish ──────────────────────────────────────────────────────
      server.middlewares.use('/api/stream/publish', async (req, res, next) => {
        // DELETE /api/stream/publish/:id — cancel scheduled publish
        if (req.method === 'DELETE') {
          const id = req.url?.replace(/^\//, '').split('?')[0]
          if (AUTH_ENABLED && !isAuthenticated(req)) {
            res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
          }
          res.setHeader('Content-Type', 'application/json')
          const p = scheduledPublishes.get(id)
          if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Publish not found' })); return }
          if (p.timerId) clearTimeout(p.timerId)
          scheduledPublishes.delete(id)
          res.end(JSON.stringify({ ok: true })); return
        }
        if (req.method !== 'POST') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
        }
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, subject, payload = '', headers: headersArr = [], scheduleAt, msgTtl, server: serverParam, token: tokenParam } = body
          if (!stream || !subject) { res.statusCode = 400; res.end(JSON.stringify({ error: 'stream and subject are required' })); return }
          let natsServer = serverParam; let token = tokenParam
          if (!natsServer) {
            const { contexts } = loadNatsContexts()
            const ctx = contexts[0]
            if (ctx) { natsServer = ctx.url; token = token || ctx.token }
          }
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server' })); return }

          if (scheduleAt) {
            const delay = Math.max(0, new Date(scheduleAt).getTime() - Date.now())
            const id = newScheduleId()
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
          res.statusCode = 502; res.end(JSON.stringify({ error: err.message || 'Publish failed' }))
        }
      })

      server.middlewares.use('/api/stream/publishes', (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
        }
        res.setHeader('Content-Type', 'application/json')
        const reqUrl = new URL(req.url, 'http://x')
        const streamFilter = reqUrl.searchParams.get('stream')
        const list = [...scheduledPublishes.values()]
          .filter(p => !streamFilter || p.stream === streamFilter)
          .map(serializePublish)
        res.end(JSON.stringify({ publishes: list }))
      })

      server.middlewares.use('/api/stream/purge', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
        }
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, subject, server: serverParam, token: tokenParam } = body
          if (!stream) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream name' })); return }
          let natsServer = serverParam; let token = tokenParam
          if (!natsServer) {
            const { contexts } = loadNatsContexts()
            const ctx = contexts[0]
            if (ctx) { natsServer = ctx.url; token = token || ctx.token }
          }
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server' })); return }
          const result = await executePurge(stream, subject || null, natsServer, token)
          res.end(JSON.stringify({ ok: true, purged: result.purged ?? 0 }))
        } catch (err) {
          res.statusCode = 502; res.end(JSON.stringify({ error: err.message || 'Purge failed' }))
        }
      })

      server.middlewares.use('/api/stream/schedules', (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
        }
        res.setHeader('Content-Type', 'application/json')
        const reqUrl = new URL(req.url, 'http://x')
        const streamFilter = reqUrl.searchParams.get('stream')
        const list = [...schedules.values()]
          .filter(s => !streamFilter || s.stream === streamFilter)
          .map(serializeSchedule)
        res.end(JSON.stringify({ schedules: list }))
      })

      server.middlewares.use('/api/stream/schedule', async (req, res, next) => {
        // DELETE /api/stream/schedule/:id
        if (req.method === 'DELETE') {
          const id = req.url?.replace(/^\//, '').split('?')[0]
          if (AUTH_ENABLED && !isAuthenticated(req)) {
            res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
          }
          res.setHeader('Content-Type', 'application/json')
          const s = schedules.get(id)
          if (!s) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Schedule not found' })); return }
          if (s.timerId) clearTimeout(s.timerId)
          schedules.delete(id)
          res.end(JSON.stringify({ ok: true })); return
        }
        // POST /api/stream/schedule — create
        if (req.method !== 'POST') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false })); return
        }
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, type, runAt, intervalMs, intervalLabel, subject, server: serverParam, token: tokenParam } = body
          if (!stream) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream' })); return }
          if (type !== 'once' && type !== 'recurring') { res.statusCode = 400; res.end(JSON.stringify({ error: 'type must be once|recurring' })); return }
          if (type === 'once' && !runAt) { res.statusCode = 400; res.end(JSON.stringify({ error: 'runAt required for once schedule' })); return }
          if (type === 'recurring' && (!intervalMs || intervalMs < 60000)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'intervalMs must be ≥ 60000' })); return }

          let natsServer = serverParam; let token = tokenParam
          if (!natsServer) {
            const { contexts } = loadNatsContexts()
            const ctx = contexts[0]
            if (ctx) { natsServer = ctx.url; token = token || ctx.token }
          }
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server' })); return }

          const id = newScheduleId()
          const nextRun = type === 'once' ? runAt : new Date(Date.now() + Number(intervalMs)).toISOString()
          const schedule = {
            id, stream, type,
            runAt: type === 'once' ? runAt : null,
            intervalMs: type === 'recurring' ? Number(intervalMs) : null,
            intervalLabel: type === 'recurring' ? (intervalLabel || `${Math.round(Number(intervalMs)/60000)}m`) : null,
            subject: subject || null,
            server: natsServer, token,
            createdAt: new Date().toISOString(),
            lastRun: null, nextRun,
            status: 'active', error: null, timerId: null,
          }
          schedules.set(id, schedule)
          armSchedule(schedule)
          res.statusCode = 201
          res.end(JSON.stringify({ ok: true, schedule: serializeSchedule(schedule) }))
        } catch (err) {
          res.statusCode = 400; res.end(JSON.stringify({ error: err.message }))
        }
      })

      server.middlewares.use('/api/nats-contexts', (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
          return
        }
        try {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(loadNatsContexts()))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })

      server.middlewares.use('/api/nats-proxy', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (AUTH_ENABLED && !isAuthenticated(req)) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
          return
        }
        res.setHeader('Content-Type', 'application/json')

        const reqUrl = new URL(req.url, 'http://x')
        const server = reqUrl.searchParams.get('server')
        const path   = reqUrl.searchParams.get('path') || '/'
        const token  = reqUrl.searchParams.get('token')
          || req.headers['authorization']?.replace(/^Bearer\s+/i, '')

        if (!server) {
          res.statusCode = 400
          return res.end(JSON.stringify({ error: 'Missing server param' }))
        }

        // Try to fill in token from saved contexts if not provided
        let authToken = token
        if (!authToken) {
          try {
            const host = new URL(server.startsWith('nats') ? server : `nats://${new URL(server).host}`).hostname
            const { contexts } = loadNatsContexts()
            const ctx = contexts.find(c => new URL(c.url).hostname === host)
            if (ctx?.token) authToken = ctx.token
          } catch { /* ignore */ }
        }

        try {
          const nc = await getConn(server, authToken)
          const data = await handlePath(nc, path)
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
      })
    },
  }
}
