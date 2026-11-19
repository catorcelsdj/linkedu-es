import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
export default function Modal({ title, onClose, children, dismissible = true }) {
  const dialog = useRef(null), close = useRef(onClose), dismiss = useRef(dismissible), id = useId()
  // A click only closes when it both starts and ends on the backdrop. Selecting text in a field and
  // releasing the mouse outside must not discard the form.
  const pressedOutside = useRef(false), unmounting = useRef(false)
  useEffect(() => { close.current = onClose; dismiss.current = dismissible })
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    unmounting.current = false
    node.showModal(); document.body.style.overflow = 'hidden'
    return () => { unmounting.current = true; node.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])
  const outside = e => {
    if (e.target !== dialog.current) return false
    const r = dialog.current.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }
  return createPortal(<dialog ref={dialog} className="modal-native panel" aria-labelledby={id}
    onCancel={e => { e.preventDefault(); if (dismiss.current) close.current() }}
    // Chrome may close a dialog on a repeated Escape even when "cancel" is prevented. Keep React and the DOM in sync.
    // The close event is queued, so ignore it when the dialog was reopened (StrictMode remount) or is unmounting.
    onClose={() => { const node = dialog.current; if (unmounting.current || !node || node.open) return; if (dismiss.current) close.current(); else node.showModal() }}
    onPointerDown={e => { pressedOutside.current = outside(e) }}
    onClick={e => { const start = pressedOutside.current; pressedOutside.current = false; if (start && dismissible && outside(e)) onClose() }}>
    <div className="flex items-center justify-between gap-4"><h2 id={id} className="text-xl font-bold text-navy">{title}</h2><button type="button" aria-label="Cerrar ventana" className="icon-button" disabled={!dismissible} onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>, document.body)
}
