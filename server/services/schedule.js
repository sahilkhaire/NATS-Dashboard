/**
 * Scheduled purge store — persists in-memory across requests for the lifetime
 * of the server process.
 */

import { randomBytes } from 'crypto'
import { getConn, natsRequest } from './nats.js'

export const schedules = new Map()

function newScheduleId() {
  return randomBytes(8).toString('hex')
}

async function executePurge(streamName, subject, natsServer, token) {
  const nc = await getConn(natsServer, token)
  const body = subject ? { filter: subject } : {}
  const resp = await natsRequest(nc, `$JS.API.STREAM.PURGE.${streamName}`, body)
  if (resp.error) throw new Error(resp.error.description || 'Purge failed')
  return resp
}

export function armSchedule(schedule) {
  const target = new Date(schedule.nextRun).getTime()
  const delay  = Math.max(0, target - Date.now())

  const fire = async () => {
    const s = schedules.get(schedule.id)
    if (!s) return
    s.status = 'running'
    try {
      await executePurge(s.stream, s.subject, s.server, s.token)
      s.lastRun = new Date().toISOString()
      s.error   = null
      if (s.type === 'once') {
        s.status  = 'done'
        s.timerId = null
      } else {
        s.status  = 'active'
        s.nextRun = new Date(Date.now() + s.intervalMs).toISOString()
        s.timerId = setTimeout(fire, s.intervalMs)
      }
    } catch (err) {
      s.lastRun = new Date().toISOString()
      s.error   = err.message
      if (s.type === 'once') {
        s.status  = 'error'
        s.timerId = null
      } else {
        s.status  = 'active'
        s.nextRun = new Date(Date.now() + s.intervalMs).toISOString()
        s.timerId = setTimeout(fire, s.intervalMs)
      }
    }
  }

  schedule.timerId = setTimeout(fire, delay)
}

export function createSchedule({ stream, type, runAt, intervalMs, intervalLabel, subject, natsServer, token }) {
  const id      = newScheduleId()
  const nextRun = type === 'once'
    ? runAt
    : new Date(Date.now() + Number(intervalMs)).toISOString()

  const schedule = {
    id,
    stream,
    type,
    runAt:          type === 'once'      ? runAt                : null,
    intervalMs:     type === 'recurring' ? Number(intervalMs)   : null,
    intervalLabel:  type === 'recurring' ? (intervalLabel || `${Math.round(Number(intervalMs) / 60000)}m`) : null,
    subject:        subject || null,
    server:         natsServer,
    token,
    createdAt:      new Date().toISOString(),
    lastRun:        null,
    nextRun,
    status:         'active',
    error:          null,
    timerId:        null,
  }

  schedules.set(id, schedule)
  armSchedule(schedule)
  return schedule
}

export function serializeSchedule(s) {
  // eslint-disable-next-line no-unused-vars
  const { timerId, token, server: _srv, ...rest } = s
  return rest
}
