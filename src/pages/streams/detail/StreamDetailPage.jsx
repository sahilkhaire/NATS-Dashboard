import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { useNatsPolling }    from '../../../hooks/useNatsPolling'
import { useStreamTimeseries } from '../../../hooks/useStreamTimeseries'
import { normalizeRetention } from '../../../utils/retention'
import { useStreamMutation } from '../../../hooks/useStreamMutation'
import { AlertBanner }       from '../../../components/AlertBanner'
import { RefreshSelector }   from '../../../components/RefreshSelector'
import { Trash2, ChevronLeft, Ellipsis, PencilLine, CopyPlus, Copy, ChevronsDown, CircleMinus, Terminal, Code2, Eraser, Lock } from 'lucide-react'
import { useConfirmDialog } from '../../../components/shared/ConfirmDialogProvider'
import { UpdateStreamModal } from '../../../components/UpdateStreamModal'
import { Button, Input, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu'
import { useNotifications } from '../../../context/NotificationContext'

import { AnalyticsTab }  from './tabs/AnalyticsTab'
import { PropertiesTab } from './tabs/PropertiesTab'
import { ConsumersTab }  from './tabs/ConsumersTab'
import { MessagesTab }   from './tabs/MessagesTab'
import { RelationsTab }  from './tabs/RelationsTab'
import { PublishTab }    from './tabs/PublishTab'
import { ScheduleTab }   from './tabs/ScheduleTab'
import { StreamSwitcherSidebar } from './components/StreamSwitcherSidebar'

const TAB_IDS = ['analytics', 'properties', 'consumers', 'messages', 'relations', 'publish', 'schedule']

export function StreamDetailPage() {
  const { name }     = useParams()
  const navigate     = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [refreshInterval,  setRefreshInterval]  = useState(2000)
  const [menuBusy,         setMenuBusy]         = useState(false)
  const [showUpdateModal,  setShowUpdateModal]  = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [showMirrorModal, setShowMirrorModal] = useState(false)
  const [mirrorName, setMirrorName] = useState('')
  const [mirrorFilterSubject, setMirrorFilterSubject] = useState('')
  const [configPreview, setConfigPreview] = useState({ open: false, title: '', content: '' })
  const { confirm } = useConfirmDialog()
  const { notifyError, notifySuccess } = useNotifications()

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true&config=true', refreshInterval)
  const {
    deleteStream,
    updateStream,
    purgeStream,
    duplicateStream,
    createMirrorStream,
    stepDownLeader,
    removeFollowers,
    sealStream,
    getStreamCliConfig,
    getStreamTerraformConfig,
  } = useStreamMutation()
  const accountDetails = data?.account_details ?? []
  const allStreams = accountDetails.flatMap((acc) =>
    (acc.stream_detail ?? []).map((streamDetail) => ({ ...streamDetail, account: acc.name }))
  )
  const timeseriesByName = useStreamTimeseries(allStreams, { maxPoints: 90 })
  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab')
    if (tab && TAB_IDS.includes(tab)) return tab
    return 'properties'
  }, [searchParams])

  let stream = null
  for (const acc of accountDetails) {
    for (const sd of acc.stream_detail ?? []) {
      if (sd.name === name) { stream = sd; break }
    }
    if (stream) break
  }

  const streamName = stream?.name || name
  const consumers = stream?.consumer_detail ?? []
  const streamSeries = timeseriesByName.get(streamName) ?? []
  const followerCount = (stream?.cluster?.replicas || []).filter((r) => !r.current).length
  const canStepDown = Boolean(stream?.cluster?.leader)
  const canRemoveFollowers = followerCount > 0

  const setActiveTab = (tabId) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tabId)
    setSearchParams(nextParams, { replace: true })
  }

  const handleDelete = async () => {
    const shouldDelete = await confirm(
      `Delete stream "${streamName}"?`,
      'This action permanently removes the stream and all associated data.'
    )
    if (!shouldDelete) return
    try {
      await deleteStream(streamName)
      notifySuccess('Stream deleted', `"${streamName}" was deleted.`, 'stream')
      navigate('/streams')
    } catch (err) {
      notifyError('Delete failed', err.message || 'Unable to delete stream.', 'stream')
    }
  }

  const handleUpdate = async (streamName, config) => {
    try {
      await updateStream(streamName, config)
      refetch()
      notifySuccess('Stream updated', `"${streamName}" was updated.`, 'stream')
    } catch (err) {
      notifyError('Update failed', err.message || 'Unable to update stream.', 'stream')
      throw err
    }
  }

  const runAction = async (fn, okMessage, shouldRefetch = true) => {
    setMenuBusy(true)
    try {
      await fn()
      if (okMessage) notifySuccess('Action completed', okMessage, 'stream')
      if (shouldRefetch) refetch()
    } catch (err) {
      notifyError('Action failed', err.message || 'Action failed', 'stream')
    } finally {
      setMenuBusy(false)
    }
  }

  const handlePurgeFromMenu = async () => {
    const shouldPurge = await confirm(
      `Purge messages in "${streamName}"?`,
      'This removes all messages from the stream.'
    )
    if (!shouldPurge) return
    await runAction(() => purgeStream(streamName), 'Messages purged.')
  }

  const handleSeal = async () => {
    const shouldSeal = await confirm(
      `Seal stream "${streamName}"?`,
      'Sealed streams become immutable and cannot be unsealed.'
    )
    if (!shouldSeal) return
    await runAction(() => sealStream(streamName), 'Stream sealed.')
  }

  const handleStepDown = async () => {
    await runAction(() => stepDownLeader(streamName), 'Leader step-down requested.')
  }

  const handleRemoveFollowers = async () => {
    const shouldRemove = await confirm(
      `Remove follower(s) for "${streamName}"?`,
      'This removes non-leader replicas for this stream.'
    )
    if (!shouldRemove) return
    await runAction(() => removeFollowers(streamName), 'Follower removal requested.')
  }

  const handleShowCli = async () => {
    await runAction(async () => {
      const data = await getStreamCliConfig(streamName)
      setConfigPreview({ open: true, title: 'NATS CLI Config', content: data.cli || '' })
    }, '', false)
  }

  const handleShowTerraform = async () => {
    await runAction(async () => {
      const data = await getStreamTerraformConfig(streamName)
      setConfigPreview({ open: true, title: 'Terraform Config', content: data.terraform || '' })
    }, '', false)
  }

  const handleDuplicate = async () => {
    const target = duplicateName.trim()
    if (!target) {
      notifyError('Validation error', 'Duplicate stream name is required.', 'stream')
      return
    }
    await runAction(() => duplicateStream(streamName, target), `Stream duplicated as "${target}".`)
    setShowDuplicateModal(false)
    setDuplicateName('')
  }

  const handleCreateMirror = async () => {
    const target = mirrorName.trim()
    if (!target) {
      notifyError('Validation error', 'Mirror stream name is required.', 'stream')
      return
    }
    const mirror = {}
    if (mirrorFilterSubject.trim()) mirror.filter_subject = mirrorFilterSubject.trim()
    await runAction(() => createMirrorStream(streamName, target, mirror), `Mirror stream "${target}" created.`)
    setShowMirrorModal(false)
    setMirrorName('')
    setMirrorFilterSubject('')
  }

  useEffect(() => {
    if (!data || !stream) return undefined
    const onKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return
      if (e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setShowUpdateModal(true)
      } else if (e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setDuplicateName(`${streamName}-copy`)
        setShowDuplicateModal(true)
      } else if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setMirrorName(`${streamName}-mirror`)
        setShowMirrorModal(true)
      } else if (!e.metaKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        void handleStepDown()
      } else if (!e.metaKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        void handleShowCli()
      } else if (!e.metaKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        void handlePurgeFromMenu()
      } else if (!e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSeal()
      } else if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        void handleDelete()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [data, stream, streamName])

  if (error)  return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data)  return <div className="p-6 text-muted-foreground">Loading...</div>
  if (!stream) return <div className="p-6 text-muted-foreground">Stream not found.</div>

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
    <div className="-m-6 flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <StreamSwitcherSidebar
        streams={allStreams}
        currentStreamName={streamName}
        currentSearch={location.search}
      />
      <div className="min-w-0 flex-1 space-y-5 p-6">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Manage stream">
                  <Ellipsis size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Manage Stream</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setShowUpdateModal(true)} disabled={menuBusy}>
                  <PencilLine size={14} /> Edit Stream
                  <DropdownMenuShortcut>⌘ + E</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setDuplicateName(`${stream.name}-copy`); setShowDuplicateModal(true) }} disabled={menuBusy}>
                  <CopyPlus size={14} /> Duplicate Stream
                  <DropdownMenuShortcut>⌘ + D</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setMirrorName(`${stream.name}-mirror`); setShowMirrorModal(true) }} disabled={menuBusy}>
                  <Copy size={14} /> Create Mirror
                  <DropdownMenuShortcut>⌘ + ⇧ + M</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleStepDown} disabled={menuBusy || !canStepDown}>
                  <ChevronsDown size={14} /> Step Down Leader
                  <DropdownMenuShortcut>Shift + L</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleRemoveFollowers} disabled={menuBusy || !canRemoveFollowers}>
                  <CircleMinus size={14} /> Remove Follower(s)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleShowCli} disabled={menuBusy}>
                  <Terminal size={14} /> Show NATS CLI Config
                  <DropdownMenuShortcut>Shift + F</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleShowTerraform} disabled={menuBusy}>
                  <Code2 size={14} /> Show Terraform Config
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handlePurgeFromMenu} disabled={menuBusy}>
                  <Eraser size={14} /> Purge Messages
                  <DropdownMenuShortcut>Shift + P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleSeal} disabled={menuBusy}>
                  <Lock size={14} /> Seal Stream
                  <DropdownMenuShortcut>Shift + S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDelete} disabled={menuBusy} className="text-destructive focus:text-destructive">
                  <Trash2 size={14} /> Delete Stream
                  <DropdownMenuShortcut>⌘ + Shift + D</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={handleDelete}
              variant="outline"
              className="border-nats-error/40 text-nats-error hover:bg-nats-error/20"
            >
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        </div>

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
        {activeTab === 'consumers'  && (
          <ConsumersTab
            consumers={consumers}
            lastFetch={lastFetch}
            streamName={streamName}
            refreshInterval={refreshInterval}
          />
        )}
        {activeTab === 'messages'   && <MessagesTab   stream={stream} />}
        {activeTab === 'relations'  && <RelationsTab  stream={stream} allStreams={allStreams} />}
        {activeTab === 'publish'    && <PublishTab    stream={stream} />}
        {activeTab === 'schedule'   && <ScheduleTab   streamName={stream.name} purgeStream={purgeStream} />}

        <UpdateStreamModal
          open={showUpdateModal}
          stream={stream.name}
          config={stream.config}
          onClose={() => setShowUpdateModal(false)}
          onSave={handleUpdate}
        />

        <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate Stream</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">New stream name</label>
              <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} placeholder="orders-copy" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDuplicateModal(false)}>Cancel</Button>
              <Button onClick={handleDuplicate} disabled={menuBusy}>Create Duplicate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showMirrorModal} onOpenChange={setShowMirrorModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mirror</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Mirror stream name</label>
                <Input value={mirrorName} onChange={(e) => setMirrorName(e.target.value)} placeholder="orders-mirror" />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Filter subject (optional)</label>
                <Input value={mirrorFilterSubject} onChange={(e) => setMirrorFilterSubject(e.target.value)} placeholder="orders.created" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMirrorModal(false)}>Cancel</Button>
              <Button onClick={handleCreateMirror} disabled={menuBusy}>Create Mirror</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={configPreview.open} onOpenChange={(open) => setConfigPreview((prev) => ({ ...prev, open }))}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{configPreview.title}</DialogTitle>
            </DialogHeader>
            <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-muted p-3 text-xs">{configPreview.content}</pre>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(configPreview.content || '')
                  notifySuccess('Copied', 'Configuration copied to clipboard.', 'stream')
                }}
              >
                Copy
              </Button>
              <Button onClick={() => setConfigPreview({ open: false, title: '', content: '' })}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
