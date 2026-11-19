import { createContext, useContext, useEffect, useState } from 'react'
const KEY = 'linkedu-theme'
const Ctx = createContext({ dark: false, toggle: () => {} })
export const useTheme = () => useContext(Ctx)
const stored = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    // Change the palette atomically: interpolated light/dark colours can briefly lose contrast.
    root.classList.add('theme-changing')
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
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
  const toggle = () => {
    const next = !dark
    try { localStorage.setItem(KEY, next ? 'dark' : 'light') } catch { /* Theme remains usable. */ }
    setDark(next)
  }
  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>
}
