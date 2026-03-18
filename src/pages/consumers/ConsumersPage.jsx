import { useState, useMemo } from 'react'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { usePagination } from '../../hooks/usePagination'
import { AlertBanner } from '../../components/AlertBanner'
import { RefreshSelector } from '../../components/RefreshSelector'
import { SortableTh } from '../../components/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function PaginationBar({ page, totalPages, totalItems, pageSize, onPage, onPageSize }) {
  const PAGE_SIZES = [25, 50, 100]
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
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="p-1 rounded hover:bg-nats-border disabled:opacity-30 transition-colors">
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-nats-accent text-nats-bg' : 'hover:bg-nats-border text-gray-400'}`}
            >
              {p}
            </button>
          )
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="p-1 rounded hover:bg-nats-border disabled:opacity-30 transition-colors">
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

export function ConsumersPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const { data, error, lastFetch } = useNatsPolling('/jsz?accounts=true&streams=true&consumers=true&config=true', refreshInterval)

  // ── Filter state ──
  const [search, setSearch] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [regexError, setRegexError] = useState('')
  const [filterStream, setFilterStream] = useState('all')

  const consumers = useMemo(() => {
    const list = []
    if (data) {
      for (const acc of data.account_details ?? []) {
        for (const sd of acc.stream_detail ?? []) {
          for (const c of sd.consumer_detail ?? []) {
            list.push({ ...c, stream: sd.name })
          }
        }
      }
    }
    return list
  }, [data])

  const streamNames = useMemo(() => {
    const names = [...new Set(consumers.map(c => c.stream))].sort()
    return names
  }, [consumers])

  const filtered = useMemo(() => {
    setRegexError('')
    let list = consumers
    if (search.trim()) {
      if (useRegex) {
        try {
          const re = new RegExp(search, 'i')
          list = list.filter(c => re.test(c.name) || re.test(c.stream))
        } catch {
          setRegexError('Invalid regex')
          return list
        }
      } else {
        const q = search.toLowerCase()
        list = list.filter(c =>
          c.name.toLowerCase().includes(q) || c.stream.toLowerCase().includes(q)
        )
      }
    }
    if (filterStream !== 'all') list = list.filter(c => c.stream === filterStream)
    return list
  }, [consumers, search, useRegex, filterStream])

  const { sortedData: sortedConsumers, sortBy, sortDir, handleSort } = useTableSort(filtered, {
    defaultSortBy: 'stream',
    getSortValue: (c, key) => {
      if (key === 'stream')       return c.stream ?? ''
      if (key === 'consumer')     return c.name ?? ''
      if (key === 'ack_policy')   return c.config?.ack_policy ?? ''
      if (key === 'deliver_policy') return c.config?.deliver_policy ?? ''
      if (key === 'pending')      return c.num_pending ?? 0
      if (key === 'ack_pending')  return c.num_ack_pending ?? 0
      if (key === 'redelivered')  return c.num_redelivered ?? 0
      if (key === 'num_waiting')  return c.num_waiting ?? 0
      return ''
    },
  })

  const { pagedData, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(sortedConsumers, 25)

  const lagging = consumers.filter(c => (c.num_pending ?? 0) > 1000 || (c.num_ack_pending ?? 0) > 0)

  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-nats-text-secondary uppercase tracking-wide">
          {consumers.length} Consumer{consumers.length !== 1 ? 's' : ''}
        </h2>
        <RefreshSelector interval={refreshInterval} onChange={setRefreshInterval} lastFetch={lastFetch} />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-1 min-w-[200px] items-center gap-1 bg-nats-card border border-nats-border rounded px-3 py-2">
          <input
            type="text"
            placeholder="Filter by consumer or stream name…"
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

        {streamNames.length > 1 && (
          <select
            value={filterStream}
            onChange={e => { setFilterStream(e.target.value); setPage(1) }}
            className="bg-nats-card border border-nats-border rounded px-3 py-2 text-sm text-gray-300"
          >
            <option value="all">All Streams</option>
            {streamNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}

        {(search || filterStream !== 'all') && (
          <span className="text-xs text-gray-500">
            {totalItems} of {consumers.length} shown
          </span>
        )}
      </div>

      {lagging.length > 0 && (
        <AlertBanner variant="warn" title="Consumers with lag or unacked messages">
          {lagging.length} consumer(s) need attention.
        </AlertBanner>
      )}

      <div className="rounded-lg border border-nats-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-nats-card border-b border-nats-border">
            <tr>
              <SortableTh sortKey="stream" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Stream</SortableTh>
              <SortableTh sortKey="consumer" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Consumer</SortableTh>
              <SortableTh sortKey="ack_policy" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Ack Policy</SortableTh>
              <SortableTh sortKey="deliver_policy" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Deliver Policy</SortableTh>
              <SortableTh sortKey="pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Pending</SortableTh>
              <SortableTh sortKey="ack_pending" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Ack Pending</SortableTh>
              <SortableTh sortKey="redelivered" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Redelivered</SortableTh>
              <SortableTh sortKey="num_waiting" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Waiting</SortableTh>
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  {consumers.length === 0 ? 'No consumers found.' : 'No consumers match the current filter.'}
                </td>
              </tr>
            ) : pagedData.map((c) => (
              <tr key={`${c.stream}-${c.name}`} className="border-b border-nats-border hover:bg-nats-border/30">
                <td className="p-3 font-mono text-gray-300">{c.stream}</td>
                <td className="p-3 font-mono font-medium text-nats-accent">{c.name}</td>
                <td className="p-3 text-xs text-gray-400">{c.config?.ack_policy ?? '—'}</td>
                <td className="p-3 text-xs text-gray-400">{c.config?.deliver_policy ?? '—'}</td>
                <td className={`p-3 font-mono ${(c.num_pending ?? 0) > 1000 ? 'text-nats-error' : ''}`}>{(c.num_pending ?? 0).toLocaleString()}</td>
                <td className={`p-3 font-mono ${(c.num_ack_pending ?? 0) > 0 ? 'text-nats-error' : ''}`}>{(c.num_ack_pending ?? 0).toLocaleString()}</td>
                <td className={`p-3 font-mono ${(c.num_redelivered ?? 0) > 0 ? 'text-nats-warn' : ''}`}>{c.num_redelivered ?? 0}</td>
                <td className="p-3 font-mono text-gray-400">{c.num_waiting ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}
