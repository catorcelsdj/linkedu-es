import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
export default function Modal({ title, onClose, children, dismissible = true }) {
  const dialog = useRef(null), close = useRef(onClose), dismiss = useRef(dismissible), id = useId()
  useEffect(() => { close.current = onClose; dismiss.current = dismissible })
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    node.showModal(); document.body.style.overflow = 'hidden'
    return () => { node.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={dialog} className="modal-native panel" aria-labelledby={id}
    onCancel={e => { e.preventDefault(); if (dismiss.current) close.current() }}
    onClick={e => { if (e.target !== dialog.current || !dismissible) return; const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() }}>
    <div className="flex items-center justify-between gap-4"><h2 id={id} className="text-xl font-bold text-navy">{title}</h2><button type="button" aria-label="Cerrar ventana" className="icon-button" disabled={!dismissible} onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>, document.body)
}
