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

export function ObjectPage() {
  const [bucket, setBucket] = useState('')
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [targetBucket, setTargetBucket] = useState('')
  const [targetName, setTargetName] = useState('')
  const [commandArgs, setCommandArgs] = useState('object ls --json')
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

  const runBucket = (action) => run(`/api/object/bucket/${action}`, {
    method: 'POST',
    body: JSON.stringify(withConn({ bucket })),
  })

  const listBuckets = () => {
    const params = new URLSearchParams(withConn())
    return run(`/api/object/buckets?${params.toString()}`)
  }
  const loadBucketInfo = () => {
    const params = new URLSearchParams(withConn())
    return run(`/api/object/bucket/${encodeURIComponent(bucket)}?${params.toString()}`)
  }
  const listObjects = () => {
    const params = new URLSearchParams(withConn({ bucket }))
    return run(`/api/object/list?${params.toString()}`)
  }

  const runObject = (action) => run(`/api/object/${action}`, {
    method: 'POST',
    body: JSON.stringify(withConn({ bucket, name, content, targetBucket, targetName })),
  })

  const runCommand = () => {
    if (!commandList.length) return
    return run('/api/object/command', {
      method: 'POST',
      body: JSON.stringify(withConn({ args: commandList })),
    })
  }

  const startWatch = () => {
    if (!bucket || watching) return
    setWatchEvents([])
    setWatchError('')
    const params = new URLSearchParams(withConn({ bucket, name, updatesOnly: String(updatesOnly) }))
    const es = new EventSource(`/api/object/watch?${params.toString()}`, { withCredentials: true })
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-nats-text-secondary">Object Buckets</h2>
        <p className="text-sm text-muted-foreground">Bucket lifecycle, object operations, links, watch, and full command escape hatch.</p>
      </div>

      <div className="grid gap-3 rounded border border-border bg-card p-4 md:grid-cols-2">
        <input className="input-enterprise h-10" placeholder="Bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="Object name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="Link target bucket (optional)" value={targetBucket} onChange={(e) => setTargetBucket(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="Link target object (optional)" value={targetName} onChange={(e) => setTargetName(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="NATS server override (optional)" value={server} onChange={(e) => setServer(e.target.value)} />
        <input className="input-enterprise h-10" placeholder="Token override (optional)" value={token} onChange={(e) => setToken(e.target.value)} />
        <textarea className="input-enterprise min-h-24 md:col-span-2" placeholder="Object content for put (UTF-8)" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-enterprise" onClick={listBuckets} disabled={loading}>List Buckets</button>
        <button className="btn-enterprise" onClick={loadBucketInfo} disabled={loading || !bucket}>Bucket Info</button>
        <button className="btn-enterprise" onClick={() => runBucket('create')} disabled={loading || !bucket}>Create</button>
        <button className="btn-enterprise" onClick={() => runBucket('seal')} disabled={loading || !bucket}>Seal</button>
        <button className="btn-enterprise" onClick={() => runBucket('delete')} disabled={loading || !bucket}>Delete</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-enterprise" onClick={listObjects} disabled={loading || !bucket}>List Objects</button>
        <button className="btn-enterprise" onClick={() => runObject('info')} disabled={loading || !bucket || !name}>Info</button>
        <button className="btn-enterprise" onClick={() => runObject('put')} disabled={loading || !bucket || !name}>Put</button>
        <button className="btn-enterprise" onClick={() => runObject('get')} disabled={loading || !bucket || !name}>Get</button>
        <button className="btn-enterprise" onClick={() => runObject('delete')} disabled={loading || !bucket || !name}>Delete</button>
        <button className="btn-enterprise" onClick={() => runObject('link')} disabled={loading || !bucket || !name || !targetBucket}>Link</button>
      </div>

      <div className="space-y-2 rounded border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <input id="obj-updates-only" type="checkbox" checked={updatesOnly} onChange={(e) => setUpdatesOnly(e.target.checked)} />
          <label htmlFor="obj-updates-only" className="text-sm text-muted-foreground">Updates only</label>
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
          placeholder="object ls --json"
        />
        <button className="btn-enterprise" onClick={runCommand} disabled={loading || !commandList.length}>Run Object Command</button>
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
