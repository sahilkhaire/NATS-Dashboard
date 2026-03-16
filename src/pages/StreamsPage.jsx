import { useState } from 'react'
import { useNatsPolling } from '../hooks/useNatsPolling'
import { useStreamMutation } from '../hooks/useStreamMutation'
import { Link, useNavigate } from 'react-router-dom'
import { formatBytes } from '../utils/byteFormatter'
import { StatusBadge } from '../components/StatusBadge'
import { AlertBanner } from '../components/AlertBanner'
import { RefreshSelector } from '../components/RefreshSelector'
import { UpdateStreamModal } from '../components/UpdateStreamModal'
import { Settings, Trash2 } from 'lucide-react'

export function StreamsPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [updateStreamName, setUpdateStreamName] = useState(null)
  const [actionError, setActionError] = useState('')
  const navigate = useNavigate()
  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true', refreshInterval)
  const { deleteStream, updateStream } = useStreamMutation()

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  const streams = []
  for (const acc of data.account_details ?? []) {
    for (const sd of acc.stream_detail ?? []) {
      streams.push({ ...sd, account: acc.name })
    }
  }

  const handleDelete = async (s, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete stream "${s.name}" and all its data? This cannot be undone.`)) return
    setActionError('')
    try {
      await deleteStream(s.name)
      refetch()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const handleUpdate = async (streamName, config) => {
    await updateStream(streamName, config)
    setUpdateStreamName(null)
    refetch()
  }

  const streamToEdit = updateStreamName ? streams.find(s => s.name === updateStreamName) : null

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-nats-text-secondary uppercase tracking-wide">
          {streams.length} Stream{streams.length !== 1 ? 's' : ''}
        </h2>
        <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
      </div>
      {actionError && (
        <div className="p-3 rounded bg-nats-error/20 border border-nats-error/50 text-nats-error text-sm">
          {actionError}
        </div>
      )}
      <div className="rounded-lg border border-nats-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Subjects</th>
              <th className="text-left p-3">Retention</th>
              <th className="text-left p-3">Storage</th>
              <th className="text-left p-3">Messages</th>
              <th className="text-left p-3">Bytes</th>
              <th className="text-left p-3">Consumers</th>
              <th className="text-left p-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {streams.map(s => (
              <tr key={`${s.account}-${s.name}`} className="border-b border-nats-border hover:bg-nats-border/50">
                <td className="p-3">
                  <Link to={`/streams/${encodeURIComponent(s.name)}`} className="text-nats-accent hover:underline font-mono">
                    {s.name}
                  </Link>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(s.config?.subjects ?? []).slice(0, 3).map((sub, i) => (
                      <span key={i} className="text-xs bg-nats-card px-1 rounded">{sub}</span>
                    ))}
                    {(s.config?.subjects?.length ?? 0) > 3 && <span className="text-nats-text-muted">+{(s.config.subjects.length - 3)}</span>}
                  </div>
                </td>
                <td className="p-3"><StatusBadge status="info">{s.config?.retention ?? '-'}</StatusBadge></td>
                <td className="p-3">{s.config?.storage ?? '-'}</td>
                <td className="p-3 font-mono font-semibold">{(s.state?.messages ?? 0).toLocaleString()}</td>
                <td className="p-3">{formatBytes(s.state?.bytes)}</td>
                <td className="p-3">{s.state?.consumer_count ?? 0}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUpdateStreamName(s.name) }}
                      className="p-1.5 rounded hover:bg-nats-border text-gray-400 hover:text-nats-accent"
                      title="Edit stream"
                    >
                      <Settings size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(s, e)}
                      className="p-1.5 rounded hover:bg-nats-error/20 text-gray-400 hover:text-nats-error"
                      title="Delete stream"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UpdateStreamModal
        open={!!updateStreamName}
        stream={updateStreamName}
        config={streamToEdit?.config}
        onClose={() => setUpdateStreamName(null)}
        onSave={handleUpdate}
      />
    </div>
  )
}
