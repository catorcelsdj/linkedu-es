import { useEffect, useState } from 'react'
import EmptyState from './EmptyState'
import Icon from './Icon'
import { initials } from '../lib/format'
import { useTheme } from '../context/ThemeContext'

export { EmptyState }

export const Isotipo = ({ className = 'h-7' }) => (
  <svg viewBox="0 0 215 240" className={className} aria-hidden="true">
    <path d="M5 25H182M182 25L25 208M103 117H203M25 208H203" fill="none" strokeWidth="12" strokeLinecap="round" className="stroke-[#163257] dark:stroke-[#eaf5ef]" />
    {[[182, 25], [103, 117], [25, 208]].map(([x, y]) => (
      <g key={x}><circle cx={x} cy={y} r="24" className="fill-[#163257] dark:fill-[#eaf5ef]" /><circle cx={x} cy={y} r="13" fill="#8FDEBF" /></g>
    ))}
  </svg>
)

export function Avatar({ name, role, size = 36, src }) {
  const [broken, setBroken] = useState(null)
  if (src && broken !== src) return <img src={src} onError={() => setBroken(src)} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-2 ring-white/60 dark:ring-cyan-400/30" />
  const c = role === 'empresa' ? 'bg-mint text-emerald-950' : role === 'alumno' ? 'bg-slate-500 text-white' : 'bg-brand text-white dark:ring-1 dark:ring-cyan-400/30'
  return <span style={{ width: size, height: size, fontSize: size * 0.36 }} className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${c}`} aria-hidden="true">{initials(name)}</span>
}

export function Status({ loading, error, count, empty, onRetry }) {
  if (error) return <div role="alert" className="notice notice-error mb-4"><p>{error}</p>{onRetry && <button className="btn btn-s mt-3" onClick={onRetry}>Reintentar</button>}</div>
  if (loading && !count) return <div className="grid gap-4 md:grid-cols-2" role="status" aria-busy="true" aria-label="Cargando resultados">{[0, 1, 2, 3].map(i => <div key={i} className="panel h-36 animate-pulse" />)}</div>
  if (!loading && !count) return <div className="panel">{typeof empty === 'string' ? <EmptyState icon="search" title={empty} /> : <EmptyState {...empty} />}</div>
  return loading ? <p role="status" className="mb-3 text-sm text-muted">Actualizando resultados…</p> : null
}

export function LoadingState({ full = false }) {
  return <div className={`loading-state ${full ? 'min-h-screen' : 'min-h-64'}`} role="status"><span className="loading-ring" /><p>Preparando tu espacio…</p></div>
}

export const LoadMore = ({ more, loading, onClick }) => more ? (
  <div className="mt-6 text-center"><button className="btn btn-s" onClick={onClick} disabled={loading}>{loading ? 'Cargando…' : 'Ver más'}</button></div>
) : null

export const PageHead = ({ title, sub, children }) => (
  <div className="page-heading mb-7 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="h1">{title}</h1>{sub && <p className="mt-1 max-w-xl text-sm text-muted">{sub}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
)

export const FormError = ({ children }) => children ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{children}</p> : null

// Número que sube hasta su valor (sin animación si se pide reducir movimiento).
export function Counter({ to }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(to)
    let raf, t0
    const step = t => { t0 ??= t; const p = Math.min((t - t0) / 900, 1); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return v
}

export function ThemeSwitch({ compact }) {
  const { dark, toggle } = useTheme()
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Tema oscuro" onClick={toggle}
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-slate-50 hover:text-ink ${compact ? 'w-auto' : 'w-full'}`}>
      {!compact && <span>Tema</span>}
      {/* Sun while the light theme is active, moon while the dark theme is active. */}
      <span className={`theme-track ${dark ? 'is-dark' : ''}`}>
        <span className="theme-knob" data-icon={dark ? 'moon' : 'sun'}><Icon key={dark ? 'moon' : 'sun'} name={dark ? 'moon' : 'sun'} size={13} className="theme-glyph" /></span>
      </span>
    </button>
  )
}
