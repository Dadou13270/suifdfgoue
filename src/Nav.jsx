import React from 'react'
export const TABS = [
  ['dispositif', 'Dispositif', '▦'], ['plannings', 'Plannings', '☰'], ['engins', 'Engins', '◫'],
  ['calendrier', 'Calendrier', '◷'], ['carto', 'Carto CIS', '◎'], ['cadres', 'Cadres', '☺'],
]
export default function Nav({ tab, setTab, allowed }) {
  return (
    <nav className="nav" aria-label="Sections">
      {TABS.filter(([k]) => allowed.includes(k)).map(([k, l, i]) => (
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
          <span className="ni" aria-hidden>{i}</span><span>{l}</span>
        </button>
      ))}
    </nav>
  )
}
