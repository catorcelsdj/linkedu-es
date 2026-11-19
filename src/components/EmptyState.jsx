import { Link } from 'react-router-dom'

// Iconos de línea (48x48) adaptados a cada pantalla. El de "projects" repite los tres nodos del isotipo.
const ICONS = {
  projects: <><circle cx="12" cy="36" r="4" /><circle cx="24" cy="24" r="4" /><circle cx="36" cy="12" r="4" /><path d="M15 33l6-6M27 21l6-6" /></>,
  resources: <><path d="M14 6h14l8 8v28H14z" /><path d="M28 6v8h8M20 24h10M20 31h10" /></>,
  people: <><circle cx="24" cy="17" r="7" /><path d="M10 40c1-8 7-12 14-12s13 4 14 12" /></>,
  chat: <><path d="M8 12h32v20H22l-8 7v-7H8z" /><path d="M16 20h16M16 26h10" /></>,
  check: <><circle cx="24" cy="24" r="14" /><path d="M17 24l5 5 9-10" /></>,
  search: <><circle cx="21" cy="21" r="11" /><path d="M30 30l10 10" /></>,
}

export default function EmptyState({ icon = 'projects', title, text, action, compact }) {
  return (
    <div className={`flex flex-col items-center px-6 text-center ${compact ? 'py-6' : 'py-12'}`}>
      <span className={`mb-3 flex animate-[float_6s_ease-in-out_infinite] items-center justify-center rounded-full border border-dashed border-slate-300 text-muted dark:border-cyan-500/40 dark:shadow-[0_0_28px_-8px_rgba(34,211,238,.6)] ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}>
        <svg viewBox="0 0 48 48" className={compact ? 'h-6 w-6' : 'h-8 w-8'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
      </span>
      <p className="font-semibold text-navy">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && (action.to
        ? <Link to={action.to} className="btn btn-s mt-4">{action.label}</Link>
        : <button type="button" className="btn btn-s mt-4" onClick={action.onClick}>{action.label}</button>)}
    </div>
  )
}
