import { useState, useMemo, useEffect } from 'react'

/**
 * Client-side pagination hook.
 * @param {Array} data - Full sorted/filtered data array
 * @param {number} defaultPageSize - Initial rows per page
 * @returns {{ pagedData, page, pageSize, totalPages, totalItems, setPage, setPageSize }}
 */
export function usePagination(data, defaultPageSize = 25) {
  const [page, setPageRaw] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize)

  const totalItems = data?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const setPage = (p) => {
    if (typeof p === 'function') {
      setPageRaw(prev => Math.min(Math.max(1, p(prev)), totalPages))
    } else {
      setPageRaw(Math.min(Math.max(1, p), totalPages))
    }
  }
  const setPageSize = (s) => {
    setPageSizeRaw(s)
    setPageRaw(1)
  }

  const pagedData = useMemo(() => {
    if (!data) return []
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize])

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPageRaw(1)
    }
  }, [page, totalPages])

  return { pagedData, page, pageSize, totalPages, totalItems, setPage, setPageSize }
}
