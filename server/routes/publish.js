/**
 * Publish routes:
 *   POST   /api/stream/publish       — publish or schedule a message
 *   GET    /api/stream/publishes     — list scheduled publishes for a stream
 *   DELETE /api/stream/publish/:id   — cancel a scheduled publish
 */

import { executePublish, schedulePublish, scheduledPublishes, serializePublish } from '../services/publish.js'

export function registerPublishRoutes(router, { NATS_URL, NATS_TOKEN, readJsonBody }) {
  router.post('/api/stream/publish', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, subject, payload = '', headers: headersArr = [], scheduleAt, msgTtl, server: serverParam, token: tokenParam } = body
      if (!stream || !subject) { res.statusCode = 400; res.end(JSON.stringify({ error: 'stream and subject are required' })); return }

      const natsServer = serverParam || NATS_URL
      const token      = tokenParam  || NATS_TOKEN
      if (!natsServer) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing server' })); return }

      if (scheduleAt) {
        const pub = schedulePublish({ stream, subject, payload, headers: headersArr, msgTtl: msgTtl || null, scheduleAt, natsServer, token })
        res.statusCode = 201
        res.end(JSON.stringify({ ok: true, scheduled: true, id: pub.id, scheduleAt }))
      } else {
        const result = await executePublish(natsServer, token, subject, payload, headersArr, msgTtl)
        res.end(JSON.stringify({ ok: true, scheduled: false, ...result }))
      }
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Publish failed' }))
    }
  })

  router.get('/api/stream/publishes', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const url    = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const stream = url.searchParams.get('stream')
    const list   = [...scheduledPublishes.values()]
      .filter(p => !stream || p.stream === stream)
      .map(serializePublish)
    res.end(JSON.stringify({ publishes: list }))
  })

  router.delete('/api/stream/publish/:id', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const id = req.url.split('/').pop().split('?')[0]
    const p  = scheduledPublishes.get(id)
    if (!p) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Publish not found' })); return }
    if (p.timerId) clearTimeout(p.timerId)
    scheduledPublishes.delete(id)
    res.end(JSON.stringify({ ok: true }))
  })
}
