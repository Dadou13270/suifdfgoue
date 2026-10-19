import React from 'react'
import { TextField } from './Cell.jsx'

// Ligne d'intitulé « GIFF1 [MAT ▾] : chef de groupe »
export default function HeadLine({ b, day, config, onPatch, fix, compact }) {
  const cis = day.headCis?.[b.id] || ''
  const opts = [...new Set([...(config.lists.cis || []), ...(cis ? [cis] : [])])]
  return (
    <div className={`headline ${compact ? 'compact' : ''} ${day.headsAuto?.[b.id] ? 'auto' : ''}`}>
      {!compact && !b.tag && <span className="hp">{b.title}</span>}
      {!b.tag && <select aria-label={`CIS de ${b.title}`} value={cis} onChange={(e) => onPatch({ headCis: { [b.id]: e.target.value }, headsAuto: { [b.id]: false } })}>
        <option value="">{b.tag ? 'CIS engins' : 'CIS'}</option>{opts.map((o) => <option key={o}>{o}</option>)}
      </select>}
      {!b.tag && <span className="hp">:</span>}
      <TextField className="headfield" value={day.heads?.[b.id]} fix={fix} list={/^mil/.test(b.id) ? 'dl-mil' : 'dl-cdg'} placeholder={b.headHint || 'Chef de groupe'}
        onCommit={(t) => onPatch({ heads: { [b.id]: t }, headsAuto: { [b.id]: false } })} />
    </div>
  )
}
