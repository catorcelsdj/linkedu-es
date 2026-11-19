import { createContext, useCallback, useContext, useEffect } from 'react'
import { Toaster, toast as sonner } from 'sonner'
import { useTheme } from './ThemeContext'
import HoloToast from '../components/HoloToast'

// toast('texto') = éxito, toast('texto', 'error') = fallo, toast('texto', 'info') = aviso neutro.
const Ctx = createContext(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const { dark } = useTheme()
  const toast = useCallback((text, kind = 'ok', opts = {}) => {
    const duration = opts.duration ?? (kind === 'error' ? 5500 : 3800)
    return sonner.custom(id => <HoloToast id={id} kind={kind} text={text} duration={duration} />, { duration, id: opts.id })
  }, [])

  useEffect(() => {
    const off = () => toast('Sin conexión a internet', 'error', { id: 'net', duration: Infinity })
    const on = () => toast('Conexión recuperada', 'ok', { id: 'net', duration: 3000 })
    window.addEventListener('offline', off); window.addEventListener('online', on)
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [toast])

  return (
    <Ctx.Provider value={toast}>
      {children}
      <Toaster position="bottom-left" theme={dark ? 'dark' : 'light'} visibleToasts={4} gap={12} />
    </Ctx.Provider>
  )
}
