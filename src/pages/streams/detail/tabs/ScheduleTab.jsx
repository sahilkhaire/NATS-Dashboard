import { useState, useEffect, useCallback } from 'react'
import { useStreamMutation } from '../../../../hooks/useStreamMutation'
import { useTableSort } from '../../../../hooks/useTableSort'
import { SortableTh } from '../../../../components/ui'
import { Plus, Flame, CalendarClock, Clock, RotateCcw, X as XIcon } from 'lucide-react'
import { useConfirmDialog } from '../../../../components/shared/ConfirmDialogProvider'

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
    <div className="space-y-4 rounded-lg border border-primary/40 bg-card p-4">
      <div className="text-sm font-semibold text-nats-accent">New Scheduled Purge</div>
      <div className="flex gap-2">
        {['once', 'recurring'].map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${type === t ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:border-primary/50'}`}>
            {t === 'once' ? 'One-time' : 'Recurring'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {type === 'once' ? (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Run at</label>
            <input type="datetime-local" value={runAt} onChange={e => setRunAt(e.target.value)}
              className="input-enterprise w-full px-2 py-1.5 text-sm" />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Repeat every</label>
            <select value={intervalMs} onChange={e => setIntervalMs(Number(e.target.value))}
              className="input-enterprise w-full px-2 py-1.5 text-sm">
              {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Subject filter <span className="text-muted-foreground">(optional)</span></label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. orders.> or leave blank for all"
            className="input-enterprise w-full px-2 py-1.5 font-mono text-sm" />
        </div>
      </div>
      {error && <div className="text-xs text-nats-error">{error}</div>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded bg-nats-accent text-nats-bg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Create schedule'}
        </button>
        <button onClick={onCancel} className="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  )
}

export function ScheduleTab({ streamName, purgeStream }) {
  const { confirm } = useConfirmDialog()
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
    const shouldPurge = await confirm(
      `Purge messages from "${streamName}"?`,
      purgeSubject
        ? `This permanently deletes messages matching subject "${purgeSubject}".`
        : 'This permanently deletes all messages in the stream.'
    )
    if (!shouldPurge) return
    setPurging(true); setPurgeResult(null); setPurgeError('')
    try {
      const result = await purgeStream(streamName, purgeSubject.trim() || undefined)
      setPurgeResult(result.purged ?? 0)
    } catch (err) { setPurgeError(err.message) }
    finally { setPurging(false) }
  }

  const handleCreate = async (params) => { await createSchedule(params); setShowForm(false); reload() }
  const handleDelete = async (id) => {
    const shouldDelete = await confirm(
      'Cancel scheduled purge?',
      'The schedule will be removed and no future purge will run from it.'
    )
    if (!shouldDelete) return
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
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
          <Flame size={14} className="text-nats-error" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purge Now</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Immediately delete messages from this stream. Optionally narrow by subject filter.</p>
          <div className="flex gap-2 items-center">
            <input type="text" value={purgeSubject} onChange={e => setPurgeSubject(e.target.value)} placeholder="Subject filter (optional, e.g. orders.>)"
              className="input-enterprise flex-1 px-2 py-1.5 font-mono text-sm" />
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
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduled Purges</span>
            {!loading && <span className="text-xs text-muted-foreground">({schedules.length})</span>}
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
            <Plus size={12} /> Add
          </button>
        </div>

        {showForm && (
          <div className="p-4">
            <AddScheduleForm streamName={streamName} onCreate={handleCreate} onCancel={() => setShowForm(false)} />
          </div>
        )}
        {error && <div className="border-b border-border p-3 text-xs text-nats-error">{error}</div>}

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No scheduled purges. Click <strong>Add</strong> to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card/60">
              <tr>
                <SortableTh sortKey="type" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Type</SortableTh>
                <SortableTh sortKey="subject" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subject Filter</SortableTh>
                <SortableTh sortKey="nextRun" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Next Run</SortableTh>
                <SortableTh sortKey="lastRun" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Last Run</SortableTh>
                <SortableTh sortKey="status" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Status</SortableTh>
                  <th className="w-16 p-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {sortedSchedules.map(s => (
                <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {s.type === 'recurring' ? <RotateCcw size={12} className="text-nats-accent" /> : <Clock size={12} className="text-muted-foreground" />}
                      <span className="text-xs font-medium">{s.type === 'recurring' ? `Every ${s.intervalLabel}` : 'One-time'}</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-foreground">{s.subject || <span className="text-muted-foreground">all messages</span>}</td>
                  <td className="p-3 text-xs">{formatNextRun(s)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{s.lastRun ? new Date(s.lastRun).toLocaleString() : '—'}</td>
                  <td className="p-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      s.status === 'done'    ? 'bg-border text-muted-foreground' :
                      s.status === 'error'   ? 'bg-nats-error/20 text-nats-error' :
                      s.status === 'running' ? 'bg-nats-warn/20 text-nats-warn' :
                      'bg-nats-ok/20 text-nats-ok'
                    }`}>{s.status}</span>
                    {s.error && <div className="text-xs text-nats-error mt-0.5">{s.error}</div>}
                  </td>
                  <td className="p-3">
                    {s.status !== 'done' && (
                      <button onClick={() => handleDelete(s.id)} className="rounded p-1 text-muted-foreground transition-colors hover:bg-nats-error/20 hover:text-nats-error" title="Cancel schedule">
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
