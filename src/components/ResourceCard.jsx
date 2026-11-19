import { Link } from 'react-router-dom'
import { TagList } from './Tags'
import Tilt from './Tilt'
import { fileSize, timeAgo } from '../lib/format'
import Icon from './Icon'

export const resourceLink = id => `/recursos?ver=${id}`

export default function ResourceCard({ r, uid, onOpen, onDelete, onEdit, busy = false }) {
  const mine = r.owner_id === uid
  return (
    <Tilt as="article" className="card3d panel flex flex-col gap-3 p-5">
      <div className="card-topline"><span className="card-icon"><Icon name={r.resource_type === 'file' ? 'file' : 'link'} /></span><span className="eyebrow">PARA COMPARTIR</span></div>
      <div className="min-w-0">
        <h2><Link to={resourceLink(r.id)} className="card-title hover:underline">{r.title}</Link></h2>
        {r.description && <p className="mt-0.5 line-clamp-3 text-sm text-muted">{r.description}</p>}
        <TagList tags={r.tags} />
        <p className="mt-2 text-xs text-muted">Por {r.owner ? <Link className="hover:underline" to={`/docentes/${r.owner.id}`}>{r.owner.full_name}</Link> : 'La comunidad'}, {timeAgo(r.created_at)}</p>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          <span className="chip">{r.subject_area}</span>
          {r.education_level && <span className="chip">{r.education_level}</span>}
          <span className="chip">{r.resource_type === 'file' ? `Fichero, ${fileSize(r.file_size)}` : 'Enlace'}</span>
        </div>
        <div className="card-footer flex flex-wrap items-center gap-4">
          <button className="btn btn-s" onClick={() => onOpen(r)}>{r.resource_type === 'file' ? 'Descargar' : 'Abrir'}</button>
          {mine && onEdit && <button className="link text-sm" disabled={busy} onClick={() => onEdit(r)}>Editar</button>}
          {mine && onDelete && <button className="danger" disabled={busy} onClick={() => onDelete(r)}>Eliminar</button>}
        </div>
      </div>
    </Tilt>
  )
}
