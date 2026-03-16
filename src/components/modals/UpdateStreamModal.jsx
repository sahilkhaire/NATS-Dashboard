import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const RETENTION_OPTIONS = ['limits', 'interest', 'workqueue']

function parseDurationToNs(s) {
  if (s === '' || s == null) return undefined
  if (typeof s === 'number') return s
  const m = String(s).trim().match(/^(\d+)(ns|us|ms|s|m|h|d|y)$/i)
  if (!m) return undefined
  const v = parseInt(m[1], 10)
  const u = m[2].toLowerCase()
  const mult = { ns: 1, us: 1e3, ms: 1e6, s: 1e9, m: 60e9, h: 3600e9, d: 86400e9, y: 31536000e9 }
  const result = v * (mult[u] ?? 0)
  return isNaN(result) ? undefined : result
}

function nsToDuration(ns) {
  if (!ns || ns === 0) return ''
  if (ns >= 86400e9) return `${Math.round(ns / 86400e9)}d`
  if (ns >= 3600e9) return `${Math.round(ns / 3600e9)}h`
  if (ns >= 60e9) return `${Math.round(ns / 60e9)}m`
  if (ns >= 1e9) return `${Math.round(ns / 1e9)}s`
  return `${ns}ns`
}
const STORAGE_OPTIONS = ['file', 'memory']
const DISCARD_OPTIONS = ['old', 'new']

export function UpdateStreamModal({ open, stream, config, onClose, onSave }) {
  const [subjects, setSubjects] = useState('')
  const [retention, setRetention] = useState('limits')
  const [maxMsgs, setMaxMsgs] = useState('')
  const [maxBytes, setMaxBytes] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [maxMsgSize, setMaxMsgSize] = useState('')
  const [storage, setStorage] = useState('file')
  const [discard, setDiscard] = useState('old')
  const [discardNewPerSubject, setDiscardNewPerSubject] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && config) {
      setSubjects((config.subjects || []).join(', '))
      setRetention(config.retention || 'limits')
      setMaxMsgs(config.max_msgs?.toString() ?? '')
      setMaxBytes(config.max_bytes?.toString() ?? '')
      setMaxAge(nsToDuration(config.max_age) || '')
      setMaxMsgSize(config.max_msg_size?.toString() ?? '')
      setStorage(config.storage || 'file')
      setDiscard(config.discard || 'old')
      setDiscardNewPerSubject(config.discard_new_per_subject ?? false)
      setError('')
    }
  }, [open, config])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const cfg = {}
      const subjList = subjects.trim() ? subjects.split(',').map(s => s.trim()).filter(Boolean) : []
      if (subjList.length > 0) cfg.subjects = subjList
      if (retention) cfg.retention = retention
      if (maxMsgs !== '') cfg.max_msgs = parseInt(maxMsgs, 10) || 0
      if (maxBytes !== '') cfg.max_bytes = parseInt(maxBytes, 10) || 0
      const maxAgeNs = parseDurationToNs(maxAge)
      if (maxAgeNs !== undefined && !isNaN(maxAgeNs)) cfg.max_age = maxAgeNs
      if (maxMsgSize !== '') cfg.max_msg_size = parseInt(maxMsgSize, 10) || 0
      if (storage) cfg.storage = storage
      if (discard) cfg.discard = discard
      cfg.discard_new_per_subject = discardNewPerSubject

      await onSave(stream, cfg)
      onClose()
    } catch (err) {
      setError(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-nats-card border border-nats-border rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-nats-border">
            <h3 className="font-mono font-semibold text-lg">Update stream: {stream}</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-nats-border text-gray-400">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 rounded bg-nats-error/20 border border-nats-error/50 text-nats-error text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Subjects (comma-separated)</label>
              <input
                type="text"
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                placeholder="e.g. orders.>, events.>"
                className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Retention</label>
                <select
                  value={retention}
                  onChange={(e) => setRetention(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                >
                  {RETENTION_OPTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Storage</label>
                <select
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                >
                  {STORAGE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max messages</label>
                <input
                  type="number"
                  min="0"
                  value={maxMsgs}
                  onChange={(e) => setMaxMsgs(e.target.value)}
                  placeholder="0 = unlimited"
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max bytes</label>
                <input
                  type="number"
                  min="0"
                  value={maxBytes}
                  onChange={(e) => setMaxBytes(e.target.value)}
                  placeholder="0 = unlimited"
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max age (e.g. 24h, 7d)</label>
                <input
                  type="text"
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  placeholder="e.g. 24h"
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max message size (bytes)</label>
                <input
                  type="number"
                  min="0"
                  value={maxMsgSize}
                  onChange={(e) => setMaxMsgSize(e.target.value)}
                  placeholder="0 = unlimited"
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Discard policy</label>
                <select
                  value={discard}
                  onChange={(e) => setDiscard(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-nats-border bg-nats-bg text-white"
                >
                  {DISCARD_OPTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discardNewPerSubject}
                    onChange={(e) => setDiscardNewPerSubject(e.target.checked)}
                    className="rounded border-nats-border"
                  />
                  <span className="text-sm text-gray-300">Discard new per subject</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border border-nats-border hover:bg-nats-border/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded bg-nats-accent text-nats-bg font-semibold hover:bg-nats-accent/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
