import { toast as sonner } from 'sonner'

const TONE = { ok: 'var(--color-electric)', error: 'var(--toast-error, #b33148)', info: 'var(--color-electric)' }
const LABEL = { ok: 'Listo', error: 'Error', info: 'Aviso' }
const ICON = {
  ok: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  error: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>,
}

// Alerta con aspecto de sistema operativo: icono flotante, borde luminoso y barra de tiempo.
export default function HoloToast({ id, kind, text, duration }) {
  return (
    <div className="holo" style={{ '--tone': TONE[kind], '--dur': `${duration}ms` }} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="holo-icon">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[kind]}</svg>
      </span>
      <div className="min-w-0 text-sm">
        <p className="text-xs font-semibold" style={{ color: TONE[kind] }}>{LABEL[kind]}</p>
        <p className="break-words">{text}</p>
      </div>
      <button type="button" onClick={() => sonner.dismiss(id)} aria-label="Cerrar notificación" className="absolute right-2 top-2 cursor-pointer rounded-lg px-1.5 text-lg leading-none text-muted hover:text-ink">×</button>
      {Number.isFinite(duration) && <span className="holo-bar" />}
    </div>
  )
}
