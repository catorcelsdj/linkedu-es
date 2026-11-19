import { useState } from 'react'
import { MAX_TAGS, TAGS } from '../lib/format'

export function TagList({ tags }) {
  if (!tags?.length) return null
  return <div className="mt-2 flex flex-wrap gap-1">{tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
}

function Badge({ on, children, ...rest }) {
  return (
    <button type="button" aria-pressed={on} {...rest}
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-electric bg-electric/10 text-electric dark:text-blue-300' : 'border-line text-muted hover:border-slate-400'}`}>
      {children}
    </button>
  )
}

function Groups({ value, toggle, locked }) {
  return Object.entries(TAGS).map(([group, list]) => (
    <div key={group}>
      <p className="mb-1.5 text-xs font-semibold text-muted">{group}</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map(t => <Badge key={t} on={value.includes(t)} disabled={locked && !value.includes(t)} onClick={() => toggle(t)}>{t}</Badge>)}
      </div>
    </div>
  ))
}

// Filtro de listados: muestra solo lo que tiene TODAS las etiquetas elegidas.
export function TagFilter({ value, onChange }) {
  const [open, setOpen] = useState(value.length > 0)
  const toggle = t => onChange(value.includes(t) ? value.filter(x => x !== t) : [...value, t])
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Ocultar etiquetas' : 'Filtrar por etiquetas'}</button>
        {value.length > 0 && <button type="button" className="link" onClick={() => onChange([])}>Quitar {value.length === 1 ? 'el filtro' : `los ${value.length} filtros`}</button>}
      </div>
      {open && <div className="panel mt-2 space-y-3 p-4"><Groups value={value} toggle={toggle} /></div>}
      {!open && value.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{value.map(t => <Badge key={t} on onClick={() => toggle(t)}>{t} ×</Badge>)}</div>}
    </div>
  )
}

// Selector para formularios de creación (máximo 8).
export function TagPicker({ value, onChange }) {
  const toggle = t => onChange(value.includes(t) ? value.filter(x => x !== t) : [...value, t])
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold">Etiquetas <span className="font-normal text-muted">({value.length}/{MAX_TAGS})</span></legend>
      <div className="mt-2 max-h-48 space-y-3 overflow-y-auto"><Groups value={value} toggle={toggle} locked={value.length >= MAX_TAGS} /></div>
    </fieldset>
  )
}
