import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon'

// Select-only combobox (WAI-ARIA APG pattern) styled like the rest of the app, in light and dark themes.
// `options`: strings or [value, label] pairs. Name it with <label htmlFor={id}> or `ariaLabel`.
// Keyboard: arrows, Home/End, Page Up/Down, Enter/Space to choose, Escape to close and type-ahead.
export default function Select({ id, value, onChange, options, ariaLabel, className = '', disabled = false }) {
  const auto = useId(), listId = `${id || auto}-lista`
  const opts = options.map(o => Array.isArray(o) ? o : [o, o])
  const selected = Math.max(0, opts.findIndex(([v]) => v === value))
  const [open, setOpen] = useState(false), [active, setActive] = useState(selected), [up, setUp] = useState(false), [name, setName] = useState(ariaLabel)
  const wrap = useRef(null), list = useRef(null), typed = useRef({ text: '', at: 0 })

  const show = (index = selected) => {
    // Opens upwards when there is no room below, inside a modal or in the window.
    const rect = wrap.current.getBoundingClientRect(), bound = wrap.current.closest('dialog')?.getBoundingClientRect()
    const below = (bound ? bound.bottom : window.innerHeight) - rect.bottom, above = rect.top - (bound ? bound.top : 0)
    setUp(below < 290 && above > below)
    // The list takes the same name as the field (its <label>), not the selected value.
    setName(ariaLabel || (id && document.querySelector(`label[for="${id}"]`)?.textContent) || undefined)
    setActive(index); setOpen(true)
  }
  const choose = index => { const option = opts[index]; setOpen(false); if (option && option[0] !== value) onChange(option[0]) }
  useEffect(() => {
    if (!open) return
    const away = e => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  useEffect(() => { if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' }) }, [open, active])

  const find = key => {
    const now = Date.now(), t = typed.current
    t.text = (now - t.at > 700 ? '' : t.text) + key.toLocaleLowerCase('es'); t.at = now
    const start = open ? active : selected
    const order = [...opts.keys()].map(i => (start + 1 + i) % opts.length)
    const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es')
    return order.find(i => plain(opts[i][1]).startsWith(plain(t.text)))
  }
  const onKey = e => {
    const last = opts.length - 1, k = e.key
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); show() }
      else if (k === 'Home') { e.preventDefault(); show(0) }
      else if (k === 'End') { e.preventDefault(); show(last) }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = find(k); if (i != null) { e.preventDefault(); show(i) } }
      return
    }
    const move = i => { e.preventDefault(); setActive(Math.min(last, Math.max(0, i))) }
    if (k === 'ArrowDown') { if (e.altKey) return; move(active + 1) }
    else if (k === 'ArrowUp') { if (e.altKey) { e.preventDefault(); return choose(active) } move(active - 1) }
    else if (k === 'Home') move(0)
    else if (k === 'End') move(last)
    else if (k === 'PageDown') move(active + 8)
    else if (k === 'PageUp') move(active - 8)
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active) }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (k === 'Tab') setOpen(false)
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey) { const i = find(k); if (i != null) move(i) }
  }

  return (
    <div ref={wrap} className={`select ${className}`} onBlur={e => { if (!wrap.current.contains(e.relatedTarget)) setOpen(false) }}>
      <button type="button" id={id} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined} aria-label={ariaLabel} disabled={disabled}
        className={`input select-trigger ${open ? 'is-open' : ''}`} onClick={() => open ? setOpen(false) : show()} onKeyDown={onKey}>
        <span className="truncate">{opts[selected]?.[1]}</span><Icon name="chevron" size={16} className="select-chevron" />
      </button>
      {open && <ul ref={list} id={listId} role="listbox" aria-label={name} tabIndex={-1} className={`select-list ${up ? 'up' : ''}`}>
        {opts.map(([v, label], i) => (
          <li key={String(v)} id={`${listId}-${i}`} role="option" aria-selected={i === selected}
            className={`select-option ${i === active ? 'is-active' : ''}`}
            onPointerDown={e => e.preventDefault()} onPointerMove={() => active !== i && setActive(i)} onClick={() => choose(i)}>
            <span>{label}</span>{i === selected && <Icon name="check" size={15} />}
          </li>))}
      </ul>}
    </div>
  )
}
