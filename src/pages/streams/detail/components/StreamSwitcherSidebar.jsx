import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export function StreamSwitcherSidebar({ streams, currentStreamName, currentSearch = '' }) {
  const [query, setQuery] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [regexError, setRegexError] = useState('')
  const [appliedFilter, setAppliedFilter] = useState({ query: '', useRegex: false })

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setRegexError('')
      setAppliedFilter({ query: '', useRegex })
      return
    }

    if (!useRegex) {
      setRegexError('')
      setAppliedFilter({ query: trimmed, useRegex: false })
      return
    }

    try {
      new RegExp(trimmed, 'i')
      setRegexError('')
      setAppliedFilter({ query: trimmed, useRegex: true })
    } catch {
      // Keep previously applied valid filter while displaying an inline error.
      setRegexError('Invalid regex')
    }
  }, [query, useRegex])

  const sortedStreams = useMemo(
    () => [...streams].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [streams]
  )

  const filteredStreams = useMemo(() => {
    const activeQuery = appliedFilter.query
    if (!activeQuery) return sortedStreams

    if (appliedFilter.useRegex) {
      const re = new RegExp(activeQuery, 'i')
      return sortedStreams.filter((stream) => re.test(stream.name ?? ''))
    }

    const q = activeQuery.toLowerCase()
    return sortedStreams.filter((stream) => (stream.name ?? '').toLowerCase().includes(q))
  }, [sortedStreams, appliedFilter])

  return (
    <aside className="w-full shrink-0 space-y-3 border-b border-border lg:w-72 lg:self-stretch lg:border-b-0 lg:border-r">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Data
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {filteredStreams.length} of {sortedStreams.length} items shown
        </p>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter data..."
          className="input-enterprise h-9 w-full px-2.5 py-1.5 text-sm"
        />
        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(event) => setUseRegex(event.target.checked)}
            className="accent-foreground"
          />
          Regex
        </label>
        {regexError ? <p className="text-xs text-foreground">{regexError}</p> : null}
      </div>

      <div className="max-h-[calc(100vh-16rem)] space-y-1 overflow-y-auto pr-1">
        {filteredStreams.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
            No items match the current filter.
          </p>
        ) : (
          filteredStreams.map((stream) => {
            const isActive = stream.name === currentStreamName
            return (
              <Link
                key={`${stream.account ?? 'default'}-${stream.name}`}
                to={{
                  pathname: `/streams/${encodeURIComponent(stream.name ?? '')}`,
                  search: currentSearch,
                }}
                className={`block rounded-md border px-2.5 py-2 text-sm transition-colors ${
                  isActive
                    ? 'border-foreground/30 bg-foreground/10 text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <p className="truncate font-mono">{stream.name}</p>
                {/* {stream.account ? (
                  <p className="truncate text-[11px] text-muted-foreground">{stream.account}</p>
                ) : null} */}
              </Link>
            )
          })
        )}
      </div>
    </aside>
  )
}
