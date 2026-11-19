import { useRef } from 'react'

// Inclinación 3D según la posición del ratón, con reflejo que sigue al cursor.
// Solo en dispositivos con ratón y sin "reducir movimiento"; en táctil queda una tarjeta normal.
const FINE = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
const CALM = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Tilt({ as: Tag = 'div', className = '', max = 6, children, ...rest }) {
  const ref = useRef(null)
  const move = e => {
    if (!FINE || CALM || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current, r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`)
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
  }
  const leave = () => { const s = ref.current.style; s.setProperty('--rx', '0deg'); s.setProperty('--ry', '0deg') }
  return <Tag ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt ${className}`} {...rest}>{children}</Tag>
}
