/**
 * Production HTTP server for NATS Dashboard.
 * Serves static files from dist/ and exposes /api/* endpoints.
 *
 * Environment variables:
 *   NATS_URL            — NATS server URL (e.g. nats://host:4222) [required]
 *   NATS_MONITORING_URL — HTTP monitoring URL (e.g. http://host:8222). If unset, derived from NATS_URL.
 *   NATS_TOKEN          — Auth token [required if server uses token auth]
 *   NATS_NAME           — Context name shown in the UI (default: docker)
 *   NATS_DESCRIPTION    — Human-readable label (default: Docker NATS Server)
 *   PORT                 — HTTP port (default: 3000)
 *   DASHBOARD_USERNAME   — Login username (enables auth when set)
 *   DASHBOARD_PASSWORD   — Login password (required when DASHBOARD_USERNAME is set)
 */

import { createServer }   from 'http'
import { fileURLToPath }  from 'url'
import { join }           from 'path'

import { readJsonBody }           from './utils/http.js'
import { createAuthMiddleware }   from './middleware/auth.js'
import { createStaticHandler }    from './middleware/static.js'
import { registerProxyRoutes }    from './routes/proxy.js'
import { registerStreamRoutes }   from './routes/stream.js'
import { registerScheduleRoutes } from './routes/schedule.js'
import { registerPublishRoutes }  from './routes/publish.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PORT              = parseInt(process.env.PORT || '3000', 10)
const NATS_URL          = process.env.NATS_URL          || ''
const NATS_MONITORING_URL = process.env.NATS_MONITORING_URL || ''
const NATS_TOKEN        = process.env.NATS_TOKEN        || null
const NATS_NAME         = process.env.NATS_NAME         || 'docker'
const NATS_DESCRIPTION  = process.env.NATS_DESCRIPTION  || 'Docker NATS Server'
const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME || ''
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''

const DIST_DIR = join(__dirname, '..', 'dist')

/** Convert nats://host:4222 to http://host:8222 for monitoring endpoints. */
function toMonitoringUrl(natsUrl) {
  if (!natsUrl || typeof natsUrl !== 'string') return null
  if (natsUrl.startsWith('http://') || natsUrl.startsWith('https://')) return natsUrl
  try {
    const u = new URL(natsUrl)
    return `http://${u.hostname}:8222`
  } catch {
    return null
  }
}

// ─── Context loader ───────────────────────────────────────────────────────────

function loadContexts() {
  if (!NATS_URL) return { contexts: [], current: null }
  const monitoringUrl = NATS_MONITORING_URL || toMonitoringUrl(NATS_URL) || NATS_URL
  return {
    contexts: [{
      name:          NATS_NAME,
      description:   NATS_DESCRIPTION,
      url:           NATS_URL,
      monitoringUrl,
      token:         NATS_TOKEN,
    }],
    current: NATS_NAME,
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

const auth = createAuthMiddleware({ username: DASHBOARD_USERNAME, password: DASHBOARD_PASSWORD })

// ─── Simple router ────────────────────────────────────────────────────────────

const methodRoutes = { GET: [], POST: [], DELETE: [] }

const router = {
  get:    (path, handler) => methodRoutes.GET.push({ path, handler }),
  post:   (path, handler) => methodRoutes.POST.push({ path, handler }),
  delete: (path, handler) => methodRoutes.DELETE.push({ path, handler }),
}

// Register all route groups
registerProxyRoutes(router,    { NATS_URL, NATS_TOKEN, loadContexts })
registerStreamRoutes(router,   { NATS_URL, NATS_TOKEN })
registerScheduleRoutes(router, { NATS_URL, NATS_TOKEN, readJsonBody })
registerPublishRoutes(router,  { NATS_URL, NATS_TOKEN, readJsonBody })

// ─── Static file handler ──────────────────────────────────────────────────────

const serveStatic = createStaticHandler(DIST_DIR)

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url      = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname
  const method   = req.method

  // ── Auth endpoints (unauthenticated) ────────────────────────────────────────

  if (pathname === '/api/auth/me' && method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    if (!auth.AUTH_ENABLED) { res.end(JSON.stringify({ authenticated: true })); return }
    if (auth.isAuthenticated(req)) {
      res.end(JSON.stringify({ authenticated: true }))
    } else {
      res.statusCode = 401
      res.end(JSON.stringify({ authenticated: false }))
    }
    return
  }

  if (pathname === '/api/login' && method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    if (!auth.AUTH_ENABLED) { res.end(JSON.stringify({ ok: true })); return }
    try {
      const body = await readJsonBody(req)
      if (body.username === auth.username && body.password === auth.password) {
        const sid = auth.createSession()
        auth.setSessionCookie(res, sid)
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

  if (pathname === '/api/logout' && method === 'POST') {
    res.setHeader('Content-Type', 'application/json')
    const sid = auth.getSessionId(req)
    if (sid) auth.createSession() // clear by not storing
    auth.clearSessionCookie(res)
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // ── Auth guard for all other API routes ─────────────────────────────────────

  if (auth.AUTH_ENABLED && pathname.startsWith('/api/')) {
    if (!auth.isAuthenticated(req)) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Unauthorized', authenticated: false }))
      return
    }
  }

  // ── Dispatch to registered routes ────────────────────────────────────────────

  const routes = methodRoutes[method] || []
  for (const route of routes) {
    const patternStr = route.path.replace(/:(\w+)/g, '([^/?]+)')
    const match = pathname.match(new RegExp(`^${patternStr}$`))
    if (match) {
      req.params = {}
      const paramNames = [...route.path.matchAll(/:(\w+)/g)].map(m => m[1])
      paramNames.forEach((name, i) => { req.params[name] = match[i + 1] })
      await route.handler(req, res)
      return
    }
  }

  // ── Static files ─────────────────────────────────────────────────────────────

  if (!serveStatic(pathname, res)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain')
    res.end('Not Found')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NATS Dashboard listening on http://0.0.0.0:${PORT}`)
  if (auth.AUTH_ENABLED) console.log('Login protection enabled (DASHBOARD_USERNAME/DASHBOARD_PASSWORD)')
  if (!NATS_URL) console.warn('WARNING: NATS_URL not set. Set NATS_URL and NATS_TOKEN (if needed) to connect.')
})
