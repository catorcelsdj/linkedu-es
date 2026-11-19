import { useCallback, useEffect, useRef, useState } from 'react'
import { msgError } from '../lib/format'

// Paged list with stale-while-revalidate: a new filter keeps the previous results visible (marked as
// refreshing) until the new page arrives, instead of flashing an empty skeleton on every keystroke.
export function usePaged(fetchPage, deps, size = 12) {
  const [state, setState] = useState({ items: [], loading: true, more: false, error: '', stale: false })
  const data = useRef([]), offset = useRef(0), version = useRef(0), busy = useRef(false), fetchRef = useRef(fetchPage)
  const invalidate = useCallback(() => { version.current++; busy.current = false }, [])
  useEffect(() => { fetchRef.current = fetchPage })
  const load = useCallback(async (reset = false) => {
    if (busy.current && !reset) return
    const id = ++version.current
    busy.current = true
    if (reset) { data.current = []; offset.current = 0 }
    setState(s => ({ ...s, loading: true, error: '', stale: reset && s.items.length > 0 }))
    try {
      const rows = await fetchRef.current(reset ? 0 : offset.current, (reset ? 0 : offset.current) + size - 1)
      if (id !== version.current) return
      offset.current += rows.length
      data.current = [...new Map([...data.current, ...rows].map(row => [row.id, row])).values()]
      setState({ items: data.current, loading: false, more: rows.length === size, error: '', stale: false })
    } catch (error) {
      // A failed new search must not leave the previous filter's results on screen as if they matched.
      if (id === version.current) setState(s => ({ ...s, items: reset ? [] : s.items, loading: false, stale: false, error: msgError(error) }))
    }
    finally { if (id === version.current) busy.current = false }
  }, [size])
  useEffect(() => {
    load(true)
    return invalidate
  // Callers pass the filter values that define the result set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, load, invalidate])
  // Local edits keep the scroll position and the pages already loaded.
  const remove = useCallback(id => {
    const before = data.current.length
    data.current = data.current.filter(row => row.id !== id)
    if (data.current.length < before) offset.current = Math.max(0, offset.current - 1)
    setState(s => ({ ...s, items: data.current }))
  }, [])
  const replace = useCallback(row => {
    data.current = data.current.map(item => item.id === row.id ? { ...item, ...row } : item)
    setState(s => ({ ...s, items: data.current }))
  }, [])
  return { ...state, loadMore: () => load(), reload: () => load(true), remove, replace }
}
export function useDebounce(value, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(timer) }, [value, ms])
  return debounced
}
