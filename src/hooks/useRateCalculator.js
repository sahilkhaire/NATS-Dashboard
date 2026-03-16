import { useState, useCallback } from 'react'

export function useRateCalculator() {
  const [prev, setPrev] = useState({ value: 0, timestamp: Date.now() })

  const getRate = useCallback((currentValue) => {
    const now = Date.now()
    const elapsed = (now - prev.timestamp) / 1000
    const rate = elapsed > 0 ? (currentValue - prev.value) / elapsed : 0
    setPrev({ value: currentValue, timestamp: now })
    return Math.max(0, Math.round(rate))
  }, [prev])

  const updatePrev = useCallback((value) => {
    setPrev({ value, timestamp: Date.now() })
  }, [])

  return { getRate, updatePrev }
}
