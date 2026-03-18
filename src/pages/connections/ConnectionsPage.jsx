import { useState, useMemo, Fragment } from 'react'
import { useNatsPolling } from '../../hooks/useNatsPolling'
import { useTableSort } from '../../hooks/useTableSort'
import { AlertBanner } from '../../components/AlertBanner'
import { StatusBadge } from '../../components/StatusBadge'
import { NatsProtocolNotice } from '../../components/NatsProtocolNotice'
import { SortableTh } from '../../components/ui'
import { formatBytes } from '../../utils/byteFormatter'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function ConnectionsPage() {
  // ── All hooks first, no conditional returns until after this block ──
  const { data, error } = useNatsPolling('/connz?subs=1&state=open&limit=1000', 3000)
  const [expanded, setExpanded] = useState(new Set())
  const [search, setSearch] = useState('')

  const conns = data?.connections ?? []
  const slowConsumers = conns.filter(c => (c.pending_bytes ?? 0) > 0)

  const filtered = useMemo(() => {
    if (!search) return conns
    const s = search.toLowerCase()
    return conns.filter(c =>
      (c.ip + '').toLowerCase().includes(s) ||
      (c.name + '').toLowerCase().includes(s) ||
      (c.lang + '').toLowerCase().includes(s)
    )
  }, [conns, search])

  const { sortedData, sortBy, sortDir, handleSort } = useTableSort(filtered, {
    defaultSortBy: 'cid',
    getSortValue: (c, key) => {
      if (key === 'cid') return c.cid ?? 0
      if (key === 'name') return c.name ?? ''
      if (key === 'ip_port') return `${c.ip ?? ''}:${c.port ?? ''}`
      if (key === 'kind') return c.kind ?? ''
      if (key === 'lang') return c.lang ?? ''
      if (key === 'uptime') return c.uptime ?? ''
      if (key === 'pending_bytes') return c.pending_bytes ?? 0
      if (key === 'in_msgs') return c.in_msgs ?? 0
      if (key === 'out_msgs') return c.out_msgs ?? 0
      if (key === 'subscriptions') return c.subscriptions ?? 0
      return ''
    },
  })

  const toggleExpand = (cid) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cid)) next.delete(cid)
      else next.add(cid)
      return next
    })
  }

  // ── Conditional returns only after all hooks ──
  if (data?._unavailable) return <NatsProtocolNotice endpoint="connz" />

  if (error) {
    return (
      <div className="p-6">
        <AlertBanner variant="error" title="Cannot reach NATS server">{error}</AlertBanner>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {slowConsumers.length > 0 && (
        <AlertBanner variant="error" title="Slow Consumers Detected">
          {slowConsumers.map(c => (
            <div key={c.cid} className="mt-1">
              {c.name || c.ip}:{c.port} — {formatBytes(c.pending_bytes)} pending
            </div>
          ))}
        </AlertBanner>
      )}

      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by IP, name, language..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-nats-card border border-nats-border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-lg border border-nats-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nats-card border-b border-nats-border">
              <tr>
                <th className="w-8"></th>
                <SortableTh sortKey="cid" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>ID</SortableTh>
                <SortableTh sortKey="name" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Name</SortableTh>
                <SortableTh sortKey="ip_port" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>IP:Port</SortableTh>
                <SortableTh sortKey="kind" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Kind</SortableTh>
                <SortableTh sortKey="lang" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Lang</SortableTh>
                <SortableTh sortKey="uptime" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Uptime</SortableTh>
                <SortableTh sortKey="pending_bytes" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Pending</SortableTh>
                <SortableTh sortKey="in_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>In</SortableTh>
                <SortableTh sortKey="out_msgs" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Out</SortableTh>
                <SortableTh sortKey="subscriptions" currentSortBy={sortBy} currentSortDir={sortDir} onSort={handleSort}>Subs</SortableTh>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(c => (
                <Fragment key={c.cid}>
                  <tr
                    className="border-b border-nats-border hover:bg-nats-border/50 cursor-pointer"
                    onClick={() => toggleExpand(c.cid)}
                  >
                    <td className="p-2">{expanded.has(c.cid) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className="p-3 font-mono">{c.cid}</td>
                    <td className="p-3">{c.name || '-'}</td>
                    <td className="p-3 font-mono">{c.ip}:{c.port}</td>
                    <td className="p-3"><StatusBadge status="info">{c.kind || 'Client'}</StatusBadge></td>
                    <td className="p-3">{c.lang || '-'}</td>
                    <td className="p-3">{c.uptime || '-'}</td>
                    <td className={`p-3 font-mono ${(c.pending_bytes ?? 0) > 0 ? 'text-nats-error' : ''}`}>
                      {formatBytes(c.pending_bytes)}
                    </td>
                    <td className="p-3 font-mono">{(c.in_msgs ?? 0).toLocaleString()}</td>
                    <td className="p-3 font-mono">{(c.out_msgs ?? 0).toLocaleString()}</td>
                    <td className="p-3">{c.subscriptions ?? 0}</td>
                  </tr>
                  {expanded.has(c.cid) && c.subscriptions_list?.length > 0 && (
                    <tr key={`${c.cid}-subs`} className="bg-nats-bg">
                      <td colSpan={11} className="p-4">
                        <div className="text-xs text-nats-text-muted mb-1">Subscriptions:</div>
                        <div className="flex flex-wrap gap-1">
                          {c.subscriptions_list.map((s, i) => (
                            <span key={i} className="font-mono text-xs bg-nats-card px-2 py-1 rounded">{s}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
