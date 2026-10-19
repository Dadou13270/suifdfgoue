import React from 'react'
import { uid, baseTitle } from './util.js'

// ⧉ dupliquer le groupe (copie propre au jour) · ✕ masquer un groupe optionnel ajouté pour le jour
export function BlockTools({ b, day, onPatch, config }) {
  const src = (config.blocks || []).find((x) => x.id === b.id) || b
  const optional = src.show === false && !!day.shown?.[b.id]
  const dup = () => {
    const copy = { id: uid(), title: `${baseTitle(b)} (copie)`, head: !!b.head, location: !!b.location, headHint: b.headHint || '', rows: b.rows.map((r) => ({ id: uid(), label: r.label, ...(r.filter ? { filter: r.filter } : {}) })) }
    onPatch({ customBlocks: [...(day.customBlocks || []), copy] })
  }
  return (
    <span className="btools">
      <button type="button" aria-label="Dupliquer le groupe" title="Dupliquer le groupe" onClick={dup}>⧉</button>
      {optional && <button type="button" aria-label="Masquer le groupe" title="Masquer ce groupe" onClick={() => onPatch({ shown: { [b.id]: false } })}>✕</button>}
    </span>
  )
}
