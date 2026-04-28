import { spawn } from 'node:child_process'

const MAX_COMMAND_LENGTH = 500
const MAX_OUTPUT_BYTES = 1024 * 1024
const EXECUTION_TIMEOUT_MS = 15000
const FORBIDDEN_TOKENS = ['&&', '||', '|', ';', '`', '$(', '<', '>', '\n', '\r']

function parseArguments(input) {
  const args = []
  let current = ''
  let quote = null
  let escaped = false

  for (const ch of input) {
    if (escaped) {
      current += ch
      escaped = false
      continue
    }

    if (ch === '\\') {
      escaped = true
      continue
    }

    if (quote) {
      if (ch === quote) {
        quote = null
      } else {
        current += ch
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        args.push(current)
        current = ''
      }
      continue
    }

    current += ch
  }

  if (escaped) throw new Error('Command cannot end with a trailing escape character.')
  if (quote) throw new Error('Unclosed quote in command.')
  if (current.length > 0) args.push(current)

  return args
}

export function validateAndParseNatsCommand(rawCommand) {
  if (typeof rawCommand !== 'string') return { valid: false, error: 'Command must be a string.' }
  const command = rawCommand.trim()

  if (!command) return { valid: false, error: 'Command is required.' }
  if (command.length > MAX_COMMAND_LENGTH) {
    return { valid: false, error: `Command is too long (max ${MAX_COMMAND_LENGTH} chars).` }
  }

  for (const token of FORBIDDEN_TOKENS) {
    if (command.includes(token)) {
      return { valid: false, error: `Unsupported operator detected: ${token}` }
    }
  }

  let parts
  try {
    parts = parseArguments(command)
  } catch (err) {
    return { valid: false, error: err.message || 'Invalid command syntax.' }
  }

  if (parts.length === 0) return { valid: false, error: 'Command is required.' }
  if (parts[0] !== 'nats') return { valid: false, error: 'Only commands starting with "nats" are allowed.' }

  const args = parts.slice(1)

  const needsStreamForConsumerCommand =
    args[0] === 'consumer' &&
    ['ls', 'info', 'rm', 'edit', 'next'].includes(args[1])

  if (needsStreamForConsumerCommand) {
    const positional = args.slice(2).find((token) => token && !token.startsWith('-'))
    if (!positional) {
      return {
        valid: false,
        error: 'This command needs a stream name in non-interactive mode. Example: nats consumer ls <STREAM_NAME>',
      }
    }
  }

  return { valid: true, args }
}

export function runNatsCommand(args) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let stdoutTruncated = false
    let stderrTruncated = false

    const child = spawn('nats', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
    })

    const appendChunk = (value, chunk, setTruncated) => {
      if (value.length >= MAX_OUTPUT_BYTES) {
        setTruncated(true)
        return value
      }
      const text = chunk.toString()
      const remaining = MAX_OUTPUT_BYTES - value.length
      if (text.length > remaining) {
        setTruncated(true)
        return value + text.slice(0, remaining)
      }
      return value + text
    }

    child.stdout.on('data', (chunk) => {
      stdout = appendChunk(stdout, chunk, (flag) => { stdoutTruncated = flag })
    })

    child.stderr.on('data', (chunk) => {
      stderr = appendChunk(stderr, chunk, (flag) => { stderrTruncated = flag })
    })

    child.on('error', (err) => {
      const durationMs = Date.now() - startedAt
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${err.message || 'Failed to run command.'}`,
        durationMs,
      })
    })

    const timeoutId = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, EXECUTION_TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timeoutId)
      const durationMs = Date.now() - startedAt
      let finalStderr = stderr

      if (timedOut) {
        finalStderr = `${finalStderr}${finalStderr ? '\n' : ''}Command timed out after ${EXECUTION_TIMEOUT_MS}ms.`
      }
      if (stdoutTruncated) stdout = `${stdout}\n[stdout truncated]`
      if (stderrTruncated) finalStderr = `${finalStderr}${finalStderr ? '\n' : ''}[stderr truncated]`

      resolve({
        ok: !timedOut && code === 0,
        exitCode: code,
        stdout,
        stderr: finalStderr,
        durationMs,
      })
    })
  })
}
