import { useState, useMemo } from 'react'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useStreamMutation } from '../../hooks/useStreamMutation'
import { useTableSort } from '../../hooks/useTableSort'
import { usePagination } from '../../hooks/usePagination'
import { useStreamRates } from '../../hooks/useStreamRates'
import { useStreamTimeseries } from '../../hooks/useStreamTimeseries'
import { Link } from 'react-router-dom'
import { formatBytes } from '../../utils/byteFormatter'
import { normalizeRetention } from '../../utils/retention'
import { StatusBadge } from '../../components/StatusBadge'
import { SortableTh } from '../../components/ui'
import { AlertBanner } from '../../components/AlertBanner'
import { RefreshSelector } from '../../components/RefreshSelector'
import { UpdateStreamModal } from '../../components/UpdateStreamModal'
import { PaginationBar } from '../../components/shared/PaginationBar'
import { Button, Input } from '../../components/ui'
import { StreamSparkline } from './components/StreamSparkline'
import { Settings, Trash2, Plus, Minus } from 'lucide-react'
import { useConfirmDialog } from '../../components/shared/ConfirmDialogProvider'

// ─── Column group config ─────────────────────────────────────────────────────
const GROUPS = [
  {
    id: 'messages',
    label: 'Messages',
    defaultVisible: true,
    cols: [
      { key: 'first_seq',    label: 'First Seq' },
      { key: 'last_seq',     label: 'Last Seq' },
      { key: 'num_subjects', label: 'Subjects' },
    ],
  },
  {
    id: 'bytes',
    label: 'Bytes',
    defaultVisible: true,
    cols: [
      { key: 'bytes', label: 'Size' },
    ],
  },
  {
    id: 'rates',
    label: 'Message Rates',
    defaultVisible: true,
    cols: [
      { key: 'msgs_per_sec',  label: 'Msgs/s' },
      { key: 'bytes_per_sec', label: 'Bytes/s' },
      { key: 'traffic', label: 'Traffic' },
    ],
  },
  {
    id: 'consumers',
    label: 'Consumers',
    defaultVisible: true,
    cols: [
      { key: 'consumers', label: 'Count' },
    ],
  },
]

function loadVisibility() {
  try {
    const saved = JSON.parse(localStorage.getItem('nats-stream-col-groups') || 'null')
    if (saved && typeof saved === 'object') return saved
  } catch {}
  return Object.fromEntries(GROUPS.map(g => [g.id, g.defaultVisible]))
}

function formatRate(val) {
  if (val == null || val === 0) return <span className="text-muted-foreground">0.0</span>
  return val >= 1 ? val.toFixed(1) : val.toFixed(2)
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function StreamsPage() {
  const { confirm } = useConfirmDialog()
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [updateStreamName, setUpdateStreamName] = useState(null)
  const [actionError, setActionError] = useState('')
  const [sparklineMetric, setSparklineMetric] = useState('msgsPerSec')

  // ── Filter state ──
  const [search, setSearch] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [regexError, setRegexError] = useState('')
  const [filterRetention, setFilterRetention] = useState('all')
  const [filterStorage, setFilterStorage] = useState('all')

  // ── Column group visibility ──
  const [groupVisible, setGroupVisible] = useState(loadVisibility)

  const toggleGroup = (id) => {
    setGroupVisible(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem('nats-stream-col-groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true&config=true', refreshInterval)
  const { deleteStream, updateStream } = useStreamMutation()

  const streams = useMemo(() => {
    const list = []
    if (data) {
      for (const acc of data.account_details ?? []) {
        for (const sd of acc.stream_detail ?? []) {
          list.push({ ...sd, account: acc.name })
        }
      }
    }
    return list
  }, [data])

  const rates = useStreamRates(streams)
  const timeseriesByName = useStreamTimeseries(streams, { maxPoints: 60 })

  // ── Filter ──
  const filtered = useMemo(() => {
    setRegexError('')
    let list = streams
    if (search.trim()) {
      if (useRegex) {
        try {
          const re = new RegExp(search, 'i')
          list = list.filter(s => re.test(s.name))
        } catch (e) {
          setRegexError('Invalid regex')
          return list
        }
      } else {
        const q = search.toLowerCase()
        list = list.filter(s => s.name.toLowerCase().includes(q))
      }
    }
    if (filterRetention !== 'all') list = list.filter(s => normalizeRetention(s.config?.retention) === filterRetention)
    if (filterStorage !== 'all') list = list.filter(s => (s.config?.storage ?? 'file') === filterStorage)
    return list
  }, [streams, search, useRegex, filterRetention, filterStorage])

  // ── Sort ──
  const { sortedData: sortedStreams, sortBy, sortDir, handleSort } = useTableSort(filtered, {
    defaultSortBy: 'name',
    getSortValue: (s, key) => {
      if (key === 'name')         return s.name ?? ''
      if (key === 'subjects')     return (s.config?.subjects ?? []).join(',')
      if (key === 'retention')    return normalizeRetention(s.config?.retention)
      if (key === 'storage')      return s.config?.storage ?? ''
      if (key === 'messages')     return s.state?.messages ?? 0
      if (key === 'first_seq')    return s.state?.first_seq ?? 0
      if (key === 'last_seq')     return s.state?.last_seq ?? 0
      if (key === 'num_subjects') return s.state?.num_subjects ?? 0
      if (key === 'bytes')        return s.state?.bytes ?? 0
      if (key === 'consumers')    return s.state?.consumer_count ?? 0
      if (key === 'msgs_per_sec') return rates.get(s.name)?.msgsPerSec ?? 0
      if (key === 'bytes_per_sec') return rates.get(s.name)?.bytesPerSec ?? 0
      if (key === 'traffic') {
        const points = timeseriesByName.get(s.name) ?? []
        return points[points.length - 1]?.[sparklineMetric] ?? 0
      }
      return ''
    },
  })

  // ── Pagination ──
  const { pagedData, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(sortedStreams, 25)

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-muted-foreground">Loading...</div>

  const handleDelete = async (s, e) => {
    e.preventDefault()
    e.stopPropagation()
    const shouldDelete = await confirm(
      `Delete stream "${s.name}"?`,
      'This action permanently removes the stream and all associated data.'
    )
    if (!shouldDelete) return
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

  // ── Visible column keys (flat list for colspan/render) ──
  const visibleGroups = GROUPS.filter(g => groupVisible[g.id])
  const visibleCols = visibleGroups.flatMap(g => g.cols)

  return (
    <div className="space-y-4">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {streams.length} Stream{streams.length !== 1 ? 's' : ''}
        </h2>
        <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-1 min-w-[200px] items-center gap-1 rounded border border-border bg-card px-3 py-2">
          <Input
            type="text"
            placeholder="Filter by name…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="h-auto border-0 bg-transparent p-0 ring-0 focus-visible:ring-0"
          />
          <label className="ml-2 flex shrink-0 cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={e => { setUseRegex(e.target.checked); setPage(1) }}
              className="accent-foreground"
            />
            Regex
          </label>
        </div>
        {regexError && <span className="text-xs text-foreground">{regexError}</span>}

        <select
          value={filterRetention}
          onChange={e => { setFilterRetention(e.target.value); setPage(1) }}
          className="input-enterprise h-10 w-auto px-3 py-2"
        >
          <option value="all">All Retention</option>
          <option value="limits">Limits</option>
          <option value="interest">Interest</option>
          <option value="workqueue">Workqueue</option>
        </select>

        <select
          value={filterStorage}
          onChange={e => { setFilterStorage(e.target.value); setPage(1) }}
          className="input-enterprise h-10 w-auto px-3 py-2"
        >
          <option value="all">All Storage</option>
          <option value="file">File</option>
          <option value="memory">Memory</option>
        </select>

        {(search || filterRetention !== 'all' || filterStorage !== 'all') && (
          <span className="text-xs text-muted-foreground">
            {totalItems} of {streams.length} shown
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Traffic sparkline:</span>
          <Button
            onClick={() => setSparklineMetric('msgsPerSec')}
            variant="outline"
            size="sm"
            className={`${
              sparklineMetric === 'msgsPerSec'
                ? 'border-foreground/35 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Msg/s
          </Button>
          <Button
            onClick={() => setSparklineMetric('bytesPerSec')}
            variant="outline"
            size="sm"
            className={`${
              sparklineMetric === 'bytesPerSec'
                ? 'border-foreground/35 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bytes/s
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded border border-border bg-muted p-3 text-sm text-foreground">
          {actionError}
        </div>
      )}

      {/* ── Table ── */}
      <div className="premium-table-wrap">
        <table className="premium-table">
          {/* ── Spanning group headers ── */}
          <thead>
            <tr>
              {/* Core columns: Name + Subjects + Retention + Storage = 4, no group label */}
              <th colSpan={5} className="p-0" />

              {visibleGroups.map(g => (
                <th
                  key={g.id}
                  colSpan={g.cols.length}
                  className="border-l border-border px-3 py-1.5 text-center"
                >
                  {g.label}
                </th>
              ))}

              {/* Actions column */}
              <th className="border-l border-border p-0">
                {/* +/− toggle button lives here */}
                <div className="flex justify-end pr-2 py-1">
                  <div className="relative group">
                    <button className="flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground">
                      <Plus size={10} /><Minus size={10} />
                    </button>
                    {/* Dropdown panel */}
                    <div className="absolute right-0 top-full z-20 mt-1 hidden min-w-[160px] flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-xl group-hover:flex group-focus-within:flex">
                      {GROUPS.map(g => (
                        <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-muted/70">
                          <input
                            type="checkbox"
                            checked={!!groupVisible[g.id]}
                            onChange={() => toggleGroup(g.id)}
                            className="accent-foreground"
                          />
                          {g.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </th>
            </tr>

            {/* ── Column headers ── */}
            <tr>
              {/* Core */}
              <SortableTh
                sortKey="name"
                currentSortBy={sortBy}
                currentSortDir={sortDir}
                onSort={handleSort}
                className="sticky left-0 z-30 min-w-[240px] border-r border-border bg-card"
              >
                Name
              </SortableTh>
              <SortableTh sortKey="subjects" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subjects</SortableTh>
              <SortableTh sortKey="retention" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Retention</SortableTh>
              <SortableTh sortKey="storage" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Storage</SortableTh>
              <SortableTh sortKey="messages" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Total Msgs</SortableTh>

              {/* Dynamic group columns */}
              {visibleGroups.map((g, gi) =>
                g.cols.map((col, ci) => (
                  <SortableTh
                    key={col.key}
                    sortKey={col.key}
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                    className={ci === 0 ? 'border-l border-border' : ''}
                  >
                    {col.label}
                  </SortableTh>
                ))
              )}

              <th className="w-20 border-l border-border p-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={5 + visibleCols.length + 1} className="p-10 text-center text-muted-foreground">
                  {streams.length === 0 ? 'No streams found.' : 'No streams match the current filter.'}
                </td>
              </tr>
            ) : pagedData.map(s => {
              const r = rates.get(s.name)
              return (
                <tr key={`${s.account}-${s.name}`}>
                  {/* ── Core ── */}
                  <td className="sticky left-0 z-20 min-w-[240px] border-r border-border bg-card p-3">
                    <Link to={`/streams/${encodeURIComponent(s.name)}`} className="font-mono text-foreground hover:text-primary hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.config?.subjects?.length ?? 0) > 0 ? (
                        <>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                            {s.config.subjects[0]}
                          </span>
                          {(s.config.subjects.length ?? 0) > 1 && (
                            <span className="text-xs text-muted-foreground">+{s.config.subjects.length - 1}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3"><StatusBadge status="info">{normalizeRetention(s.config?.retention)}</StatusBadge></td>
                  <td className="p-3 text-foreground">{s.config?.storage ?? 'file'}</td>
                  <td className="p-3 font-mono font-semibold">{(s.state?.messages ?? 0).toLocaleString()}</td>

                  {/* ── Dynamic group columns ── */}
                  {visibleGroups.map((g, gi) =>
                    g.cols.map((col, ci) => {
                      const borderClass = ci === 0 ? 'border-l border-border' : ''
                      if (col.key === 'first_seq') return <td key={col.key} className={`p-3 font-mono text-muted-foreground ${borderClass}`}>{(s.state?.first_seq ?? 0).toLocaleString()}</td>
                      if (col.key === 'last_seq') return <td key={col.key} className={`p-3 font-mono text-muted-foreground ${borderClass}`}>{(s.state?.last_seq ?? 0).toLocaleString()}</td>
                      if (col.key === 'num_subjects') return <td key={col.key} className={`p-3 font-mono ${borderClass}`}>{(s.state?.num_subjects ?? 0).toLocaleString()}</td>
                      if (col.key === 'bytes') return <td key={col.key} className={`p-3 ${borderClass}`}>{formatBytes(s.state?.bytes)}</td>
                      if (col.key === 'msgs_per_sec') return <td key={col.key} className={`p-3 font-mono ${borderClass}`}>{formatRate(r?.msgsPerSec)}</td>
                      if (col.key === 'bytes_per_sec') return <td key={col.key} className={`p-3 font-mono ${borderClass}`}>{r?.bytesPerSec != null ? formatBytes(r.bytesPerSec) + '/s' : '—'}</td>
                      if (col.key === 'traffic') {
                        const points = timeseriesByName.get(s.name) ?? []
                        return (
                          <td key={col.key} className={`p-3 ${borderClass}`}>
                            <StreamSparkline points={points} metric={sparklineMetric} />
                          </td>
                        )
                      }
                      if (col.key === 'consumers') return <td key={col.key} className={`p-3 ${borderClass}`}>{s.state?.consumer_count ?? 0}</td>
                      return <td key={col.key} className={`p-3 ${borderClass}`}>—</td>
                    })
                  )}

                  {/* ── Actions ── */}
                  <td className="border-l border-border p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUpdateStreamName(s.name) }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit stream"
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(s, e)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Delete stream"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={setPageSize}
          pageSizes={[25, 50, 100, 250]}
        />
      )}

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
