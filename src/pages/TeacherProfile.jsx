import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { people, projects, resources } from '../services/api'
import { ROLE_LABEL, SOCIALS, isHttpUrl, msgError } from '../lib/format'
import { Avatar, EmptyState } from '../components/ui'
import ResourceCard from '../components/ResourceCard'
import { openResource } from '../lib/openResource'
import { LoadingState } from '../components/ui'

export default function TeacherProfile() {
  const { id } = useParams(), { profile: me } = useAuth(), toast = useToast()
  const [d, setD] = useState(undefined)
  const [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let off = false
    setD(undefined); setError('')
    ;(async () => {
      try {
        const p = await people.get(id)
        if (!p) return !off && setD(null)
        const [rs, ps] = p.role === 'docente' ? await Promise.all([resources.list({ owner: id, to: 19 }), projects.list({ owner: id, to: 19 })]) : [[], []]
        if (!off) setD({ p, rs, ps: ps.filter(x => x.owner_id === id) })
      } catch (e) { if (!off) setError(msgError(e)) }
    })()
    return () => { off = true }
  }, [id, retry])

  if (error) return <div className="notice notice-error" role="alert">{error}<button className="btn btn-s mt-4 block" onClick={() => setRetry(n => n + 1)}>Reintentar</button></div>
  if (d === undefined) return <LoadingState />
  if (d === null) return <div><Link to="/" className="link text-sm">Volver a inicio</Link><h1 className="h1 mt-4">Perfil no disponible</h1><p className="mt-2 text-muted">No existe o no es visible para ti.</p></div>
  const { p, rs, ps } = d
  const where = [p.center, p.city].filter(Boolean).join(', ')
  const web = isHttpUrl(p.website) ? p.website : null
  const openRes = async r => { try { await openResource(r) } catch (e) { toast(msgError(e), 'error') } }

  return (<>
    <header className="flex flex-wrap items-start gap-5 border-b border-line pb-6">
      <Avatar name={p.full_name} role={p.role} size={72} src={p.avatar_url} />
      <div className="min-w-0 flex-1">
        <h1 className="h1">{p.full_name}</h1>
        <p className="mt-1 text-sm text-muted">{[ROLE_LABEL[p.role], p.subject_area, where].filter(Boolean).join(', ')}</p>
        {web && <p className="mt-1 text-sm"><a className="link" href={web} target="_blank" rel="noopener noreferrer">{web.replace(/^https?:\/\//, '')}</a></p>}
        {SOCIALS.some(([k]) => isHttpUrl(p.social?.[k])) && <p className="mt-2 flex flex-wrap gap-x-4">{SOCIALS.filter(([k]) => isHttpUrl(p.social?.[k])).map(([k, l]) => <a key={k} className="link text-sm" href={p.social[k]} target="_blank" rel="noopener noreferrer">{l}</a>)}</p>}
        {p.education_levels?.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{p.education_levels.map(l => <span className="chip" key={l}>{l}</span>)}</div>}
      </div>
      {p.id !== me.id && me.role !== 'alumno' && p.role !== 'alumno' && <Link to={`/mensajes/${p.id}`} className="btn">Enviar mensaje</Link>}
      {p.id === me.id && <Link to="/perfil" className="btn btn-s">Editar mi perfil</Link>}
    </header>
    <p className="mt-6 max-w-2xl whitespace-pre-wrap">{p.bio || 'Este perfil aún no tiene descripción.'}</p>
    {p.role === 'docente' && (<>
      <section className="mt-10"><h2 className="h2 mb-2">Proyectos que lidera</h2>
        <div className="panel">{ps.length ? ps.map(x => <Link key={x.id} to={`/proyectos/${x.id}`} className="block border-b border-line px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50"><b className="text-navy">{x.title}</b><span className="line-clamp-1 block text-xs text-muted">{x.description}</span></Link>) : <EmptyState compact icon="projects" title="Sin proyectos visibles" />}</div></section>
      <section className="mt-8"><h2 className="h2 mb-2">Recursos publicados</h2>
        <div className="grid gap-4 sm:grid-cols-2">{rs.length ? rs.map(r => <ResourceCard key={r.id} r={r} uid={me.id} onOpen={openRes} />) : <div className="panel sm:col-span-2"><EmptyState compact icon="resources" title="Todavía no ha publicado recursos" /></div>}</div></section>
    </>)}
  </>)
}
