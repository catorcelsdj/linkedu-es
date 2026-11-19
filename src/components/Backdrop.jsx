import { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

// Fondo: rejilla (CSS) + red de nodos que se acercan al cursor, como en el isotipo de la marca.
export default function Backdrop() {
  const ref = useRef(null)
  const { dark } = useTheme()

  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d')
    if (!ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rgb = dark ? '34,211,238' : '37,99,235'
    const mouse = { x: -999, y: -999 }
    let w = 0, h = 0, dots = [], raf = 0, last = 0, timer = 0

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth; h = window.innerHeight
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = Array.from({ length: Math.min(70, Math.floor((w * h) / 20000)) }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: 1 + Math.random() * 1.3,
      }))
    }
    const frame = t => {
      if (!still) raf = requestAnimationFrame(frame)
      if (!still && t - last < 32) return
      last = t
      ctx.clearRect(0, 0, w, h)
      const L = 120
      for (const d of dots) {
        if (!still) { d.x += d.vx; d.y += d.vy; if (d.x < 0 || d.x > w) d.vx *= -1; if (d.y < 0 || d.y > h) d.vy *= -1 }
      }
      ctx.lineWidth = 1
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i]
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j], d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < L) { ctx.strokeStyle = `rgba(${rgb},${(1 - d / L) * 0.28})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
        }
        const m = Math.hypot(a.x - mouse.x, a.y - mouse.y)
        if (m < 160) { ctx.strokeStyle = `rgba(16,185,129,${(1 - m / 160) * 0.55})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke() }
        ctx.fillStyle = `rgba(${rgb},.55)`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill()
      }
    }
    const onMove = e => { mouse.x = e.clientX; mouse.y = e.clientY }
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { seed(); if (still) frame(100) }, 150) }
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !still) raf = requestAnimationFrame(frame) }

    seed(); frame(100)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf); clearTimeout(timer)
      window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis)
    }
  }, [dark])

  return (<>
    <div className="app-grid" aria-hidden="true" />
    <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
  </>)
}
