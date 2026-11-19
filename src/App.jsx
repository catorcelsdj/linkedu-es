import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider, useToast } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { isConfigured } from './services/supabaseClient'
import { msgError } from './lib/format'
import Backdrop from './components/Backdrop'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { LoadingState, Isotipo, ThemeSwitch } from './components/ui'
import Home from './pages/Home'
import Auth, { ResetPassword } from './pages/Auth'
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Resources = lazy(() => import('./pages/Resources'))
const TalentDirectory = lazy(() => import('./pages/TalentDirectory'))
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'))
const Messages = lazy(() => import('./pages/Messages'))
const Settings = lazy(() => import('./pages/Settings'))
function Setup() {
  return <main className="mx-auto max-w-2xl px-6 py-20"><div className="mb-10 flex justify-between"><div className="flex items-center gap-3"><Isotipo /><b className="text-2xl text-navy">Linkedu<span className="text-electric">.</span></b></div><ThemeSwitch compact /></div><div className="panel p-8"><p className="eyebrow">Tu red educativa, a un paso</p><h1 className="h1 mt-3">Conecta tu espacio</h1><p className="mt-4 text-muted">Falta la configuración de Supabase para poder iniciar sesión. Sigue estos pasos en la carpeta del proyecto:</p><ol className="mt-6 list-decimal space-y-3 pl-5 text-sm"><li>Copia <code>.env.example</code> como <code>.env.local</code>.</li><li>Completa <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> con la URL y la clave pública de tu proyecto.</li><li>Aplica las migraciones SQL 001, 002, 003 y 004, en ese orden, si aún no están aplicadas.</li><li>Reinicia <code>npm run dev</code>.</li></ol><p className="hint mt-6">El README incluye la instalación completa. No uses una clave service_role en el navegador.</p></div></main>
}
function Shell() {
  const { session, profile, loading, recovery, error, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  if (!isConfigured) return <Setup />
  if (recovery && session) return <ResetPassword />
  if (loading) return <LoadingState full />
  if (error) return <main className="mx-auto max-w-lg px-6 py-24"><div className="panel p-8"><h1 className="h1">No hemos podido abrir tu espacio</h1><p role="alert" className="mt-4 text-sm text-muted">{error}</p><div className="mt-6 flex gap-3"><button className="btn" onClick={() => session ? refreshProfile() : window.location.reload()}>Reintentar</button>{session && <button className="btn btn-s" onClick={() => signOut().catch(err => toast(msgError(err), 'error'))}>Cerrar sesión</button>}</div></div></main>
  if (!session || !profile) return <Auth />
  const guard = el => profile.role === 'alumno' ? <Navigate to="/" replace /> : el
  return <Routes><Route element={<Layout key={profile.id} />}>
    <Route index element={<Home />} />
    <Route path="proyectos" element={<Projects />} /><Route path="proyectos/:id" element={<ProjectDetail />} />
    <Route path="recursos" element={<Resources />} /><Route path="docentes" element={guard(<TalentDirectory />)} />
    <Route path="docentes/:id" element={<TeacherProfile />} /><Route path="mensajes/:id?" element={guard(<Messages />)} />
    <Route path="perfil" element={<Settings />} />
    <Route path="*" element={<div className="panel p-10"><p className="eyebrow">404 · Nos hemos perdido</p><h1 className="h1 mt-3">Página no encontrada</h1><p className="mt-3 text-muted">La dirección no existe o ya no está disponible.</p><Link className="btn mt-6" to="/">Volver a inicio</Link></div>} />
  </Route></Routes>
}
export default function App() {
  return <ErrorBoundary><ThemeProvider><Backdrop /><AuthProvider><ToastProvider><ConfirmProvider><Suspense fallback={<LoadingState full />}><Shell /></Suspense></ConfirmProvider></ToastProvider></AuthProvider></ThemeProvider></ErrorBoundary>
}
