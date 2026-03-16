import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useConfig } from '../../../../context/ConfigContext'
import { ChevronDown, Pause, Play, Filter, RotateCcw, Radio, History, X as XIcon } from 'lucide-react'

export function MessagesTab({ stream }) {
  const { serverUrl, authToken } = useConfig()
  const [mode,        setMode]        = useState('realtime')
  const [paused,      setPaused]      = useState(false)
  const [messages,    setMessages]    = useState([])
  const [streamMeta,  setStreamMeta]  = useState({ firstSeq: 1, lastSeq: 0 })
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [hasMore,     setHasMore]     = useState(false)
  const lastSeqRef = useRef(null)

  const [showFilters,      setShowFilters]      = useState(false)
  const [filterSubject,    setFilterSubject]    = useState('')
  const [filterStartSeq,   setFilterStartSeq]   = useState('')
  const [filterStartTime,  setFilterStartTime]  = useState('')
  const [savedFilters,     setSavedFilters]     = useState([])
  const [filterSetName,    setFilterSetName]    = useState('')
  const [expanded,         setExpanded]         = useState(new Set())

  const buildUrl = useCallback((params) => {
    const u = new URLSearchParams({ stream: stream.name, limit: '50', ...params })
    if (serverUrl)  u.set('server', serverUrl)
    if (authToken)  u.set('token',  authToken)
    return `/api/stream/messages?${u}`
  }, [stream.name, serverUrl, authToken])

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
      if (opts.afterSeq != null)  params.afterSeq   = String(opts.afterSeq)
      else if (opts.startSeq != null) params.startSeq = String(opts.startSeq)
      else if (opts.startTime)    params.startTime   = opts.startTime
      if (opts.subject)  params.subject = opts.subject
      if (opts.limit)    params.limit   = String(opts.limit)

      const res  = await fetch(buildUrl(params), { credentials: 'include' })
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

  const reload = useCallback(async () => {
    setMessages([])
    setHasMore(false)
    setExpanded(new Set())
    const subject = filterSubject.trim() || undefined
    let opts = { subject }

    if (mode === 'history') {
      if (filterStartSeq)  opts.startSeq  = Number(filterStartSeq)
      else if (filterStartTime) opts.startTime = new Date(filterStartTime).toISOString()
      else opts.startSeq = 1
    }

    const data = await loadMessages(opts)
    if (!data) return
    setMessages(data.messages || [])
    setStreamMeta({ firstSeq: data.firstSeq, lastSeq: data.lastSeq })
    setHasMore(data.hasMore ?? false)
    const lastMsg = data.messages?.[data.messages.length - 1]
    lastSeqRef.current = lastMsg?.seq ?? data.lastSeq
  }, [mode, filterSubject, filterStartSeq, filterStartTime, loadMessages])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (mode !== 'realtime' || paused) return
    const timer = setInterval(async () => {
      if (lastSeqRef.current == null) return
      const subject = filterSubject.trim() || undefined
      const res = await fetch(
        buildUrl({ afterSeq: String(lastSeqRef.current), limit: '20', ...(subject ? { subject } : {}) }),
        { credentials: 'include' }
      )
      if (!res.ok) return
      const data = await res.json()
      if (data.messages?.length > 0) {
        setMessages(prev => [...prev, ...data.messages].slice(-500))
        lastSeqRef.current = data.messages[data.messages.length - 1].seq
        setStreamMeta(prev => ({ ...prev, lastSeq: data.lastSeq }))
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [mode, paused, filterSubject, buildUrl])

  const loadMore = async () => {
    if (!hasMore || loading || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    const subject = filterSubject.trim() || undefined
    const data = await loadMessages({ afterSeq: lastMsg.seq, ...(subject ? { subject } : {}) })
    if (!data) return
    setMessages(prev => [...prev, ...(data.messages || [])])
    setHasMore(data.hasMore ?? false)
    if (data.messages?.length > 0) lastSeqRef.current = data.messages[data.messages.length - 1].seq
  }

  const saveFilterSet = () => {
    const name = filterSetName.trim()
    if (!name) return
    const newFilter = { name, subject: filterSubject, startSeq: filterStartSeq, startTime: filterStartTime }
    const updated   = [...savedFilters.filter(f => f.name !== name), newFilter]
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

  const hasActiveFilters  = filterSubject || filterStartSeq || filterStartTime
  const displayMessages   = mode === 'realtime' ? [...messages].reverse() : messages

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
              <input type="text" value={filterSubject} onChange={e => setFilterSubject(e.target.value)} placeholder="e.g. orders.> or events.*"
                className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
            </div>
            {mode === 'history' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Sequence</label>
                  <input type="number" value={filterStartSeq} onChange={e => { setFilterStartSeq(e.target.value); setFilterStartTime('') }} placeholder="e.g. 1000"
                    className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                  <input type="datetime-local" value={filterStartTime} onChange={e => { setFilterStartTime(e.target.value); setFilterStartSeq('') }}
                    className="w-full px-2 py-1.5 text-sm rounded border border-nats-border bg-nats-bg text-white focus:outline-none focus:ring-1 focus:ring-nats-accent" />
                </div>
              </>
            )}
          </div>

          {savedFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-nats-border">
              <span className="text-xs text-gray-500">Saved:</span>
              {savedFilters.map(f => (
                <div key={f.name} className="flex items-center gap-0.5">
                  <button onClick={() => applyFilter(f)} className="px-2 py-0.5 text-xs rounded-l bg-nats-border hover:bg-nats-accent/20 text-gray-300 hover:text-nats-accent transition-colors">
                    {f.name}
                  </button>
                  <button onClick={() => deleteSavedFilter(f.name)} className="px-1 py-0.5 text-xs rounded-r bg-nats-border hover:bg-nats-error/20 text-gray-500 hover:text-nats-error transition-colors">
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center pt-2 border-t border-nats-border">
            <input type="text" value={filterSetName} onChange={e => setFilterSetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveFilterSet()} placeholder="Save as filter set…"
              className="flex-1 px-2 py-1 text-xs rounded border border-nats-border bg-nats-bg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-nats-accent" />
            <button onClick={saveFilterSet} disabled={!filterSetName.trim()} className="px-2.5 py-1 text-xs rounded border border-nats-border hover:border-nats-accent/50 text-gray-400 hover:text-nats-accent transition-colors disabled:opacity-40">
              Save
            </button>
            {hasActiveFilters && (
              <button onClick={() => { setFilterSubject(''); setFilterStartSeq(''); setFilterStartTime('') }} className="px-2.5 py-1 text-xs rounded text-gray-500 hover:text-white transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {error && <div className="p-3 rounded bg-nats-error/20 border border-nats-error/50 text-nats-error text-xs">{error}</div>}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
          {streamMeta.lastSeq > 0 && ` · stream seq ${streamMeta.lastSeq.toLocaleString()}`}
        </span>
        {mode === 'realtime' && paused && (
          <span className="text-nats-warn flex items-center gap-1"><Pause size={10} /> Paused — new messages not shown</span>
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
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Loading messages…</td></tr>
            ) : displayMessages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  {mode === 'realtime' ? 'Waiting for messages… (new messages will appear here)' : 'No messages found for the given filters.'}
                </td>
              </tr>
            ) : (
              displayMessages.map(m => (
                <Fragment key={m.seq}>
                  <tr className="border-b border-nats-border hover:bg-nats-border/20 cursor-pointer" onClick={() => toggleExpand(m.seq)}>
                    <td className="px-3 py-2 font-mono text-nats-accent">{(m.seq ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{m.time ? new Date(m.time).toLocaleString() : '—'}</td>
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

      {mode === 'history' && hasMore && (
        <div className="text-center pt-1">
          <button onClick={loadMore} disabled={loading} className="px-5 py-2 rounded border border-nats-border text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50">
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
