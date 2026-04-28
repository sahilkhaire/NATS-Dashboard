import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'

export function StreamSwitcherSidebar({ streams, currentStreamName, currentSearch = '' }) {
  const [query, setQuery] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
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
    <aside className="flex w-full shrink-0 flex-col space-y-3 border-b border-border p-6 lg:h-[calc(100vh-4rem)] lg:w-72 lg:self-stretch lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Data
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {filteredStreams.length} of {sortedStreams.length} items shown
          </p>
        </div>
        <div className="shrink-0">
          {showSearch ? (
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer select-none items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(event) => setUseRegex(event.target.checked)}
                  className="accent-foreground"
                />
                Regex
              </label>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close stream search"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Open stream search"
            >
              <Search size={14} />
            </button>
          )}
        </div>
      </div>

      {showSearch ? (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter data..."
            className="input-enterprise h-9 w-full px-2.5 py-1.5 text-sm"
          />
          {regexError ? <p className="text-xs text-foreground">{regexError}</p> : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
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
                className={`block rounded-md py-2 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-cyan-500'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
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
