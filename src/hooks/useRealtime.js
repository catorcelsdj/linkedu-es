import { useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabaseClient'
let sequence = 0
// Subscribes to postgres_changes. `listeners` are [table, event, filter, handlerName] tuples; RLS on each table
// decides which rows reach this person. `poll` adds a fallback refresh while the tab is visible and online.
export function useRealtime(topic, listeners, handlers, { poll = 20000 } = {}) {
  const ref = useRef(handlers)
  useEffect(() => { ref.current = handlers })
  const [status, setStatus] = useState('connecting')
  const spec = JSON.stringify(listeners)
  useEffect(() => {
    if (!topic || !supabase) return
    let active = true
    setStatus('connecting')
    // removeChannel() is asynchronous. A channel with the same topic stays registered while it is leaving, and
    // supabase.channel() would return that dying instance on a quick remount (StrictMode, back-and-forth navigation),
    // leaving the new listeners attached to a closed channel. A unique topic per subscription avoids the reuse.
    const channel = supabase.channel(`${topic}:${++sequence}`)
    for (const [table, event, filter, key] of JSON.parse(spec)) {
      channel.on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, payload => {
        if (active) ref.current[key]?.(payload.new)
      })
    }
    channel.subscribe(value => {
      if (!active) return
      setStatus(value === 'SUBSCRIBED' ? 'live' : ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(value) ? 'error' : 'connecting')
      if (value === 'SUBSCRIBED') ref.current.onSubscribed?.()
    })
    const refresh = () => { if (!document.hidden && navigator.onLine) ref.current.onRefresh?.() }
    const timer = poll ? setInterval(refresh, poll) : 0
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false; clearInterval(timer)
      window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [topic, spec, poll])
  return topic ? status : 'idle'
}
