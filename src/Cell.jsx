import { createPortal } from 'react-dom'
import { getActor, writeDoc } from './store.js'
import { DayIndex, labelOf, labelsIn } from './engage.js'
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
export function EngineCell({ cell = {}, legend, onChange, compact, listId = 'eng-list', cis, filter, ckey }) {
  const { fix, fleet = [], statuses = [] } = useContext(Lookup)
  const idx = useContext(DayIndex)
  const [foc, setFoc] = useState(false)
  const [warn, setWarn] = useState('')
  const [rev, setRev] = useState(0)
  const [ednote, setEdnote] = useState(false)
  const [nv, setNv] = useState('')
  const uid = 'dlc' + useId().replace(/\W/g, '')
  const own = filter !== '@names'
  const taken = own && idx && ckey ? idx.takenFor(ckey) : new Set()
  const dup = own && idx && ckey ? idx.dupOf(ckey) : false
  let opts = []
  if (own && foc) {
    const ok = (e) => statuses.find((s) => s.id === e.status)?.avail !== false
    const f = (filter || '').toUpperCase() + (/\d$/.test(filter || '') ? '-' : '')
    const all = fleet.filter((e) => ok(e) && !taken.has(labelOf(e)) && (!filter || e.code.toUpperCase().startsWith(f)))
    opts = cis ? [...all.filter((e) => e.cis === cis), ...all.filter((e) => e.cis !== cis)] : all
  }
  const idxl = legend.findIndex((l) => l.id === cell.status)
  const cur = legend[idxl]
  const next = () => {
    const n = idxl + 1 >= legend.length ? -1 : idxl + 1
    onChange({ status: n === -1 ? '' : legend[n].id })
  }
  const parsed = (() => {
    const m = /^([A-Z]+\d*[A-Z]*)-(\d+[A-Z]?)\s+([A-Z]{2,5})$/i.exec(String(cell.text || '').trim())
    if (!m || !own || !fleet.length) return null
    const code = `${m[1]}-${m[2]}`.toUpperCase(); const cis = m[3].toUpperCase()
    if (fleet.some((e) => labelOf(e) === `${code} ${cis}`)) return null
    const pref = m[1].toUpperCase()
    const cat = fleet.find((e) => String(e.code).toUpperCase().startsWith(pref + '-'))?.cat || pref
    return { code, cis, cat }
  })()
  const addToFleet = () => {
    if (!parsed) return
    const status = statuses.find((s) => s.avail)?.id || statuses[0]?.id
    writeDoc('fleet/main', { engins: [...fleet, { id: Math.random().toString(36).slice(2, 10), ...parsed, status }] }, true)
  }
  const commit = (t) => {
    const clash = own && taken.size ? [...labelsIn(fleet, t)].find((l) => taken.has(l)) : null
    if (clash) { setWarn(`${clash} est déjà pris ce jour`); setTimeout(() => setWarn(''), 4000); setRev((r) => r + 1); return }
    setWarn('')
    onChange({ text: t, auto: false })
  }
  return (
    <div className={`ecell ${compact ? 'compact' : ''} ${cell.auto ? 'auto' : ''} ${dup ? 'dupe' : ''}`} style={cur ? { '--st': cur.color } : undefined} data-st={cur ? 1 : 0} title={dup ? 'Engin déjà utilisé ailleurs ce jour' : undefined}>
      <span className="dlwrap" onPointerEnter={() => setFoc(true)} onFocus={() => setFoc(true)}>
        <TextField key={rev} value={cell.text} fix={fix} list={own ? uid : listId} onCommit={commit} />
        {own && foc && <datalist id={uid}>{opts.map((e) => <option key={e.id} value={`${e.code} ${e.cis}`.trim()} />)}</datalist>}
      </span>
      {!compact && <button className={`cmt ${cell.note ? 'has' : ''}`} onClick={() => { setNv(cell.note || ''); setEdnote(!ednote) }} title={cell.note ? 'Modifier le commentaire' : 'Ajouter un commentaire'} aria-label="Commentaire sur l'engin">💬</button>}
      <button className="dot" onClick={next} title={cur ? cur.label : 'Statut'} aria-label="Changer le statut" />
      {!compact && ednote && <input className="enote-in" autoFocus placeholder="Commentaire…" value={nv} onChange={(e) => setNv(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} onBlur={() => { setEdnote(false); if (nv.trim() !== (cell.note || '')) onChange({ note: nv.trim() }) }} />}
      {!compact && !ednote && cell.note && <div className="enote" onClick={() => { setNv(cell.note); setEdnote(true) }}>{cell.note}</div>}
      {warn && <span className="dupwarn" role="alert">{warn}</span>}
      {parsed && !warn && <button className="addfleet" onClick={addToFleet} title={`Ajouter ${parsed.code} ${parsed.cis} au parc (${parsed.cat})`}>＋ parc</button>}
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
  const a = getActor()
  const who = a.name || (a.email || '').split('@')[0]
  return (
    <div className={`notif ${v ? 'done' : ''} ${compact ? 'compact' : ''}`}>
      {v
        ? <><span className="ok" title={v.by ? `par ${v.by}` : ''}>✔ {label} · {fmt(v.at)}{v.by ? ` · ${v.by}` : ''}</span>
            <button className="link" onClick={() => onChange(null)} aria-label="Annuler la notification">✕</button></>
        : <button onClick={() => onChange({ at: Date.now(), by: who })}>🔔 {label}</button>}
    </div>
  )
}

function stamp() { const a = getActor(); return { at: Date.now(), by: a.name || (a.email || '').split('@')[0] } }

export function EngageField({ value, onChange, compact, icon = '🔥', word = 'Engagé', ph = 'Commentaire (lieu du feu, mission…)' }) {
  const v = value && value.at ? value : null
  const [note, setNote] = useState(v?.note || '')
  useEffect(() => setNote(v?.note || ''), [v?.note])
  const fmt = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`engage ${v ? 'done' : ''} ${compact ? 'compact' : ''} ${word === 'Aladin' ? 'aladin' : ''}`}>
      <div className="notif">
        {v
          ? <><span className="eng" title={v.by ? `par ${v.by}` : ''}>{icon} {word} · {fmt(v.at)}{v.by ? ` · ${v.by}` : ''}</span>
              <button className="link" onClick={() => onChange(null)} aria-label={`Annuler : ${word}`}>✕</button></>
          : <button onClick={() => onChange(stamp())}>{icon} {word}</button>}
      </div>
      {v && <input className="engnote" aria-label={`Commentaire : ${word}`} placeholder={ph} value={note}
        onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (v.note || '') && onChange({ ...v, note })} />}
    </div>
  )
}

export function NotifyBar({ notif, engaged, onNotif, onEngaged, aladin, onAladin, label, compact }) {
  return (
    <div className="notifbar">
      <NotifyField label={label} compact={compact} value={notif} onChange={onNotif} />
      <EngageField compact={compact} value={engaged} onChange={onEngaged} />
      {onAladin && <EngageField compact={compact} value={aladin} onChange={onAladin} icon="🚨" word="Aladin" ph="Commentaire (motif Aladin…)" />}
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
