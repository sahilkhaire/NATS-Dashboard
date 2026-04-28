import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

import { runNatsCommand } from './cli.js'

const WATCH_TIMEOUT_MS = 10 * 60 * 1000

function withConnection(args, { server, token }) {
  const next = [...args]
  if (server) next.push('--server', server)
  if (token) next.push('--user', 'token', '--password', token)
  return next
}

function parseJsonLines(stdout) {
  if (!stdout?.trim()) return []
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { raw: line }
      }
    })
}

export async function runCommand(args, conn = {}, options = {}) {
  const cmdArgs = withConnection(args, conn)
  const result = await runNatsCommand(cmdArgs, options)
  return {
    ...result,
    parsed: parseJsonLines(result.stdout),
  }
}

export async function runKv(args, conn = {}, options = {}) {
  return runCommand(['kv', ...args], conn, options)
}

export async function runObject(args, conn = {}, options = {}) {
  return runCommand(['object', ...args], conn, options)
}

function toData(content, encoding = 'utf8') {
  if (encoding === 'base64') return Buffer.from(content || '', 'base64')
  if (encoding === 'json') return Buffer.from(JSON.stringify(content ?? null), 'utf8')
  return Buffer.from(String(content ?? ''), 'utf8')
}

async function withTempFile(content, encoding, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'nats-dashboard-'))
  const path = join(dir, 'payload.bin')
  try {
    await writeFile(path, toData(content, encoding))
    return await fn(path)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function putObject({ bucket, name, content, encoding }, conn) {
  return withTempFile(content, encoding, async (path) => {
    return runObject(['put', bucket, name, '--file', path, '--json'], conn, { timeoutMs: 60000 })
  })
}

export async function getObject({ bucket, name }, conn) {
  const dir = await mkdtemp(join(tmpdir(), 'nats-dashboard-'))
  const path = join(dir, 'download.bin')
  try {
    const result = await runObject(['get', bucket, name, '--output', path, '--json'], conn, { timeoutMs: 60000 })
    const raw = await readFile(path)
    return {
      ...result,
      contentBase64: raw.toString('base64'),
      size: raw.length,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function streamWatch({ kind, args, conn, req, res }) {
  const fullArgs = withConnection([kind, ...args], conn)
  const child = spawn('nats', fullArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  })

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    try { child.kill('SIGKILL') } catch { /* noop */ }
    res.end()
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(': connected\n\n')

  const timerId = setTimeout(() => {
    res.write('event: done\ndata: {"reason":"timeout"}\n\n')
    close()
  }, WATCH_TIMEOUT_MS)

  const onData = (chunk, stream) => {
    const lines = chunk.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      const payload = JSON.stringify({ stream, line, ts: new Date().toISOString() })
      res.write(`data: ${payload}\n\n`)
    }
  }

  child.stdout.on('data', (chunk) => onData(chunk, 'stdout'))
  child.stderr.on('data', (chunk) => onData(chunk, 'stderr'))
  child.on('close', (code) => {
    clearTimeout(timerId)
    if (!closed) {
      res.write(`event: done\ndata: {"exitCode":${code ?? -1}}\n\n`)
      close()
    }
  })
  req.on('close', () => {
    clearTimeout(timerId)
    close()
  })
}
