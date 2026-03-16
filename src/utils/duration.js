/**
 * Human-readable nanosecond duration helpers used throughout the UI.
 */

export function nsToDuration(ns) {
  if (!ns || ns === 0) return '0'
  if (ns >= 86400e9) return `${Math.round(ns / 86400e9)}d`
  if (ns >= 3600e9)  return `${Math.round(ns / 3600e9)}h`
  if (ns >= 60e9)    return `${Math.round(ns / 60e9)}m`
  if (ns >= 1e9)     return `${Math.round(ns / 1e9)}s`
  return `${ns}ns`
}

/**
 * Parse a duration string like "24h", "7d", "30m", "500ms" to nanoseconds.
 * Returns null for invalid input, 0 for "0".
 */
export function parseDurationToNs(s) {
  if (!s || s === '0') return 0
  const m = String(s).trim().match(/^(\d+)(ns|us|ms|s|m|h|d|y)$/i)
  if (!m) return null
  const v = parseInt(m[1], 10)
  const mult = { ns: 1, us: 1e3, ms: 1e6, s: 1e9, m: 60e9, h: 3600e9, d: 86400e9, y: 31536000e9 }
  const result = v * (mult[m[2].toLowerCase()] ?? 0)
  return isNaN(result) ? null : result
}
