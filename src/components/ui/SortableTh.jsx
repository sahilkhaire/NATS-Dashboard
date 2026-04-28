import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

/**
 * Sortable table header. Click to sort by this column.
 * @param {string} sortKey - The key identifying this column for sorting
 * @param {string} currentSortBy - Currently active sort column key
 * @param {'asc'|'desc'} currentSortDir - Current sort direction
 * @param {function} onSort - Called with (sortKey) when header is clicked
 * @param {string} className - Additional classes for the th
 * @param {React.ReactNode} children - Header content
 */
export function SortableTh({ sortKey, currentSortBy, currentSortDir, onSort, className = '', children }) {
  const isActive = currentSortBy === sortKey
  const ariaSort = isActive ? (currentSortDir === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <th className={`p-0 text-left ${className}`} aria-sort={ariaSort}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={() => onSort(sortKey)}
      >
        {children}
        {isActive ? (
          currentSortDir === 'asc' ? (
            <ChevronUp size={14} className="text-primary shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-primary shrink-0" />
          )
        ) : (
          <ChevronsUpDown size={14} className="shrink-0 opacity-50 text-muted-foreground" />
        )}
      </button>
    </th>
  )
}
