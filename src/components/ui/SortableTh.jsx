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

  return (
    <th
      className={`text-left p-3 cursor-pointer select-none hover:bg-nats-border/50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive ? (
          currentSortDir === 'asc' ? (
            <ChevronUp size={14} className="text-nats-accent shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-nats-accent shrink-0" />
          )
        ) : (
          <ChevronsUpDown size={14} className="text-gray-500 shrink-0 opacity-50" />
        )}
      </div>
    </th>
  )
}
