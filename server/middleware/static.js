/**
 * Static file serving for the production build (dist/ directory).
 */

import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

const MIME = {
  '.html':  'text/html',
  '.js':    'application/javascript',
  '.css':   'text/css',
  '.json':  'application/json',
  '.ico':   'image/x-icon',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
}

export function createStaticHandler(distDir) {
  return function serveStatic(pathname, res) {
    let filePath = join(distDir, pathname === '/' ? 'index.html' : pathname)
    if (!existsSync(filePath) && !extname(filePath)) {
      filePath = join(distDir, 'index.html')
    }
    if (!existsSync(filePath)) return false
    const ext = extname(filePath)
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    res.end(readFileSync(filePath))
    return true
  }
}
