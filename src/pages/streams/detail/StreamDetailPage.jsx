import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useNatsPolling }    from '../../../hooks/useNatsPolling'
import { useStreamTimeseries } from '../../../hooks/useStreamTimeseries'
import { normalizeRetention } from '../../../utils/retention'
import { useStreamMutation } from '../../../hooks/useStreamMutation'
import { AlertBanner }       from '../../../components/AlertBanner'
import { RefreshSelector }   from '../../../components/RefreshSelector'
import { Trash2, ChevronLeft } from 'lucide-react'
import { useConfirmDialog } from '../../../components/shared/ConfirmDialogProvider'
import { Button } from '../../../components/ui'

import { AnalyticsTab }  from './tabs/AnalyticsTab'
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
  const { confirm } = useConfirmDialog()

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true&config=true', refreshInterval)
  const { deleteStream, updateStream, purgeStream } = useStreamMutation()
  const accountDetails = data?.account_details ?? []
  const allStreams = accountDetails.flatMap(acc => acc.stream_detail ?? [])
  const timeseriesByName = useStreamTimeseries(allStreams, { maxPoints: 90 })

  if (error)  return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data)  return <div className="p-6 text-muted-foreground">Loading...</div>

  let stream = null
  for (const acc of accountDetails) {
    for (const sd of acc.stream_detail ?? []) {
      if (sd.name === name) { stream = sd; break }
    }
    if (stream) break
  }
  if (!stream) return <div className="p-6 text-muted-foreground">Stream not found.</div>

  const consumers = stream.consumer_detail ?? []
  const streamSeries = timeseriesByName.get(stream.name) ?? []

  const handleDelete = async () => {
    const shouldDelete = await confirm(
      `Delete stream "${stream.name}"?`,
      'This action permanently removes the stream and all associated data.'
    )
    if (!shouldDelete) return
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
    { id: 'analytics', label: 'Analytics' },
    { id: 'properties', label: 'Properties' },
    { id: 'consumers',  label: `Consumers${consumers.length > 0 ? ` (${consumers.length})` : ''}` },
    { id: 'messages',   label: 'Messages' },
    { id: 'relations',  label: 'Relations' },
    { id: 'publish',    label: 'Publish' },
    { id: 'schedule',   label: 'Schedule' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/streams" className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-semibold text-nats-accent">{stream.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stream.config?.storage ?? 'file'} · {normalizeRetention(stream.config?.retention)} · {(stream.state?.messages ?? 0).toLocaleString()} msgs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
          <Button
            onClick={handleDelete}
            variant="outline"
            className="border-nats-error/40 text-nats-error hover:bg-nats-error/20"
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {deleteError && <AlertBanner variant="error" title="Delete failed">{deleteError}</AlertBanner>}

      <div className="premium-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`premium-tab-btn ${
              activeTab === tab.id
                ? 'premium-tab-btn-active'
                : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'analytics'  && <AnalyticsTab points={streamSeries} refreshInterval={refreshInterval} />}
      {activeTab === 'properties' && <PropertiesTab stream={stream} onUpdate={handleUpdate} />}
      {activeTab === 'consumers'  && <ConsumersTab  consumers={consumers} />}
      {activeTab === 'messages'   && <MessagesTab   stream={stream} />}
      {activeTab === 'relations'  && <RelationsTab  stream={stream} allStreams={allStreams} />}
      {activeTab === 'publish'    && <PublishTab    stream={stream} />}
      {activeTab === 'schedule'   && <ScheduleTab   streamName={stream.name} purgeStream={purgeStream} />}
    </div>
  )
}
