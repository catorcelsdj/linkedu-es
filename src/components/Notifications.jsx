import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { notifications } from '../services/api'
import { useRealtime } from '../hooks/useRealtime'
import { UNREAD_EVENT, msgError, notificationView, timeAgo } from '../lib/format'
import Icon from './Icon'
import EmptyState from './EmptyState'

const PAGE = 20

// Bell with unread counter and a panel of notifications. Clicking one opens its message, project or team
// and marks it as read. The list and the counter update in real time (migration 006).
export default function NotificationBell({ uid }) {
  const nav = useNavigate(), { pathname } = useLocation(), headingId = useId()
  const [open, setOpen] = useState(false), [count, setCount] = useState(0)
  const [items, setItems] = useState(null), [error, setError] = useState(''), [more, setMore] = useState(false), [busy, setBusy] = useState(false)
  const [shift, setShift] = useState(0)
  const wrap = useRef(null), button = useRef(null), panel = useRef(null), version = useRef(0), active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const refreshCount = useCallback(() => {
    notifications.unread().then(n => { if (active.current) setCount(n) }).catch(() => { if (active.current) setCount(0) })
  }, [])
  const load = useCallback(async (append = false) => {
    const request = ++version.current
    setBusy(true); setError('')
    try {
      const from = append ? (items?.length || 0) : 0
      const rows = await notifications.list({ from, to: from + PAGE - 1 })
      if (!active.current || request !== version.current) return
      setItems(current => append ? [...(current || []), ...rows.filter(row => !current?.some(item => item.id === row.id))] : rows)
      setMore(rows.length === PAGE)
    } catch (err) { if (active.current && request === version.current) setError(msgError(err)) }
    finally { if (active.current && request === version.current) setBusy(false) }
  }, [items])
  const latest = useRef({ open, load })
  useEffect(() => { latest.current = { open, load } })
  const refresh = useCallback(() => { refreshCount(); if (latest.current.open) latest.current.load() }, [refreshCount])

  useEffect(() => { refreshCount() }, [pathname, refreshCount])
  useEffect(() => { window.addEventListener(UNREAD_EVENT, refresh); return () => window.removeEventListener(UNREAD_EVENT, refresh) }, [refresh])
  useRealtime(uid ? `notifications:${uid}` : null, [
    ['notifications', 'INSERT', `user_id=eq.${uid}`, 'onChange'],
    ['notifications', 'UPDATE', `user_id=eq.${uid}`, 'onChange'],
  ], { onChange: refresh, onSubscribed: refreshCount, onRefresh: refreshCount }, { poll: 60000 })

  const close = (focus = true) => { setOpen(false); if (focus) button.current?.focus() }
  const toggle = () => { if (open) return close(); setOpen(true); load() }
  useEffect(() => {
    if (!open) return
    const away = e => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  // Keep the panel inside the screen on narrow layouts.
  useLayoutEffect(() => {
    if (!open || !panel.current) { setShift(0); return }
    const rect = panel.current.getBoundingClientRect()
    setShift(rect.left < 12 ? 12 - rect.left : 0)
  }, [open])
  useEffect(() => { if (open) panel.current?.focus({ preventScroll: true }) }, [open])

  const go = item => {
    const view = notificationView(item)
    close(false); nav(view.to)
    if (!item.read_at) {
      setItems(current => current?.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row))
      setCount(n => Math.max(0, n - 1))
      notifications.read(item.id).catch(() => {}).finally(refreshCount)
    }
  }
  const readAll = async () => {
    setItems(current => current?.map(row => row.read_at ? row : { ...row, read_at: new Date().toISOString() })); setCount(0)
    try { await notifications.readAll() } catch (err) { setError(msgError(err)) } finally { refreshCount() }
  }
  const unread = items?.some(row => !row.read_at)

  return (
    <div ref={wrap} className="bell" onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); close() } }}
      onBlur={e => { if (open && e.relatedTarget && !wrap.current.contains(e.relatedTarget)) setOpen(false) }}>
      <button ref={button} type="button" className="icon-button" aria-expanded={open} aria-haspopup="dialog" onClick={toggle}
        aria-label={count ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}>
        <Icon name="bell" size={19} />{count > 0 && <span className="bell-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && <div ref={panel} className="bell-panel" role="dialog" aria-labelledby={headingId} tabIndex={-1} style={shift ? { right: `${-8 - shift}px` } : undefined}>
        <div className="bell-head"><h2 id={headingId} className="h2">Notificaciones</h2>{unread && <button type="button" className="link text-xs" onClick={readAll}>Marcar todas como leídas</button>}</div>
        <div className="bell-list">
          {error && <div role="alert" className="notice notice-error m-3">{error}<button type="button" className="link mt-2 block" onClick={() => load()}>Reintentar</button></div>}
          {!error && items === null && <p role="status" className="p-5 text-sm text-muted">Cargando…</p>}
          {!error && items?.length === 0 && <EmptyState compact icon="check" title="Todo al día" text="Aquí verás mensajes, solicitudes y novedades de tus proyectos." />}
          {items?.map(item => {
            const view = notificationView(item)
            return <button key={item.id} type="button" className={`bell-item ${item.read_at ? '' : 'unread'}`} onClick={() => go(item)}>
              <span className="card-icon"><Icon name={view.icon} size={17} /></span>
              <span className="bell-text"><span className="block"><b>{view.who}</b> {view.text}</span>
                {view.preview && <span className="bell-preview block">{view.preview}</span>}
                <span className="bell-time block">{timeAgo(item.created_at)}{!item.read_at && <span className="sr-only">, sin leer</span>}</span></span>
            </button>
          })}
          {more && !error && <div className="p-3 text-center"><button type="button" className="btn btn-s" disabled={busy} onClick={() => load(true)}>{busy ? 'Cargando…' : 'Ver anteriores'}</button></div>}
        </div>
      </div>}
    </div>
  )
}
