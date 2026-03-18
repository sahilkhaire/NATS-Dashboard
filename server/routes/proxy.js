/**
 * NATS proxy and context routes:
 *   GET /api/nats-contexts  — returns available NATS contexts
 *   GET /api/nats-proxy     — proxies monitoring endpoint calls:
 *       • http(s):// server  → direct HTTP fetch to the monitoring port (all endpoints work)
 *       • nats://    server  → NATS protocol via system account (jsz/varz/healthz only)
 */

import { getConn, handlePath } from '../services/nats.js'

/**
 * Fetch a monitoring path directly from an HTTP monitoring base URL.
 * e.g. monitoringBase = "http://host:8222", path = "/connz?subs=1"
 */
async function fetchFromMonitoringHttp(monitoringBase, path) {
  const base   = monitoringBase.replace(/\/$/, '')
  const p      = path.startsWith('/') ? path : `/${path}`
  const target = `${base}${p}`
  const resp   = await fetch(target, { signal: AbortSignal.timeout(10000) })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from monitoring endpoint`)
  return resp.json()
}

export function registerProxyRoutes(router, { NATS_URL, NATS_TOKEN, loadContexts }) {
  router.get('/api/nats-contexts', (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(loadContexts()))
  })

  router.get('/api/nats-proxy', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const url         = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const serverParam = url.searchParams.get('server')
    const pathParam   = url.searchParams.get('path') || '/'
    let   token       = url.searchParams.get('token') || req.headers['authorization']?.replace(/^Bearer\s+/i, '')

    const natsServer = serverParam || NATS_URL
    if (!natsServer) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Missing server param and NATS_URL env not set' }))
      return
    }
    if (!token && NATS_TOKEN) token = NATS_TOKEN

    try {
      // If the server URL is an HTTP monitoring URL, fetch directly — no NATS protocol needed.
      // This makes connz, routez, gatewayz, leafz, accountz, subsz all available.
      if (natsServer.startsWith('http://') || natsServer.startsWith('https://')) {
        const data = await fetchFromMonitoringHttp(natsServer, pathParam)
        res.statusCode = 200
        res.end(JSON.stringify(data))
        return
      }

      const nc   = await getConn(natsServer, token)
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
  })
}
