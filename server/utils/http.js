/**
 * Shared HTTP utility helpers used by both server/index.js and Vite plugin middleware.
 */

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

export function parseQuery(path) {
  const [, qs = ''] = path.split('?')
  return Object.fromEntries(
    qs.split('&').filter(Boolean).map((kv) => {
      const [k, v = 'true'] = kv.split('=')
      return [decodeURIComponent(k), decodeURIComponent(v)]
    })
  )
}
