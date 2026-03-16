#!/usr/bin/env node
/**
 * Syncs NATS CLI contexts to public/nats-contexts.json for production builds.
 * Run: node scripts/sync-nats-context.js
 * Or: npm run sync-context
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function toMonitoringUrl(natsUrl) {
  if (!natsUrl || typeof natsUrl !== 'string') return null
  try {
    const url = new URL(natsUrl)
    return `http://${url.hostname}:8222`
  } catch {
    return null
  }
}

function loadNatsContexts() {
  const home = process.env.HOME || process.env.USERPROFILE
  const configDir = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'nats')
    : join(home, '.config', 'nats')
  const contextDir = join(configDir, 'context')

  if (!existsSync(contextDir)) return { contexts: [], current: null }

  let current = null
  const contextTxt = join(configDir, 'context.txt')
  if (existsSync(contextTxt)) {
    current = readFileSync(contextTxt, 'utf8').trim()
  }

  const contexts = []
  const files = readdirSync(contextDir).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const name = file.replace('.json', '')
    try {
      const raw = readFileSync(join(contextDir, file), 'utf8')
      const ctx = JSON.parse(raw)
      const monitoringUrl = toMonitoringUrl(ctx.url)
      if (monitoringUrl) {
        contexts.push({
          name,
          description: ctx.description || name,
          url: ctx.url,
          monitoringUrl,
          // Token omitted from sync output for security - use dev mode or enter in Settings
        })
      }
    } catch {
      /* skip */
    }
  }

  return { contexts, current }
}

const outPath = join(__dirname, '..', 'public', 'nats-contexts.json')
const outDir = dirname(outPath)
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const data = loadNatsContexts()
writeFileSync(outPath, JSON.stringify(data, null, 2))
console.log(`Wrote ${data.contexts.length} context(s) to ${outPath}`)
