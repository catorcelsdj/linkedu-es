import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useMessageEvents } from '../hooks/useMessageEvents'
import { useRealtime } from '../hooks/useRealtime'
import { messages, people, projects } from '../services/api'
import { Avatar, Isotipo, LoadingState, ThemeSwitch } from './ui'
import ErrorBoundary from './ErrorBoundary'
import NotificationBell from './Notifications'
import Icon from './Icon'
import { PROJECT_EVENT, ROLE_LABEL, UNREAD_EVENT, msgError } from '../lib/format'
export default function Layout() {
  const { profile, signOut } = useAuth(), toast = useToast()
  const [unread, setUnread] = useState(0), [pending, setPending] = useState(0), [leaving, setLeaving] = useState(false)
  const { pathname } = useLocation(), here = useRef(pathname), active = useRef(true)
  const noAlumno = profile.role !== 'alumno', inProjects = profile.role !== 'empresa', leads = profile.role === 'docente'
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { here.current = pathname; window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])
  const refreshUnread = useCallback(() => {
    if (noAlumno) messages.unread(profile.id).then(n => { if (active.current) setUnread(n) }).catch(() => {})
    else setUnread(0)
  }, [profile.id, noAlumno])
  useEffect(() => { refreshUnread() }, [pathname, refreshUnread])
  // Reading a conversation updates the badge at once, even when Realtime is unavailable.
  useEffect(() => { window.addEventListener(UNREAD_EVENT, refreshUnread); return () => window.removeEventListener(UNREAD_EVENT, refreshUnread) }, [refreshUnread])
  useMessageEvents(noAlumno ? profile.id : null, 'nav', {
    onIncoming: message => {
      if (here.current !== `/mensajes/${message.sender_id}`) people.byIds([message.sender_id]).then(([person]) => { if (active.current) toast(`Nuevo mensaje de ${person?.full_name || 'un usuario'}`, 'info') }).catch(() => {})
      refreshUnread()
    }, onMarked: refreshUnread, onSubscribed: refreshUnread, onRefresh: refreshUnread,
  })
  // Project notices: requests to my projects, my acceptances and new posts where I take part.
  const refreshPending = useCallback(() => {
    if (leads) projects.pending(profile.id).then(n => { if (active.current) setPending(n) }).catch(() => {})
    else setPending(0)
  }, [profile.id, leads])
  useEffect(() => { refreshPending() }, [pathname, refreshPending])
  useEffect(() => { window.addEventListener(PROJECT_EVENT, refreshPending); return () => window.removeEventListener(PROJECT_EVENT, refreshPending) }, [refreshPending])
  const known = useRef(new Map())
  const about = useCallback(async id => {
    if (!known.current.has(id)) { const project = await projects.get(id).catch(() => null); if (project) known.current.set(id, project); return project }
    return known.current.get(id)
  }, [])
  const notice = (row, text, kind = 'info') => {
    window.dispatchEvent(new CustomEvent(PROJECT_EVENT, { detail: { projectId: row.project_id } }))
    if (text) about(row.project_id).then(project => { const message = project && text(project); if (message && active.current) toast(message, kind) })
  }
  useRealtime(inProjects ? `projects:nav:${profile.id}` : null, [
    ['project_members', 'INSERT', null, 'onMember'],
    ['project_members', 'UPDATE', `user_id=eq.${profile.id}`, 'onMembership'],
    ['project_posts', 'INSERT', null, 'onPost'],
  ], {
    onMember: row => {
      if (row.user_id === profile.id) return
      notice(row, project => project.owner_id !== profile.id ? null : row.status === 'pendiente' ? `Nueva solicitud para «${project.title}»` : `Alguien se ha unido a «${project.title}»`)
    },
    onMembership: row => { if (row.status === 'aceptado') notice(row, project => `Ya formas parte de «${project.title}»`, 'ok') },
    onPost: row => {
      if (row.author_id === profile.id) return
      notice(row, project => here.current === `/proyectos/${row.project_id}` ? null : `Nueva publicación en «${project.title}»`)
    },
    onSubscribed: refreshPending, onRefresh: refreshPending,
  }, { poll: 60000 })
  const leave = async () => {
    if (leaving) return
    setLeaving(true)
    try { await signOut() } catch (error) { toast(msgError(error), 'error') } finally { setLeaving(false) }
  }
  const nav = [['/', 'Inicio', 'home'], ['/proyectos', 'Proyectos', 'projects', pending, 'solicitudes pendientes'], ['/recursos', 'Recursos', 'resources'],
    ...(noAlumno ? [['/docentes', 'Directorio', 'people'], ['/mensajes', 'Mensajes', 'chat', unread, 'sin leer']] : []), ['/perfil', 'Mi perfil', 'user']]
  const current = nav.find(([path]) => path !== '/' && pathname.startsWith(path)) || nav[0], section = current[1]
  useEffect(() => { document.title = `${section} · Linkedu` }, [section])
  const pageKey = pathname.startsWith('/mensajes') ? '/mensajes' : pathname
  // Move focus to the new content on navigation so screen readers and keyboard users start at the page.
  const lastKey = useRef(pageKey)
  useEffect(() => {
    if (lastKey.current === pageKey) return
    lastKey.current = pageKey
    document.getElementById('contenido')?.focus({ preventScroll: true })
  }, [pageKey])
  return <div className="app-shell">
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <aside className="app-sidebar glass">
      <Link to="/" className="brand" aria-label="Linkedu, inicio"><Isotipo className="h-9" /><span>Linkedu<span className="text-electric">.</span><small>LA RED QUE EDUCA</small></span></Link>
      <p className="sidebar-label">TU ESPACIO</p>
      <nav aria-label="Principal" className="app-nav">{nav.map(([to, label, icon, count, meaning]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}><Icon name={icon} /><span>{label}</span>{count > 0 && <span className="nav-count" aria-label={`${count} ${meaning}`}>{count > 99 ? '99+' : count}</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="network-note"><span className="network-mark"><Icon name="spark" /></span><b>Las buenas ideas crecen juntas.</b><p>Un aula puede ser el principio de algo mucho más grande.</p><Link to="/proyectos">Encuentra tu proyecto <Icon name="arrow" size={16} /></Link></div><ThemeSwitch /><div className="sidebar-person"><Avatar name={profile.full_name} role={profile.role} src={profile.avatar_url} /><Link className="min-w-0 flex-1" to="/perfil"><b className="block truncate text-sm">{profile.full_name}</b><span className="text-xs text-muted">{ROLE_LABEL[profile.role]}</span></Link><button aria-label="Cerrar sesión" className="icon-button" disabled={leaving} onClick={leave}><Icon name="logout" size={18} /></button></div></div>
    </aside>
    <div className="min-w-0"><header className="workspace-bar"><div className="flex items-center gap-2 text-sm"><span className="crumb-root text-muted">Mi espacio</span><span className="crumb-root text-muted">/</span><b>{section}</b></div><div className="flex items-center gap-3"><span className="workspace-role"><span />Comunidad educativa</span><span className="mobile-theme"><ThemeSwitch compact /></span><NotificationBell uid={profile.id} /><Link to="/perfil" aria-label="Abrir mi perfil"><Avatar name={profile.full_name} role={profile.role} src={profile.avatar_url} size={30} /></Link><button className="icon-button mobile-logout" onClick={leave} disabled={leaving} aria-label="Cerrar sesión"><Icon name="logout" size={18} /></button></div></header>
      <main id="contenido" tabIndex={-1} className="app-main"><div key={pageKey} className="page-enter"><ErrorBoundary inline><Suspense fallback={<LoadingState />}><Outlet /></Suspense></ErrorBoundary></div></main>
      <footer className="workspace-footer"><span>Linkedu · Conectar para transformar</span><span>Hecho para la comunidad educativa</span></footer>
    </div>
  </div>
}
