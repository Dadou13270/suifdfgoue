import React from 'react'
import Presence from './Presence.jsx'
export const TABS = [
  ['dispositif', 'Dispositif', '▦'], ['plannings', 'Plannings', '☰'], ['engins', 'Engins', '◫'],
  ['calendrier', 'Calendrier', '◷'], ['carto', 'Carto CIS', '◎'], ['cadres', 'Cadres', '☺'], ['releves', 'Relèves', '↻'],
]
export default function Nav({ tab, setTab, allowed, user, role }) {
  return (
    <nav className="nav" aria-label="Sections">
      {TABS.filter(([k]) => allowed.includes(k)).map(([k, l, i]) => (
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
          <span className="ni" aria-hidden>{i}</span><span>{l}</span>
        </button>
      ))}
      <Presence user={user} role={role} />
    </nav>
  )
}
