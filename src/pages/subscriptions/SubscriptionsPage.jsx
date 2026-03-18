import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { usePagination } from '../../hooks/usePagination'
import { MetricCard } from '../../components/MetricCard'
import { AlertBanner } from '../../components/AlertBanner'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'
import { Database, Server, Layers, Search } from 'lucide-react'

const FILTER_ALL = 'all'
const FILTER_JS = 'js'
const FILTER_SYS = 'sys'
const FILTER_APP = 'app'

function getFilterCategory(subject) {
  if (!subject) return FILTER_APP
  if (subject.startsWith('$JS')) return FILTER_JS
  if (subject.startsWith('$SYS')) return FILTER_SYS
  return FILTER_APP
}

export function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFilter = searchParams.get('filter') || FILTER_ALL
  const [filter, setFilter] = useState(urlFilter)
  const [search, setSearch] = useState('')

  const { data, error } = useNatsPolling('/subsz?subs=1&limit=2000', 5000)

  const subs = data?.subscriptions_list ?? []
  const counts = useMemo(() => {
    let js = 0, sys = 0, app = 0
    for (const s of subs) {
      const subj = s?.subject ?? ''
      if (subj.startsWith('$JS')) js++
      else if (subj.startsWith('$SYS')) sys++
      else app++
    }
    return { js, sys, app, total: subs.length }
  }, [subs])

  const filtered = useMemo(() => {
    let list = subs
    if (filter !== FILTER_ALL) {
      list = list.filter(s => getFilterCategory(s?.subject) === filter)
    }
    if (search.trim()) {
      let re = null
      try {
        re = search.includes('*') || search.includes('.')
          ? new RegExp(search.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i')
          : null
      } catch {
        re = null
      }
      const term = search.toLowerCase()
      list = list.filter(s => {
        const subj = (s?.subject ?? '').toLowerCase()
        return re ? re.test(s?.subject ?? '') : subj.includes(term)
      })
    }
    return list
  }, [subs, filter, search])

  const { sortedData, sortBy, sortDir, handleSort } = useTableSort(filtered, {
    defaultSortBy: 'subject',
    getSortValue: (s, key) => {
      if (key === 'subject') return s?.subject ?? ''
      if (key === 'account') return s?.account ?? ''
      if (key === 'cid') return s?.cid ?? 0
      if (key === 'sid') return s?.sid ?? ''
      if (key === 'msgs') return s?.msgs ?? 0
      return ''
    },
  })

  const { pagedData, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(sortedData, 25)

  const handleFilterChange = (f) => {
    setFilter(f)
    setSearchParams(f === FILTER_ALL ? {} : { filter: f })
  }

  if (data?._unavailable) return <NatsProtocolNotice endpoint="subsz" />
  if (error) return <div className="p-6"><AlertBanner variant="error" title="Error">{error}</AlertBanner></div>
  if (!data) return <div className="p-6 text-nats-text-secondary">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Subscriptions" value={(data.num_subscriptions ?? 0).toLocaleString()} />
        <MetricCard label="Cache Hit Rate" value={`${((data.cache_hit_rate ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Max Fanout" value={data.max_fanout ?? 0} />
        <MetricCard label="Avg Fanout" value={(data.avg_fanout ?? 0).toFixed(2)} />
      </div>

      {/* Category breakdown */}
      <div className="rounded-lg border border-nats-border bg-nats-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-nats-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Subscription Categories</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleFilterChange(FILTER_ALL)}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              filter === FILTER_ALL ? 'border-nats-accent bg-nats-accent/10' : 'border-nats-border hover:border-nats-border/80'
            }`}
          >
            <Layers size={18} className="text-gray-400" />
            <div>
              <div className="font-mono text-lg text-white">{counts.total}</div>
              <div className="text-xs text-gray-500">All</div>
            </div>
          </button>
          <button
            onClick={() => handleFilterChange(FILTER_JS)}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              filter === FILTER_JS ? 'border-nats-accent bg-nats-accent/10' : 'border-nats-border hover:border-nats-border/80'
            }`}
          >
            <Database size={18} className="text-nats-accent" />
            <div>
              <div className="font-mono text-lg text-white">{counts.js}</div>
              <div className="text-xs text-gray-500">JetStream ($JS.*)</div>
            </div>
          </button>
          <button
            onClick={() => handleFilterChange(FILTER_SYS)}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              filter === FILTER_SYS ? 'border-nats-accent bg-nats-accent/10' : 'border-nats-border hover:border-nats-border/80'
            }`}
          >
            <Server size={18} className="text-amber-400" />
            <div>
              <div className="font-mono text-lg text-white">{counts.sys}</div>
              <div className="text-xs text-gray-500">System ($SYS.*)</div>
            </div>
          </button>
          <button
            onClick={() => handleFilterChange(FILTER_APP)}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              filter === FILTER_APP ? 'border-nats-accent bg-nats-accent/10' : 'border-nats-border hover:border-nats-border/80'
            }`}
          >
            <Layers size={18} className="text-green-400" />
            <div>
              <div className="font-mono text-lg text-white">{counts.app}</div>
              <div className="text-xs text-gray-500">Application</div>
            </div>
          </button>
        </div>
      </div>

      {/* Search + table */}
      <div className="rounded-lg border border-nats-border bg-nats-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-nats-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search subject (regex supported)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-nats-bg border border-nats-border rounded focus:outline-none focus:border-nats-accent"
            />
          </div>
          <span className="text-xs text-gray-500">
            {filtered.length} of {counts.total} subscriptions
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-nats-border">
                <SortableTh sortKey="subject" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>
                  Subject
                </SortableTh>
                <SortableTh sortKey="account" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>
                  Account
                </SortableTh>
                <SortableTh sortKey="cid" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>
                  CID
                </SortableTh>
                <SortableTh sortKey="sid" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>
                  SID
                </SortableTh>
                <SortableTh sortKey="msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>
                  Msgs
                </SortableTh>
              </tr>
            </thead>
            <tbody>
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                    No subscriptions match the current filter.
                  </td>
                </tr>
              ) : (
                pagedData.map((s, i) => (
                  <tr key={`${s.cid}-${s.sid}-${i}`} className="border-b border-nats-border/50 hover:bg-nats-border/30">
                    <td className="p-3 font-mono text-sm text-gray-200">
                      <span className={s.subject?.startsWith('$JS') ? 'text-nats-accent' : s.subject?.startsWith('$SYS') ? 'text-amber-400' : ''}>
                        {s.subject ?? '—'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-gray-400">{s.account ?? '—'}</td>
                    <td className="p-3 font-mono text-xs text-gray-400">{s.cid ?? '—'}</td>
                    <td className="p-3 font-mono text-xs text-gray-400">{s.sid ?? '—'}</td>
                    <td className="p-3 font-mono text-xs text-gray-400">{(s.msgs ?? 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-nats-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="bg-nats-bg border border-nats-border rounded px-2 py-1 text-gray-300"
              >
                {[10, 25, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
              </span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 text-xs rounded border border-nats-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nats-border/30"
              >
                Prev
              </button>
              <span className="text-xs text-gray-400">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2 py-1 text-xs rounded border border-nats-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nats-border/30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
