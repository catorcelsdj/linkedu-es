import { Link } from 'react-router-dom'
import { Avatar } from './ui'
import Tilt from './Tilt'

export default function TalentCard({ t, uid }) {
  const where = [t.center, t.city].filter(Boolean).join(', ')
  return (
    <Tilt as="article" className="card3d panel flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <Avatar name={t.full_name} role="docente" size={48} src={t.avatar_url} />
        <div className="min-w-0">
          <Link to={`/docentes/${t.id}`} className="font-semibold text-navy hover:underline">{t.full_name}</Link>
          <p className="text-sm text-muted">{[t.subject_area, where].filter(Boolean).join(', ') || 'Sin datos de centro'}</p>
        </div>
      </div>
      {t.bio && <p className="line-clamp-3 text-sm">{t.bio}</p>}
      {t.education_levels?.length > 0 && <div className="flex flex-wrap gap-1">{t.education_levels.map(l => <span key={l} className="chip">{l}</span>)}</div>}
      {t.id !== uid ? <Link to={`/mensajes/${t.id}`} className="btn btn-s mt-auto self-start">Contactar</Link> : <span className="mt-auto text-sm text-muted">Este es tu perfil</span>}
    </Tilt>
  )
}
