import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { people } from '../services/api'
import { usePaged, useDebounce } from '../hooks/usePaged'
import { LEVELS, SUBJECTS } from '../lib/format'
import { LoadMore, PageHead, Status } from '../components/ui'
import TalentCard from '../components/TalentCard'

export default function TalentDirectory() {
  const { profile: me } = useAuth()
  const [q, setQ] = useState(''), [subject, setSubject] = useState(''), [level, setLevel] = useState(''), dq = useDebounce(q)
  const list = usePaged((from, to) => people.teachers({ q: dq, subject, level, from, to }), [dq, subject, level])
  return (<>
    <PageHead title="Directorio de docentes" sub={me.role === 'empresa' ? 'Encuentra docentes por asignatura y etapa. Durante la fase gratuita, el contacto no tiene coste.' : 'Encuentra docentes de tu materia para colaborar.'} />
    <div className="filter-bar">
      <input className="input max-w-xs flex-1" type="search" placeholder="Nombre, centro o palabra del perfil" aria-label="Buscar docentes" value={q} onChange={e => setQ(e.target.value)} />
      <select className="input w-auto" aria-label="Asignatura" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Todas las asignaturas</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
      <select className="input w-auto" aria-label="Etapa" value={level} onChange={e => setLevel(e.target.value)}><option value="">Todas las etapas</option>{LEVELS.map(s => <option key={s}>{s}</option>)}</select>
    </div>
    <Status loading={list.loading} error={list.error} count={list.items.length} onRetry={list.reload} empty={dq || subject || level ? { icon: 'search', title: 'Ningún docente coincide', text: 'Prueba a quitar algún filtro.', action: { label: 'Limpiar filtros', onClick: () => { setQ(''); setSubject(''); setLevel('') } } } : { icon: 'people', title: 'Aún no hay docentes en el directorio', text: 'Cuando los docentes completen su registro aparecerán aquí.' }} />
    <div className="grid gap-4 md:grid-cols-2">{list.items.map(t => <TalentCard key={t.id} t={t} uid={me.id} />)}</div>
    <LoadMore more={list.more} loading={list.loading} onClick={list.loadMore} />
  </>)
}
