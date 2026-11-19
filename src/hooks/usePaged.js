import { useCallback, useEffect, useRef, useState } from 'react'
import { msgError } from '../lib/format'

export function usePaged(fetchPage, deps, size = 12) {
  const [state, setState] = useState({ items: [], loading: true, more: false, error: '' })
  const data = useRef([]), offset = useRef(0), version = useRef(0), busy = useRef(false), fetchRef = useRef(fetchPage)
  const invalidate = useCallback(() => { version.current++; busy.current = false }, [])
  useEffect(() => { fetchRef.current = fetchPage })
  const load = useCallback(async (reset = false) => {
    if (busy.current && !reset) return
    const id = ++version.current
    busy.current = true
    if (reset) { data.current = []; offset.current = 0 }
    setState(s => ({ ...s, items: reset ? [] : s.items, loading: true, error: '' }))
    try {
      const rows = await fetchRef.current(reset ? 0 : offset.current, (reset ? 0 : offset.current) + size - 1)
      if (id !== version.current) return
      offset.current += rows.length
      data.current = [...new Map([...data.current, ...rows].map(row => [row.id, row])).values()]
      setState({ items: data.current, loading: false, more: rows.length === size, error: '' })
    } catch (error) { if (id === version.current) setState(s => ({ ...s, loading: false, error: msgError(error) })) }
    finally { if (id === version.current) busy.current = false }
  }, [size])
  useEffect(() => {
    load(true)
    return invalidate
  // Callers pass the filter values that define the result set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, load, invalidate])
  return { ...state, loadMore: () => load(), reload: () => load(true) }
}
export function useDebounce(value, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(timer) }, [value, ms])
  return debounced
}
