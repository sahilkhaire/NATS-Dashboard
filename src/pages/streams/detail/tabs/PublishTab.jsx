import { useState, useEffect, useCallback } from 'react'
import { useStreamMutation } from '../../../../hooks/useStreamMutation'
import { Plus, Send, Clock, AlertCircle, X as XIcon } from 'lucide-react'

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
        className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
      <input value={hdr.value} onChange={e => onChange({ ...hdr, value: e.target.value })} placeholder="Value"
        className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
      <button onClick={onRemove} className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error" title="Remove">
        <XIcon size={13} />
      </button>
    </div>
  )
}

export function PublishTab({ stream }) {
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
    if (!confirm('Cancel this scheduled message?')) return
    try { await cancelScheduledPublish(id); reloadPending() }
    catch (err) { setPublishError(err.message) }
  }

  const isScheduled = delayOption !== 0

  return (
    <div className="space-y-5">
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
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. orders.created"
                  className="flex-1 px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
              </div>
            ) : (
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. orders.created"
                className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
            )}
          </div>

          {/* Payload */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Payload <span className="text-gray-500">(text or JSON)</span></label>
            <textarea value={payload} onChange={e => setPayload(e.target.value)} rows={5}
              placeholder={'{"event":"order.created","orderId":"123"}'}
              className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono resize-y" />
            <div className="flex gap-2 mt-1">
              <button onClick={() => { try { setPayload(JSON.stringify(JSON.parse(payload), null, 2)) } catch { /* not JSON */ } }} className="text-xs text-gray-500 hover:text-nats-accent">Format JSON</button>
              <button onClick={() => setPayload('')} className="text-xs text-gray-500 hover:text-nats-error">Clear</button>
            </div>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">NATS Headers <span className="text-gray-500">(optional)</span></label>
              <button onClick={() => setHdrs(h => [...h, { key: '', value: '' }])} className="flex items-center gap-1 text-xs text-gray-500 hover:text-nats-accent">
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
              <label className="block text-xs text-gray-400 mb-1">Message TTL <span className="text-gray-500">(Nats-Msg-Ttl header, e.g. 1h, 30m)</span></label>
              <input value={msgTtl} onChange={e => setMsgTtl(e.target.value)} placeholder="e.g. 1h — message expires after this duration"
                className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Delivery</label>
            <div className="flex gap-2 flex-wrap items-center">
              <select value={delayOption} onChange={e => setDelayOption(Number(e.target.value))}
                className="px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent">
                {DELAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {delayOption === -1 && (
                <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)}
                  className="px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent" />
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
                    <td className="p-3 text-xs">{p.scheduleAt ? new Date(p.scheduleAt).toLocaleString() : '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.status === 'delivered' ? 'bg-nats-ok/20 text-nats-ok' :
                        p.status === 'error'     ? 'bg-nats-error/20 text-nats-error' :
                        p.status === 'running'   ? 'bg-nats-warn/20 text-nats-warn' :
                        'bg-nats-border text-gray-300'
                      }`}>{p.status}</span>
                      {p.error  && <div className="text-xs text-nats-error mt-0.5">{p.error}</div>}
                      {p.result && <div className="text-xs text-gray-500 mt-0.5">seq: {p.result.seq}</div>}
                    </td>
                    <td className="p-3">
                      {(p.status === 'pending' || p.status === 'running') && (
                        <button onClick={() => handleCancelPending(p.id)} className="p-1 rounded hover:bg-nats-error/20 text-gray-500 hover:text-nats-error transition-colors" title="Cancel">
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
