import { useMemo, useState } from 'react'

async function parseResponse(res) {
  const raw = await res.text()
  if (!raw) return { ok: res.ok, status: res.status, data: null }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(raw) }
  } catch {
    return { ok: false, status: res.status, data: { error: `Invalid JSON response (${res.status})` } }
  }
}

function buildBody(payload) {
  const body = {}
  for (const [k, v] of Object.entries(payload || {})) {
    if (v !== '' && v != null) body[k] = v
  }
  return body
}

export function KvPage() {
  const [bucket, setBucket] = useState('')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [commandArgs, setCommandArgs] = useState('kv ls --json')
  const [server, setServer] = useState('')
  const [token, setToken] = useState('')
  const [updatesOnly, setUpdatesOnly] = useState(true)
  const [watching, setWatching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState(null)
  const [watchEvents, setWatchEvents] = useState([])
  const [watchError, setWatchError] = useState('')

  const commandList = useMemo(
    () => commandArgs.split(' ').map((p) => p.trim()).filter(Boolean),
    [commandArgs],
  )

  const run = async (url, init = {}) => {
    setLoading(true)
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
        ...init,
      })
      const parsed = await parseResponse(res)
      setOutput(parsed.data)
    } finally {
      setLoading(false)
    }
  }

  const withConn = (payload = {}) => buildBody({ ...payload, server, token })

  const runBucket = (action) => run(`/api/kv/bucket/${action}`, {
    method: 'POST',
    body: JSON.stringify(withConn({ bucket })),
  })

  const runEntry = (action) => {
    const payload = { bucket, key }
    if (action === 'put') payload.value = value
    return run(`/api/kv/entry/${action}`, {
      method: 'POST',
      body: JSON.stringify(withConn(payload)),
    })
  }

  const listBuckets = () => {
    const params = new URLSearchParams(withConn())
    return run(`/api/kv/buckets?${params.toString()}`)
  }
  const listKeys = () => {
    const params = new URLSearchParams(withConn({ bucket }))
    return run(`/api/kv/keys?${params.toString()}`)
  }
  const loadBucketInfo = () => {
    const params = new URLSearchParams(withConn())
    return run(`/api/kv/bucket/${encodeURIComponent(bucket)}?${params.toString()}`)
  }

  const runCommand = () => {
    if (!commandList.length) return
    return run('/api/kv/command', {
      method: 'POST',
      body: JSON.stringify(withConn({ args: commandList })),
    })
  }

  const startWatch = () => {
    if (!bucket || watching) return
    setWatchEvents([])
    setWatchError('')
    const params = new URLSearchParams(withConn({ bucket, key, updatesOnly: String(updatesOnly) }))
    const es = new EventSource(`/api/kv/watch?${params.toString()}`, { withCredentials: true })
    setWatching(true)

    es.onmessage = (ev) => {
      setWatchEvents((prev) => [ev.data, ...prev].slice(0, 200))
    }
    es.addEventListener('done', () => {
      setWatching(false)
      es.close()
    })
    es.onerror = () => {
      setWatchError('Watch disconnected.')
      setWatching(false)
      es.close()
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-nats-text-secondary">KV Buckets</h2>
        <p className="text-sm text-muted-foreground">Lifecycle, key operations, watch, and full command escape hatch.</p>
      </div>

      <div className="grid gap-3 rounded border border-border bg-card p-4 md:grid-cols-2">
        <input className="input-enterprise h-10" placeholder="Bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="Key (optional for bucket actions)" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="NATS server override (optional)" value={server} onChange={(e) => setServer(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="Token override (optional)" value={token} onChange={(e) => setToken(e.target.value)} />
        <textarea className="input-enterprise min-h-24 md:col-span-2" placeholder="Value for put (UTF-8)" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-enterprise" onClick={listBuckets} disabled={loading}>List Buckets</button>
        <button className="btn-enterprise" onClick={loadBucketInfo} disabled={loading || !bucket}>Bucket Info</button>
        <button className="btn-enterprise" onClick={() => runBucket('create')} disabled={loading || !bucket}>Create</button>
        <button className="btn-enterprise" onClick={() => runBucket('update')} disabled={loading || !bucket}>Update</button>
        <button className="btn-enterprise" onClick={() => runBucket('purge')} disabled={loading || !bucket}>Purge Bucket</button>
        <button className="btn-enterprise" onClick={() => runBucket('delete')} disabled={loading || !bucket}>Delete Bucket</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-enterprise" onClick={listKeys} disabled={loading || !bucket}>List Keys</button>
        <button className="btn-enterprise" onClick={() => runEntry('get')} disabled={loading || !bucket || !key}>Get</button>
        <button className="btn-enterprise" onClick={() => runEntry('put')} disabled={loading || !bucket || !key}>Put</button>
        <button className="btn-enterprise" onClick={() => runEntry('delete')} disabled={loading || !bucket || !key}>Delete</button>
        <button className="btn-enterprise" onClick={() => runEntry('purge')} disabled={loading || !bucket || !key}>Purge Key</button>
        <button className="btn-enterprise" onClick={() => runEntry('history')} disabled={loading || !bucket || !key}>History</button>
      </div>

      <div className="space-y-2 rounded border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <input id="updates-only" type="checkbox" checked={updatesOnly} onChange={(e) => setUpdatesOnly(e.target.checked)} />
          <label htmlFor="updates-only" className="text-sm text-muted-foreground">Updates only</label>
          <button className="btn-enterprise ml-auto" onClick={startWatch} disabled={watching || !bucket}>Start Watch</button>
        </div>
        {watchError && <div className="text-sm text-nats-error">{watchError}</div>}
        <pre className="max-h-64 overflow-auto rounded border border-border/70 bg-background p-3 text-xs">
          {watchEvents.length ? watchEvents.join('\n') : 'No watch events yet.'}
        </pre>
      </div>

      <div className="space-y-2 rounded border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Advanced / Full CLI coverage</div>
        <input
          className="input-enterprise h-10"
          value={commandArgs}
          onChange={(e) => setCommandArgs(e.target.value)}
          placeholder="kv ls --json"
        />
        <button className="btn-enterprise" onClick={runCommand} disabled={loading || !commandList.length}>Run KV Command</button>
      </div>

      <div className="rounded border border-border bg-card p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Response</div>
        <pre className="max-h-[30rem] overflow-auto rounded border border-border/70 bg-background p-3 text-xs">
          {output ? JSON.stringify(output, null, 2) : loading ? 'Loading...' : 'No response yet.'}
        </pre>
      </div>
    </div>
  )
}
