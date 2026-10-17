import React, { useEffect, useState } from 'react'
import { useDoc } from './store.js'
import { ROLES } from './roles.js'

const BEAT = 30000, TTL = 90000
// Personnes connectées : chaque client écrit un battement dans presence/main
export default function Presence({ user, role }) {
  const [doc, patch] = useDoc('presence/main')
  const [now, setNow] = useState(Date.now())
  const uid = user?.uid
  const name = user?.displayName || (user?.email || '').split('@')[0] || 'Moi'
  useEffect(() => {
    if (!uid) return
    const beat = () => patch({ [uid]: { n: name, r: role || '', t: Date.now() } })
    beat()
    const a = setInterval(beat, BEAT)
    const b = setInterval(() => setNow(Date.now()), BEAT)
    const vis = () => { if (!document.hidden) beat() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(a); clearInterval(b); document.removeEventListener('visibilitychange', vis) }
  }, [uid, name, role]) // eslint-disable-line
  const list = Object.entries(doc || {})
    .filter(([k, v]) => v && v.t && now - v.t < TTL)
    .map(([k, v]) => ({ id: k, ...v }))
    .sort((x, y) => (x.n || '').localeCompare(y.n || '', 'fr'))
  if (!list.length) return null
  return (
    <div className="presence" aria-label="Personnes connectées">
      <span className="dot" aria-hidden />
      <span className="small muted">{list.length} en ligne</span>
      {list.map((p) => (
        <span key={p.id} className={'chip' + (p.id === uid ? ' me' : '')} title={`${p.n} — ${ROLES[p.r]?.label || p.r}`}>{p.n}</span>
      ))}
    </div>
  )
}
