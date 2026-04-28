import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'

export function PaginationBar({ page, totalPages, totalItems, pageSize, onPage, onPageSize, pageSizes = [25, 50, 100] }) {
  const pages = []
  const radius = 2
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || (i >= page - radius && i <= page + radius)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground">
      <span>
        Showing <span className="font-medium text-foreground">{Math.min((page - 1) * pageSize + 1, totalItems)}-{Math.min(page * pageSize, totalItems)}</span> of <span className="font-medium text-foreground">{totalItems}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button onClick={() => onPage(page - 1)} disabled={page <= 1} variant="ghost" size="icon">
          <ChevronLeft size={15} />
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1">...</span>
          ) : (
            <Button key={p} onClick={() => onPage(p)} variant={p === page ? 'secondary' : 'ghost'} size="sm">
              {p}
            </Button>
          )
        )}
        <Button onClick={() => onPage(page + 1)} disabled={page >= totalPages} variant="ghost" size="icon">
          <ChevronRight size={15} />
        </Button>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          className="input-enterprise ml-1 h-8 w-auto min-w-[110px] px-2 py-1 text-xs"
        >
          {pageSizes.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
    </div>
  )
}
