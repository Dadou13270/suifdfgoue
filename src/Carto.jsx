import React, { useMemo, useState } from 'react'
import { useDoc } from './store.js'
import { fmtLong } from './util.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default function Carto({ config, date, day }) {
  const [fleet] = useDoc('fleet/main')
  const [cat, setCat] = useState('')
  const eng = fleet?.engins || []
  const cats = [...new Set(eng.map((e) => e.cat))]
  const sts = config.statuses
  const avail = (id) => sts.find((s) => s.id === id)?.avail

  const text = useMemo(() => {
    const t = []
    Object.values(day.cells || {}).forEach((c) => c?.text && t.push(c.text))
    Object.values(day.heads || {}).forEach((x) => x && t.push(x))
    return t.join(' | ')
  }, [day])

  const state = (e) => {
    if (!avail(e.status)) return 'indispo'
    const re = new RegExp(`(^|[^A-Za-z0-9-])${esc(e.code)}(?![A-Za-z0-9]|-\\d)`, 'i')
    return re.test(text) ? 'mob' : 'dispo'
  }
  const rows = eng.filter((e) => !cat || e.cat === cat).map((e) => ({ ...e, st: state(e) }))
  const tot = (s) => rows.filter((r) => r.st === s).length
  const bassins = [...config.bassins, { name: 'Autres CIS', cis: [...new Set(rows.map((r) => r.cis))].filter((c) => c && !config.bassins.some((b) => b.cis.includes(c))) }].filter((b) => b.cis.length)
  const h = day.header || {}

  return (
    <div>
      <div className="subbar">
        <div><b style={{ textTransform: 'capitalize' }}>{fmtLong(date)}</b>
          <span className="muted"> · {[h.validation, h.nmr, h.niveau && `niveau ${h.niveau}`].filter(Boolean).join(' · ')}</span></div>
        <select data-ro-ok className="short" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Toutes catégories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <div className="stats">
        <span className="pill" style={{ '--st': '#16a34a' }}><i />Disponibles <b>{tot('dispo')}</b></span>
        <span className="pill" style={{ '--st': '#2563eb' }}><i />Mobilisés <b>{tot('mob')}</b></span>
        <span className="pill" style={{ '--st': '#dc2626' }}><i />Indisponibles <b>{tot('indispo')}</b></span>
      </div>
      {!eng.length && <p className="muted">Aucun engin. Importez le parc (Paramètres › Données) ou ajoutez-le dans « Engins ».</p>}
      <p className="muted small">Un engin est « mobilisé » quand son code apparaît dans le dispositif du jour.</p>
      {bassins.map((b) => (
        <section key={b.name} className="bassin">
          <h3>Bassin {b.name}</h3>
          <div className="ciscols">
            {b.cis.map((c) => {
              const list = rows.filter((r) => r.cis === c)
              return (
                <div className="card ciscol" key={c}>
                  <div className="cishead"><b>{c}</b><span className="muted">{list.filter((r) => r.st === 'dispo').length}/{list.length}</span></div>
                  {list.map((r) => <span key={r.id} className={`chipe ${r.st}`} title={r.status}>{r.code}</span>)}
                  {!list.length && <span className="muted small">—</span>}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <div className="legend"><span className="lg"><i style={{ background: '#16a34a' }} />Disponible</span><span className="lg"><i style={{ background: '#2563eb' }} />Mobilisé</span><span className="lg"><i style={{ background: '#dc2626' }} />Indisponible / OPEX / stage</span></div>
    </div>
  )
}
