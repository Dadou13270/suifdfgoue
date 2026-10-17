import { createPortal } from 'react-dom'
import { getActor } from './store.js'
import React, { createContext, useContext, useEffect, useId, useState } from 'react'

export const Lookup = createContext({ fix: (t) => t })

// Champ texte validé au blur / Entrée (évite d'écrire à chaque frappe).
// Avec `list` : liste déroulante maison (toujours complète au clic, filtrée dès qu'on tape ; fonctionne au doigt).
export function TextField({ value, onCommit, placeholder, list, className = '', fix }) {
  const [v, setV] = useState(value || '')
  useEffect(() => setV(value || ''), [value])
  const [foc, setFoc] = useState(false)
  const [opts, setOpts] = useState([])
  const [hi, setHi] = useState(-1)
  const [pos, setPos] = useState(null)
  const ref = React.useRef(null)
  const touched = React.useRef(false)
  const picking = React.useRef(false)
  const open = (el) => {
    touched.current = false; setFoc(true); setHi(-1)
    const r = el.getBoundingClientRect(); setPos({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 160), up: window.innerHeight - r.bottom < 220, bottom: window.innerHeight - r.top + 2 })
    setTimeout(() => { const d = list && document.getElementById(list); setOpts(d ? [...d.options].map((o) => o.value) : []) }, 0)
  }
  const commitValue = (val) => {
    const out = fix ? fix(val) : val
    setV(out)
    if (out !== (value || '')) onCommit(out)
  }
  const commit = () => {
    setFoc(false)
    if (picking.current) { picking.current = false; return }
    if (list && v === '' && value && !touched.current) { setV(value); return }
    commitValue(v)
  }
  const shown = list && foc ? (touched.current && v ? opts.filter((o) => o.toLowerCase().includes(v.toLowerCase())) : opts).slice(0, 200) : []
  const pick = (o) => { picking.current = true; setFoc(false); commitValue(o); ref.current?.blur() }
  return (
    <>
      <input ref={ref} className={`txt ${className}`} value={list && foc && !touched.current ? '' : v}
        placeholder={list && foc && !touched.current && value ? value : placeholder} autoComplete="off"
        onFocus={(e) => (list ? open(e.currentTarget) : undefined)}
        onChange={(e) => { touched.current = true; setHi(-1); setV(e.target.value) }} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' || e.key === 'Delete') { if (list && !touched.current) setV(''); touched.current = true }
          if (e.key === 'ArrowDown' && shown.length) { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)) }
          else if (e.key === 'ArrowUp' && shown.length) { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
          else if (e.key === 'Escape') { touched.current = true; setV(value || ''); setFoc(false); e.currentTarget.blur() }
          else if (e.key === 'Enter') { if (hi >= 0 && shown[hi]) pick(shown[hi]); else e.currentTarget.blur() }
        }} />
      {foc && pos && shown.length > 0 && createPortal(
        <ul className="combo" style={{ position: 'fixed', left: pos.left, minWidth: pos.width, ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }) }}>
          {shown.map((o, i) => <li key={o + i} className={i === hi ? 'on' : ''} onPointerDown={(e) => { e.preventDefault(); pick(o) }}>{o}</li>)}
        </ul>, document.body)}
    </>
  )
}

// Cellule engin / personne : texte complété automatiquement + pastille de statut
export function EngineCell({ cell = {}, legend, onChange, compact, listId = 'eng-list', cis, filter }) {
  const { fix, fleet = [], statuses = [] } = useContext(Lookup)
  const [foc, setFoc] = useState(false)
  const uid = 'dlc' + useId().replace(/\W/g, '')
  const prio = cis && filter !== '@names'
  let opts = []
  if (prio && foc) {
    const ok = (e) => statuses.find((s) => s.id === e.status)?.avail !== false
    const f = (filter || '').toUpperCase() + (/\d$/.test(filter || '') ? '-' : '')
    const all = fleet.filter((e) => ok(e) && (!filter || e.code.toUpperCase().startsWith(f)))
    opts = [...all.filter((e) => e.cis === cis), ...all.filter((e) => e.cis !== cis)]
  }
  const idx = legend.findIndex((l) => l.id === cell.status)
  const cur = legend[idx]
  const next = () => {
    const n = idx + 1 >= legend.length ? -1 : idx + 1
    onChange({ status: n === -1 ? '' : legend[n].id })
  }
  return (
    <div className={`ecell ${compact ? 'compact' : ''} ${cell.auto ? 'auto' : ''}`} style={cur ? { '--st': cur.color } : undefined} data-st={cur ? 1 : 0}>
      <span className="dlwrap" onPointerEnter={() => setFoc(true)} onFocus={() => setFoc(true)}>
        <TextField value={cell.text} fix={fix} list={prio ? uid : listId} onCommit={(t) => onChange({ text: t, auto: false })} />
        {prio && foc && <datalist id={uid}>{opts.map((e) => <option key={e.id} value={`${e.code} ${e.cis}`.trim()} />)}</datalist>}
      </span>
      <button className="dot" onClick={next} title={cur ? cur.label : 'Statut'} aria-label="Changer le statut" />
    </div>
  )
}

// Emplacement + horaires (début / fin), listes et préréglages configurables
export function LocField({ value, onChange, lists, compact }) {
  const o = value && typeof value === 'object' ? value : { place: value || '', start: '', end: '' }
  const set = (p) => onChange({ ...o, ...p })
  const presets = (lists?.horaires || []).filter((h) => /^\d{1,2}[:h]\d{0,2}\s*-\s*\d{1,2}[:h]\d{0,2}$/.test(h.trim()))
  const norm = (t) => { const [h, m = '00'] = t.trim().replace('h', ':').split(':'); return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}` }
  const pick = (e) => { if (!e.target.value) return; const [a, b] = e.target.value.split('-'); set({ start: norm(a), end: norm(b) }) }
  return (
    <div className={`locf ${compact ? 'compact' : ''} ${o.auto ? 'auto' : ''}`}>
      <TextField value={o.place} list="place-list" placeholder="Emplacement" onCommit={(t) => set({ place: t, auto: false })} />
      <div className="times">
        <input type="time" aria-label="Début" value={o.start || ''} onChange={(e) => set({ start: e.target.value, auto: false })} />
        <span>→</span>
        <input type="time" aria-label="Fin" value={o.end || ''} onChange={(e) => set({ end: e.target.value, auto: false })} />
        {presets.length > 0 && <select aria-label="Horaires prédéfinis" value="" onChange={pick}><option value="">⏱</option>{presets.map((h) => <option key={h}>{h}</option>)}</select>}
      </div>
    </div>
  )
}

// Astreinte / Caserné : type + lieu + horaires
export function NotifyField({ value, onChange, compact, label = 'CIS informés' }) {
  const v = value && value.at ? value : null
  const fmt = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const who = (getActor().email || '').split('@')[0]
  return (
    <div className={`notif ${v ? 'done' : ''} ${compact ? 'compact' : ''}`}>
      {v
        ? <><span className="ok" title={v.by ? `par ${v.by}` : ''}>✔ {label} · {fmt(v.at)}{v.by && !compact ? ` · ${v.by}` : ''}</span>
            <button className="link" onClick={() => onChange(null)} aria-label="Annuler la notification">✕</button></>
        : <button onClick={() => onChange({ at: Date.now(), by: who })}>🔔 {label}</button>}
    </div>
  )
}

export function DutyField({ value, onChange, lists, compact }) {
  const o = value && typeof value === 'object' ? value : {}
  const types = lists?.astreinte?.length ? lists.astreinte : ['Astreinte', 'Caserné']
  return (
    <div className={`dutyf ${compact ? 'compact' : ''}`}>
      <select aria-label="Astreinte ou caserné" value={o.type || ''} onChange={(e) => onChange({ ...o, type: e.target.value })}>
        <option value="">Astreinte / Caserné</option>{types.map((t) => <option key={t}>{t}</option>)}
      </select>
      <LocField compact={compact} value={o} lists={lists} onChange={(v) => onChange({ ...o, ...v })} />
    </div>
  )
}
