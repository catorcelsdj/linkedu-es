import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMessageEvents } from '../hooks/useMessageEvents'
import { messages, people } from '../services/api'
import { UNREAD_EVENT, msgError, timeAgo } from '../lib/format'
import { isUuid, mergeMessages } from '../lib/validation'
import { Avatar, EmptyState, FormError, LoadingState, PageHead } from '../components/ui'
import Icon from '../components/Icon'
function Live({ status }) {
  return <span className="flex items-center gap-1.5 text-xs text-muted" role="status"><span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'bg-mint' : 'bg-amber-500'}`} />{status === 'live' ? 'En directo' : 'Actualización periódica'}</span>
}
function Conversation({ other, me, onChange }) {
  const [peer, setPeer] = useState(null), [thread, setThread] = useState([]), [text, setText] = useState('')
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [sendError, setSendError] = useState('')
  const [busy, setBusy] = useState(false), [older, setOlder] = useState(false), [more, setMore] = useState(false)
  const active = useRef(true), request = useRef(0), lock = useRef(false), end = useRef(null), scroll = useRef(null), oldest = useRef(null), atBottom = useRef(true), olderLock = useRef(false), box = useRef(null)
  const invalidate = useCallback(() => { active.current = false; request.current++ }, [])
  const read = useCallback(async () => {
    if (document.hidden) return
    try { await messages.markRead(me.id, other); window.dispatchEvent(new Event(UNREAD_EVENT)); if (active.current) onChange() }
    catch (err) { if (active.current) setSendError(`No se ha podido marcar la lectura. ${msgError(err)}`) }
  }, [me.id, other, onChange])
  const load = useCallback(async () => {
    if (!isUuid(other) || other === me.id) { setLoading(false); setError('Esta conversación no está disponible.'); return }
    const version = ++request.current
    try {
      const [person, rows] = await Promise.all([people.get(other), messages.thread(me.id, other)])
      if (!active.current || version !== request.current) return
      if (!person || person.role === 'alumno') throw new Error('Este perfil no admite mensajes directos.')
      setPeer(person); setThread(current => mergeMessages(current, rows)); setError('')
      if (!oldest.current) { oldest.current = rows[0] || null; setMore(rows.length === 50) }
      if (rows.some(row => row.receiver_id === me.id && !row.read_at)) read()
    } catch (err) { if (active.current && version === request.current) setError(msgError(err)) }
    finally { if (active.current && version === request.current) setLoading(false) }
  }, [me.id, other, read])
  useEffect(() => {
    active.current = true; load()
    return invalidate
  }, [load, invalidate])
  const status = useMessageEvents(isUuid(other) && other !== me.id ? me.id : null, `thread:${other}`, {
    onIncoming: row => { if (row.sender_id === other) { setThread(current => mergeMessages(current, [row])); read() } },
    onSent: row => { if (row.receiver_id === other) setThread(current => mergeMessages(current, [row])) },
    onRead: row => setThread(current => current.map(item => item.id === row.id ? { ...item, read_at: row.read_at } : item)),
    onSubscribed: load, onRefresh: load,
  })
  useEffect(() => { if (atBottom.current && !olderLock.current) end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }, [thread.length])
  const loadOlder = async () => {
    if (olderLock.current || !oldest.current) return
    olderLock.current = true; setOlder(true)
    const height = scroll.current?.scrollHeight || 0, top = scroll.current?.scrollTop || 0
    try {
      const rows = await messages.thread(me.id, other, oldest.current)
      if (!active.current) return
      setThread(current => mergeMessages(rows, current)); oldest.current = rows[0] || oldest.current; setMore(rows.length === 50)
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = top + scroll.current.scrollHeight - height; olderLock.current = false })
    } catch (err) { if (active.current) setSendError(msgError(err)); olderLock.current = false }
    finally { if (active.current) setOlder(false) }
  }
  const send = async event => {
    event.preventDefault()
    if (lock.current || !peer || !text.trim()) return
    lock.current = true; setBusy(true); setSendError('')
    try {
      const row = await messages.send(me.id, other, text.trim())
      onChange()
      if (!active.current) return
      atBottom.current = true; setThread(current => mergeMessages(current, [row])); setText(''); box.current?.focus()
    } catch (err) { if (active.current) setSendError(msgError(err)) }
    finally { lock.current = false; if (active.current) setBusy(false) }
  }
  return <section className="panel flex min-h-[32rem] min-w-0 flex-col overflow-hidden" aria-label="Conversación">
    <header className="flex items-center gap-3 border-b border-line px-5 py-4"><Link to="/mensajes" className="link text-sm md:hidden">Volver</Link>{peer && <><Avatar name={peer.full_name} role={peer.role} src={peer.avatar_url} /><div className="min-w-0 flex-1"><Link to={`/docentes/${peer.id}`} className="font-bold text-navy hover:underline">{peer.full_name}</Link><p className="text-xs text-muted">{peer.subject_area || 'Comunidad Linkedu'}</p></div></>}<div className="ml-auto"><Live status={status} /></div></header>
    {loading ? <LoadingState /> : error && !peer ? <div className="p-5"><FormError>{error}</FormError><button className="btn btn-s mt-4" onClick={load}>Reintentar</button></div> : <>
      {error && <div role="alert" className="notice notice-error m-3">{error}<button className="link ml-2" onClick={load}>Reintentar</button></div>}
      <div ref={scroll} className="flex-1 space-y-4 overflow-y-auto p-5" style={{ maxHeight: '55vh', minHeight: 260 }} onScroll={() => { const node = scroll.current; atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80 }}>
        {more && <div className="text-center"><button className="btn btn-s" disabled={older} onClick={loadOlder}>{older ? 'Cargando…' : 'Ver mensajes anteriores'}</button></div>}
        {!thread.length && <EmptyState compact icon="chat" title="Todo empieza con un hola" text="Preséntate y cuenta qué te gustaría hacer en equipo." />}
        {thread.map(row => <div key={row.id} className={`flex ${row.sender_id === me.id ? 'justify-end' : ''}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${row.sender_id === me.id ? 'rounded-br-sm bg-[#176b57] text-white' : 'rounded-bl-sm border border-line bg-slate-50'}`}><p className="whitespace-pre-wrap break-words">{row.content}</p><p className={`mt-2 text-[10px] ${row.sender_id === me.id ? 'text-[#c7e7da]' : 'text-muted'}`}>{timeAgo(row.created_at)}{row.sender_id === me.id && row.read_at && ' · Leído'}</p></div></div>)}<div ref={end} />
      </div>
      {peer && <form onSubmit={send} className="border-t border-line p-4"><label htmlFor="msg" className="sr-only">Mensaje</label><textarea ref={box} id="msg" rows={2} maxLength={2000} className="input" readOnly={busy} aria-busy={busy} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) send(event) }} placeholder="Comparte una idea…" /><FormError>{sendError}</FormError><div className="mt-3 flex items-center justify-between gap-2"><span className="text-[10px] text-muted">Ctrl / ⌘ + Intro · {text.length}/2000</span><button className="btn" disabled={busy || !text.trim()}>{busy ? 'Enviando…' : 'Enviar'}<Icon name="arrow" size={16} /></button></div></form>}
    </>}
  </section>
}
export default function Messages() {
  const { id: other } = useParams(), { profile: me } = useAuth()
  const [conversations, setConversations] = useState(null), [error, setError] = useState('')
  const active = useRef(true), request = useRef(0)
  const invalidate = useCallback(() => { active.current = false; request.current++ }, [])
  const load = useCallback(async () => {
    const version = ++request.current
    try { const rows = await messages.conversations(); if (active.current && version === request.current) { setConversations(rows); setError('') } }
    catch (err) { if (active.current && version === request.current) setError(msgError(err)) }
  }, [])
  useEffect(() => { active.current = true; load(); return invalidate }, [load, invalidate])
  const status = useMessageEvents(me.id, 'inbox', { onIncoming: load, onSent: load, onMarked: load, onSubscribed: load, onRefresh: load })
  return <><PageHead title="Conversaciones que conectan" sub="Una idea, una propuesta, un nuevo equipo. Todo empieza aquí."><Link to="/docentes" className="btn btn-s"><Icon name="plus" size={17} />Nueva conversación</Link></PageHead><div className="grid items-start gap-4 md:grid-cols-[minmax(220px,.8fr)_minmax(0,1.4fr)]">
    <section className={`panel overflow-hidden ${other ? 'hidden md:block' : ''}`} aria-label="Conversaciones"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><h2 className="h2">Tu bandeja</h2><Live status={status} /></div>{error && <div role="alert" className="notice notice-error m-3">{error}<button className="link mt-2 block" onClick={load}>Reintentar</button></div>}{conversations === null && !error && <LoadingState />}{conversations?.length === 0 && <EmptyState compact icon="chat" title="Tu primera conexión te espera" text="Encuentra a un docente y empieza a conversar." action={{ to: '/docentes', label: 'Explorar docentes' }} />}{conversations?.map(conversation => <Link key={conversation.id} to={`/mensajes/${conversation.id}`} className={`flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 hover:bg-slate-50 ${conversation.id === other ? 'bg-slate-100' : ''}`} aria-current={conversation.id === other ? 'page' : undefined}><Avatar name={conversation.person?.full_name} role={conversation.person?.role} src={conversation.person?.avatar_url} /><div className="min-w-0 flex-1"><b className="block truncate text-sm text-navy">{conversation.person?.full_name || 'Perfil no disponible'}</b><p className={`mt-1 truncate text-xs ${conversation.unread ? 'font-semibold' : 'text-muted'}`}>{conversation.last.sender_id === me.id && 'Tú: '}{conversation.last.content}</p><p className="mt-1 text-[10px] text-muted">{timeAgo(conversation.last.created_at)}</p></div>{conversation.unread > 0 && <span className="nav-count" aria-label={`${conversation.unread} sin leer`}>{conversation.unread}</span>}</Link>)}</section>
    {other ? <Conversation key={other} other={other} me={me} onChange={load} /> : <section className="panel hidden min-h-[32rem] place-items-center md:grid"><EmptyState icon="chat" title="El siguiente paso es conversar" text="Elige una conversación o encuentra a alguien en el directorio." /></section>}
  </div></>
}
