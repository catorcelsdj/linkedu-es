import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { messages, people, projects, resources, stats } from '../services/api'
import { Avatar, Counter, EmptyState, LoadingState, PageHead } from '../components/ui'
import Icon from '../components/Icon'
import { greeting, msgError, plural, timeAgo } from '../lib/format'
export default function Home() {
  const { profile: me } = useAuth()
  const [data, setData] = useState(null), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    const keys = ['mine', 'ps', 'rs', 'unread', 'teachers', 'st']
    Promise.allSettled([projects.mine(me.id), projects.list({ to: 4 }), resources.list({ to: 4 }), me.role === 'alumno' ? 0 : messages.unread(me.id), me.role === 'empresa' ? people.teachers({ to: 4 }) : [], stats()])
      .then(results => {
        if (!active) return
        const failed = [], errors = []
        const values = Object.fromEntries(results.map((result, i) => {
          if (result.status === 'fulfilled') return [keys[i], result.value]
          failed.push(keys[i]); errors.push(msgError(result.reason))
          return [keys[i], keys[i] === 'unread' ? null : keys[i] === 'st' ? {} : []]
        }))
        setData({ ...values, failed, errors })
      })
    return () => { active = false }
  }, [me.id, me.role, retry])
  const reload = useCallback(() => { setData(null); setRetry(n => n + 1) }, [])
  if (!data) return <LoadingState />
  const pending = data.mine.filter(p => p.owner_id === me.id).map(p => ({ p, n: p.project_members?.filter(m => m.status === 'pendiente').length || 0 })).filter(x => x.n)
  const todo = [...pending.map(({ p, n }) => ({ to: `/proyectos/${p.id}`, text: `${plural(n, 'solicitud', 'solicitudes')} para «${p.title}»`, icon: 'people' })),
    ...(data.unread ? [{ to: '/mensajes', text: plural(data.unread, 'mensaje sin leer', 'mensajes sin leer'), icon: 'chat' }] : []),
    ...(me.role !== 'alumno' && !me.bio ? [{ to: '/perfil', text: 'Dale voz a tu perfil. Cuéntanos sobre ti.', icon: 'user' }] : [])]
  const feed = [...data.ps.map(p => ({ id: 'p' + p.id, type: 'Proyecto', to: `/proyectos/${p.id}`, title: p.title, by: p.owner?.full_name, at: p.created_at, icon: 'projects' })), ...data.rs.map(r => ({ id: 'r' + r.id, type: 'Recurso', to: '/recursos', title: r.title, by: r.owner?.full_name, at: r.created_at, icon: 'resources' }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
  return <>
    <PageHead title={`${greeting()}, ${me.full_name?.trim().split(/\s+/)[0] || 'hola'} 👋`} sub="Este es tu espacio. Vamos a hacer que pasen cosas buenas."><span className="text-xs text-muted">{new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' }).format(new Date())}</span></PageHead>
    {data.errors.length > 0 && <div role="alert" className="notice notice-error mb-5"><p>Algunos datos no han podido cargarse. {data.errors[0]}</p><button className="link mt-2" onClick={reload}>Volver a intentarlo</button></div>}
    <section className="hero"><div className="hero-art" aria-hidden="true"><span className="hero-orbit"><Icon name="projects" size={52} /></span><i className="hero-node" /><i className="hero-node" /><i className="hero-node" /></div><p className="eyebrow mb-3">CONECTAR. COMPARTIR. CRECER.</p><h2>{me.role === 'empresa' ? <>El talento que buscas<br />está más cerca.</> : <>Las grandes ideas<br />empiezan en equipo.</>}</h2><p className="mt-3">{me.role === 'empresa' ? 'Conecta con docentes que quieren transformar la educación.' : 'Hay un mundo de posibilidades al otro lado de tu aula. Descubre con quién hacerlo realidad.'}</p><Link className="btn mt-5" to={me.role === 'empresa' ? '/docentes' : '/proyectos'}>{me.role === 'empresa' ? 'Conocer docentes' : 'Explorar proyectos'}<Icon name="arrow" size={17} /></Link></section>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Proyectos compartidos', data.st.projects, 'projects', '/proyectos'], ['Recursos para inspirarte', data.st.resources, 'resources', '/recursos'], ['Docentes en la red', data.st.teachers, 'people', me.role === 'alumno' ? '/proyectos' : '/docentes']].map(([label, value, icon, to]) => <Link key={label} to={to} className="panel metric"><span className="metric-icon"><Icon name={icon} /></span><div><strong>{value == null ? '—' : <Counter to={value} />}</strong><p>{label}</p></div><Icon name="arrow" className="ml-auto text-muted" size={16} /></Link>)}</div>
    <div className="grid gap-x-7 lg:grid-cols-[1.15fr_1fr]"><section><div className="section-heading"><h2 className="h2">{me.role === 'empresa' ? 'Personas con las que conectar' : 'Tus proyectos'}</h2><Link to={me.role === 'empresa' ? '/docentes' : '/proyectos'}>Ver todos<Icon name="arrow" size={14} /></Link></div><div className="panel overflow-hidden">{data.failed.includes(me.role === 'empresa' ? 'teachers' : 'mine') ? <p className="p-5 text-sm text-muted">No se pudo cargar esta sección.</p> : me.role === 'empresa' ? (data.teachers.length ? data.teachers.map(person => <Link key={person.id} to={`/docentes/${person.id}`} className="activity-row"><Avatar name={person.full_name} src={person.avatar_url} /><div><b>{person.full_name}</b><p>{person.subject_area || 'Docente'}</p></div><Icon name="arrow" className="ml-auto text-muted" size={15} /></Link>) : <EmptyState compact icon="people" title="Las conexiones empiezan aquí" text="Los docentes aparecerán en cuanto se unan a la red." />) : data.mine.length ? data.mine.slice(0, 4).map(p => <Link key={p.id} to={`/proyectos/${p.id}`} className="activity-row"><span className="card-icon"><Icon name="projects" size={18} /></span><div className="min-w-0 flex-1"><b className="truncate">{p.title}</b><p>{p.owner_id === me.id ? 'Eres responsable' : p.project_members?.find(m => m.user_id === me.id)?.status === 'pendiente' ? 'Solicitud pendiente' : 'En equipo'}</p></div><Icon name="arrow" size={15} /></Link>) : <EmptyState compact icon="projects" title="Tu próxima idea vive aquí" text="Explora un proyecto o da el primer paso y crea el tuyo." action={{ to: '/proyectos', label: 'Descubrir proyectos' }} />}</div>
      <div className="section-heading"><h2 className="h2">Tu siguiente paso</h2><Icon name="spark" size={17} className="text-electric" /></div><div className="panel overflow-hidden">{todo.length ? todo.map(item => <Link key={item.text} to={item.to} className="activity-row"><Icon name={item.icon} className="shrink-0 text-electric" size={18} /><b>{item.text}</b><Icon name="arrow" size={15} className="ml-auto shrink-0" /></Link>) : <EmptyState compact icon="check" title={data.failed.some(k => ['mine', 'unread'].includes(k)) ? 'No se pudo comprobar tu actividad' : 'Todo al día'} text={data.failed.length ? 'Vuelve a cargar los datos para comprobarlo.' : 'Buen momento para descubrir algo nuevo.'} />}</div>
    </section><section><div className="section-heading"><h2 className="h2">Se mueve en la comunidad</h2><span className="chip">Lo último</span></div><div className="panel overflow-hidden">{feed.length ? feed.map(item => <Link key={item.id} to={item.to} className="activity-row items-start"><span className="card-icon mt-1"><Icon name={item.icon} size={17} /></span><div className="min-w-0"><span className="eyebrow">{item.type}</span><b className="mt-1">{item.title}</b><p>{item.by || 'La comunidad'} · {timeAgo(item.at)}</p></div></Link>) : <EmptyState compact icon="chat" title={data.failed.includes('ps') || data.failed.includes('rs') ? 'No se pudo cargar la actividad' : 'Aquí empieza la conversación'} text="Los nuevos proyectos y recursos aparecerán aquí." />}</div>{me.role === 'docente' && <Link to="/recursos?nuevo=1" className="panel mt-5 flex items-center gap-4 p-5"><span className="card-icon"><Icon name="plus" /></span><div><b className="text-sm">Lo que sabes puede inspirar.</b><p className="mt-1 text-xs text-muted">Comparte un recurso con la comunidad.</p></div><Icon name="arrow" className="ml-auto shrink-0" size={17} /></Link>}</section></div>
  </>
}
