import React, { useMemo, useState } from 'react'
import { useDoc, useDays, writeDoc, getActor } from './store.js'
import { ENG, labelOf, labelsIn, freeStatus, strip } from './engage.js'
import { uid } from './util.js'

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fmtT = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtD = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })
const who = () => { const a = getActor(); return a.name || (a.email || '').split('@')[0] || '' }

// Remplace l'engin dans le texte d'une cellule du dispositif
function replaceIn(text, oldE, newE) {
  const nl = `${newE.code} ${newE.cis || ''}`.trim()
  const ol = `${oldE.code} ${oldE.cis || ''}`.trim()
  const full = new RegExp(esc(ol).replace(/\s+/g, '\\s+'), 'i')
  if (full.test(text)) return text.replace(full, nl)
  const code = new RegExp(`(^|[^A-Za-z0-9-])${esc(oldE.code)}(?![A-Za-z0-9-])`, 'i')
  return code.test(text) ? text.replace(code, (_, p) => p + nl) : null
}

export default function Releves({ config }) {
  const [fdoc] = useDoc('fleet/main')
  const [rdoc] = useDoc('releves/main')
  const fleet = fdoc?.engins || []
  const sts = config.statuses
  const stOf = (id) => sts.find((s) => s.id === id) || { id, label: id, color: '#6b7280' }
  const availIds = new Set(sts.filter((s) => s.avail).map((s) => s.id))
  const log = rdoc?.log || []

  // groupes engagés = engins au statut « engagé », regroupés par engagement
  const groups = useMemo(() => {
    const m = new Map()
    fleet.filter((e) => e.status === ENG && e.eng?.key).forEach((e) => { if (!m.has(e.eng.key)) m.set(e.eng.key, { key: e.eng.key, meta: e.eng, list: [] }); m.get(e.eng.key).list.push(e) })
    return [...m.values()].sort((a, b) => (b.meta.at || 0) - (a.meta.at || 0))
  }, [fleet])
  const dates = useMemo(() => [...new Set(groups.map((g) => g.meta.date).filter(Boolean))], [groups])
  const [days] = useDays(dates, true)
  const takenOn = (date) => { const s = new Set(); Object.values(days[date]?.cells || {}).forEach((c) => labelsIn(fleet, c?.text).forEach((l) => s.add(l))); return s }

  const [sel, setSel] = useState(null)       // { key, id } : engin à relever
  const [pick, setPick] = useState(null)     // engin remplaçant choisi
  const [motif, setMotif] = useState('')
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const selGroup = sel && groups.find((g) => g.key === sel.key)
  const selEng = selGroup?.list.find((e) => e.id === sel.id)
  const cats = doc2cats(fdoc, fleet)
  const taken = selEng ? takenOn(selEng.eng.date) : new Set()
  const free = fleet.filter((e) => e.status !== ENG && availIds.has(e.status))
    .filter((e) => (!cat || e.cat === cat) && (!q || `${e.code} ${e.cis}`.toLowerCase().includes(q.toLowerCase())))

  const start = (g, e) => { setSel({ key: g.key, id: e.id }); setPick(null); setMotif(''); setCat(e.cat || ''); setQ(''); setMsg('') }
  const cancel = () => { setSel(null); setPick(null); setMotif('') }

  async function confirm() {
    if (!selEng || !pick || busy) return
    setBusy(true)
    try {
      const meta = selEng.eng
      const blockId = meta.key.split('|')[1]
      const nextFleet = fleet.map((e) => {
        if (e.id === selEng.id) return { ...strip(e), status: freeStatus(e, sts) }
        if (e.id === pick.id) return { ...e, prev: e.status === ENG ? e.prev : e.status, status: ENG, eng: { ...meta } }
        return e
      })
      await writeDoc('fleet/main', { engins: nextFleet }, true)
      // reporte le changement dans le dispositif (vue jour et semaine, en temps réel)
      const cells = days[meta.date]?.cells || {}
      const patch = {}
      Object.entries(cells).forEach(([k, c]) => {
        if (!k.startsWith(`${blockId}__`)) return
        const t = replaceIn(String(c?.text || ''), selEng, pick)
        if (t != null) patch[k] = { text: t }
      })
      if (Object.keys(patch).length) await writeDoc(`days/${meta.date}`, { cells: patch }, true)
      const entry = { id: uid(), at: Date.now(), by: who(), key: meta.key, date: meta.date, group: meta.group, from: labelOf(selEng), to: labelOf(pick), note: motif.trim(), inDay: Object.keys(patch).length > 0 }
      await writeDoc('releves/main', { log: [entry, ...log].slice(0, 500) }, true)
      setMsg(`${labelOf(selEng)} relevé par ${labelOf(pick)}${entry.inDay ? '' : ' (non trouvé dans le dispositif : à corriger à la main)'}.`)
      cancel()
    } catch { setMsg('Échec de la relève.') }
    setBusy(false)
  }

  return (
    <div className="releves">
      <div className="subbar"><b>Relèves <span className="muted">{groups.length} groupe(s) engagé(s) · {fleet.filter((e) => e.status !== ENG && availIds.has(e.status)).length} engin(s) disponible(s)</span></b></div>
      {msg && <div className="banner" onClick={() => setMsg('')}>{msg}</div>}
      <div className="rel-grid">
        <section className="rel-col">
          <h3 className="cathead">Groupes engagés</h3>
          {!groups.length && <p className="muted">Aucun groupe engagé. Le bouton « Engagé » d'un bloc (vue jour ou semaine) le place ici.</p>}
          {groups.map((g) => {
            const hist = log.filter((l) => l.key === g.key)
            return (
              <div className="card rel-group" key={g.key}>
                <div className="rel-head"><b>{g.meta.kind === 'aladin' ? '🚨' : '🔥'} {g.meta.group}{g.meta.kind === 'aladin' ? ' (Aladin)' : ''}</b><span className="muted small">{fmtD(g.meta.date)} · {g.meta.kind === 'aladin' ? 'aladin' : 'engagé'} {fmtT(g.meta.at)}{g.meta.by ? ` · ${g.meta.by}` : ''}</span></div>
                {g.meta.note && <div className="small rel-note">{g.meta.note}</div>}
                {g.list.map((e) => {
                  const on = sel?.id === e.id
                  return (
                    <div className={`rel-eng ${on ? 'on' : ''}`} key={e.id}>
                      <b>{e.code}</b><span className="muted">{e.cis}</span>
                      <button className={on ? 'primary' : ''} onClick={() => (on ? cancel() : start(g, e))}>{on ? 'Annuler' : '↻ Relever'}</button>
                    </div>
                  )
                })}
                {!!hist.length && <div className="rel-hist">{hist.map((h) => <div className="small" key={h.id}>↻ {fmtT(h.at)} · <s>{h.from}</s> → <b>{h.to}</b>{h.by ? ` · ${h.by}` : ''}{h.note ? ` · ${h.note}` : ''}</div>)}</div>}
              </div>
            )
          })}
        </section>
        <section className="rel-col">
          <h3 className="cathead">Engins disponibles</h3>
          {selEng
            ? <div className="relbar"><b>Relever {labelOf(selEng)}</b> : choisissez le remplaçant{pick && <> → <b>{labelOf(pick)}</b></>}
                <input placeholder="Motif (panne, fin de mission…)" value={motif} onChange={(e) => setMotif(e.target.value)} />
                <div className="actions"><button className="primary" disabled={!pick || busy} onClick={confirm}>Valider la relève</button><button onClick={cancel}>Annuler</button></div></div>
            : <p className="muted small">Cliquez sur « Relever » à côté d'un engin engagé, puis choisissez son remplaçant ici.</p>}
          <div className="rel-filter">
            <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Toutes catégories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="card rel-free">
            {!free.length && <p className="muted">Aucun engin disponible.</p>}
            {free.map((e) => {
              const st = stOf(e.status)
              const dup = selEng && taken.has(labelOf(e))
              return (
                <button key={e.id} className={`rel-pick ${pick?.id === e.id ? 'on' : ''}`} disabled={!selEng || dup} onClick={() => setPick(e)} title={dup ? 'Déjà pris ce jour dans le dispositif' : ''}>
                  <b>{e.code}</b><span className="muted">{e.cis}</span><span className="muted small">{e.cat}</span>
                  <span className="pill" style={{ '--st': st.color }}>{dup ? 'déjà pris' : st.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
function doc2cats(doc, fleet) { return doc?.cats?.length ? doc.cats : [...new Set(fleet.map((e) => e.cat))] }
