import { useState, useEffect, useCallback } from 'react'
import { useStreamMutation } from '../../../../hooks/useStreamMutation'
import { useTableSort } from '../../../../hooks/useTableSort'
import { SortableTh } from '../../../../components/ui'
import { Plus, Flame, CalendarClock, Clock, RotateCcw, X as XIcon } from 'lucide-react'

const INTERVAL_OPTIONS = [
  { label: '1 hour',  value: 3600000,   display: '1h'  },
  { label: '6 hours', value: 21600000,  display: '6h'  },
  { label: '12 hours',value: 43200000,  display: '12h' },
  { label: '1 day',   value: 86400000,  display: '24h' },
  { label: '7 days',  value: 604800000, display: '7d'  },
]

function AddScheduleForm({ streamName, onCreate, onCancel }) {
  const [type,       setType]       = useState('once')
  const [runAt,      setRunAt]      = useState('')
  const [intervalMs, setIntervalMs] = useState(INTERVAL_OPTIONS[0].value)
  const [subject,    setSubject]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    const d = new Date(Date.now() + 3600000); d.setSeconds(0, 0)
    setRunAt(d.toISOString().slice(0, 16))
  }, [])

  const handleSave = async () => {
    setError(''); setSaving(true)
    try {
      const params = { stream: streamName, type, subject: subject.trim() || undefined }
      if (type === 'once') {
        if (!runAt) throw new Error('Please pick a date and time')
        const ts = new Date(runAt)
        if (ts <= new Date()) throw new Error('Scheduled time must be in the future')
        params.runAt = ts.toISOString()
      } else {
        params.intervalMs    = intervalMs
        params.intervalLabel = INTERVAL_OPTIONS.find(o => o.value === Number(intervalMs))?.display || `${intervalMs}ms`
      }
      await onCreate(params)
    } catch (err) { setError(err.message); setSaving(false) }
  }

  return (
    <div className="rounded-lg border border-nats-accent/40 bg-nats-card p-4 space-y-4">
      <div className="text-sm font-semibold text-nats-accent">New Scheduled Purge</div>
      <div className="flex gap-2">
        {['once', 'recurring'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${type === t ? 'bg-nats-accent text-nats-bg' : 'border border-nats-border text-gray-400 hover:border-nats-accent/50'}`}>
            {t === 'once' ? 'One-time' : 'Recurring'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {type === 'once' ? (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Run at</label>
            <input type="datetime-local" value={runAt} onChange={e => setRunAt(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent" />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Repeat every</label>
            <select value={intervalMs} onChange={e => setIntervalMs(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent">
              {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Subject filter <span className="text-gray-500">(optional)</span></label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. orders.> or leave blank for all"
            className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
        </div>
      </div>
      {error && <div className="text-xs text-nats-error">{error}</div>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded bg-nats-accent text-nats-bg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Create schedule'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-nats-border text-gray-400 hover:bg-nats-border text-sm">Cancel</button>
      </div>
    </div>
  )
}

export function ScheduleTab({ streamName, purgeStream }) {
  const { listSchedules, createSchedule, deleteSchedule } = useStreamMutation()
  const [schedules,    setSchedules]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [purgeSubject, setPurgeSubject] = useState('')
  const [purging,      setPurging]      = useState(false)
  const [purgeResult,  setPurgeResult]  = useState(null)
  const [purgeError,   setPurgeError]   = useState('')

  const reload = useCallback(async () => {
    try {
      const list = await listSchedules(streamName)
      setSchedules(list); setError('')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [listSchedules, streamName])

  useEffect(() => { reload() }, [reload])

  const handlePurge = async () => {
    if (!confirm(`Purge all messages from "${streamName}"${purgeSubject ? ` matching subject "${purgeSubject}"` : ''}? This cannot be undone.`)) return
    setPurging(true); setPurgeResult(null); setPurgeError('')
    try {
      const result = await purgeStream(streamName, purgeSubject.trim() || undefined)
      setPurgeResult(result.purged ?? 0)
    } catch (err) { setPurgeError(err.message) }
    finally { setPurging(false) }
  }

  const handleCreate = async (params) => { await createSchedule(params); setShowForm(false); reload() }
  const handleDelete = async (id) => {
    if (!confirm('Cancel this scheduled purge?')) return
    try { await deleteSchedule(id); reload() }
    catch (err) { setError(err.message) }
  }

  const formatNextRun = (s) => {
    if (s.status === 'done') return 'Completed'
    if (!s.nextRun) return '—'
    const diff = new Date(s.nextRun) - Date.now()
    if (diff < 0) return 'Overdue'
    if (diff < 60000)   return `in ${Math.round(diff / 1000)}s`
    if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`
    if (diff < 86400000) return `in ${Math.round(diff / 3600000)}h`
    return new Date(s.nextRun).toLocaleString()
  }

  const { sortedData: sortedSchedules, sortBy, sortDir, handleSort } = useTableSort(schedules, {
    defaultSortBy: 'nextRun',
    getSortValue: (s, key) => {
      if (key === 'type') return s.type ?? ''
      if (key === 'subject') return s.subject ?? ''
      if (key === 'nextRun') return s.nextRun ? new Date(s.nextRun).getTime() : 0
      if (key === 'lastRun') return s.lastRun ? new Date(s.lastRun).getTime() : 0
      if (key === 'status') return s.status ?? ''
      return ''
    },
  })

  return (
    <div className="space-y-5">
      {/* Immediate purge */}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <div className="px-4 py-3 bg-nats-card border-b border-nats-border flex items-center gap-2">
          <Flame size={14} className="text-nats-error" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Purge Now</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400">Immediately delete messages from this stream. Optionally narrow by subject filter.</p>
          <div className="flex gap-2 items-center">
            <input type="text" value={purgeSubject} onChange={e => setPurgeSubject(e.target.value)} placeholder="Subject filter (optional, e.g. orders.>)"
              className="flex-1 px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
            <button onClick={handlePurge} disabled={purging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-nats-error/40 hover:bg-nats-error/20 text-nats-error text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap">
              <Flame size={13} />{purging ? 'Purging…' : 'Purge'}
            </button>
          </div>
          {purgeResult !== null && <div className="text-xs text-nats-ok">Purged {purgeResult.toLocaleString()} message{purgeResult !== 1 ? 's' : ''} successfully.</div>}
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
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-nats-border hover:border-nats-accent/50 text-gray-400 hover:text-nats-accent text-xs transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>

        {showForm && (
          <div className="p-4">
            <AddScheduleForm streamName={streamName} onCreate={handleCreate} onCancel={() => setShowForm(false)} />
          </div>
        )}
        {error && <div className="p-3 text-xs text-nats-error border-b border-nats-border">{error}</div>}

        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No scheduled purges. Click <strong>Add</strong> to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-nats-card/60 border-b border-nats-border">
              <tr>
                <SortableTh sortKey="type" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Type</SortableTh>
                <SortableTh sortKey="subject" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subject Filter</SortableTh>
                <SortableTh sortKey="nextRun" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Next Run</SortableTh>
                <SortableTh sortKey="lastRun" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Last Run</SortableTh>
                <SortableTh sortKey="status" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Status</SortableTh>
                <th className="text-left p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {sortedSchedules.map(s => (
                <tr key={s.id} className="border-b border-nats-border hover:bg-nats-border/20">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {s.type === 'recurring' ? <RotateCcw size={12} className="text-nats-accent" /> : <Clock size={12} className="text-gray-400" />}
                      <span className="text-xs font-medium">{s.type === 'recurring' ? `Every ${s.intervalLabel}` : 'One-time'}</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-300">{s.subject || <span className="text-gray-500">all messages</span>}</td>
                  <td className="p-3 text-xs">{formatNextRun(s)}</td>
                  <td className="p-3 text-xs text-gray-400">{s.lastRun ? new Date(s.lastRun).toLocaleString() : '—'}</td>
                  <td className="p-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      s.status === 'done'    ? 'bg-gray-700 text-gray-400' :
                      s.status === 'error'   ? 'bg-nats-error/20 text-nats-error' :
                      s.status === 'running' ? 'bg-nats-warn/20 text-nats-warn' :
                      'bg-nats-ok/20 text-nats-ok'
                    }`}>{s.status}</span>
                    {s.error && <div className="text-xs text-nats-error mt-0.5">{s.error}</div>}
                  </td>
                  <td className="p-3">
                    {s.status !== 'done' && (
                      <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error transition-colors" title="Cancel schedule">
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
