import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { people } from '../services/api'
import { usePaged, useDebounce } from '../hooks/usePaged'
import { LEVELS, SUBJECTS } from '../lib/format'
import Icon from '../components/Icon'
import { LoadMore, PageHead, Status } from '../components/ui'
import TalentCard from '../components/TalentCard'

// Teachers and companies find each other in both directions: /docentes and /docentes?tipo=empresas.
export default function TalentDirectory() {
  const { profile: me } = useAuth()
  const [sp, setSp] = useSearchParams()
  const companies = sp.get('tipo') === 'empresas', role = companies ? 'empresa' : 'docente'
  const [q, setQ] = useState(''), [subject, setSubject] = useState(''), [level, setLevel] = useState(''), dq = useDebounce(q)
  const list = usePaged((from, to) => people.directory({ role, q: dq, subject, level, from, to }), [role, dq, subject, level])
  const show = next => { setSubject(''); setLevel(''); setSp(next === 'empresa' ? { tipo: 'empresas' } : {}) }
  const filtered = dq || (!companies && (subject || level))
  const sub = companies
    ? 'Empresas y entidades que quieren colaborar con centros educativos: formación, retos reales, prácticas o material.'
    : me.role === 'empresa' ? 'Encuentra docentes por asignatura y etapa. Durante la fase gratuita, el contacto no tiene coste.' : 'Encuentra docentes de tu materia para colaborar.'
  return (<>
    <PageHead title={companies ? 'Directorio de empresas' : 'Directorio de docentes'} sub={sub} />
    <div role="group" aria-label="Tipo de perfil" className="mb-4 inline-flex gap-1 rounded-xl border border-line bg-[var(--glass-bg)] p-1 text-sm font-semibold">
      {[['docente', 'Docentes', 'people'], ['empresa', 'Empresas', 'building']].map(([key, label, icon]) => <button key={key} type="button" aria-pressed={role === key} onClick={() => show(key)} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 ${role === key ? 'bg-[var(--soft)] text-electric' : 'text-muted hover:text-ink'}`}><Icon name={icon} size={16} />{label}</button>)}
    </div>
    <div className="filter-bar">
      <input className="input max-w-xs flex-1" type="search" placeholder={companies ? 'Nombre, sector o ciudad' : 'Nombre, centro o palabra del perfil'} aria-label={companies ? 'Buscar empresas' : 'Buscar docentes'} value={q} onChange={e => setQ(e.target.value)} />
      {!companies && <select className="input w-auto" aria-label="Asignatura" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Todas las asignaturas</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>}
      {!companies && <select className="input w-auto" aria-label="Etapa" value={level} onChange={e => setLevel(e.target.value)}><option value="">Todas las etapas</option>{LEVELS.map(s => <option key={s}>{s}</option>)}</select>}
    </div>
    <Status loading={list.loading} error={list.error} count={list.items.length} onRetry={list.reload} empty={filtered
      ? { icon: 'search', title: companies ? 'Ninguna empresa coincide' : 'Ningún docente coincide', text: 'Prueba a quitar algún filtro.', action: { label: 'Limpiar filtros', onClick: () => { setQ(''); setSubject(''); setLevel('') } } }
      : companies ? { icon: 'people', title: 'Aún no hay empresas en el directorio', text: 'Cuando una empresa se registre, aparecerá aquí.' } : { icon: 'people', title: 'Aún no hay docentes en el directorio', text: 'Cuando los docentes completen su registro aparecerán aquí.' }} />
    <div className="results grid gap-4 md:grid-cols-2" aria-busy={list.stale}>{list.items.map(t => <TalentCard key={t.id} t={t} uid={me.id} />)}</div>
    <LoadMore more={list.more} loading={list.loading} onClick={list.loadMore} />
  </>)
}
