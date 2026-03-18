import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useNatsPolling }    from '../../../hooks/useNatsPolling'
import { normalizeRetention } from '../../../utils/retention'
import { useStreamMutation } from '../../../hooks/useStreamMutation'
import { AlertBanner }       from '../../../components/AlertBanner'
import { RefreshSelector }   from '../../../components/RefreshSelector'
import { Trash2, ChevronLeft } from 'lucide-react'

import { PropertiesTab } from './tabs/PropertiesTab'
import { ConsumersTab }  from './tabs/ConsumersTab'
import { MessagesTab }   from './tabs/MessagesTab'
import { RelationsTab }  from './tabs/RelationsTab'
import { PublishTab }    from './tabs/PublishTab'
import { ScheduleTab }   from './tabs/ScheduleTab'

export function StreamDetailPage() {
  const { name }     = useParams()
  const navigate     = useNavigate()
  const [activeTab,        setActiveTab]        = useState('properties')
  const [refreshInterval,  setRefreshInterval]  = useState(5000)
  const [deleteError,      setDeleteError]      = useState('')

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true&config=true', refreshInterval)
  const { deleteStream, updateStream, purgeStream } = useStreamMutation()

  if (error)  return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data)  return <div className="p-6 text-gray-400">Loading...</div>

  let stream = null
  for (const acc of data.account_details ?? []) {
    for (const sd of acc.stream_detail ?? []) {
      if (sd.name === name) { stream = sd; break }
    }
    if (stream) break
  }
  if (!stream) return <div className="p-6 text-gray-400">Stream not found.</div>

  const consumers = stream.consumer_detail ?? []
  const allStreams = (data.account_details ?? []).flatMap(acc => acc.stream_detail ?? [])

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
    { id: 'consumers',  label: `Consumers${consumers.length > 0 ? ` (${consumers.length})` : ''}` },
    { id: 'messages',   label: 'Messages' },
    { id: 'relations',  label: 'Relations' },
    { id: 'publish',    label: 'Publish' },
    { id: 'schedule',   label: 'Schedule' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/streams" className="p-1.5 rounded hover:bg-nats-border text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-semibold text-nats-accent">{stream.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {stream.config?.storage ?? 'file'} · {normalizeRetention(stream.config?.retention)} · {(stream.state?.messages ?? 0).toLocaleString()} msgs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-nats-error/40 hover:bg-nats-error/20 text-nats-error text-sm transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {deleteError && <AlertBanner variant="error" title="Delete failed">{deleteError}</AlertBanner>}

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

      {activeTab === 'properties' && <PropertiesTab stream={stream} onUpdate={handleUpdate} />}
      {activeTab === 'consumers'  && <ConsumersTab  consumers={consumers} />}
      {activeTab === 'messages'   && <MessagesTab   stream={stream} />}
      {activeTab === 'relations'  && <RelationsTab  stream={stream} allStreams={allStreams} />}
      {activeTab === 'publish'    && <PublishTab    stream={stream} />}
      {activeTab === 'schedule'   && <ScheduleTab   streamName={stream.name} purgeStream={purgeStream} />}
    </div>
  )
}
