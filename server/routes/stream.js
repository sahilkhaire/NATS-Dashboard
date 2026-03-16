/**
 * Stream mutation routes:
 *   POST /api/stream/delete  — delete a stream
 *   POST /api/stream/update  — update stream config
 *   POST /api/stream/purge   — immediate purge
 *   GET  /api/stream/messages — fetch messages
 */

import { getConn, natsRequest } from '../services/nats.js'
import { fetchStreamMessages }  from '../services/jetstream.js'
import { readJsonBody }         from '../utils/http.js'

export function registerStreamRoutes(router, { NATS_URL, NATS_TOKEN }) {
  router.post('/api/stream/delete', async (req, res) => {
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
      const token      = tokenParam  || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing server and NATS_URL env not set' }))
        return
      }
      const nc   = await getConn(natsServer, token)
      const resp = await natsRequest(nc, `$JS.API.STREAM.DELETE.${stream}`, {})
      if (resp.error) throw new Error(resp.error.description || 'Delete failed')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream delete failed' }))
    }
  })

  router.post('/api/stream/update', async (req, res) => {
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
      const token      = tokenParam  || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing server and NATS_URL env not set' }))
        return
      }
      const nc       = await getConn(natsServer, token)
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
      const merged = { ...(infoResp.config || {}), ...config, name: stream }
      const resp   = await natsRequest(nc, `$JS.API.STREAM.UPDATE.${stream}`, merged)
      if (resp.error) throw new Error(resp.error.description || 'Update failed')
      res.end(JSON.stringify({ ok: true, config: resp.config }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream update failed' }))
    }
  })

  router.post('/api/stream/purge', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, subject, server: serverParam, token: tokenParam } = body
      if (!stream || typeof stream !== 'string') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing stream name' }))
        return
      }
      const natsServer = serverParam || NATS_URL
      const token      = tokenParam  || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing server and NATS_URL env not set' }))
        return
      }
      const nc   = await getConn(natsServer, token)
      const body2 = subject ? { filter: subject } : {}
      const resp = await natsRequest(nc, `$JS.API.STREAM.PURGE.${stream}`, body2)
      if (resp.error) throw new Error(resp.error.description || 'Purge failed')
      res.end(JSON.stringify({ ok: true, purged: resp.purged ?? 0 }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Purge failed' }))
    }
  })

  router.get('/api/stream/messages', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const url         = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const stream      = url.searchParams.get('stream')
      const limit       = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
      const startSeq    = url.searchParams.get('startSeq')    || null
      const afterSeq    = url.searchParams.get('afterSeq')    || null
      const startTime   = url.searchParams.get('startTime')   || null
      const subject     = url.searchParams.get('subject')     || null
      const serverParam = url.searchParams.get('server')
      const tokenParam  = url.searchParams.get('token') || req.headers['authorization']?.replace(/^Bearer\s+/i, '')

      if (!stream) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'stream param required' }))
        return
      }
      const natsServer = serverParam || NATS_URL
      const token      = tokenParam  || NATS_TOKEN
      if (!natsServer) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing server and NATS_URL not set' }))
        return
      }
      const nc   = await getConn(natsServer, token)
      const data = await fetchStreamMessages(nc, stream, { limit, startSeq, afterSeq, startTime, subject })
      res.end(JSON.stringify(data))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Failed to fetch messages' }))
    }
  })
}
