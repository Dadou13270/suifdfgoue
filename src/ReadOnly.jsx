import React, { useEffect, useRef } from 'react'

// Lecture seule : bloque toute saisie et tout clic sur les commandes, sauf celles marquées data-ro-ok (navigation, filtres)
const CTRL = 'input,select,textarea,button,summary,label,[draggable="true"]'
export default function ReadOnly({ children }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return undefined
    const stop = (e) => {
      const t = e.target instanceof Element ? e.target.closest(CTRL) : null
      if (!t || t.closest('[data-ro-ok]')) return
      if (e.type === 'keydown' && ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return
      e.preventDefault(); e.stopPropagation()
    }
    const evs = ['mousedown', 'click', 'keydown', 'keypress', 'beforeinput', 'paste', 'cut', 'drop', 'dragstart', 'touchstart']
    evs.forEach((n) => el.addEventListener(n, stop, true))
    return () => evs.forEach((n) => el.removeEventListener(n, stop, true))
  }, [])
  return <div ref={ref} className="ro"><div className="banner small">🔒 Lecture seule</div>{children}</div>
}
