import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal'
const Ctx = createContext(null)
export const useConfirm = () => useContext(Ctx)
export function ConfirmProvider({ children }) {
  const [prompt, setPrompt] = useState(null)
  const resolver = useRef(null)
  const confirm = useCallback((message, label = 'Continuar') => new Promise(resolve => {
    resolver.current?.(false); resolver.current = resolve; setPrompt({ message, label })
  }), [])
  const finish = result => { resolver.current?.(result); resolver.current = null; setPrompt(null) }
  useEffect(() => () => resolver.current?.(false), [])
  return <Ctx.Provider value={confirm}>{children}{prompt && <Modal title="Confirmar acción" onClose={() => finish(false)}><p className="mt-3 text-sm text-muted">{prompt.message}</p><div className="mt-6 flex justify-end gap-3"><button className="btn btn-s" autoFocus onClick={() => finish(false)}>Cancelar</button><button className="btn" onClick={() => finish(true)}>{prompt.label}</button></div></Modal>}</Ctx.Provider>
}
