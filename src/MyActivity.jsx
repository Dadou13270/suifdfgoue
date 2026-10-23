import React, { useEffect, useMemo, useState } from 'react'
import { useDoc, getActor } from './store.js'
import { iso, addDays, fmtDMY } from './util.js'
import { ActItem } from './Activity.jsx'

// Pop-up « Mes activités » : modifications faites par l'utilisateur connecté, jour par jour
export default function MyActivity({ config, role, onClose, initialDate }) {
  const me = getActor()
  const [date, setDate] = useState(initialDate || iso(new Date()))
  const admin = role === 'superadmin' || role === 'admin'
  const [mine] = useDoc(`ua/${me.uid}_${date}`, !!me.uid)
  const [all] = useDoc(`activity/${date}`, admin)   // historique antérieur à la copie personnelle (lecture réservée aux administrateurs)
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const items = useMemo(() => {
    const m = new Map()
    ;[...(mine?.items || []), ...((all?.items || []).filter((x) => x.who === me.email))].forEach((x) => m.set(`${x.t}|${x.path}`, x))
    return [...m.values()].sort((a, b) => b.t - a.t)
  }, [mine, all, me.email])
  const loading = (!!me.uid && mine === undefined) || (admin && all === undefined)
  return (
    <div className="jr-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="jr-box" role="dialog" aria-modal="true" aria-label="Mes activités">
        <div className="jr-head"><h3>Mes activités</h3><button aria-label="Fermer" onClick={onClose}>✕</button></div>
        <div className="jr-new" style={{ borderTop: 0, borderBottom: '1px solid var(--line)' }}>
          <button onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">›</button>
          <button onClick={() => setDate(iso(new Date()))}>Aujourd’hui</button>
        </div>
        <p className="muted small" style={{ margin: '8px 16px 0' }}>{loading ? 'Chargement…' : `${items.length} modification(s) de ${me.name || me.email || 'vous'} le ${fmtDMY(date)}`}</p>
        <div className="jr-list actlist">
          {items.map((x, i) => <ActItem key={x.t + '-' + i} x={x} config={config} />)}
          {!loading && !items.length && <p className="muted">Aucune activité enregistrée ce jour-là.</p>}
        </div>
      </div>
    </div>
  )
}
