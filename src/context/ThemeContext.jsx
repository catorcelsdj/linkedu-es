import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
const KEY = 'linkedu-theme'
const Ctx = createContext({ dark: false, toggle: () => {} })
export const useTheme = () => useContext(Ctx)
const stored = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const apply = dark => {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    // Change the palette atomically: interpolated light/dark colours can briefly lose contrast.
    root.classList.add('theme-changing')
    apply(dark)
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => root.classList.remove('theme-changing')) })
    return () => cancelAnimationFrame(frame)
  }, [dark])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setDark(stored() ? stored() === 'dark' : media.matches)
    const change = () => { if (!stored()) setDark(media.matches) }
    const storage = e => { if (e.key === KEY || e.key === null) sync() }
    media.addEventListener('change', change); window.addEventListener('storage', storage)
    return () => { media.removeEventListener('change', change); window.removeEventListener('storage', storage) }
  }, [])
  // Signature effect: the new theme spreads as a circle from the switch that was pressed (View Transitions API).
  // Browsers without support, or people who prefer reduced motion, get the instant change.
  const toggle = event => {
    const next = !dark
    try { localStorage.setItem(KEY, next ? 'dark' : 'light') } catch { /* Theme remains usable. */ }
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || calm || document.hidden) return setDark(next)
    const box = event?.currentTarget?.getBoundingClientRect?.()
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2, y = box ? box.top + box.height / 2 : 0
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const transition = document.startViewTransition(() => { apply(next); flushSync(() => setDark(next)) })
    transition.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 620, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {})
  }
  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>
}
