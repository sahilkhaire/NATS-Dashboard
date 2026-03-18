import { useState, useMemo } from 'react'

const defaultGetSortValue = (row, key) => row[key]

/**
 * Hook for sortable table data.
 * @param {Array} data - Raw data array
 * @param {Object} options - { defaultSortBy, defaultSortDir: 'asc'|'desc', getSortValue(row, key) }
 * @returns {{ sortedData, sortBy, sortDir, handleSort }}
 */
export function useTableSort(data, options = {}) {
  const {
    defaultSortBy = null,
    defaultSortDir = 'asc',
    getSortValue = defaultGetSortValue,
  } = options

  const [sortBy, setSortBy] = useState(defaultSortBy)
  const [sortDir, setSortDir] = useState(defaultSortDir)

  const handleSort = (key) => {
    setSortBy(key)
    setSortDir(prev => (sortBy === key && prev === 'asc' ? 'desc' : 'asc'))
  }

  const sortedData = useMemo(() => {
    if (!data || !Array.isArray(data) || !sortBy) return data ?? []
    const arr = [...data]
    arr.sort((a, b) => {
      const av = getSortValue(a, sortBy)
      const bv = getSortValue(b, sortBy)
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [data, sortBy, sortDir])

  return { sortedData, sortBy, sortDir, handleSort }
}
