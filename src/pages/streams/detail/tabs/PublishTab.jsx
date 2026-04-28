import { useState, useEffect, useCallback } from 'react'
import { useStreamMutation } from '../../../../hooks/useStreamMutation'
import { useTableSort } from '../../../../hooks/useTableSort'
import { SortableTh } from '../../../../components/ui'
import { Plus, Send, Clock, AlertCircle, X as XIcon } from 'lucide-react'
import { useConfirmDialog } from '../../../../components/shared/ConfirmDialogProvider'

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
      <input value={hdr.key} onChange={e => onChange({ ...hdr, key: e.target.value })} placeholder="Header name"
        className="input-enterprise flex-1 px-2 py-1 text-xs font-mono" />
      <input value={hdr.value} onChange={e => onChange({ ...hdr, value: e.target.value })} placeholder="Value"
        className="input-enterprise flex-1 px-2 py-1 text-xs font-mono" />
      <button onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-nats-error/20 hover:text-nats-error" title="Remove">
        <XIcon size={13} />
      </button>
    </div>
  )
}

export function PublishTab({ stream }) {
  const { confirm } = useConfirmDialog()
  const { publishMessage, listScheduledPublishes, cancelScheduledPublish } = useStreamMutation()
  const subjects    = stream.config?.subjects ?? []
  const allowMsgTtl = stream.config?.allow_msg_ttl === true

  const [subject,        setSubject]        = useState(subjects[0] ?? '')
  const [payload,        setPayload]        = useState('')
  const [hdrs,           setHdrs]           = useState([])
  const [msgTtl,         setMsgTtl]         = useState('')
  const [delayOption,    setDelayOption]    = useState(0)
  const [scheduleAt,     setScheduleAt]     = useState('')
  const [publishing,     setPublishing]     = useState(false)
  const [publishResult,  setPublishResult]  = useState(null)
  const [publishError,   setPublishError]   = useState('')
  const [pending,        setPending]        = useState([])
  const [loadingPending, setLoadingPending] = useState(true)

  useEffect(() => {
    const d = new Date(Date.now() + 3600000); d.setSeconds(0, 0)
    setScheduleAt(d.toISOString().slice(0, 16))
  }, [])

  const reloadPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const list = await listScheduledPublishes(stream.name)
      setPending(list)
    } catch { /* ignore */ }
    finally { setLoadingPending(false) }
  }, [listScheduledPublishes, stream.name])

  useEffect(() => { reloadPending() }, [reloadPending])

  const handlePublish = async () => {
    setPublishError(''); setPublishResult(null)
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
    const shouldCancel = await confirm(
      'Cancel scheduled message?',
      'The message will be removed from the pending queue and will not be delivered.'
    )
    if (!shouldCancel) return
    try { await cancelScheduledPublish(id); reloadPending() }
    catch (err) { setPublishError(err.message) }
  }

  const isScheduled = delayOption !== 0

  const { sortedData: sortedPending, sortBy, sortDir, handleSort } = useTableSort(pending, {
    defaultSortBy: 'scheduleAt',
    getSortValue: (p, key) => {
      if (key === 'subject') return p.subject ?? ''
      if (key === 'payload') return p.payload ?? ''
      if (key === 'scheduleAt') return p.scheduleAt ? new Date(p.scheduleAt).getTime() : 0
      if (key === 'status') return p.status ?? ''
      return ''
    },
  })

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
          <Send size={13} className="text-nats-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compose Message</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Subject */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Subject <span className="text-nats-error">*</span></label>
            {subjects.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={subjects.includes(subject) ? subject : '__custom__'}
                  onChange={e => { if (e.target.value !== '__custom__') setSubject(e.target.value) }}
                  className="input-enterprise w-48 shrink-0"
                >
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. orders.created"
                  className="input-enterprise flex-1 font-mono" />
              </div>
            ) : (
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. orders.created"
                className="input-enterprise w-full font-mono" />
            )}
          </div>

          {/* Payload */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Payload <span className="text-muted-foreground">(text or JSON)</span></label>
            <textarea value={payload} onChange={e => setPayload(e.target.value)} rows={5}
              placeholder={'{"event":"order.created","orderId":"123"}'}
              className="input-enterprise w-full resize-y px-2 py-1.5 font-mono" />
            <div className="flex gap-2 mt-1">
              <button onClick={() => { try { setPayload(JSON.stringify(JSON.parse(payload), null, 2)) } catch { /* not JSON */ } }} className="text-xs text-muted-foreground hover:text-primary">Format JSON</button>
              <button onClick={() => setPayload('')} className="text-xs text-muted-foreground hover:text-nats-error">Clear</button>
            </div>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">NATS Headers <span className="text-muted-foreground">(optional)</span></label>
              <button onClick={() => setHdrs(h => [...h, { key: '', value: '' }])} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                <Plus size={11} /> Add header
              </button>
            </div>
            {hdrs.length > 0 && (
              <div className="space-y-2">
                {hdrs.map((h, i) => (
                  <HeaderRow key={i} hdr={h}
                    onChange={updated => setHdrs(prev => prev.map((x, j) => j === i ? updated : x))}
                    onRemove={() => setHdrs(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}
          </div>

          {allowMsgTtl && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Message TTL <span className="text-muted-foreground">(Nats-Msg-Ttl header, e.g. 1h, 30m)</span></label>
              <input value={msgTtl} onChange={e => setMsgTtl(e.target.value)} placeholder="e.g. 1h — message expires after this duration"
                className="input-enterprise w-full font-mono" />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Delivery</label>
            <div className="flex gap-2 flex-wrap items-center">
              <select value={delayOption} onChange={e => setDelayOption(Number(e.target.value))}
                className="input-enterprise px-2 py-1.5 text-sm">
                {DELAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {delayOption === -1 && (
                <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)}
                  className="input-enterprise px-2 py-1.5 text-sm" />
              )}
              {isScheduled && (
                <span className="flex items-center gap-1 text-xs text-nats-warn">
                  <Clock size={11} /> Scheduled — held server-side until delivery time
                </span>
              )}
            </div>
          </div>

          {publishError && (
            <div className="flex items-start gap-2 p-2 rounded bg-nats-error/10 border border-nats-error/30 text-nats-error text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" /> {publishError}
            </div>
          )}
          {publishResult && !publishError && (
            <div className="p-2 rounded bg-nats-ok/10 border border-nats-ok/30 text-nats-ok text-xs font-mono">
              {publishResult.scheduled
                ? `Scheduled for ${new Date(publishResult.scheduleAt).toLocaleString()} (id: ${publishResult.id})`
                : `Delivered → stream: ${publishResult.stream}, seq: ${publishResult.seq}${publishResult.duplicate ? ' (duplicate)' : ''}`}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-nats-accent text-nats-bg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              <Send size={13} />
              {publishing ? 'Sending…' : isScheduled ? 'Schedule Message' : 'Publish Now'}
            </button>
          </div>
        </div>
      </div>

      {(pending.length > 0 || !loadingPending) && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-3">
            <Clock size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduled Messages</span>
            <span className="text-xs text-muted-foreground">({pending.length})</span>
          </div>
          {loadingPending ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No pending scheduled messages.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card/60">
                <tr>
                  <SortableTh sortKey="subject" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subject</SortableTh>
                  <SortableTh sortKey="payload" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Payload preview</SortableTh>
                  <SortableTh sortKey="scheduleAt" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Deliver at</SortableTh>
                  <SortableTh sortKey="status" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Status</SortableTh>
                  <th className="w-12 p-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPending.map(p => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs text-nats-accent">{p.subject}</td>
                    <td className="max-w-[180px] truncate p-3 font-mono text-xs text-muted-foreground">
                      {p.payload ? p.payload.slice(0, 60) + (p.payload.length > 60 ? '…' : '') : <span className="text-muted-foreground">(empty)</span>}
                    </td>
                    <td className="p-3 text-xs">{p.scheduleAt ? new Date(p.scheduleAt).toLocaleString() : '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.status === 'delivered' ? 'bg-nats-ok/20 text-nats-ok' :
                        p.status === 'error'     ? 'bg-nats-error/20 text-nats-error' :
                        p.status === 'running'   ? 'bg-nats-warn/20 text-nats-warn' :
                        'bg-border text-foreground'
                      }`}>{p.status}</span>
                      {p.error  && <div className="text-xs text-nats-error mt-0.5">{p.error}</div>}
                      {p.result && <div className="mt-0.5 text-xs text-muted-foreground">seq: {p.result.seq}</div>}
                    </td>
                    <td className="p-3">
                      {(p.status === 'pending' || p.status === 'running') && (
                        <button onClick={() => handleCancelPending(p.id)} className="rounded p-1 text-muted-foreground transition-colors hover:bg-nats-error/20 hover:text-nats-error" title="Cancel">
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
