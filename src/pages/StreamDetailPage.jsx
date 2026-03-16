import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useNatsPolling } from '../hooks/useNatsPolling'
import { useStreamMutation } from '../hooks/useStreamMutation'
import { useConfig } from '../context/ConfigContext'
import { formatBytes } from '../utils/byteFormatter'
import { AlertBanner } from '../components/AlertBanner'
import { RefreshSelector } from '../components/RefreshSelector'
import { Trash2, ChevronLeft, Pencil, Check, X as XIcon, Clock, RotateCcw, CalendarClock, Flame, Plus, Send, AlertCircle, ChevronDown, Pause, Play, Filter, GitMerge, Radio, History } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nsToDuration(ns) {
  if (!ns || ns === 0) return '0'
  if (ns >= 86400e9) return `${Math.round(ns / 86400e9)}d`
  if (ns >= 3600e9)  return `${Math.round(ns / 3600e9)}h`
  if (ns >= 60e9)    return `${Math.round(ns / 60e9)}m`
  if (ns >= 1e9)     return `${Math.round(ns / 1e9)}s`
  return `${ns}ns`
}

function parseDurationToNs(s) {
  if (!s || s === '0') return 0
  const m = String(s).trim().match(/^(\d+)(ns|us|ms|s|m|h|d|y)$/i)
  if (!m) return null
  const v = parseInt(m[1], 10)
  const mult = { ns: 1, us: 1e3, ms: 1e6, s: 1e9, m: 60e9, h: 3600e9, d: 86400e9, y: 31536000e9 }
  const result = v * (mult[m[2].toLowerCase()] ?? 0)
  return isNaN(result) ? null : result
}

// ─── Inline editable field ────────────────────────────────────────────────────

function PropertyRow({ label, value, displayValue, editable, inputType = 'text', options, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startEdit = () => {
    setDraft(value ?? '')
    setError('')
    setEditing(true)
  }

  const cancel = () => setEditing(false)

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start justify-between py-3 px-4 border-b border-nats-border last:border-0 group hover:bg-nats-border/20 transition-colors">
      <div className="text-sm text-gray-400 w-44 shrink-0 pt-0.5">{label}</div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            {options ? (
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="px-2 py-1 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
                autoFocus
              >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={inputType}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full px-2 py-1 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
              />
            )}
            <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-nats-ok/20 text-nats-ok" title="Save">
              <Check size={14} />
            </button>
            <button onClick={cancel} className="p-1 rounded hover:bg-nats-border text-gray-400" title="Cancel">
              <XIcon size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-white break-all">{displayValue ?? value ?? '—'}</span>
            {editable && (
              <button
                onClick={startEdit}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-nats-border text-gray-400 hover:text-nats-accent transition-all"
                title={`Edit ${label}`}
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        )}
        {error && <div className="text-xs text-nats-error mt-1">{error}</div>}
      </div>
    </div>
  )
}

// ─── Properties tab ───────────────────────────────────────────────────────────

function PropertiesTab({ stream, onUpdate }) {
  const cfg = stream.config || {}
  const state = stream.state || {}

  const makeUpdater = (field, transform) => async (val) => {
    const v = transform ? transform(val) : val
    if (v === null || v === undefined) throw new Error('Invalid value')
    await onUpdate(stream.name, { [field]: v })
  }

  const sections = [
    {
      title: 'Identity',
      rows: [
        { label: 'Name', value: cfg.name, editable: false },
        { label: 'Description', value: cfg.description, editable: true, onSave: makeUpdater('description') },
        { label: 'Subjects', value: (cfg.subjects || []).join(', '),
          editable: true,
          onSave: async (val) => {
            const subjects = val.trim() ? val.split(',').map(s => s.trim()).filter(Boolean) : []
            await onUpdate(stream.name, { subjects })
          }
        },
      ],
    },
    {
      title: 'Limits',
      rows: [
        { label: 'Max Messages', value: cfg.max_msgs?.toString() ?? '-1',
          displayValue: cfg.max_msgs == null || cfg.max_msgs <= 0 ? 'Unlimited' : cfg.max_msgs.toLocaleString(),
          editable: true, inputType: 'number',
          onSave: makeUpdater('max_msgs', v => parseInt(v, 10) || -1),
        },
        { label: 'Max Bytes', value: cfg.max_bytes?.toString() ?? '-1',
          displayValue: cfg.max_bytes == null || cfg.max_bytes <= 0 ? 'Unlimited' : formatBytes(cfg.max_bytes),
          editable: true, inputType: 'number',
          onSave: makeUpdater('max_bytes', v => parseInt(v, 10) || -1),
        },
        { label: 'Max Message Size', value: cfg.max_msg_size?.toString() ?? '-1',
          displayValue: cfg.max_msg_size == null || cfg.max_msg_size <= 0 ? 'Unlimited' : formatBytes(cfg.max_msg_size),
          editable: true, inputType: 'number',
          onSave: makeUpdater('max_msg_size', v => parseInt(v, 10) || -1),
        },
        { label: 'Max Age', value: nsToDuration(cfg.max_age),
          displayValue: !cfg.max_age || cfg.max_age === 0 ? 'Unlimited' : nsToDuration(cfg.max_age),
          editable: true,
          onSave: makeUpdater('max_age', v => {
            const ns = parseDurationToNs(v)
            if (ns === null) throw new Error('Invalid duration (e.g. 24h, 7d, 30m)')
            return ns
          }),
        },
        { label: 'Max Consumers', value: cfg.max_consumers?.toString() ?? '-1',
          displayValue: cfg.max_consumers == null || cfg.max_consumers <= 0 ? 'Unlimited' : cfg.max_consumers.toLocaleString(),
          editable: true, inputType: 'number',
          onSave: makeUpdater('max_consumers', v => parseInt(v, 10) || -1),
        },
        { label: 'Max Msgs per Subject', value: cfg.max_msgs_per_subject?.toString() ?? '-1',
          displayValue: cfg.max_msgs_per_subject == null || cfg.max_msgs_per_subject <= 0 ? 'Unlimited' : cfg.max_msgs_per_subject.toLocaleString(),
          editable: true, inputType: 'number',
          onSave: makeUpdater('max_msgs_per_subject', v => parseInt(v, 10) || -1),
        },
      ],
    },
    {
      title: 'Storage & Retention',
      rows: [
        { label: 'Storage Type', value: cfg.storage ?? 'file', editable: true,
          options: ['file', 'memory'],
          onSave: makeUpdater('storage'),
        },
        { label: 'Retention', value: cfg.retention ?? 'limits', editable: true,
          options: ['limits', 'interest', 'workqueue'],
          onSave: makeUpdater('retention'),
        },
        { label: 'Discard Policy', value: cfg.discard ?? 'old', editable: true,
          options: ['old', 'new'],
          onSave: makeUpdater('discard'),
        },
        { label: 'Discard New Per Subject', value: cfg.discard_new_per_subject ? 'true' : 'false',
          editable: true,
          options: ['false', 'true'],
          onSave: makeUpdater('discard_new_per_subject', v => v === 'true'),
        },
        { label: 'Replicas', value: cfg.num_replicas?.toString() ?? '1', editable: false },
        { label: 'Duplicate Window', value: nsToDuration(cfg.duplicate_window),
          displayValue: !cfg.duplicate_window ? 'Default' : nsToDuration(cfg.duplicate_window),
          editable: true,
          onSave: makeUpdater('duplicate_window', v => {
            const ns = parseDurationToNs(v)
            if (ns === null) throw new Error('Invalid duration (e.g. 2m, 1h)')
            return ns
          }),
        },
        { label: 'Allow Msg TTL',
          value: cfg.allow_msg_ttl ? 'true' : 'false',
          displayValue: cfg.allow_msg_ttl
            ? <span className="text-nats-ok text-xs font-medium">Enabled — publishers may set per-message Nats-Msg-Ttl header</span>
            : <span className="text-gray-500 text-xs">Disabled</span>,
          editable: true,
          options: ['false', 'true'],
          onSave: makeUpdater('allow_msg_ttl', v => v === 'true'),
        },
        { label: 'Allow Direct Get',
          value: cfg.allow_direct ? 'true' : 'false',
          displayValue: cfg.allow_direct
            ? <span className="text-nats-ok text-xs font-medium">Enabled</span>
            : <span className="text-gray-500 text-xs">Disabled</span>,
          editable: true,
          options: ['false', 'true'],
          onSave: makeUpdater('allow_direct', v => v === 'true'),
        },
      ],
    },
    {
      title: 'Current State',
      rows: [
        { label: 'Messages', value: state.messages?.toLocaleString() ?? '0', editable: false },
        { label: 'Bytes', value: formatBytes(state.bytes), editable: false },
        { label: 'Consumer Count', value: state.consumer_count?.toString() ?? '0', editable: false },
        { label: 'First Sequence', value: state.first_seq?.toLocaleString() ?? '—', editable: false },
        { label: 'Last Sequence', value: state.last_seq?.toLocaleString() ?? '—', editable: false },
        { label: 'Created', value: stream.created ? new Date(stream.created).toLocaleString() : '—', editable: false },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {sections.map(section => (
        <div key={section.title} className="rounded-lg border border-nats-border overflow-hidden">
          <div className="px-4 py-2.5 bg-nats-card border-b border-nats-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{section.title}</span>
          </div>
          {section.rows.map(row => (
            <PropertyRow key={row.label} {...row} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Consumers tab ────────────────────────────────────────────────────────────

function ConsumersTab({ consumers }) {
  if (consumers.length === 0) {
    return (
      <div className="rounded-lg border border-nats-border bg-nats-card p-8 text-center text-gray-400">
        No consumers on this stream.
      </div>
    )
  }

  const lagging = consumers.filter(c => (c.num_pending ?? 0) > 1000 || (c.num_ack_pending ?? 0) > 0)

  return (
    <div className="space-y-4">
      {lagging.length > 0 && (
        <AlertBanner variant="warn" title="Consumers with lag">
          {lagging.length} consumer(s) have pending or unacked messages.
        </AlertBanner>
      )}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Filter Subject</th>
              <th className="text-left p-3">Pending</th>
              <th className="text-left p-3">Ack Pending</th>
              <th className="text-left p-3">Redelivered</th>
              <th className="text-left p-3">Deliver Policy</th>
            </tr>
          </thead>
          <tbody>
            {consumers.map(c => (
              <tr key={c.name} className="border-b border-nats-border hover:bg-nats-border/30">
                <td className="p-3 font-mono font-medium text-nats-accent">{c.name}</td>
                <td className="p-3">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-nats-border text-gray-300">
                    {c.config?.durable_name ? 'Durable' : 'Ephemeral'}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-gray-300">{c.config?.filter_subject || c.config?.filter_subjects?.join(', ') || '—'}</td>
                <td className={`p-3 font-mono ${(c.num_pending ?? 0) > 1000 ? 'text-nats-error' : ''}`}>
                  {(c.num_pending ?? 0).toLocaleString()}
                </td>
                <td className={`p-3 font-mono ${(c.num_ack_pending ?? 0) > 0 ? 'text-nats-error' : ''}`}>
                  {(c.num_ack_pending ?? 0).toLocaleString()}
                </td>
                <td className="p-3 font-mono">{c.num_redelivered ?? 0}</td>
                <td className="p-3 text-xs text-gray-300">{c.config?.deliver_policy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Publish tab ──────────────────────────────────────────────────────────────

const DELAY_OPTIONS = [
  { label: 'Now (immediate)',   value: 0 },
  { label: 'After 1 minute',   value: 60000 },
  { label: 'After 5 minutes',  value: 300000 },
  { label: 'After 15 minutes', value: 900000 },
  { label: 'After 30 minutes', value: 1800000 },
  { label: 'After 1 hour',     value: 3600000 },
  { label: 'After 6 hours',    value: 21600000 },
  { label: 'After 12 hours',   value: 43200000 },
  { label: 'After 24 hours',   value: 86400000 },
  { label: 'At specific time', value: -1 },
]

function HeaderRow({ hdr, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-center">
      <input
        value={hdr.key}
        onChange={e => onChange({ ...hdr, key: e.target.value })}
        placeholder="Header name"
        className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
      />
      <input
        value={hdr.value}
        onChange={e => onChange({ ...hdr, value: e.target.value })}
        placeholder="Value"
        className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
      />
      <button onClick={onRemove} className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error" title="Remove">
        <XIcon size={13} />
      </button>
    </div>
  )
}

function PublishTab({ stream }) {
  const { publishMessage, listScheduledPublishes, cancelScheduledPublish } = useStreamMutation()
  const subjects = stream.config?.subjects ?? []
  const allowMsgTtl = stream.config?.allow_msg_ttl === true

  // Composer state
  const [subject, setSubject] = useState(subjects[0] ?? '')
  const [payload, setPayload] = useState('')
  const [hdrs, setHdrs] = useState([])
  const [msgTtl, setMsgTtl] = useState('')
  const [delayOption, setDelayOption] = useState(0)
  const [scheduleAt, setScheduleAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)
  const [publishError, setPublishError] = useState('')

  // Scheduled publishes list
  const [pending, setPending] = useState([])
  const [loadingPending, setLoadingPending] = useState(true)

  // default scheduleAt to 1h from now
  useEffect(() => {
    const d = new Date(Date.now() + 3600000)
    d.setSeconds(0, 0)
    setScheduleAt(d.toISOString().slice(0, 16))
  }, [])

  const reloadPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const list = await listScheduledPublishes(stream.name)
      setPending(list)
    } catch {
      // ignore
    } finally {
      setLoadingPending(false)
    }
  }, [listScheduledPublishes, stream.name])

  useEffect(() => { reloadPending() }, [reloadPending])

  const handlePublish = async () => {
    setPublishError('')
    setPublishResult(null)
    if (!subject.trim()) { setPublishError('Subject is required'); return }

    let resolvedScheduleAt
    if (delayOption === -1) {
      if (!scheduleAt) { setPublishError('Please pick a delivery time'); return }
      resolvedScheduleAt = new Date(scheduleAt).toISOString()
      if (new Date(resolvedScheduleAt) <= new Date()) { setPublishError('Scheduled time must be in the future'); return }
    } else if (delayOption > 0) {
      resolvedScheduleAt = new Date(Date.now() + delayOption).toISOString()
    }

    setPublishing(true)
    try {
      const result = await publishMessage({
        stream: stream.name,
        subject: subject.trim(),
        payload,
        headers: hdrs.filter(h => h.key.trim()),
        msgTtl: allowMsgTtl && msgTtl.trim() ? msgTtl.trim() : undefined,
        scheduleAt: resolvedScheduleAt,
      })
      setPublishResult(result)
      if (resolvedScheduleAt) reloadPending()
    } catch (err) {
      setPublishError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  const handleCancelPending = async (id) => {
    if (!confirm('Cancel this scheduled message?')) return
    try {
      await cancelScheduledPublish(id)
      reloadPending()
    } catch (err) {
      setPublishError(err.message)
    }
  }

  const isScheduled = delayOption !== 0

  return (
    <div className="space-y-5">
      {/* Composer */}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
          <Send size={13} className="text-nats-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Compose Message</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Subject <span className="text-nats-error">*</span></label>
            {subjects.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={subjects.includes(subject) ? subject : '__custom__'}
                  onChange={e => { if (e.target.value !== '__custom__') setSubject(e.target.value) }}
                  className="w-48 shrink-0 px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
                >
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. orders.created"
                  className="flex-1 px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
                />
              </div>
            ) : (
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. orders.created"
                className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
              />
            )}
          </div>

          {/* Payload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Payload <span className="text-gray-500">(text or JSON)</span></label>
            <textarea
              value={payload}
              onChange={e => setPayload(e.target.value)}
              rows={5}
              placeholder={'{"event":"order.created","orderId":"123"}'}
              className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono resize-y"
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  try { setPayload(JSON.stringify(JSON.parse(payload), null, 2)) } catch { /* not JSON */ }
                }}
                className="text-xs text-gray-500 hover:text-nats-accent"
              >
                Format JSON
              </button>
              <button onClick={() => setPayload('')} className="text-xs text-gray-500 hover:text-nats-error">Clear</button>
            </div>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">NATS Headers <span className="text-gray-500">(optional)</span></label>
              <button
                onClick={() => setHdrs(h => [...h, { key: '', value: '' }])}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-nats-accent"
              >
                <Plus size={11} /> Add header
              </button>
            </div>
            {hdrs.length > 0 && (
              <div className="space-y-2">
                {hdrs.map((h, i) => (
                  <HeaderRow
                    key={i}
                    hdr={h}
                    onChange={updated => setHdrs(prev => prev.map((x, j) => j === i ? updated : x))}
                    onRemove={() => setHdrs(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Message TTL (only if allow_msg_ttl enabled) */}
          {allowMsgTtl && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Message TTL <span className="text-gray-500">(Nats-Msg-Ttl header, e.g. 1h, 30m)</span>
              </label>
              <input
                value={msgTtl}
                onChange={e => setMsgTtl(e.target.value)}
                placeholder="e.g. 1h — message expires after this duration"
                className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
              />
            </div>
          )}

          {/* Delivery timing */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Delivery</label>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={delayOption}
                onChange={e => setDelayOption(Number(e.target.value))}
                className="px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
              >
                {DELAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {delayOption === -1 && (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={e => setScheduleAt(e.target.value)}
                  className="px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
                />
              )}
              {isScheduled && (
                <span className="flex items-center gap-1 text-xs text-nats-warn">
                  <Clock size={11} /> Scheduled — held server-side until delivery time
                </span>
              )}
            </div>
          </div>

          {/* Error / result */}
          {publishError && (
            <div className="flex items-start gap-2 p-2 rounded bg-nats-error/10 border border-nats-error/30 text-nats-error text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {publishError}
            </div>
          )}
          {publishResult && !publishError && (
            <div className="p-2 rounded bg-nats-ok/10 border border-nats-ok/30 text-nats-ok text-xs font-mono">
              {publishResult.scheduled
                ? `Scheduled for ${new Date(publishResult.scheduleAt).toLocaleString()} (id: ${publishResult.id})`
                : `Delivered → stream: ${publishResult.stream}, seq: ${publishResult.seq}${publishResult.duplicate ? ' (duplicate)' : ''}`
              }
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-nats-accent text-nats-bg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Send size={13} />
              {publishing ? 'Sending…' : isScheduled ? 'Schedule Message' : 'Publish Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Pending scheduled messages */}
      {(pending.length > 0 || !loadingPending) && (
        <div className="rounded-lg border border-nats-border overflow-hidden">
          <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
            <Clock size={13} className="text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Scheduled Messages</span>
            <span className="text-xs text-gray-500">({pending.length})</span>
          </div>
          {loadingPending ? (
            <div className="p-4 text-sm text-gray-500">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No pending scheduled messages.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-nats-card/60 border-b border-nats-border">
                <tr>
                  <th className="text-left p-3">Subject</th>
                  <th className="text-left p-3">Payload preview</th>
                  <th className="text-left p-3">Deliver at</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.id} className="border-b border-nats-border hover:bg-nats-border/20">
                    <td className="p-3 font-mono text-xs text-nats-accent">{p.subject}</td>
                    <td className="p-3 font-mono text-xs text-gray-400 max-w-[180px] truncate">
                      {p.payload ? p.payload.slice(0, 60) + (p.payload.length > 60 ? '…' : '') : <span className="text-gray-600">(empty)</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {p.scheduleAt ? new Date(p.scheduleAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.status === 'delivered' ? 'bg-nats-ok/20 text-nats-ok' :
                        p.status === 'error'     ? 'bg-nats-error/20 text-nats-error' :
                        p.status === 'running'   ? 'bg-nats-warn/20 text-nats-warn' :
                        'bg-nats-border text-gray-300'
                      }`}>
                        {p.status}
                      </span>
                      {p.error && <div className="text-xs text-nats-error mt-0.5">{p.error}</div>}
                      {p.result && <div className="text-xs text-gray-500 mt-0.5">seq: {p.result.seq}</div>}
                    </td>
                    <td className="p-3">
                      {(p.status === 'pending' || p.status === 'running') && (
                        <button
                          onClick={() => handleCancelPending(p.id)}
                          className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error transition-colors"
                          title="Cancel"
                        >
                          <XIcon size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Schedule tab ─────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
  { label: '1 hour',    value: 3600000,   display: '1h'  },
  { label: '6 hours',   value: 21600000,  display: '6h'  },
  { label: '12 hours',  value: 43200000,  display: '12h' },
  { label: '1 day',     value: 86400000,  display: '24h' },
  { label: '7 days',    value: 604800000, display: '7d'  },
]

function AddScheduleForm({ streamName, onCreate, onCancel }) {
  const [type, setType] = useState('once')
  const [runAt, setRunAt] = useState('')
  const [intervalMs, setIntervalMs] = useState(INTERVAL_OPTIONS[0].value)
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Default runAt to 1 hour from now
  useEffect(() => {
    const d = new Date(Date.now() + 3600000)
    d.setSeconds(0, 0)
    setRunAt(d.toISOString().slice(0, 16))
  }, [])

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const params = {
        stream: streamName,
        type,
        subject: subject.trim() || undefined,
      }
      if (type === 'once') {
        if (!runAt) throw new Error('Please pick a date and time')
        const ts = new Date(runAt)
        if (ts <= new Date()) throw new Error('Scheduled time must be in the future')
        params.runAt = ts.toISOString()
      } else {
        params.intervalMs = intervalMs
        params.intervalLabel = INTERVAL_OPTIONS.find(o => o.value === Number(intervalMs))?.display || `${intervalMs}ms`
      }
      await onCreate(params)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-nats-accent/40 bg-nats-card p-4 space-y-4">
      <div className="text-sm font-semibold text-nats-accent">New Scheduled Purge</div>

      {/* Type toggle */}
      <div className="flex gap-2">
        {['once', 'recurring'].map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              type === t ? 'bg-nats-accent text-nats-bg' : 'border border-nats-border text-gray-400 hover:border-nats-accent/50'
            }`}
          >
            {t === 'once' ? 'One-time' : 'Recurring'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {type === 'once' ? (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Run at</label>
            <input
              type="datetime-local"
              value={runAt}
              onChange={e => setRunAt(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Repeat every</label>
            <select
              value={intervalMs}
              onChange={e => setIntervalMs(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
            >
              {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Subject filter <span className="text-gray-500">(optional)</span></label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. orders.> or leave blank for all"
            className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
          />
        </div>
      </div>

      {error && <div className="text-xs text-nats-error">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded bg-nats-accent text-nats-bg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Create schedule'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-nats-border text-gray-400 hover:bg-nats-border text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ScheduleTab({ streamName, purgeStream }) {
  const { listSchedules, createSchedule, deleteSchedule } = useStreamMutation()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [purgeSubject, setPurgeSubject] = useState('')
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState(null)
  const [purgeError, setPurgeError] = useState('')

  const reload = useCallback(async () => {
    try {
      const list = await listSchedules(streamName)
      setSchedules(list)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [listSchedules, streamName])

  useEffect(() => { reload() }, [reload])

  const handlePurge = async () => {
    if (!confirm(`Purge all messages from "${streamName}"${purgeSubject ? ` matching subject "${purgeSubject}"` : ''}? This cannot be undone.`)) return
    setPurging(true); setPurgeResult(null); setPurgeError('')
    try {
      const result = await purgeStream(streamName, purgeSubject.trim() || undefined)
      setPurgeResult(result.purged ?? 0)
    } catch (err) {
      setPurgeError(err.message)
    } finally {
      setPurging(false)
    }
  }

  const handleCreate = async (params) => {
    await createSchedule(params)
    setShowForm(false)
    reload()
  }

  const handleDelete = async (id) => {
    if (!confirm('Cancel this scheduled purge?')) return
    try {
      await deleteSchedule(id)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const formatNextRun = (s) => {
    if (s.status === 'done') return 'Completed'
    if (!s.nextRun) return '—'
    const d = new Date(s.nextRun)
    const now = Date.now()
    const diff = d - now
    if (diff < 0) return 'Overdue'
    if (diff < 60000) return `in ${Math.round(diff / 1000)}s`
    if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`
    if (diff < 86400000) return `in ${Math.round(diff / 3600000)}h`
    return d.toLocaleString()
  }

  return (
    <div className="space-y-5">
      {/* Immediate purge panel */}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
          <Flame size={14} className="text-nats-error" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Purge Now</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400">
            Immediately delete messages from this stream. Optionally narrow by subject filter.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={purgeSubject}
              onChange={e => setPurgeSubject(e.target.value)}
              placeholder="Subject filter (optional, e.g. orders.>)"
              className="flex-1 px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
            />
            <button
              onClick={handlePurge}
              disabled={purging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-nats-error/40 hover:bg-nats-error/20 text-nats-error text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Flame size={13} />
              {purging ? 'Purging…' : 'Purge'}
            </button>
          </div>
          {purgeResult !== null && (
            <div className="text-xs text-nats-ok">Purged {purgeResult.toLocaleString()} message{purgeResult !== 1 ? 's' : ''} successfully.</div>
          )}
          {purgeError && <div className="text-xs text-nats-error">{purgeError}</div>}
        </div>
      </div>

      {/* Scheduled purges */}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={14} className="text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Scheduled Purges</span>
            {!loading && <span className="text-xs text-gray-500">({schedules.length})</span>}
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-nats-border hover:border-nats-accent/50 text-gray-400 hover:text-nats-accent text-xs transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>

        {showForm && (
          <div className="p-4">
            <AddScheduleForm
              streamName={streamName}
              onCreate={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-nats-error border-b border-nats-border">{error}</div>
        )}

        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No scheduled purges. Click <strong>Add</strong> to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-nats-card/60 border-b border-nats-border">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Subject Filter</th>
                <th className="text-left p-3">Next Run</th>
                <th className="text-left p-3">Last Run</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className="border-b border-nats-border hover:bg-nats-border/20">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {s.type === 'recurring'
                        ? <RotateCcw size={12} className="text-nats-accent" />
                        : <Clock size={12} className="text-gray-400" />
                      }
                      <span className="text-xs font-medium">
                        {s.type === 'recurring' ? `Every ${s.intervalLabel}` : 'One-time'}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-300">{s.subject || <span className="text-gray-500">all messages</span>}</td>
                  <td className="p-3 text-xs">{formatNextRun(s)}</td>
                  <td className="p-3 text-xs text-gray-400">
                    {s.lastRun ? new Date(s.lastRun).toLocaleString() : '—'}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      s.status === 'done'  ? 'bg-gray-700 text-gray-400' :
                      s.status === 'error' ? 'bg-nats-error/20 text-nats-error' :
                      s.status === 'running' ? 'bg-nats-warn/20 text-nats-warn' :
                      'bg-nats-ok/20 text-nats-ok'
                    }`}>
                      {s.status}
                    </span>
                    {s.error && <div className="text-xs text-nats-error mt-0.5">{s.error}</div>}
                  </td>
                  <td className="p-3">
                    {s.status !== 'done' && (
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error transition-colors"
                        title="Cancel schedule"
                      >
                        <XIcon size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Messages tab ─────────────────────────────────────────────────────────────

function MessagesTab({ stream }) {
  const { serverUrl, authToken } = useConfig()
  const [mode, setMode] = useState('realtime') // 'realtime' | 'history'
  const [paused, setPaused] = useState(false)
  const [messages, setMessages] = useState([])
  const [streamMeta, setStreamMeta] = useState({ firstSeq: 1, lastSeq: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const lastSeqRef = useRef(null)

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStartSeq, setFilterStartSeq] = useState('')
  const [filterStartTime, setFilterStartTime] = useState('')
  const [savedFilters, setSavedFilters] = useState([])
  const [filterSetName, setFilterSetName] = useState('')

  // Expanded rows
  const [expanded, setExpanded] = useState(new Set())

  const buildUrl = useCallback((params) => {
    const u = new URLSearchParams({ stream: stream.name, limit: '50', ...params })
    if (serverUrl) u.set('server', serverUrl)
    if (authToken) u.set('token', authToken)
    return `/api/stream/messages?${u}`
  }, [stream.name, serverUrl, authToken])

  // Load saved filters from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nats-msg-filters') || '[]')
      setSavedFilters(Array.isArray(saved) ? saved : [])
    } catch {}
  }, [])

  const loadMessages = useCallback(async (opts = {}) => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (opts.afterSeq != null) params.afterSeq = String(opts.afterSeq)
      else if (opts.startSeq != null) params.startSeq = String(opts.startSeq)
      else if (opts.startTime) params.startTime = opts.startTime
      if (opts.subject) params.subject = opts.subject
      if (opts.limit) params.limit = String(opts.limit)

      const res = await fetch(buildUrl(params), { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch messages')
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  // Initial / reset load
  const reload = useCallback(async () => {
    setMessages([])
    setHasMore(false)
    setExpanded(new Set())
    const subject = filterSubject.trim() || undefined
    let opts = { subject }

    if (mode === 'history') {
      if (filterStartSeq) opts.startSeq = Number(filterStartSeq)
      else if (filterStartTime) opts.startTime = new Date(filterStartTime).toISOString()
      else opts.startSeq = 1
    }
    // Realtime: no startSeq = server returns last 50

    const data = await loadMessages(opts)
    if (!data) return
    setMessages(data.messages || [])
    setStreamMeta({ firstSeq: data.firstSeq, lastSeq: data.lastSeq })
    setHasMore(data.hasMore ?? false)
    const lastMsg = data.messages?.[data.messages.length - 1]
    lastSeqRef.current = lastMsg?.seq ?? data.lastSeq
  }, [mode, filterSubject, filterStartSeq, filterStartTime, loadMessages])

  useEffect(() => { reload() }, [reload])

  // Realtime polling — check for new messages
  useEffect(() => {
    if (mode !== 'realtime' || paused) return
    const timer = setInterval(async () => {
      if (lastSeqRef.current == null) return
      const subject = filterSubject.trim() || undefined
      const res = await fetch(buildUrl({ afterSeq: String(lastSeqRef.current), limit: '20', ...(subject ? { subject } : {}) }), { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data.messages?.length > 0) {
        setMessages(prev => {
          const combined = [...prev, ...data.messages]
          return combined.slice(-500) // keep last 500 in realtime
        })
        const lastMsg = data.messages[data.messages.length - 1]
        lastSeqRef.current = lastMsg.seq
        setStreamMeta(prev => ({ ...prev, lastSeq: data.lastSeq }))
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [mode, paused, filterSubject, buildUrl])

  // Load more (history)
  const loadMore = async () => {
    if (!hasMore || loading || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    const subject = filterSubject.trim() || undefined
    const data = await loadMessages({ afterSeq: lastMsg.seq, ...(subject ? { subject } : {}) })
    if (!data) return
    setMessages(prev => [...prev, ...(data.messages || [])])
    setHasMore(data.hasMore ?? false)
    if (data.messages?.length > 0) {
      lastSeqRef.current = data.messages[data.messages.length - 1].seq
    }
  }

  const saveFilterSet = () => {
    const name = filterSetName.trim()
    if (!name) return
    const newFilter = { name, subject: filterSubject, startSeq: filterStartSeq, startTime: filterStartTime }
    const updated = [...savedFilters.filter(f => f.name !== name), newFilter]
    setSavedFilters(updated)
    try { localStorage.setItem('nats-msg-filters', JSON.stringify(updated)) } catch {}
    setFilterSetName('')
  }

  const applyFilter = (f) => {
    setFilterSubject(f.subject || '')
    setFilterStartSeq(f.startSeq || '')
    setFilterStartTime(f.startTime || '')
    setShowFilters(false)
  }

  const deleteSavedFilter = (fname) => {
    const updated = savedFilters.filter(f => f.name !== fname)
    setSavedFilters(updated)
    try { localStorage.setItem('nats-msg-filters', JSON.stringify(updated)) } catch {}
  }

  const toggleExpand = (seq) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(seq)) next.delete(seq); else next.add(seq)
      return next
    })
  }

  const hasActiveFilters = filterSubject || filterStartSeq || filterStartTime
  const displayMessages = mode === 'realtime' ? [...messages].reverse() : messages

  return (
    <div className="space-y-3">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-nats-card border border-nats-border rounded-lg p-1">
          <button
            onClick={() => setMode('realtime')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'realtime' ? 'bg-nats-accent/20 text-nats-accent border border-nats-accent/30' : 'text-gray-400 hover:text-white'}`}
          >
            {mode === 'realtime' && !paused
              ? <span className="w-1.5 h-1.5 rounded-full bg-nats-accent animate-pulse" />
              : <Radio size={13} />}
            Realtime
          </button>
          <button
            onClick={() => setMode('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === 'history' ? 'bg-nats-accent/20 text-nats-accent border border-nats-accent/30' : 'text-gray-400 hover:text-white'}`}
          >
            <History size={13} />
            History
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {mode === 'realtime' && (
            <button
              onClick={() => setPaused(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm transition-colors ${paused ? 'border-nats-warn/40 hover:bg-nats-warn/20 text-nats-warn' : 'border-nats-border text-gray-400 hover:text-white'}`}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm transition-colors ${showFilters || hasActiveFilters ? 'border-nats-accent/40 text-nats-accent' : 'border-nats-border text-gray-400 hover:text-white'}`}
          >
            <Filter size={13} />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-nats-accent" />}
          </button>
          <button
            onClick={reload}
            disabled={loading}
            title="Reload"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-nats-border text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-lg border border-nats-border bg-nats-card p-4 space-y-3">
          <div className={`grid gap-3 ${mode === 'history' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Subject Filter</label>
              <input
                type="text"
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                placeholder="e.g. orders.> or events.*"
                className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
              />
            </div>
            {mode === 'history' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Sequence</label>
                  <input
                    type="number"
                    value={filterStartSeq}
                    onChange={e => { setFilterStartSeq(e.target.value); setFilterStartTime('') }}
                    placeholder="e.g. 1000"
                    className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={filterStartTime}
                    onChange={e => { setFilterStartTime(e.target.value); setFilterStartSeq('') }}
                    className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent"
                  />
                </div>
              </>
            )}
          </div>

          {/* Saved filter sets */}
          {savedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-nats-border">
              <span className="text-xs text-gray-500">Saved:</span>
              {savedFilters.map(f => (
                <div key={f.name} className="flex items-center gap-0.5">
                  <button
                    onClick={() => applyFilter(f)}
                    className="px-2 py-0.5 text-xs rounded-l bg-nats-border hover:bg-nats-accent/20 text-gray-300 hover:text-nats-accent transition-colors"
                  >
                    {f.name}
                  </button>
                  <button
                    onClick={() => deleteSavedFilter(f.name)}
                    className="px-1 py-0.5 text-xs rounded-r bg-nats-border hover:bg-nats-error/20 text-gray-500 hover:text-nats-error transition-colors"
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Save + clear */}
          <div className="flex gap-2 items-center pt-2 border-t border-nats-border">
            <input
              type="text"
              value={filterSetName}
              onChange={e => setFilterSetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveFilterSet()}
              placeholder="Save as filter set…"
              className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent"
            />
            <button
              onClick={saveFilterSet}
              disabled={!filterSetName.trim()}
              className="px-2.5 py-1 text-xs rounded border border-nats-border hover:border-nats-accent/50 text-gray-400 hover:text-nats-accent transition-colors disabled:opacity-40"
            >
              Save
            </button>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterSubject(''); setFilterStartSeq(''); setFilterStartTime('') }}
                className="px-2.5 py-1 text-xs rounded text-gray-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded bg-nats-error/20 border border-nats-error/50 text-nats-error text-xs">
          {error}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
          {streamMeta.lastSeq > 0 && ` · stream seq ${streamMeta.lastSeq.toLocaleString()}`}
        </span>
        {mode === 'realtime' && paused && (
          <span className="text-nats-warn flex items-center gap-1">
            <Pause size={10} /> Paused — new messages not shown
          </span>
        )}
        {mode === 'history' && hasMore && !loading && (
          <span className="text-gray-500">More messages available ↓</span>
        )}
      </div>

      {/* Messages table */}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-20">Seq</th>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-44">Time</th>
              <th className="text-left px-3 py-2 font-medium text-gray-400 w-52">Subject</th>
              <th className="text-left px-3 py-2 font-medium text-gray-400">Payload</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {loading && messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">Loading messages…</td>
              </tr>
            ) : displayMessages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  {mode === 'realtime'
                    ? 'Waiting for messages… (new messages will appear here)'
                    : 'No messages found for the given filters.'}
                </td>
              </tr>
            ) : (
              displayMessages.map(m => (
                <Fragment key={m.seq}>
                <tr
                  className="border-b border-nats-border hover:bg-nats-border/20 cursor-pointer"
                  onClick={() => toggleExpand(m.seq)}
                >
                    <td className="px-3 py-2 font-mono text-nats-accent">{(m.seq ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                      {m.time ? new Date(m.time).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-200 max-w-0 truncate" title={m.subject}>{m.subject}</td>
                    <td className="px-3 py-2 font-mono text-gray-400 max-w-0 truncate" title={m.data}>
                      {m.data ? (m.data.length > 120 ? m.data.slice(0, 120) + '…' : m.data) : <span className="text-gray-600">(empty)</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <ChevronDown size={13} className={`transition-transform ${expanded.has(m.seq) ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {expanded.has(m.seq) && (
                    <tr className="border-b border-nats-border bg-nats-bg/50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="flex gap-4 text-xs">
                            <span><span className="text-gray-500">Subject: </span><span className="font-mono text-gray-200">{m.subject}</span></span>
                            <span><span className="text-gray-500">Seq: </span><span className="font-mono text-gray-200">{m.seq}</span></span>
                            {m.time && <span><span className="text-gray-500">Time: </span><span className="font-mono text-gray-200">{new Date(m.time).toISOString()}</span></span>}
                          </div>
                          {Object.keys(m.headers || {}).length > 0 && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Headers:</div>
                              <div className="bg-nats-card rounded border border-nats-border p-2 space-y-0.5">
                                {Object.entries(m.headers).map(([k, v]) => (
                                  <div key={k} className="font-mono text-xs">
                                    <span className="text-nats-accent">{k}</span>
                                    <span className="text-gray-500">: </span>
                                    <span className="text-gray-200">{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Payload:</div>
                            <pre className="bg-nats-card rounded border border-nats-border p-3 text-xs font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap break-all max-h-64">
                              {(() => {
                                if (!m.data) return '(empty)'
                                try { return JSON.stringify(JSON.parse(m.data), null, 2) } catch { return m.data }
                              })()}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {mode === 'history' && hasMore && (
        <div className="text-center pt-1">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-5 py-2 rounded border border-nats-border text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more messages'}
          </button>
        </div>
      )}
      {mode === 'history' && !hasMore && messages.length > 0 && (
        <div className="text-center text-xs text-gray-600 py-2">End of messages</div>
      )}
    </div>
  )
}

// ─── Relations tab ────────────────────────────────────────────────────────────

function RelationsTab({ stream, allStreams }) {
  const navigate = useNavigate()
  const name = stream.name
  const cfg = stream.config || {}

  // Build graph
  const nodes = [{ id: name, label: name, type: 'current' }]
  const edges = []

  // Mirror source (this stream mirrors from another)
  if (cfg.mirror?.name) {
    const mn = cfg.mirror.name
    if (!nodes.find(n => n.id === mn)) {
      nodes.push({ id: mn, label: mn, type: allStreams.some(s => s.name === mn) ? 'stream' : 'external' })
    }
    edges.push({ from: mn, to: name, label: 'mirror of' })
  }

  // Sources (this stream aggregates from others)
  for (const src of cfg.sources || []) {
    const sn = src.name
    if (!nodes.find(n => n.id === sn)) {
      nodes.push({ id: sn, label: sn, type: allStreams.some(s => s.name === sn) ? 'stream' : 'external' })
    }
    edges.push({ from: sn, to: name, label: 'source' })
  }

  // Republish target
  if (cfg.republish?.dst) {
    const dst = cfg.republish.dst
    const dstId = `__subj__${dst}`
    nodes.push({ id: dstId, label: dst, type: 'subject' })
    edges.push({ from: name, to: dstId, label: 'republish' })
  }

  // Other streams that mirror or source from this stream
  for (const s of allStreams) {
    if (s.name === name) continue
    const sc = s.config || {}
    if (sc.mirror?.name === name) {
      if (!nodes.find(n => n.id === s.name)) nodes.push({ id: s.name, label: s.name, type: 'stream' })
      edges.push({ from: name, to: s.name, label: 'mirrored by' })
    }
    for (const src of sc.sources || []) {
      if (src.name === name) {
        if (!nodes.find(n => n.id === s.name)) nodes.push({ id: s.name, label: s.name, type: 'stream' })
        edges.push({ from: name, to: s.name, label: 'sourced by' })
      }
    }
  }

  if (nodes.length === 1) {
    return (
      <div className="rounded-lg border border-nats-border bg-nats-card p-10 text-center space-y-2">
        <GitMerge size={32} className="mx-auto text-gray-700" />
        <p className="text-gray-400 text-sm">No relations found for this stream.</p>
        <p className="text-gray-600 text-xs">Configure a mirror, sources, or republish to see relationships here.</p>
      </div>
    )
  }

  // Layout: current stream center, incomers left, outgoers right
  const W = 720; const H = 300
  const CX = W / 2; const CY = H / 2
  const NW = 150; const NH = 38

  const incomers = nodes.filter(n => n.id !== name && edges.some(e => e.to === name && e.from === n.id))
  const outgoers = nodes.filter(n => n.id !== name && edges.some(e => e.from === name && e.to === n.id))

  const pos = {}
  pos[name] = { x: CX, y: CY }
  const gap = 85
  incomers.forEach((n, i) => {
    const offset = ((incomers.length - 1) * gap) / 2
    pos[n.id] = { x: CX - 220, y: CY - offset + i * gap }
  })
  outgoers.forEach((n, i) => {
    const offset = ((outgoers.length - 1) * gap) / 2
    pos[n.id] = { x: CX + 220, y: CY - offset + i * gap }
  })

  const typeColor = { current: '#00c8b4', stream: '#4d8ff5', external: '#f5a623', subject: '#a78bfa' }

  return (
    <div className="rounded-lg border border-nats-border overflow-hidden">
      <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
        <GitMerge size={14} className="text-nats-accent" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stream Relations</span>
        <span className="ml-auto text-xs text-gray-600">{edges.length} relation{edges.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="p-4 bg-nats-bg">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '300px' }}>
          <defs>
            <marker id="rel-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#4d5278" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const fp = pos[e.from]; const tp = pos[e.to]
            if (!fp || !tp) return null
            const dx = tp.x - fp.x
            const x1 = fp.x + (dx > 0 ? NW / 2 : -NW / 2)
            const x2 = tp.x + (dx > 0 ? -NW / 2 - 6 : NW / 2 + 6)
            const y1 = fp.y; const y2 = tp.y
            const mx = (x1 + x2) / 2; const my = Math.min(y1, y2) - 10
            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                  fill="none" stroke="#2d3148" strokeWidth="1.5"
                  markerEnd="url(#rel-arrow)"
                />
                <text
                  x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
                  textAnchor="middle" fill="#8b92b3" fontSize="9"
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {e.label}
                </text>
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const p = pos[n.id]; if (!p) return null
            const color = typeColor[n.type] || '#4d5278'
            const clickable = n.type === 'stream'
            const label = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label
            return (
              <g key={n.id} transform={`translate(${p.x - NW / 2},${p.y - NH / 2})`}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onClick={() => clickable && navigate(`/streams/${encodeURIComponent(n.id)}`)}
              >
                <rect width={NW} height={NH} rx="6"
                  fill={n.type === 'current' ? `${color}1a` : '#1a1d27'}
                  stroke={color} strokeWidth={n.type === 'current' ? '2' : '1'}
                />
                <text x={NW / 2} y={NH / 2 + 4}
                  textAnchor="middle" fill={n.type === 'current' ? color : '#d1d5db'}
                  fontSize="11" fontFamily="monospace"
                  fontWeight={n.type === 'current' ? '600' : '400'}
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-nats-border text-xs text-gray-400">
          {[
            { color: '#00c8b4', label: 'This stream' },
            { color: '#4d8ff5', label: 'Other stream (click to open)' },
            { color: '#f5a623', label: 'External / unknown' },
            { color: '#a78bfa', label: 'Republish subject' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border" style={{ borderColor: color, background: `${color}22` }} />
              {label}
            </div>
          ))}
        </div>

        {/* Relation details */}
        {edges.length > 0 && (
          <div className="mt-3 space-y-1">
            {edges.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-mono text-gray-300">{e.from === `__subj__${cfg.republish?.dst}` ? cfg.republish?.dst : e.from}</span>
                <span className="text-gray-600">→ {e.label} →</span>
                <span className="font-mono text-gray-300">{e.to.startsWith('__subj__') ? e.to.replace('__subj__', '') : e.to}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function StreamDetailPage() {
  const { name } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('properties')
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [deleteError, setDeleteError] = useState('')

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true', refreshInterval)
  const { deleteStream, updateStream, purgeStream } = useStreamMutation()

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-gray-400">Loading...</div>

  let stream = null
  for (const acc of data.account_details ?? []) {
    for (const sd of acc.stream_detail ?? []) {
      if (sd.name === name) { stream = sd; break }
    }
    if (stream) break
  }

  if (!stream) return <div className="p-6 text-gray-400">Stream not found.</div>

  const consumers = stream.consumer_detail ?? []

  // Collect all streams for the Relations tab
  const allStreams = []
  for (const acc of data.account_details ?? []) {
    for (const sd of acc.stream_detail ?? []) {
      allStreams.push(sd)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete stream "${stream.name}" and ALL its data? This cannot be undone.`)) return
    setDeleteError('')
    try {
      await deleteStream(stream.name)
      navigate('/streams')
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  const handleUpdate = async (streamName, config) => {
    await updateStream(streamName, config)
    refetch()
  }

  const tabs = [
    { id: 'properties', label: 'Properties' },
    { id: 'consumers', label: `Consumers${consumers.length > 0 ? ` (${consumers.length})` : ''}` },
    { id: 'messages', label: 'Messages' },
    { id: 'relations', label: 'Relations' },
    { id: 'publish', label: 'Publish' },
    { id: 'schedule', label: 'Schedule' },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/streams" className="p-1.5 rounded hover:bg-nats-border text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-semibold text-nats-accent">{stream.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {stream.config?.storage ?? 'file'} · {stream.config?.retention ?? 'limits'} · {(stream.state?.messages ?? 0).toLocaleString()} msgs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-nats-error/40 hover:bg-nats-error/20 text-nats-error text-sm transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {deleteError && (
        <AlertBanner variant="error" title="Delete failed">{deleteError}</AlertBanner>
      )}

      {/* Tabs */}
      <div className="border-b border-nats-border flex gap-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-nats-accent text-nats-accent'
                : 'border-transparent text-gray-400 hover:text-white hover:border-nats-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'properties' && (
        <PropertiesTab stream={stream} onUpdate={handleUpdate} />
      )}
      {activeTab === 'consumers' && (
        <ConsumersTab consumers={consumers} />
      )}
      {activeTab === 'messages' && (
        <MessagesTab stream={stream} />
      )}
      {activeTab === 'relations' && (
        <RelationsTab stream={stream} allStreams={allStreams} />
      )}
      {activeTab === 'publish' && (
        <PublishTab stream={stream} />
      )}
      {activeTab === 'schedule' && (
        <ScheduleTab streamName={stream.name} purgeStream={purgeStream} />
      )}
    </div>
  )
}
