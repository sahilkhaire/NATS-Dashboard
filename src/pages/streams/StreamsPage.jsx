import { useState, useMemo } from 'react'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useStreamMutation } from '../../hooks/useStreamMutation'
import { useTableSort } from '../../hooks/useTableSort'
import { usePagination } from '../../hooks/usePagination'
import { useStreamRates } from '../../hooks/useStreamRates'
import { Link } from 'react-router-dom'
import { formatBytes } from '../../utils/byteFormatter'
import { StatusBadge } from '../../components/StatusBadge'
import { SortableTh } from '../../components/ui'
import { AlertBanner } from '../../components/AlertBanner'
import { RefreshSelector } from '../../components/RefreshSelector'
import { UpdateStreamModal } from '../../components/UpdateStreamModal'
import { Settings, Trash2, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react'

// ─── Column group config ─────────────────────────────────────────────────────
const GROUPS = [
  {
    id: 'messages',
    label: 'Messages',
    defaultVisible: true,
    cols: [
      { key: 'messages',     label: 'Total' },
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
    defaultVisible: false,
    cols: [
      { key: 'msgs_per_sec',  label: 'Msgs/s' },
      { key: 'bytes_per_sec', label: 'Bytes/s' },
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
  if (val == null || val === 0) return <span className="text-gray-600">0.0</span>
  return val >= 1 ? val.toFixed(1) : val.toFixed(2)
}

// ─── Pagination bar ──────────────────────────────────────────────────────────
function PaginationBar({ page, totalPages, totalItems, pageSize, onPage, onPageSize }) {
  const PAGE_SIZES = [25, 50, 100, 250]
  const pages = []
  const radius = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - radius && i <= page + radius)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 text-sm text-gray-400">
      <span>
        Showing <span className="text-white font-medium">{Math.min((page - 1) * pageSize + 1, totalItems)}–{Math.min(page * pageSize, totalItems)}</span> of <span className="text-white font-medium">{totalItems}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded hover:bg-nats-border disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-nats-accent text-nats-bg'
                  : 'hover:bg-nats-border text-gray-400'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-nats-border disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          className="ml-3 bg-nats-card border border-nats-border rounded px-2 py-1 text-xs text-gray-300"
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function StreamsPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [updateStreamName, setUpdateStreamName] = useState(null)
  const [actionError, setActionError] = useState('')

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

  const { data, error, lastFetch, refetch } = useNatsPolling('/jsz?accounts=true&streams=true', refreshInterval)
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
    if (filterRetention !== 'all') list = list.filter(s => (s.config?.retention ?? 'limits') === filterRetention)
    if (filterStorage !== 'all') list = list.filter(s => (s.config?.storage ?? 'file') === filterStorage)
    return list
  }, [streams, search, useRegex, filterRetention, filterStorage])

  // ── Sort ──
  const { sortedData: sortedStreams, sortBy, sortDir, handleSort } = useTableSort(filtered, {
    defaultSortBy: 'name',
    getSortValue: (s, key) => {
      if (key === 'name')         return s.name ?? ''
      if (key === 'subjects')     return (s.config?.subjects ?? []).join(',')
      if (key === 'retention')    return s.config?.retention ?? ''
      if (key === 'storage')      return s.config?.storage ?? ''
      if (key === 'messages')     return s.state?.messages ?? 0
      if (key === 'first_seq')    return s.state?.first_seq ?? 0
      if (key === 'last_seq')     return s.state?.last_seq ?? 0
      if (key === 'num_subjects') return s.state?.num_subjects ?? 0
      if (key === 'bytes')        return s.state?.bytes ?? 0
      if (key === 'consumers')    return s.state?.consumer_count ?? 0
      if (key === 'msgs_per_sec') return rates.get(s.name)?.msgsPerSec ?? 0
      if (key === 'bytes_per_sec') return rates.get(s.name)?.bytesPerSec ?? 0
      return ''
    },
  })

  // ── Pagination ──
  const { pagedData, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(sortedStreams, 25)

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

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

  // ── Visible column keys (flat list for colspan/render) ──
  const visibleGroups = GROUPS.filter(g => groupVisible[g.id])
  const visibleCols = visibleGroups.flatMap(g => g.cols)

  return (
    <div className="p-6 space-y-4">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-nats-text-secondary uppercase tracking-wide">
          {streams.length} Stream{streams.length !== 1 ? 's' : ''}
        </h2>
        <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-1 min-w-[200px] items-center gap-1 bg-nats-card border border-nats-border rounded px-3 py-2">
          <input
            type="text"
            placeholder="Filter by name…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-600"
          />
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none shrink-0 ml-2">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={e => { setUseRegex(e.target.checked); setPage(1) }}
              className="accent-nats-accent"
            />
            Regex
          </label>
        </div>
        {regexError && <span className="text-xs text-nats-error">{regexError}</span>}

        <select
          value={filterRetention}
          onChange={e => { setFilterRetention(e.target.value); setPage(1) }}
          className="bg-nats-card border border-nats-border rounded px-3 py-2 text-sm text-gray-300"
        >
          <option value="all">All Retention</option>
          <option value="limits">Limits</option>
          <option value="interest">Interest</option>
          <option value="workqueue">Workqueue</option>
        </select>

        <select
          value={filterStorage}
          onChange={e => { setFilterStorage(e.target.value); setPage(1) }}
          className="bg-nats-card border border-nats-border rounded px-3 py-2 text-sm text-gray-300"
        >
          <option value="all">All Storage</option>
          <option value="file">File</option>
          <option value="memory">Memory</option>
        </select>

        {(search || filterRetention !== 'all' || filterStorage !== 'all') && (
          <span className="text-xs text-gray-500">
            {totalItems} of {streams.length} shown
          </span>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded bg-nats-error/20 border border-nats-error/50 text-nats-error text-sm">
          {actionError}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-lg border border-nats-border overflow-x-auto">
        <table className="w-full text-sm">
          {/* ── Spanning group headers ── */}
          <thead>
            <tr className="bg-nats-bg border-b border-nats-border">
              {/* Core columns: Name + Subjects + Retention + Storage = 4, no group label */}
              <th colSpan={4} className="p-0" />

              {visibleGroups.map(g => (
                <th
                  key={g.id}
                  colSpan={g.cols.length}
                  className="px-3 py-1.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-l border-nats-border"
                >
                  {g.label}
                </th>
              ))}

              {/* Actions column */}
              <th className="p-0 border-l border-nats-border">
                {/* +/− toggle button lives here */}
                <div className="flex justify-end pr-2 py-1">
                  <div className="relative group">
                    <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-nats-border text-gray-500 hover:text-nats-accent hover:border-nats-accent/50 text-xs transition-colors">
                      <Plus size={10} /><Minus size={10} />
                    </button>
                    {/* Dropdown panel */}
                    <div className="hidden group-hover:flex group-focus-within:flex absolute right-0 top-full mt-1 z-20 flex-col bg-nats-card border border-nats-border rounded-lg shadow-xl p-2 gap-1 min-w-[160px]">
                      {GROUPS.map(g => (
                        <label key={g.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-nats-border cursor-pointer text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={!!groupVisible[g.id]}
                            onChange={() => toggleGroup(g.id)}
                            className="accent-nats-accent"
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
            <tr className="bg-nats-card border-b border-nats-border">
              {/* Core */}
              <SortableTh sortKey="name" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Name</SortableTh>
              <SortableTh sortKey="subjects" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subjects</SortableTh>
              <SortableTh sortKey="retention" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Retention</SortableTh>
              <SortableTh sortKey="storage" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Storage</SortableTh>

              {/* Dynamic group columns */}
              {visibleGroups.map((g, gi) =>
                g.cols.map((col, ci) => (
                  <SortableTh
                    key={col.key}
                    sortKey={col.key}
                    currentSortBy={sortBy}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                    className={ci === 0 ? 'border-l border-nats-border' : ''}
                  >
                    {col.label}
                  </SortableTh>
                ))
              )}

              <th className="text-left p-3 w-20 border-l border-nats-border">Actions</th>
            </tr>
          </thead>

          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={4 + visibleCols.length + 1} className="p-8 text-center text-gray-500">
                  {streams.length === 0 ? 'No streams found.' : 'No streams match the current filter.'}
                </td>
              </tr>
            ) : pagedData.map(s => {
              const r = rates.get(s.name)
              return (
                <tr key={`${s.account}-${s.name}`} className="border-b border-nats-border hover:bg-nats-border/50">
                  {/* ── Core ── */}
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
                      {(s.config?.subjects?.length ?? 0) > 3 && (
                        <span className="text-nats-text-muted">+{s.config.subjects.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3"><StatusBadge status="info">{s.config?.retention ?? 'limits'}</StatusBadge></td>
                  <td className="p-3 text-gray-300">{s.config?.storage ?? 'file'}</td>

                  {/* ── Dynamic group columns ── */}
                  {visibleGroups.map((g, gi) =>
                    g.cols.map((col, ci) => {
                      const borderClass = ci === 0 ? 'border-l border-nats-border' : ''
                      if (col.key === 'messages') return <td key={col.key} className={`p-3 font-mono font-semibold ${borderClass}`}>{(s.state?.messages ?? 0).toLocaleString()}</td>
                      if (col.key === 'first_seq') return <td key={col.key} className={`p-3 font-mono text-gray-400 ${borderClass}`}>{(s.state?.first_seq ?? 0).toLocaleString()}</td>
                      if (col.key === 'last_seq') return <td key={col.key} className={`p-3 font-mono text-gray-400 ${borderClass}`}>{(s.state?.last_seq ?? 0).toLocaleString()}</td>
                      if (col.key === 'num_subjects') return <td key={col.key} className={`p-3 font-mono ${borderClass}`}>{(s.state?.num_subjects ?? 0).toLocaleString()}</td>
                      if (col.key === 'bytes') return <td key={col.key} className={`p-3 ${borderClass}`}>{formatBytes(s.state?.bytes)}</td>
                      if (col.key === 'msgs_per_sec') return <td key={col.key} className={`p-3 font-mono ${borderClass}`}>{formatRate(r?.msgsPerSec)}</td>
                      if (col.key === 'bytes_per_sec') return <td key={col.key} className={`p-3 font-mono ${borderClass}`}>{r?.bytesPerSec != null ? formatBytes(r.bytesPerSec) + '/s' : '—'}</td>
                      if (col.key === 'consumers') return <td key={col.key} className={`p-3 ${borderClass}`}>{s.state?.consumer_count ?? 0}</td>
                      return <td key={col.key} className={`p-3 ${borderClass}`}>—</td>
                    })
                  )}

                  {/* ── Actions ── */}
                  <td className="p-3 border-l border-nats-border">
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
