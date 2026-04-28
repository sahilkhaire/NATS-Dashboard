/**
 * Stream mutation routes:
 *   POST /api/stream/delete  — delete a stream
 *   POST /api/stream/update  — update stream config
 *   POST /api/stream/purge   — immediate purge
 *   POST /api/stream/duplicate — duplicate stream config to new stream
 *   POST /api/stream/mirror — create mirror stream
 *   POST /api/stream/step-down — step down stream leader
 *   POST /api/stream/remove-followers — remove follower peers
 *   POST /api/stream/seal — seal stream
 *   GET  /api/stream/config-cli — generate NATS CLI config command
 *   GET  /api/stream/config-terraform — generate Terraform config snippet
 *   GET  /api/stream/messages — fetch messages
 */

import { getConn, natsRequest } from '../services/nats.js'
import { fetchStreamMessages }  from '../services/jetstream.js'
import { readJsonBody }         from '../utils/http.js'

function readAuthTokenFromHeaders(req) {
  return req.headers['authorization']?.replace(/^Bearer\s+/i, '') || null
}

function validateStreamName(stream, res) {
  if (!stream || typeof stream !== 'string') {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Missing or invalid stream name' }))
    return false
  }
  return true
}

function toSubjectList(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return ''
  return subjects.map((s) => `"${String(s).replaceAll('"', '\\"')}"`).join(',')
}

function toShellArg(value) {
  const v = String(value ?? '')
  if (/^[a-zA-Z0-9._:/=-]+$/.test(v)) return v
  return `'${v.replaceAll("'", "'\\''")}'`
}

function buildCliConfig(streamName, cfg = {}) {
  const args = ['nats', 'stream', 'add', toShellArg(streamName)]
  if (Array.isArray(cfg.subjects) && cfg.subjects.length > 0) args.push(`--subjects=${toShellArg(cfg.subjects.join(','))}`)
  if (cfg.retention) args.push(`--retention=${toShellArg(cfg.retention)}`)
  if (cfg.storage) args.push(`--storage=${toShellArg(cfg.storage)}`)
  if (Number.isFinite(cfg.num_replicas)) args.push(`--replicas=${cfg.num_replicas}`)
  if (Number.isFinite(cfg.max_msgs)) args.push(`--max-msgs=${cfg.max_msgs}`)
  if (Number.isFinite(cfg.max_bytes)) args.push(`--max-bytes=${cfg.max_bytes}`)
  if (Number.isFinite(cfg.max_msg_size)) args.push(`--max-msg-size=${cfg.max_msg_size}`)
  if (Number.isFinite(cfg.max_age)) args.push(`--max-age=${cfg.max_age}ns`)
  if (cfg.discard) args.push(`--discard=${toShellArg(cfg.discard)}`)
  if (cfg.description) args.push(`--description=${toShellArg(cfg.description)}`)
  if (cfg.sealed === true) args.push('--sealed')
  if (cfg.allow_rollup_hdrs === true) args.push('--allow-rollup')
  if (cfg.allow_direct === true) args.push('--allow-direct')
  if (cfg.no_ack === true) args.push('--no-ack')
  if (cfg.deny_purge === true) args.push('--deny-purge')
  if (cfg.deny_delete === true) args.push('--deny-delete')
  if (cfg.mirror?.name) args.push(`--mirror=${toShellArg(cfg.mirror.name)}`)
  return args.join(' ')
}

function addTerraformValue(lines, key, value) {
  if (value === undefined || value === null) return
  if (typeof value === 'string') {
    lines.push(`  ${key} = "${value.replaceAll('"', '\\"')}"`)
    return
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    lines.push(`  ${key} = ${value}`)
  }
}

function buildTerraformConfig(streamName, cfg = {}) {
  const lines = [
    'resource "nats_jetstream_stream" "this" {',
    `  name = "${streamName.replaceAll('"', '\\"')}"`,
  ]
  if (Array.isArray(cfg.subjects) && cfg.subjects.length > 0) {
    lines.push(`  subjects = [${toSubjectList(cfg.subjects)}]`)
  }
  addTerraformValue(lines, 'description', cfg.description)
  addTerraformValue(lines, 'retention', cfg.retention)
  addTerraformValue(lines, 'storage', cfg.storage)
  addTerraformValue(lines, 'num_replicas', cfg.num_replicas)
  addTerraformValue(lines, 'max_msgs', cfg.max_msgs)
  addTerraformValue(lines, 'max_bytes', cfg.max_bytes)
  addTerraformValue(lines, 'max_age', cfg.max_age)
  addTerraformValue(lines, 'max_msg_size', cfg.max_msg_size)
  addTerraformValue(lines, 'discard', cfg.discard)
  addTerraformValue(lines, 'sealed', cfg.sealed)
  addTerraformValue(lines, 'deny_delete', cfg.deny_delete)
  addTerraformValue(lines, 'deny_purge', cfg.deny_purge)
  addTerraformValue(lines, 'allow_rollup_hdrs', cfg.allow_rollup_hdrs)
  addTerraformValue(lines, 'allow_direct', cfg.allow_direct)
  addTerraformValue(lines, 'mirror_direct', cfg.mirror_direct)
  if (cfg.mirror?.name) {
    lines.push('  mirror {')
    lines.push(`    name = "${cfg.mirror.name.replaceAll('"', '\\"')}"`)
    if (cfg.mirror.filter_subject) lines.push(`    filter_subject = "${cfg.mirror.filter_subject.replaceAll('"', '\\"')}"`)
    if (cfg.mirror.opt_start_time) lines.push(`    opt_start_time = "${cfg.mirror.opt_start_time}"`)
    if (cfg.mirror.opt_start_seq != null) lines.push(`    opt_start_seq = ${cfg.mirror.opt_start_seq}`)
    lines.push('  }')
  }
  lines.push('}')
  return lines.join('\n')
}

export function registerStreamRoutes(router, { NATS_URL, NATS_TOKEN }) {
  async function resolveConn(req, {
    server: serverParam,
    token: tokenParam,
  } = {}) {
    const natsServer = serverParam || NATS_URL
    const token = tokenParam || readAuthTokenFromHeaders(req) || NATS_TOKEN
    if (!natsServer) throw new Error('Missing server and NATS_URL env not set')
    const nc = await getConn(natsServer, token)
    return nc
  }

  router.post('/api/stream/delete', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, server: serverParam, token: tokenParam } = body
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
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
      if (!validateStreamName(stream, res)) return
      if (!config || typeof config !== 'object') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing or invalid config' }))
        return
      }
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
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
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const body2 = subject ? { filter: subject } : {}
      const resp = await natsRequest(nc, `$JS.API.STREAM.PURGE.${stream}`, body2)
      if (resp.error) throw new Error(resp.error.description || 'Purge failed')
      res.end(JSON.stringify({ ok: true, purged: resp.purged ?? 0 }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Purge failed' }))
    }
  })

  router.post('/api/stream/duplicate', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, target, config = {}, server: serverParam, token: tokenParam } = body
      if (!validateStreamName(stream, res)) return
      if (!target || typeof target !== 'string') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing or invalid target stream name' }))
        return
      }
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Source stream not found')
      const newConfig = {
        ...(infoResp.config || {}),
        ...(config || {}),
        name: target,
      }
      const createResp = await natsRequest(nc, `$JS.API.STREAM.CREATE.${target}`, newConfig)
      if (createResp.error) throw new Error(createResp.error.description || 'Duplicate failed')
      res.end(JSON.stringify({ ok: true, stream: target, config: createResp.config }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream duplicate failed' }))
    }
  })

  router.post('/api/stream/mirror', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, target, mirror = {}, config = {}, server: serverParam, token: tokenParam } = body
      if (!validateStreamName(stream, res)) return
      if (!target || typeof target !== 'string') {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing or invalid target stream name' }))
        return
      }
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Source stream not found')
      const mirrorCfg = { name: stream }
      if (mirror.filter_subject) mirrorCfg.filter_subject = mirror.filter_subject
      if (mirror.opt_start_time) mirrorCfg.opt_start_time = mirror.opt_start_time
      if (mirror.opt_start_seq != null) mirrorCfg.opt_start_seq = mirror.opt_start_seq
      if (mirror.external && typeof mirror.external === 'object') mirrorCfg.external = mirror.external
      const sourceCfg = infoResp.config || {}
      const createCfg = {
        ...sourceCfg,
        ...config,
        name: target,
        mirror: mirrorCfg,
      }
      delete createCfg.subjects
      delete createCfg.sources
      const createResp = await natsRequest(nc, `$JS.API.STREAM.CREATE.${target}`, createCfg)
      if (createResp.error) throw new Error(createResp.error.description || 'Mirror creation failed')
      res.end(JSON.stringify({ ok: true, stream: target, config: createResp.config }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream mirror failed' }))
    }
  })

  router.post('/api/stream/step-down', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, server: serverParam, token: tokenParam } = body
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const resp = await natsRequest(nc, `$JS.API.STREAM.LEADER.STEPDOWN.${stream}`, {})
      if (resp.error) throw new Error(resp.error.description || 'Step down failed')
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Step down failed' }))
    }
  })

  router.post('/api/stream/remove-followers', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, peers, server: serverParam, token: tokenParam } = body
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
      const replicas = infoResp.cluster?.replicas || []
      const inferredPeers = replicas
        .filter((r) => !r.current && typeof r.name === 'string' && r.name)
        .map((r) => r.name)
      const peersToRemove = Array.isArray(peers) && peers.length > 0 ? peers : inferredPeers
      if (peersToRemove.length === 0) {
        res.end(JSON.stringify({ ok: true, removed: [], skipped: 'No follower peers found' }))
        return
      }
      const removed = []
      for (const peer of peersToRemove) {
        const removeResp = await natsRequest(nc, `$JS.API.STREAM.REMOVE_PEER.${stream}`, { peer })
        if (removeResp.error) throw new Error(removeResp.error.description || `Remove follower failed for ${peer}`)
        removed.push(peer)
      }
      res.end(JSON.stringify({ ok: true, removed }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Remove followers failed' }))
    }
  })

  router.post('/api/stream/seal', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const body = await readJsonBody(req)
      const { stream, server: serverParam, token: tokenParam } = body
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
      const merged = { ...(infoResp.config || {}), name: stream, sealed: true }
      const resp = await natsRequest(nc, `$JS.API.STREAM.UPDATE.${stream}`, merged)
      if (resp.error) throw new Error(resp.error.description || 'Seal failed')
      res.end(JSON.stringify({ ok: true, config: resp.config }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Stream seal failed' }))
    }
  })

  router.get('/api/stream/config-cli', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const stream = url.searchParams.get('stream')
      const serverParam = url.searchParams.get('server')
      const tokenParam = url.searchParams.get('token') || readAuthTokenFromHeaders(req)
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
      res.end(JSON.stringify({
        ok: true,
        stream,
        cli: buildCliConfig(stream, infoResp.config || {}),
      }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Failed to build CLI config' }))
    }
  })

  router.get('/api/stream/config-terraform', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const stream = url.searchParams.get('stream')
      const serverParam = url.searchParams.get('server')
      const tokenParam = url.searchParams.get('token') || readAuthTokenFromHeaders(req)
      if (!validateStreamName(stream, res)) return
      const nc = await resolveConn(req, { server: serverParam, token: tokenParam })
      const infoResp = await natsRequest(nc, `$JS.API.STREAM.INFO.${stream}`, {})
      if (infoResp.error) throw new Error(infoResp.error.description || 'Stream not found')
      res.end(JSON.stringify({
        ok: true,
        stream,
        terraform: buildTerraformConfig(stream, infoResp.config || {}),
      }))
    } catch (err) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: err.message || 'Failed to build Terraform config' }))
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
