import { Link } from 'react-router-dom'
import { TagList } from './Tags'
import Tilt from './Tilt'
import { plural, timeAgo } from '../lib/format'
import Icon from './Icon'

export default function ProjectCard({ p, uid }) {
  const ms = p.project_members || []
  const mine = p.owner_id === uid
  const me = ms.find(m => m.user_id === uid)
  const n = ms.filter(m => m.status === 'aceptado').length
  const pend = ms.filter(m => m.status === 'pendiente').length
  const state = mine ? 'Eres responsable' : me ? (me.status === 'aceptado' ? 'Eres miembro' : 'Solicitud enviada') : null
  return (
    <Tilt as="article" className="card3d panel flex flex-col gap-3 p-5">
      <div className="card-topline"><span className="card-icon"><Icon name="projects" /></span><span className="chip"><Icon name={p.is_public ? 'globe' : 'lock'} size={12} className="mr-1" />{p.is_public ? 'Abierto a colaborar' : 'Por invitación'}</span></div>
      <div className="min-w-0">
        <h2><Link to={`/proyectos/${p.id}`} className="card-title hover:underline">{p.title}</Link></h2>
        <p className="mt-0.5 line-clamp-3 text-sm text-muted">{p.description || 'Sin descripción.'}</p>
        <TagList tags={p.tags} />
        <p className="mt-3 text-xs text-muted">{p.owner?.full_name || 'La comunidad'} · {n > 0 && `${plural(n, 'participante visible', 'participantes visibles')} · `}{timeAgo(p.created_at)}</p>
      </div>
      <div className="card-footer flex flex-wrap items-center gap-2">
        <Link className="link mr-auto inline-flex items-center gap-1 text-xs" to={`/proyectos/${p.id}`}>Ver proyecto<Icon name="arrow" size={14} /></Link>
        {state && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{state}</span>}
        {mine && pend > 0 && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{plural(pend, 'solicitud', 'solicitudes')}</span>}
      </div>
    </Tilt>
  )
}
