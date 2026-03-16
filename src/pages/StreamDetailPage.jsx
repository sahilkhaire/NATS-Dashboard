import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useNatsPolling } from '../hooks/useNatsPolling'
import { useStreamMutation } from '../hooks/useStreamMutation'
import { formatBytes } from '../utils/byteFormatter'
import { AlertBanner } from '../components/AlertBanner'
import { RefreshSelector } from '../components/RefreshSelector'
import { Trash2, ChevronLeft, Pencil, Check, X as XIcon } from 'lucide-react'

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function StreamDetailPage() {
  const { name } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('properties')
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [deleteError, setDeleteError] = useState('')

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true', refreshInterval)
  const { deleteStream, updateStream } = useStreamMutation()

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
    </div>
  )
}
