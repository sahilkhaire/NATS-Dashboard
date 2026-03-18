/**
 * Vite development-server plugin for NATS Dashboard.
 *
 * Provides the same /api/* endpoints as server/index.js but:
 *  - Loads NATS contexts from ~/.config/nats/ instead of env vars
 *  - Runs inside the Vite dev server process
 *  - Shares business logic with the production server via server/services/
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

import { getConn, natsRequest, handlePath } from './server/services/nats.js'
import { fetchStreamMessages }              from './server/services/jetstream.js'
import { schedules, createSchedule, serializeSchedule } from './server/services/schedule.js'
import { scheduledPublishes, executePublish, schedulePublish, serializePublish } from './server/services/publish.js'
import { readJsonBody }                     from './server/utils/http.js'

// ─── Dev-only auth (mirrors server/middleware/auth.js logic inline) ───────────

const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME || ''
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''
const AUTH_ENABLED       = !!(DASHBOARD_USERNAME && DASHBOARD_PASSWORD)
const SESSION_COOKIE     = 'nats-dashboard-session'
const SESSION_MAX_AGE    = 86400
const sessions           = new Map()

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
  if (!s || s.exp < Date.now()) { if (s) sessions.delete(sid); return false }
  return true
}

function createSession() {
  const sid = randomBytes(24).toString('hex')
  sessions.set(sid, { exp: Date.now() + SESSION_MAX_AGE * 1000 })
  return sid
}

function guardAuth(req, res) {
  if (!AUTH_ENABLED || isAuthenticated(req)) return false
  res.statusCode = 401
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
  return true
}

// ─── Dev context loader (reads ~/.config/nats/) ───────────────────────────────

/**
 * Convert a nats:// URL to an HTTP monitoring URL on port 8222.
 * Matches the same logic in scripts/sync-nats-context.js.
 */
function toMonitoringUrl(natsUrl) {
  if (!natsUrl || typeof natsUrl !== 'string') return null
  // Already an HTTP URL — return as-is
  if (natsUrl.startsWith('http://') || natsUrl.startsWith('https://')) return natsUrl
  try {
    const u = new URL(natsUrl)
    return `http://${u.hostname}:8222`
  } catch {
    return null
  }
}

function loadNatsContexts() {
  const home       = process.env.HOME || process.env.USERPROFILE
  const configDir  = process.env.XDG_CONFIG_HOME
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
      // Prefer an explicit monitoring_url field; otherwise derive from NATS URL
      const monitoringUrl = ctx.monitoring_url || toMonitoringUrl(ctx.url)
      contexts.push({
        name,
        description:   ctx.description || name,
        url:           ctx.url,
        monitoringUrl: monitoringUrl || ctx.url,
        token:         ctx.token || ctx.password || null,
      })
    } catch { /* skip malformed context */ }
  }
  return { contexts, current }
}

/** Resolve natsServer + token from request params, falling back to local contexts. */
function resolveConn(serverParam, tokenParam) {
  if (serverParam) return { natsServer: serverParam, token: tokenParam || null }
  const { contexts } = loadNatsContexts()
  const ctx = contexts[0]
  if (!ctx) return { natsServer: null, token: null }
  return { natsServer: ctx.url, token: tokenParam || ctx.token }
}

// ─── Vite plugin ──────────────────────────────────────────────────────────────

export function natsContextPlugin() {
  return {
    name: 'nats-context',
    configureServer(server) {

      // ── Auth ─────────────────────────────────────────────────────────────────

      server.middlewares.use('/api/auth/me', (req, res, next) => {
        if (req.method !== 'GET') return next()
        res.setHeader('Content-Type', 'application/json')
        if (!AUTH_ENABLED) { res.end(JSON.stringify({ authenticated: true })); return }
        res.end(JSON.stringify({ authenticated: isAuthenticated(req) }))
      })

      server.middlewares.use('/api/login', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        res.setHeader('Content-Type', 'application/json')
        if (!AUTH_ENABLED) { res.end(JSON.stringify({ ok: true })); return }
        try {
          const body = await readJsonBody(req)
          if (body.username === DASHBOARD_USERNAME && body.password === DASHBOARD_PASSWORD) {
            const sid = createSession()
            res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`)
            res.end(JSON.stringify({ ok: true }))
          } else {
            res.statusCode = 401
            res.end(JSON.stringify({ error: 'Invalid username or password' }))
          }
        } catch (err) { res.statusCode = 400; res.end(JSON.stringify({ error: err.message })) }
      })

      server.middlewares.use('/api/logout', (req, res, next) => {
        if (req.method !== 'POST') return next()
        const sid = getSessionId(req)
        if (sid) sessions.delete(sid)
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      })

      // ── Stream CRUD ──────────────────────────────────────────────────────────

      server.middlewares.use('/api/stream/delete', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, server: sp, token: tp } = body
          if (!stream) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream name' })); return }
          const { natsServer, token } = resolveConn(sp, tp)
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'No NATS server configured' })); return }
          const nc   = await getConn(natsServer, token)
          const resp = await natsRequest(nc, `$JS.API.STREAM.DELETE.${stream}`, {})
          if (resp.error) throw new Error(resp.error.description || 'Delete failed')
          res.end(JSON.stringify({ ok: true }))
        } catch (err) { res.statusCode = 502; res.end(JSON.stringify({ error: err.message })) }
      })

      server.middlewares.use('/api/stream/update', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, config, server: sp, token: tp } = body
          if (!stream || !config) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream or config' })); return }
          const { natsServer, token } = resolveConn(sp, tp)
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'No NATS server configured' })); return }
          const nc       = await getConn(natsServer, token)
          const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
          if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
          const merged   = { ...(infoResp.config || {}), ...config, name: stream }
          const resp     = await natsRequest(nc, `$JS.API.STREAM.UPDATE.${stream}`, merged)
          if (resp.error) throw new Error(resp.error.description || 'Update failed')
          res.end(JSON.stringify({ ok: true, config: resp.config }))
        } catch (err) { res.statusCode = 502; res.end(JSON.stringify({ error: err.message })) }
      })

      server.middlewares.use('/api/stream/purge', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, subject, server: sp, token: tp } = body
          if (!stream) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream name' })); return }
          const { natsServer, token } = resolveConn(sp, tp)
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'No NATS server configured' })); return }
          const nc   = await getConn(natsServer, token)
          const body2 = subject ? { filter: subject } : {}
          const resp = await natsRequest(nc, `$JS.API.STREAM.PURGE.${stream}`, body2)
          if (resp.error) throw new Error(resp.error.description || 'Purge failed')
          res.end(JSON.stringify({ ok: true, purged: resp.purged ?? 0 }))
        } catch (err) { res.statusCode = 502; res.end(JSON.stringify({ error: err.message })) }
      })

      // ── Messages ─────────────────────────────────────────────────────────────

      server.middlewares.use('/api/stream/messages', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        try {
          const u         = new URL(req.url, 'http://x')
          const stream    = u.searchParams.get('stream')
          const limit     = Math.min(parseInt(u.searchParams.get('limit') || '50', 10), 200)
          const startSeq  = u.searchParams.get('startSeq')  || null
          const afterSeq  = u.searchParams.get('afterSeq')  || null
          const startTime = u.searchParams.get('startTime') || null
          const subject   = u.searchParams.get('subject')   || null
          const { natsServer, token } = resolveConn(u.searchParams.get('server'), u.searchParams.get('token'))
          if (!stream)      { res.statusCode = 400; res.end(JSON.stringify({ error: 'stream param required' })); return }
          if (!natsServer)  { res.statusCode = 400; res.end(JSON.stringify({ error: 'No NATS server configured' })); return }
          const nc   = await getConn(natsServer, token)
          const data = await fetchStreamMessages(nc, stream, { limit, startSeq, afterSeq, startTime, subject })
          res.end(JSON.stringify(data))
        } catch (err) { res.statusCode = 502; res.end(JSON.stringify({ error: err.message })) }
      })

      // ── Publish ──────────────────────────────────────────────────────────────

      server.middlewares.use('/api/stream/publish', async (req, res, next) => {
        if (req.method === 'DELETE') {
          if (guardAuth(req, res)) return
          res.setHeader('Content-Type', 'application/json')
          const id = req.url?.replace(/^\//, '').split('?')[0]
          const p  = scheduledPublishes.get(id)
          if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Publish not found' })); return }
          if (p.timerId) clearTimeout(p.timerId)
          scheduledPublishes.delete(id)
          res.end(JSON.stringify({ ok: true })); return
        }
        if (req.method !== 'POST') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, subject, payload = '', headers: headersArr = [], scheduleAt, msgTtl, server: sp, token: tp } = body
          if (!stream || !subject) { res.statusCode = 400; res.end(JSON.stringify({ error: 'stream and subject are required' })); return }
          const { natsServer, token } = resolveConn(sp, tp)
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'No NATS server configured' })); return }

          if (scheduleAt) {
            const pub = schedulePublish({ stream, subject, payload, headers: headersArr, msgTtl: msgTtl || null, scheduleAt, natsServer, token })
            res.statusCode = 201
            res.end(JSON.stringify({ ok: true, scheduled: true, id: pub.id, scheduleAt }))
          } else {
            const result = await executePublish(natsServer, token, subject, payload, headersArr, msgTtl)
            res.end(JSON.stringify({ ok: true, scheduled: false, ...result }))
          }
        } catch (err) { res.statusCode = 502; res.end(JSON.stringify({ error: err.message })) }
      })

      server.middlewares.use('/api/stream/publishes', (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        const u      = new URL(req.url, 'http://x')
        const stream = u.searchParams.get('stream')
        const list   = [...scheduledPublishes.values()].filter(p => !stream || p.stream === stream).map(serializePublish)
        res.end(JSON.stringify({ publishes: list }))
      })

      // ── Schedules ────────────────────────────────────────────────────────────

      server.middlewares.use('/api/stream/schedules', (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        const u      = new URL(req.url, 'http://x')
        const stream = u.searchParams.get('stream')
        const list   = [...schedules.values()].filter(s => !stream || s.stream === stream).map(serializeSchedule)
        res.end(JSON.stringify({ schedules: list }))
      })

      server.middlewares.use('/api/stream/schedule', async (req, res, next) => {
        if (req.method === 'DELETE') {
          if (guardAuth(req, res)) return
          res.setHeader('Content-Type', 'application/json')
          const id = req.url?.replace(/^\//, '').split('?')[0]
          const s  = schedules.get(id)
          if (!s) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Schedule not found' })); return }
          if (s.timerId) clearTimeout(s.timerId)
          schedules.delete(id)
          res.end(JSON.stringify({ ok: true })); return
        }
        if (req.method !== 'POST') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        try {
          const body = await readJsonBody(req)
          const { stream, type, runAt, intervalMs, intervalLabel, subject, server: sp, token: tp } = body
          if (!stream)                          { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream' })); return }
          if (type !== 'once' && type !== 'recurring') { res.statusCode = 400; res.end(JSON.stringify({ error: 'type must be once|recurring' })); return }
          if (type === 'once' && !runAt)        { res.statusCode = 400; res.end(JSON.stringify({ error: 'runAt required for once schedule' })); return }
          if (type === 'recurring' && (!intervalMs || intervalMs < 60000)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'intervalMs must be ≥ 60000' })); return }

          const { natsServer, token } = resolveConn(sp, tp)
          if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'No NATS server configured' })); return }
          const schedule = createSchedule({ stream, type, runAt, intervalMs, intervalLabel, subject, natsServer, token })
          res.statusCode = 201
          res.end(JSON.stringify({ ok: true, schedule: serializeSchedule(schedule) }))
        } catch (err) { res.statusCode = 400; res.end(JSON.stringify({ error: err.message })) }
      })

      // ── NATS contexts + proxy ─────────────────────────────────────────────────

      server.middlewares.use('/api/nats-contexts', (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (guardAuth(req, res)) return
        try {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(loadNatsContexts()))
        } catch (err) { res.statusCode = 500; res.end(JSON.stringify({ error: err.message })) }
      })

      server.middlewares.use('/api/nats-proxy', async (req, res, next) => {
        if (req.method !== 'GET') return next()
        if (guardAuth(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        const u    = new URL(req.url, 'http://x')
        const srv  = u.searchParams.get('server')
        const path = u.searchParams.get('path') || '/'
        let token  = u.searchParams.get('token') || req.headers['authorization']?.replace(/^Bearer\s+/i, '')

        if (!srv) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server param' })); return }

        // If it's an HTTP monitoring URL, fetch directly — no NATS protocol needed.
        // This makes connz, routez, gatewayz, leafz, accountz, subsz all available.
        if (srv.startsWith('http://') || srv.startsWith('https://')) {
          try {
            const base   = srv.replace(/\/$/, '')
            const p      = path.startsWith('/') ? path : `/${path}`
            const resp   = await fetch(`${base}${p}`, { signal: AbortSignal.timeout(10000) })
            if (!resp.ok) throw new Error(`HTTP ${resp.status} from monitoring endpoint`)
            const data = await resp.json()
            res.statusCode = 200
            res.end(JSON.stringify(data))
          } catch (err) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: err.message || 'Monitoring fetch failed' }))
          }
          return
        }

        if (!token) {
          try {
            const host = new URL(srv.startsWith('nats') ? srv : `nats://${new URL(srv).host}`).hostname
            const { contexts } = loadNatsContexts()
            const ctx = contexts.find(c => new URL(c.url).hostname === host)
            if (ctx?.token) token = ctx.token
          } catch { /* ignore */ }
        }

        try {
          const nc   = await getConn(srv, token)
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
