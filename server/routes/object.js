import { readJsonBody } from '../utils/http.js'
import { getObject, putObject, runCommand, runObject, streamWatch } from '../services/kv-object.js'

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

export function registerObjectRoutes(router, { NATS_URL, NATS_TOKEN }) {
  router.get('/api/object/buckets', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const result = await runObject(['ls', '--json'], conn)
      sendResult(res, result, 'Failed to list object buckets')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to list object buckets' }))
    }
  })

  router.get('/api/object/bucket/:bucket', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const { bucket } = req.params || {}
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const result = await runObject(['info', bucket, '--json'], conn)
      sendResult(res, result, 'Failed to load object bucket info')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to load object bucket info' }))
    }
  })

  const bucketOps = [
    ['add', '/api/object/bucket/create'],
    ['rm', '/api/object/bucket/delete'],
    ['seal', '/api/object/bucket/seal'],
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
        if (op === 'add') {
          if (config.description) args.push('--description', String(config.description))
          if (config.ttl) args.push('--ttl', String(config.ttl))
          if (config.maxBucketSize != null) args.push('--max-bucket-size', String(config.maxBucketSize))
          if (config.replicas != null) args.push('--replicas', String(config.replicas))
          if (config.storage) args.push('--storage', String(config.storage))
          if (config.compression) args.push('--compression', String(config.compression))
        }
        args.push('--json')
        const result = await runObject(args, conn)
        sendResult(res, result, `Failed to ${op} object bucket`)
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: err.message || `Failed to ${op} object bucket` }))
      }
    })
  }

  router.get('/api/object/list', async (req, res) => {
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
      const result = await runObject(['ls', bucket, '--json'], conn)
      sendResult(res, result, 'Failed to list objects')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to list objects' }))
    }
  })

  router.post('/api/object/info', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { bucket, name } = body || {}
      if (!bucket || !name) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bucket and name are required' }))
        return
      }
      const conn = getConn(body, NATS_URL, NATS_TOKEN)
      const result = await runObject(['info', bucket, name, '--json'], conn)
      sendResult(res, result, 'Failed to load object info')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to load object info' }))
    }
  })

  router.post('/api/object/put', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { bucket, name } = body || {}
      if (!bucket || !name) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bucket and name are required' }))
        return
      }
      const conn = getConn(body, NATS_URL, NATS_TOKEN)
      const result = await putObject(body, conn)
      sendResult(res, result, 'Failed to upload object')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to upload object' }))
    }
  })

  router.post('/api/object/get', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { bucket, name } = body || {}
      if (!bucket || !name) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bucket and name are required' }))
        return
      }
      const conn = getConn(body, NATS_URL, NATS_TOKEN)
      const result = await getObject(body, conn)
      if (!result.ok) {
        res.statusCode = 502
        res.end(JSON.stringify({ ok: false, error: result.stderr || 'Failed to download object', ...result }))
        return
      }
      res.end(JSON.stringify({ ok: true, data: result.parsed, contentBase64: result.contentBase64, size: result.size, ...result }))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to download object' }))
    }
  })

  router.post('/api/object/delete', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { bucket, name } = body || {}
      if (!bucket || !name) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bucket and name are required' }))
        return
      }
      const conn = getConn(body, NATS_URL, NATS_TOKEN)
      const result = await runObject(['rm', bucket, name, '--json'], conn)
      sendResult(res, result, 'Failed to delete object')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to delete object' }))
    }
  })

  router.post('/api/object/link', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { bucket, name, targetBucket, targetName } = body || {}
      if (!bucket || !name || !targetBucket) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: 'bucket, name and targetBucket are required' }))
        return
      }
      const conn = getConn(body, NATS_URL, NATS_TOKEN)
      const args = ['link', bucket, name, targetBucket]
      if (targetName) args.push(targetName)
      args.push('--json')
      const result = await runObject(args, conn)
      sendResult(res, result, 'Failed to create object link')
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: err.message || 'Failed to create object link' }))
    }
  })

  router.get('/api/object/watch', async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const bucket = url.searchParams.get('bucket')
      if (!bucket) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'bucket is required' }))
        return
      }
      const name = url.searchParams.get('name')
      const updatesOnly = url.searchParams.get('updatesOnly') === 'true'
      const conn = getConn({
        server: url.searchParams.get('server'),
        token: url.searchParams.get('token'),
      }, NATS_URL, NATS_TOKEN)
      const args = ['watch', bucket]
      if (name) args.push(name)
      if (updatesOnly) args.push('--updates-only')
      args.push('--json')
      streamWatch({ kind: 'object', args, conn, req, res })
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: err.message || 'Watch failed' }))
    }
  })

  router.post('/api/object/command', async (req, res) => {
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
