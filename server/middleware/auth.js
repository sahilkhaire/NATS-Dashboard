/**
 * Session-based authentication middleware for the production server.
 */

import { randomBytes } from 'crypto'

const SESSION_COOKIE  = 'nats-dashboard-session'
const SESSION_MAX_AGE = 86400 // 24 hours

const sessions = new Map()

export function createAuthMiddleware({ username, password }) {
  const AUTH_ENABLED = !!(username && password)

  function getSessionId(req) {
    const cookie = req.headers.cookie || ''
    const m = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
    return m ? m[1] : null
  }

  function isAuthenticated(req) {
    if (!AUTH_ENABLED) return true
    const sid = getSessionId(req)
    if (!sid) return false
    const s = sessions.get(sid)
    if (!s || s.exp < Date.now()) {
      if (s) sessions.delete(sid)
      return false
    }
    return true
  }

  function createSession() {
    const sid = randomBytes(24).toString('hex')
    sessions.set(sid, { exp: Date.now() + SESSION_MAX_AGE * 1000 })
    return sid
  }

  function setSessionCookie(res, sid) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`)
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`)
  }

  return { AUTH_ENABLED, isAuthenticated, createSession, setSessionCookie, clearSessionCookie, getSessionId, username, password }
}
