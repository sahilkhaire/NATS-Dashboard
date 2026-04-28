import { readJsonBody } from '../utils/http.js'
import { runKv, runCommand, streamWatch } from '../services/kv-object.js'

function getConn(body, NATS_URL, NATS_TOKEN) {
  return {
    server: body?.server || NATS_URL || null,
    token: body?.token || NATS_TOKEN || null,
  }
}

function sendResult(res, result, fallbackError) {
  if (!result.ok) {
    res.statusCode = 502
    res.end(JSON.stringify({ ok: false, error: result.stderr || fallbackError, ...result }))
    return
  }
  res.end(JSON.stringify({ ok: true, data: result.parsed, ...result }))
}

export function registerKvRoutes(router, { NATS_URL, NATS_TOKEN }) {
  router.get('/api/kv/buckets', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const result = await runKv(['ls', '--json'], conn)
      sendResult(res, result, 'Failed to list KV buckets')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to list KV buckets' }))
    }
  })

  router.get('/api/kv/bucket/:bucket', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const { bucket } = req.params || {}
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const result = await runKv(['info', bucket, '--json'], conn)
      sendResult(res, result, 'Failed to load bucket info')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to load bucket info' }))
    }
  })

  const bucketOps = [
    ['create', '/api/kv/bucket/create'],
    ['edit', '/api/kv/bucket/update'],
    ['rm', '/api/kv/bucket/delete'],
    ['purge', '/api/kv/bucket/purge'],
  ]
  for (const [op, path] of bucketOps) {
    router.post(path, async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      try {
        const body = await readJsonBody(req)
        const { bucket, ...config } = body || {}
        if (!bucket) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: 'bucket is required' }))
          return
        }
        const conn = getConn(body, NATS_URL, NATS_TOKEN)
        const args = [op, bucket]
        if (op === 'create' || op === 'edit') {
          if (config.description) args.push('--description', String(config.description))
          if (config.history != null) args.push('--history', String(config.history))
          if (config.ttl) args.push('--ttl', String(config.ttl))
          if (config.maxValueSize != null) args.push('--max-value-size', String(config.maxValueSize))
          if (config.maxBucketSize != null) args.push('--max-bucket-size', String(config.maxBucketSize))
          if (config.replicas != null) args.push('--replicas', String(config.replicas))
          if (config.storage) args.push('--storage', String(config.storage))
          if (config.compression) args.push('--compression', String(config.compression))
        }
        args.push('--json')
        const result = await runKv(args, conn)
        sendResult(res, result, `Failed to ${op} bucket`)
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: err.message || `Failed to ${op} bucket` }))
      }
    })
  }

  router.get('/api/kv/keys', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const bucket = url.searchParams.get('bucket')
      if (!bucket) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bucket is required' }))
        return
      }
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const result = await runKv(['keys', bucket, '--json'], conn)
      sendResult(res, result, 'Failed to list keys')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to list keys' }))
    }
  })

  const entryOps = [
    ['get', '/api/kv/entry/get'],
    ['put', '/api/kv/entry/put'],
    ['del', '/api/kv/entry/delete'],
    ['purge', '/api/kv/entry/purge'],
    ['history', '/api/kv/entry/history'],
  ]
  for (const [op, path] of entryOps) {
    router.post(path, async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      try {
        const body = await readJsonBody(req)
        const { bucket, key, value, encoding = 'utf8' } = body || {}
        if (!bucket || !key) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: 'bucket and key are required' }))
          return
        }
        const conn = getConn(body, NATS_URL, NATS_TOKEN)
        const args = [op, bucket, key]
        if (op === 'put') {
          if (encoding === 'base64') args.push(Buffer.from(String(value || ''), 'base64').toString('utf8'))
          else if (encoding === 'json') args.push(JSON.stringify(value ?? null))
          else args.push(String(value ?? ''))
        }
        args.push('--json')
        const result = await runKv(args, conn)
        sendResult(res, result, `Failed to ${op} key`)
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: err.message || `Failed to ${op} key` }))
      }
    })
  }

  router.get('/api/kv/watch', async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const bucket = url.searchParams.get('bucket')
      if (!bucket) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'bucket is required' }))
        return
      }
      const key = url.searchParams.get('key')
      const updatesOnly = url.searchParams.get('updatesOnly') === 'true'
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const args = ['watch', bucket]
      if (key) args.push(key)
      if (updatesOnly) args.push('--updates-only')
      args.push('--json')
      streamWatch({ kind: 'kv', args, conn, req, res })
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: err.message || 'Watch failed' }))
    }
  })

  router.post('/api/kv/command', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { args } = body || {}
      if (!Array.isArray(args) || !args.length) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'args must be a non-empty array' }))
        return
      }
      const conn = getConn(body, NATS_URL, NATS_TOKEN)
      const result = await runCommand(args, conn)
      sendResult(res, result, 'Command failed')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Command failed' }))
    }
  })
}
