import { useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabaseClient'
let sequence = 0
export function useMessageEvents(uid, scope, handlers) {
  const ref = useRef(handlers)
  useEffect(() => { ref.current = handlers })
  const [status, setStatus] = useState('connecting')
  useEffect(() => {
    if (!uid || !supabase) return
    let active = true
    setStatus('connecting')
    // removeChannel() is asynchronous. A channel with the same topic stays registered while it is leaving, and
    // supabase.channel() would return that dying instance on a quick remount (StrictMode, back-and-forth navigation),
    // leaving the new listeners attached to a closed channel. A unique topic per subscription avoids the reuse.
    const channel = supabase.channel(`messages:${scope}:${uid}:${++sequence}`)
    const listen = (event, filter, key) => channel.on('postgres_changes', { event, schema: 'public', table: 'messages', filter }, payload => {
      if (active) ref.current[key]?.(payload.new)
    })
    listen('INSERT', `receiver_id=eq.${uid}`, 'onIncoming')
    listen('INSERT', `sender_id=eq.${uid}`, 'onSent')
    listen('UPDATE', `sender_id=eq.${uid}`, 'onRead')
    listen('UPDATE', `receiver_id=eq.${uid}`, 'onMarked')
    channel.subscribe(value => {
      if (!active) return
      setStatus(value === 'SUBSCRIBED' ? 'live' : ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(value) ? 'error' : 'connecting')
      if (value === 'SUBSCRIBED') ref.current.onSubscribed?.()
    })
    const refresh = () => { if (!document.hidden && navigator.onLine) ref.current.onRefresh?.() }
    // Fallback also covers projects where Realtime is temporarily unavailable.
    const timer = setInterval(refresh, 20000)
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false; clearInterval(timer)
      window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [uid, scope])
  return uid ? status : 'idle'
}
