/**
 * Scheduled purge routes:
 *   GET    /api/stream/schedules        — list schedules for a stream
 *   POST   /api/stream/schedule         — create a schedule
 *   DELETE /api/stream/schedule/:id     — cancel / delete a schedule
 */

import { schedules, createSchedule, serializeSchedule } from '../services/schedule.js'

export function registerScheduleRoutes(router, { NATS_URL, NATS_TOKEN, readJsonBody }) {
  router.get('/api/stream/schedules', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const url    = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const stream = url.searchParams.get('stream')
    const list   = [...schedules.values()]
      .filter(s => !stream || s.stream === stream)
      .map(serializeSchedule)
    res.end(JSON.stringify({ schedules: list }))
  })

  router.post('/api/stream/schedule', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, type, runAt, intervalMs, intervalLabel, subject, server: serverParam, token: tokenParam } = body
      if (!stream)                          { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing stream' })); return }
      if (type !== 'once' && type !== 'recurring') { res.statusCode = 400; res.end(JSON.stringify({ error: 'type must be once|recurring' })); return }
      if (type === 'once' && !runAt)        { res.statusCode = 400; res.end(JSON.stringify({ error: 'runAt required for once schedule' })); return }
      if (type === 'recurring' && (!intervalMs || intervalMs < 60000)) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'intervalMs required and must be ≥ 60000 for recurring' })); return
      }

      const natsServer = serverParam || NATS_URL
      const token      = tokenParam  || NATS_TOKEN
      const schedule   = createSchedule({ stream, type, runAt, intervalMs, intervalLabel, subject, natsServer, token })
      res.statusCode = 201
      res.end(JSON.stringify({ ok: true, schedule: serializeSchedule(schedule) }))
    } catch (err) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: err.message }))
    }
  })

  router.delete('/api/stream/schedule/:id', (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const id = req.url.split('/').pop().split('?')[0]
    const s  = schedules.get(id)
    if (!s) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Schedule not found' })); return }
    if (s.timerId) clearTimeout(s.timerId)
    schedules.delete(id)
    res.end(JSON.stringify({ ok: true }))
  })
}
