import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { projects } from '../services/api'
import { fullDate, msgError, plural, timeAgo } from '../lib/format'
import { Avatar, EmptyState } from '../components/ui'
import { TagList } from '../components/Tags'
import { useConfirm } from '../context/ConfirmContext'
import { LoadingState } from '../components/ui'

export default function ProjectDetail() {
  const { id } = useParams(), { profile: me } = useAuth(), toast = useToast(), nav = useNavigate()
  const [p, setP] = useState(undefined), [ms, setMs] = useState([]), [posts, setPosts] = useState([])
  const [tab, setTab] = useState('actividad'), [text, setText] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [invite, setInvite] = useState(null)
  const version = useRef(0), locked = useRef(false), confirm = useConfirm()
  const invalidate = useCallback(() => { version.current++ }, [])

  const load = useCallback(async () => {
    const request = ++version.current
    setError('')
    try {
      const pr = await projects.get(id)
      if (request !== version.current) return
      if (!pr) { setP(null); return }
      const m = await projects.members(id)
      const member = pr.owner_id === me.id || m.some(x => x.user_id === me.id && x.status === 'aceptado')
      const [activity, code] = member ? await Promise.all([projects.posts(id), projects.invite(id)]) : [[], null]
      if (request !== version.current) return
      setP(pr); setMs(m); setPosts(activity); setInvite(code)
    } catch (e) { if (request === version.current) setError(msgError(e)) }
  }, [id, me.id])
  useEffect(() => { setP(undefined); setMs([]); setPosts([]); setInvite(null); setText(''); load(); return invalidate }, [load, invalidate])

  if (p === undefined) return error ? <div className="notice notice-error" role="alert">{error}<button className="btn btn-s mt-3 block" onClick={load}>Reintentar</button></div> : <LoadingState />
  if (p === null) return <div><Link to="/proyectos" className="link text-sm">Volver a proyectos</Link><h1 className="h1 mt-4">Proyecto no disponible</h1><p className="mt-2 text-muted">No existe, o es privado y no formas parte de él.</p></div>

  const mine = p.owner_id === me.id
  const mem = ms.find(x => x.user_id === me.id)
  const isMember = mine || mem?.status === 'aceptado'
  const accepted = ms.filter(x => x.status === 'aceptado'), pending = ms.filter(x => x.status === 'pendiente')
  const act = async (fn, okMsg, after) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try { await fn(); if (okMsg) toast(okMsg); if (after) await after(); else await load() } catch (e) { toast(msgError(e), 'error') } finally { locked.current = false; setBusy(false) }
  }
  const copyCode = async () => { try { await navigator.clipboard.writeText(invite); toast('Código copiado') } catch { toast('No se pudo copiar. Selecciona el código y cópialo manualmente.', 'info') } }
  const publish = e => { e.preventDefault(); if (text.trim()) act(() => projects.addPost(id, me.id, text.trim()), 'Publicado', () => { setText(''); load() }) }
  const who = m => m.profile?.role === 'docente' ? <Link to={`/docentes/${m.profile.id}`} className="font-semibold text-navy hover:underline">{m.profile.full_name}</Link> : <span className="font-semibold text-navy">{m.profile?.full_name || 'Participante'}</span>

  return (<>
    {error && <div role="alert" className="notice notice-error mb-4">{error}<button className="link ml-3" onClick={load}>Reintentar</button></div>}
    <Link to="/proyectos" className="link text-sm">Proyectos</Link>
    <header className="mb-6 mt-3 border-b border-line pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h1 className="h1">{p.title}</h1>
          <p className="mt-1 text-sm text-muted">Responsable: <Link className="hover:underline" to={`/docentes/${p.owner?.id}`}>{p.owner?.full_name}</Link>. Creado el {fullDate(p.created_at)}. {p.is_public ? 'Proyecto abierto.' : 'Proyecto privado.'}</p></div>
        <div className="flex items-center gap-3">
          {!isMember && !mem && me.role !== 'empresa' && p.is_public && <button className="btn" disabled={busy} onClick={() => act(() => projects.request(id, me.id), 'Solicitud enviada')}>Solicitar unirme</button>}
          {mem?.status === 'pendiente' && <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Solicitud pendiente de respuesta</span>}
          {isMember && !mine && <button className="danger" disabled={busy} onClick={async () => await confirm('¿Salir de este proyecto?', 'Salir del proyecto') && act(() => projects.removeMember(mem.id), 'Has salido del proyecto', () => nav('/proyectos'))}>Salir del proyecto</button>}
          {mine && <button className="danger" disabled={busy} onClick={async () => await confirm('Se borrará el proyecto y toda su actividad. Esta acción no se puede deshacer.', 'Eliminar proyecto') && act(() => projects.remove(id), 'Proyecto eliminado', () => nav('/proyectos'))}>Eliminar proyecto</button>}
        </div>
      </div>
      {p.description && <p className="mt-4 max-w-2xl whitespace-pre-wrap">{p.description}</p>}
      <TagList tags={p.tags} />
      {isMember && invite && <p className="mt-4 text-sm text-muted">Código de invitación: <span className="code text-ink">{invite}</span> <button type="button" className="link" onClick={copyCode}>Copiar</button>{mine && ' Compártelo con quien quieras que entre sin esperar aprobación.'}</p>}
    </header>

    <div role="group" aria-label="Secciones del proyecto" className="mb-4 flex gap-6 border-b border-line">
      {[['actividad', `Actividad (${posts.length})`], ['personas', `Participantes (${accepted.length})`]].map(([k, l]) => (
        <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} className={`-mb-px cursor-pointer border-b-2 pb-2 text-sm font-semibold ${tab === k ? 'border-mint text-navy' : 'border-transparent text-muted'}`}>{l}</button>))}
    </div>

    {tab === 'actividad' && (isMember ? (<>
      <form onSubmit={publish} className="panel mb-4 p-4">
        <label htmlFor="np" className="sr-only">Nueva publicación</label>
        <textarea id="np" rows={3} maxLength={2000} className="input" placeholder="Comparte un avance, una duda o una fecha con el grupo" value={text} onChange={e => setText(e.target.value)} />
        <div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted">{text.length}/2000</span><button className="btn" disabled={busy || !text.trim()}>Publicar</button></div>
      </form>
      <div className="panel">
        {posts.length === 0 && <EmptyState compact icon="chat" title="Aún no hay publicaciones" text="Comparte un avance, una duda o una fecha con el grupo." />}
        {posts.map(x => (
          <article key={x.id} className="flex gap-3 border-b border-line px-4 py-4 last:border-b-0">
            <Avatar name={x.author?.full_name} role={x.author?.role} src={x.author?.avatar_url} />
            <div className="min-w-0 flex-1">
              <div className="text-sm"><b className="text-navy">{x.author?.full_name || 'Participante'}</b> <span className="text-muted">{timeAgo(x.created_at)}</span></div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{x.content}</p>
            </div>
            {(x.author?.id === me.id || mine) && <button disabled={busy} className="danger self-start" onClick={async () => await confirm('¿Borrar esta publicación?', 'Borrar publicación') && act(() => projects.removePost(x.id), 'Publicación borrada')}>Borrar</button>}
          </article>))}
      </div></>) : <p className="panel px-4 py-6 text-sm text-muted">La actividad del proyecto solo la ven sus participantes. {me.role !== 'empresa' && p.is_public && 'Solicita unirte para participar.'}</p>)}

    {tab === 'personas' && (<>
      {mine && pending.length > 0 && (<section className="mb-6"><h2 className="h2 mb-2">{plural(pending.length, 'solicitud pendiente', 'solicitudes pendientes')}</h2>
        <div className="panel">{pending.map(m => (
          <div key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <Avatar name={m.profile?.full_name} role={m.profile?.role} src={m.profile?.avatar_url} /><div className="min-w-0 flex-1 text-sm">{who(m)}<div className="text-xs text-muted">Solicitó {timeAgo(m.joined_at)}</div></div>
            <button className="btn" disabled={busy} onClick={() => act(() => projects.accept(m.id), 'Participante aceptado')}>Aceptar</button>
            <button className="danger" disabled={busy} onClick={() => act(() => projects.removeMember(m.id), 'Solicitud rechazada')}>Rechazar</button>
          </div>))}</div></section>)}
      <div className="panel">{accepted.map(m => (
        <div key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
          <Avatar name={m.profile?.full_name} role={m.profile?.role} src={m.profile?.avatar_url} /><div className="min-w-0 flex-1 text-sm">{who(m)}<div className="text-xs text-muted">{m.user_id === p.owner_id ? 'Responsable' : 'Participante'}{m.profile?.subject_area && `, ${m.profile.subject_area}`}</div></div>
          {mine && m.user_id !== me.id && <button className="danger" disabled={busy} onClick={async () => await confirm('¿Quitar a esta persona del proyecto?', 'Quitar participante') && act(() => projects.removeMember(m.id), 'Participante eliminado')}>Quitar</button>}
        </div>))}</div>
    </>)}
  </>)
}
