/**
 * Normalize retention value from NATS API for display and filtering.
 * Handles lowercase ("limits"), PascalCase ("LimitsPolicy"), and other variants.
 * @param {string|undefined|null} raw - Raw retention from stream.config.retention
 * @returns {'limits'|'interest'|'workqueue'}
 */
export function normalizeRetention(raw) {
  if (raw == null || raw === '') return 'limits'
  const s = String(raw).toLowerCase()
  if (s.includes('interest')) return 'interest'
  if (s.includes('workqueue')) return 'workqueue'
  return 'limits'
}
