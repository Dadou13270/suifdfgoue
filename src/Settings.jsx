import Stats from './Stats.jsx'
import React, { useState } from 'react'
import { DEFAULT_CONFIG } from './defaults.js'
import { uid, guessFilter, baseTitle } from './util.js'
import { writeDoc, useDoc } from './store.js'
import { applySeed } from './seed.js'
import Users from './Users.jsx'
import ListesIO from './ListesIO.jsx'
import YearDb from './YearDb.jsx'
import Personnel from './Personnel.jsx'
import Activity from './Activity.jsx'
import { canTab, isSuper } from './roles.js'

const move = (arr, i, d) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a }
const upd = (arr, i, patch) => arr.map((x, k) => (k === i ? { ...x, ...patch } : x))
const del = (arr, i) => arr.filter((_, k) => k !== i)

function Affichage({ c, set }) {
  return (
    <div className="form">
      <label>Titre<input value={c.title} onChange={(e) => set({ title: e.target.value })} /></label>
      <label>Groupement<input value={c.groupement} onChange={(e) => set({ groupement: e.target.value })} /></label>
      <label>Échéance (compte à rebours)<input type="date" value={c.deadline || ''} onChange={(e) => set({ deadline: e.target.value })} /></label>
      <label>Titre de la section « chaîne de commandement »<input value={c.cdtTitle || ''} onChange={(e) => set({ cdtTitle: e.target.value })} /></label>
      <label>Libellé échéance<input value={c.deadlineLabel} onChange={(e) => set({ deadlineLabel: e.target.value })} /></label>
      <label>Thème
        <select value={c.theme} onChange={(e) => set({ theme: e.target.value })}>
          <option value="auto">Automatique</option><option value="light">Clair</option><option value="dark">Sombre</option>
        </select>
      </label>
      <label>Densité
        <select value={c.density} onChange={(e) => set({ density: e.target.value })}>
          <option value="compact">Compacte</option><option value="normal">Normale</option><option value="large">Confortable (terrain)</option>
        </select>
      </label>
      <label>Couleur principale<input type="color" value={c.accent} onChange={(e) => set({ accent: e.target.value })} /></label>
    </div>
  )
}

function Mobilisation({ c, set }) {
  const levels = c.lists.niveau || []
  const grey = (n) => c.mobil?.[n] || []
  const toggle = (n, id) => set({ mobil: { ...(c.mobil || {}), [n]: grey(n).includes(id) ? grey(n).filter((x) => x !== id) : [...grey(n), id] } })
  const toggleCol = (n, on) => set({ mobil: { ...(c.mobil || {}), [n]: on ? c.blocks.map((b) => b.id) : [] } })
  const toggleRow = (id, on) => set({ mobil: Object.fromEntries(levels.map((n) => [n, on ? [...new Set([...grey(n), id])] : grey(n).filter((x) => x !== id)])) })
  return (
    <div>
      <p className="muted small">Cochez les blocs à <b>griser</b> pour chaque niveau de mobilisation. Dans le dispositif (jour et semaine), un bloc est grisé quand le niveau choisi pour le jour le coche. Un bloc grisé reste modifiable.</p>
      <div className="tablewrap">
        <table className="week mobtable">
          <thead><tr><th className="sticky">Bloc</th>{levels.map((n) => (
            <th key={n} className="mc"><div>{n}</div><input type="checkbox" aria-label={`Tout griser au niveau ${n}`} checked={c.blocks.length > 0 && grey(n).length >= c.blocks.length} onChange={(e) => toggleCol(n, e.target.checked)} /></th>
          ))}<th className="mc">Tous</th></tr></thead>
          <tbody>{c.blocks.map((b) => (
            <tr key={b.id}><th className="sticky">{baseTitle(b)}</th>
              {levels.map((n) => <td key={n} className="mc"><input type="checkbox" aria-label={`${baseTitle(b)} grisé au niveau ${n}`} checked={grey(n).includes(b.id)} onChange={() => toggle(n, b.id)} /></td>)}
              <td className="mc"><input type="checkbox" aria-label={`Griser ${baseTitle(b)} à tous les niveaux`} checked={levels.length > 0 && levels.every((n) => grey(n).includes(b.id))} onChange={(e) => toggleRow(b.id, e.target.checked)} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function Listes({ c, set }) {
  const setList = (k, text) => set({ lists: { ...c.lists, [k]: text.split('\n').map((s) => s.trim()).filter(Boolean) } })
  const listKeys = Object.keys(c.lists)
  return (
    <div>
      <h3>Champs d'en-tête</h3>
      {c.header.map((h, i) => (
        <div className="line" key={h.id}>
          <input value={h.label} onChange={(e) => set({ header: upd(c.header, i, { label: e.target.value }) })} />
          <select value={h.list} onChange={(e) => set({ header: upd(c.header, i, { list: e.target.value }) })}>
            {listKeys.map((k) => <option key={k}>{k}</option>)}
          </select>
          <button onClick={() => set({ header: move(c.header, i, -1) })}>↑</button>
          <button onClick={() => set({ header: move(c.header, i, 1) })}>↓</button>
          <button className="danger" onClick={() => set({ header: del(c.header, i) })}>✕</button>
        </div>
      ))}
      <button onClick={() => set({ header: [...c.header, { id: uid(), label: 'Nouveau champ', list: listKeys[0] }] })}>+ Champ</button>
      <h3>Listes (une valeur par ligne)</h3>
      {listKeys.map((k) => (
        <label key={k} className="listbox">
          <span>{k} {!['validation', 'nmr', 'niveau', 'gdc', 'cis', 'emplacements', 'horaires', 'grades', 'astreinte', 'cadreEmploi', 'fdf', 'mil'].includes(k) && <button className="danger" onClick={() => { const l = { ...c.lists }; delete l[k]; set({ lists: l }) }}>supprimer</button>}</span>
          <textarea rows={4} defaultValue={c.lists[k].join('\n')} onBlur={(e) => setList(k, e.target.value)} />
        </label>
      ))}
      <h3>Grades proposés par niveau FDF (Cadres)</h3>
      {(c.lists.fdf || DEFAULT_CONFIG.lists.fdf).map((f) => (
        <label key={f} className="listbox"><span>{f}</span>
          <div className="line wrap">{(c.lists.grades || DEFAULT_CONFIG.lists.grades).map((g) => {
            const cur = (c.fdfGrades || DEFAULT_CONFIG.fdfGrades)[f] || []
            return <label key={g} className="chk"><input type="checkbox" checked={cur.includes(g)} onChange={(e) => set({ fdfGrades: { ...(c.fdfGrades || DEFAULT_CONFIG.fdfGrades), [f]: e.target.checked ? [...cur, g] : cur.filter((x) => x !== g) } })} /> {g}</label>
          })}</div>
        </label>
      ))}
      <button onClick={() => { const n = prompt('Nom de la nouvelle liste'); if (n) set({ lists: { ...c.lists, [n]: [] } }) }}>+ Liste</button>
      <p className="muted">« emplacements » alimente la liste des lieux. « astreinte » : choix du champ Astreinte / Caserné. « horaires » : un créneau par ligne au format 10:00-18:00 (proposés dans chaque bloc).</p>
    </div>
  )
}

function Legende({ c, set }) {
  return (
    <div>
      {c.legend.map((l, i) => (
        <div className="line wrap" key={l.id}>
          <input type="color" value={l.color} onChange={(e) => set({ legend: upd(c.legend, i, { color: e.target.value }) })} />
          <input value={l.label} onChange={(e) => set({ legend: upd(c.legend, i, { label: e.target.value }) })} />
          <input className="grow" value={l.desc} placeholder="Description" onChange={(e) => set({ legend: upd(c.legend, i, { desc: e.target.value }) })} />
          <button onClick={() => set({ legend: move(c.legend, i, -1) })}>↑</button>
          <button onClick={() => set({ legend: move(c.legend, i, 1) })}>↓</button>
          <button className="danger" onClick={() => set({ legend: del(c.legend, i) })}>✕</button>
        </div>
      ))}
      <button onClick={() => set({ legend: [...c.legend, { id: uid(), label: 'Nouveau statut', desc: '', color: '#6b7280' }] })}>+ Statut</button>
    </div>
  )
}

function Blocs({ c, set }) {
  const setB = (i, p) => set({ blocks: upd(c.blocks, i, p) })
  return (
    <div>
      {c.blocks.map((b, i) => (
        <details className="card bedit" key={b.id}>
          <summary><b>{b.title}</b> <span className="muted">{b.rows.length} lignes</span></summary>
          <div className="line wrap">
            <input value={b.title} onChange={(e) => setB(i, { title: e.target.value })} />
            <button onClick={() => set({ blocks: move(c.blocks, i, -1) })}>↑</button>
            <button onClick={() => set({ blocks: move(c.blocks, i, 1) })}>↓</button>
            <button className="danger" onClick={() => confirm(`Supprimer « ${b.title} » ?`) && set({ blocks: del(c.blocks, i) })}>Supprimer le bloc</button>
          </div>
          <div className="line wrap">
            <label className="chk"><input type="checkbox" checked={b.show !== false} onChange={(e) => setB(i, { show: e.target.checked })} /> Afficher sur la vue jour (sinon : bouton « + {b.title} »)</label>
            <label className="chk"><input type="checkbox" checked={b.head} onChange={(e) => setB(i, { head: e.target.checked })} /> Ligne d'intitulé (chef de groupe…)</label>
            <label className="chk"><input type="checkbox" checked={!!b.duty} onChange={(e) => setB(i, { duty: e.target.checked })} /> Astreinte / Caserné + lieu + horaires</label>
            <label className="chk"><input type="checkbox" checked={b.location} onChange={(e) => setB(i, { location: e.target.checked })} /> Emplacement + horaires</label>
                        <label className="chk"><input type="checkbox" checked={b.addable ?? !!b.customName} onChange={(e) => setB(i, { addable: e.target.checked })} /> Configurable chaque jour (⚙ : nom, lignes, emplacement)</label>
            <label className="chk"><input type="checkbox" checked={b.section === 'cdt'} onChange={(e) => setB(i, { section: e.target.checked ? 'cdt' : '' })} /> Chaîne de commandement</label>
          </div>
          {b.head && <label className="chk"><input type="checkbox" checked={!!b.headCis} onChange={(e) => setB(i, { headCis: e.target.checked })} /> CIS sur la ligne d'intitulé (« GIFF1 MAT : chef de groupe »)</label>}
          {b.head && <input placeholder="Exemple d'intitulé (indice de saisie)" value={b.headHint || ''} onChange={(e) => setB(i, { headHint: e.target.value })} />}
          {b.location && (
            <div className="line wrap">
              <input className="grow" list="place-list" placeholder="Emplacement par défaut" value={b.defPlace || ''} onChange={(e) => setB(i, { defPlace: e.target.value })} />
              <input type="time" aria-label="Début par défaut" value={b.defStart || ''} onChange={(e) => setB(i, { defStart: e.target.value })} />
              <span>→</span>
              <input type="time" aria-label="Fin par défaut" value={b.defEnd || ''} onChange={(e) => setB(i, { defEnd: e.target.value })} />
            </div>
          )}
          {b.rows.map((r, j) => (
            <div className="line" key={r.id}>
              <input value={r.label} onChange={(e) => setB(i, { rows: upd(b.rows, j, { label: e.target.value }) })} />
              <input className="narrow" title="Type d'engin proposé dans la liste (VLTT, CCFM, CCFS6… ; @names = cadres ; vide = tous)" placeholder="Liste : tous"
                value={guessFilter(r)} onChange={(e) => setB(i, { rows: upd(b.rows, j, { filter: e.target.value }) })} />
              <button onClick={() => setB(i, { rows: move(b.rows, j, -1) })}>↑</button>
              <button onClick={() => setB(i, { rows: move(b.rows, j, 1) })}>↓</button>
              <button className="danger" onClick={() => setB(i, { rows: del(b.rows, j) })}>✕</button>
            </div>
          ))}
          <button onClick={() => setB(i, { rows: [...b.rows, { id: uid(), label: 'Nouvelle ligne' }] })}>+ Ligne</button>
        </details>
      ))}
      <button className="primary" onClick={() => set({ blocks: [...c.blocks, { id: uid(), title: 'Nouveau bloc', head: true, location: true, rows: [{ id: uid(), label: 'Ligne 1' }] }] })}>+ Bloc</button>
    </div>
  )
}

function Plannings({ c, set }) {
  const setP = (i, p) => set({ plannings: upd(c.plannings, i, p) })
  return (
    <div>
      {c.plannings.map((p, i) => (
        <details className="card bedit" key={p.id}>
          <summary><b>{p.title}</b> <span className="muted">{p.cols.length} colonnes</span></summary>
          <div className="line wrap">
            <input value={p.title} onChange={(e) => setP(i, { title: e.target.value })} />
            <button onClick={() => set({ plannings: move(c.plannings, i, -1) })}>↑</button>
            <button onClick={() => set({ plannings: move(c.plannings, i, 1) })}>↓</button>
            <button className="danger" onClick={() => set({ plannings: del(c.plannings, i) })}>Supprimer</button>
          </div>
          <label className="chk"><input type="checkbox" checked={p.names} onChange={(e) => setP(i, { names: e.target.checked })} /> Suggestions de noms (personnel, filtrées par cadre d'emploi de la colonne)</label>
          {p.cols.map((col, j) => (
            <div className="line" key={col.id}>
              <input value={col.label} onChange={(e) => setP(i, { cols: upd(p.cols, j, { label: e.target.value }) })} />
              <select title="Cadre d'emploi proposé (filtre des noms)" value={col.cadre || ''} onChange={(e) => setP(i, { cols: upd(p.cols, j, { cadre: e.target.value }) })}>
                <option value="">Tous les cadres</option>{(c.lists.cadreEmploi || DEFAULT_CONFIG.lists.cadreEmploi).map((x) => <option key={x}>{x}</option>)}
              </select>
              <label className="chk" title="Propose les cadres dont la colonne MIL est renseignée"><input type="checkbox" checked={!!col.mil} onChange={(e) => setP(i, { cols: upd(p.cols, j, { mil: e.target.checked }) })} /> MIL</label>
              <select title="Niveau FDF proposé (filtre des noms)" value={col.fdf || ''} onChange={(e) => setP(i, { cols: upd(p.cols, j, { fdf: e.target.value }) })}>
                <option value="">Tous les FDF</option>{(c.lists.fdf || DEFAULT_CONFIG.lists.fdf).map((x) => <option key={x}>{x}</option>)}
              </select>
              <button onClick={() => setP(i, { cols: move(p.cols, j, -1) })}>↑</button>
              <button onClick={() => setP(i, { cols: move(p.cols, j, 1) })}>↓</button>
              <button className="danger" onClick={() => setP(i, { cols: del(p.cols, j) })}>✕</button>
            </div>
          ))}
          <button onClick={() => setP(i, { cols: [...p.cols, { id: uid(), label: 'Nouvelle colonne' }] })}>+ Colonne</button>
        </details>
      ))}
      <button className="primary" onClick={() => set({ plannings: [...c.plannings, { id: uid(), title: 'Nouveau planning', names: true, cols: [{ id: uid(), label: 'Colonne 1' }] }] })}>+ Planning</button>
    </div>
  )
}

function Auto({ c, set }) {
  const af = c.autofill || { enabled: true, calendar: true, rules: [] }
  const setAf = (p) => set({ autofill: { ...af, ...p } })
  const setR = (i, p) => setAf({ rules: upd(af.rules, i, p) })
  const targets = c.blocks.flatMap((b) => [
    ...(b.head ? [[`head:${b.id}`, `${b.title} · intitulé`]] : []),
    ...b.rows.map((r) => [`cell:${b.id}:${r.id}`, `${b.title} · ${r.label}`]),
  ])
  return (
    <div>
      <section className="card autohelp">
        <h4>Comment fonctionne le remplissage automatique</h4>
        <p>À l'ouverture d'un jour, le dispositif se remplit tout seul à partir des plannings et du calendrier perpétuel. À l'ouverture, seules les cases <b>vides</b> sont complétées : ce que vous saisissez à la main n'est pas écrasé (le bouton « Importer le planning » relance le remplissage à la demande).</p>
        <dl>
          <dt>Compléter automatiquement le dispositif</dt><dd>Active ou coupe tout le remplissage à l'ouverture d'un jour.</dd>
          <dt>Reporter les engins du calendrier perpétuel</dt><dd>Place dans le dispositif les engins prévus au calendrier pour la date.</dd>
          <dt>Afficher le grade avant le nom</dt><dd>Écrit « CNE DURAND » au lieu de « DURAND ». Le grade vient de Cadres, sinon de Gestion du personnel.</dd>
        </dl>
        <p><b>Règles</b> — chacune relie une source à une cible du dispositif (« → Cible ») :</p>
        <dl>
          <dt>Colonne d'un planning</dt><dd>Reprend le nom inscrit ce jour-là dans la colonne choisie d'un planning.</dd>
          <dt>Secteur du calendrier → chef</dt><dd>Lit dans le calendrier, groupe « Secteur des GIFF », le secteur (A/B/C) du jour pour la ligne indiquée (ex. GIFF-1), puis prend dans la colonne du planning portant ce nom de secteur le chef du jour.</dd>
          <dt>Ligne du calendrier = notre groupement</dt><dd>Repère la ligne du calendrier (groupe + début de libellé, ex. MODCOL) dont la valeur du jour correspond à notre groupement, et inscrit son libellé dans la cible (format <code>{'{l}'}</code>).</dd>
          <dt>Engin du cadre</dt><dd>Catégorie du parc (ex. VLTT GIFF) : l'engin affecté au cadre, au CIS d'affectation, est placé dans la cellule choisie. S'il vise la même cellule que le nom, il est ajouté à la suite (NOM - VLTT-5 CBE).</dd>
        </dl>
        <p><b>Format</b> de la cellule : <code>{'{v}'}</code> nom · <code>{'{g}'}</code> grade (s'il est présent, la case « grade » est ignorée) · <code>{'{aff}'}</code> affectation du cadre · <code>{'{s}'}</code> secteur A/B/C du calendrier · <code>{'{l}'}</code> libellé de la ligne du calendrier.</p>
        <p className="muted small">Pensez à cliquer sur « Enregistrer » pour appliquer les règles.</p>
      </section>
      <label className="chk"><input type="checkbox" checked={af.enabled} onChange={(e) => setAf({ enabled: e.target.checked })} /> Compléter automatiquement le dispositif à l'ouverture d'un jour</label>
      <label className="chk"><input type="checkbox" checked={af.calendar !== false} onChange={(e) => setAf({ calendar: e.target.checked })} /> Reporter les engins du calendrier perpétuel</label>
      <label className="chk"><input type="checkbox" checked={!!af.grade} onChange={(e) => setAf({ grade: e.target.checked })} /> Afficher le grade avant le nom (ex. CNE DURAND) — grade pris dans Cadres, sinon Gestion du personnel</label>
      <h3>Règles issues des plannings</h3>
      {af.rules.map((r, i) => (
        <div className="card rule" key={r.id}>
          <div className="line wrap">
            <select value={r.kind} onChange={(e) => setR(i, { kind: e.target.value })}>
              <option value="planning">Colonne d'un planning</option><option value="sector">Secteur du calendrier → chef</option><option value="match">Ligne du calendrier = notre groupement</option>
            </select>
            {r.kind !== 'match' && <select value={r.planning} onChange={(e) => setR(i, { planning: e.target.value, col: '' })}>
              {c.plannings.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>}
            {r.kind === 'match'
              ? <><input value={r.group || ''} placeholder="Groupe du calendrier" onChange={(e) => setR(i, { group: e.target.value })} />
                  <input value={r.labelPrefix || ''} placeholder="Début du libellé (MODCOL)" onChange={(e) => setR(i, { labelPrefix: e.target.value })} /></>
              : r.kind === 'planning'
              ? <select value={r.col || ''} onChange={(e) => setR(i, { col: e.target.value })}><option value="">Colonne…</option>
                {(c.plannings.find((p) => p.id === r.planning)?.cols || []).map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}</select>
              : <input value={r.calLine || ''} placeholder="Ligne du calendrier (GIFF-1)" onChange={(e) => setR(i, { calLine: e.target.value })} />}
          </div>
          <div className="line wrap">
            <span>→</span>
            <select value={r.target} onChange={(e) => setR(i, { target: e.target.value })}>
              <option value="">Cible…</option>{targets.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            {r.kind !== 'match' && <label className="chk"><input type="checkbox" checked={r.grade ?? !!af.grade} onChange={(e) => setR(i, { grade: e.target.checked })} /> Grade avant le nom</label>}
            <input value={r.fmt || ''} onChange={(e) => setR(i, { fmt: e.target.value })} placeholder="{v}{aff}" />
          </div>
          <div className="line wrap">
            <span className="muted small">Engin du cadre</span>
            <input value={r.engineCat || ''} placeholder="Catégorie du parc (VLTT GIFF)" onChange={(e) => setR(i, { engineCat: e.target.value })} />
            <select value={r.engineTarget || ''} onChange={(e) => setR(i, { engineTarget: e.target.value })}>
              <option value="">Aucun engin</option>{targets.filter(([k]) => k.startsWith('cell:')).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            <button className="danger" onClick={() => setAf({ rules: del(af.rules, i) })}>✕</button>
          </div>
        </div>
      ))}
      <button className="primary" onClick={() => setAf({ rules: [...af.rules, { id: uid(), kind: 'planning', planning: c.plannings[0]?.id, col: '', target: '', fmt: '{v}{aff}' }] })}>+ Règle</button>
    </div>
  )
}

function Engins({ c, set }) {
  const crew = c.crew || DEFAULT_CONFIG.crew
  const [fleet] = useDoc('fleet/main')
  const known = new Set(crew.map((x) => String(x.key).toUpperCase()))
  const [sub, setSub] = useState('crew')
  const todo = [...new Set((fleet?.engins || []).map((e) => String(e.code || '').split('-')[0].toUpperCase()).filter(Boolean))].filter((k) => !known.has(k)).sort()
  return (
    <div>
      <nav className="tabs stsub">{[['crew', 'Effectifs par engin'], ['stat', 'Statuts'], ['bas', 'Bassins']].map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</nav>
      {sub === 'crew' && <>
      <h3>Effectif par engin (PAX)</h3>
      <p className="muted small">Le compteur « x PAX » en haut de chaque bloc additionne l'équipage des engins saisis. Le type est lu au début du code (CCFM-12 → CCFM).</p>
      <div className="crew-grid">
        {crew.map((x, i) => (
          <div className="crew-tile" key={i}>
            <button className="crew-x" aria-label="Supprimer" onClick={() => set({ crew: del(crew, i) })}>✕</button>
            <input className="crew-code" value={x.key} placeholder="Type (CCFM)" onChange={(e) => set({ crew: upd(crew, i, { key: e.target.value.toUpperCase() }) })} />
            <div className="crew-step">
              <button aria-label="Moins" onClick={() => set({ crew: upd(crew, i, { pax: Math.max(0, (Number(x.pax) || 0) - 1) }) })}>−</button>
              <input type="number" min="0" aria-label={`Hommes ${x.key}`} value={x.pax} onChange={(e) => set({ crew: upd(crew, i, { pax: Number(e.target.value) }) })} />
              <button aria-label="Plus" onClick={() => set({ crew: upd(crew, i, { pax: (Number(x.pax) || 0) + 1 }) })}>+</button>
            </div>
            <span className="crew-unit">hommes</span>
          </div>
        ))}
        <button className="crew-add" onClick={() => set({ crew: [...crew, { key: '', pax: 2 }] })}>+ Type d'engin</button>
      </div>
      {todo.length > 0 && (
        <>
          <h4 className="crew-sub">Types du parc sans effectif <span className="muted small">non comptés tant que le nombre d'hommes n'est pas renseigné</span></h4>
          <div className="crew-grid">
            {todo.map((k) => (
              <div className="crew-tile todo" key={k}>
                <span className="crew-code ecode">{k}</span>
                <input type="number" min="0" className="crew-num" placeholder="hommes" aria-label={`Hommes ${k}`} value="" onChange={(e) => e.target.value !== '' && set({ crew: [...crew, { key: k, pax: Number(e.target.value) }] })} />
              </div>
            ))}
          </div>
        </>
      )}
      <h4 className="crew-sub">Autres compteurs</h4>
      <div className="crew-grid">
        <label className="crew-tile">
          <span className="crew-code">SIGAR</span>
          <input type="number" min="0" className="crew-num" value={c.sigarPax ?? DEFAULT_CONFIG.sigarPax} onChange={(e) => set({ sigarPax: Number(e.target.value) })} />
          <span className="crew-unit">hommes par moyen</span>
        </label>
        <label className="crew-tile">
          <span className="crew-code">Chaîne de commandement</span>
          <input type="number" min="0" className="crew-num" value={c.cdtPax ?? DEFAULT_CONFIG.cdtPax} onChange={(e) => set({ cdtPax: Number(e.target.value) })} />
          <span className="crew-unit">PAX par personne</span>
        </label>
      </div>
      </>}
      {sub === 'stat' && <>
      <h3>Statuts des engins</h3>
      {c.statuses.map((s, i) => (
        <div className="line wrap" key={s.id}>
          <input type="color" value={s.color} onChange={(e) => set({ statuses: upd(c.statuses, i, { color: e.target.value }) })} />
          <input value={s.label} onChange={(e) => set({ statuses: upd(c.statuses, i, { label: e.target.value }) })} />
          <label className="chk"><input type="checkbox" checked={!!s.avail} onChange={(e) => set({ statuses: upd(c.statuses, i, { avail: e.target.checked }) })} /> Engin utilisable</label>
          <button className="danger" onClick={() => set({ statuses: del(c.statuses, i) })}>✕</button>
        </div>
      ))}
      <button onClick={() => set({ statuses: [...c.statuses, { id: uid().toUpperCase(), label: 'Nouveau statut', color: '#6b7280', avail: false }] })}>+ Statut</button>
      </>}
      {sub === 'bas' && <>
      <h3>Bassins (carto CIS)</h3>
      {c.bassins.map((b, i) => (
        <div className="line wrap" key={i}>
          <input value={b.name} onChange={(e) => set({ bassins: upd(c.bassins, i, { name: e.target.value }) })} />
          <input className="grow" value={b.cis.join(', ')} placeholder="CIS séparés par des virgules"
            onChange={(e) => set({ bassins: upd(c.bassins, i, { cis: e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) }) })} />
          <button className="danger" onClick={() => set({ bassins: del(c.bassins, i) })}>✕</button>
        </div>
      ))}
      <button onClick={() => set({ bassins: [...c.bassins, { name: 'Nouveau bassin', cis: [] }] })}>+ Bassin</button>
      </>}
    </div>
  )
}

function Donnees({ c, setAll, role, config, selfId }) {
  const [msg, setMsg] = useState('')
  const seed = async () => { setMsg('Import en cours…'); try { await applySeed(writeDoc); setMsg('Données du classeur importées (plannings, parc, calendrier, cadres).') } catch { setMsg("Échec de l'import.") } }
  const exp = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })); a.download = 'config_dispositif.json'; a.click()
  }
  const imp = (e) => {
    const f = e.target.files[0]; if (!f) return
    f.text().then((t) => { try { setAll({ ...DEFAULT_CONFIG, ...JSON.parse(t) }) } catch { alert('Fichier invalide') } })
  }
  const [sub, setSub] = useState('year')
  return (
    <div className="stack">
      <nav className="tabs stsub wrapnav">{[['year', 'Base annuelle'], ['lists', 'Listes'], ['conf', 'Configuration']].map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</nav>
      {sub === 'year' && <YearDb role={role} />}
      {sub === 'lists' && <ListesIO config={config} role={role} selfId={selfId} />}
      {sub === 'conf' && <>
        <h3>Configuration et classeur</h3>
        <button onClick={exp}>⭳ Exporter la configuration (JSON)</button>
        <label className="filebtn">⭱ Importer une configuration<input type="file" accept="application/json" onChange={imp} hidden /></label>
        <button onClick={seed} disabled={!isSuper(role)}>Importer les données du classeur Excel</button>
        {!isSuper(role) && <p className="muted small">Import et réinitialisation : réservés au super administrateur.</p>}
        {msg && <div className="banner">{msg}</div>}
        <p className="muted small">Remplace les plannings, le parc d'engins, le calendrier perpétuel et la liste des cadres.</p>
        <button className="danger" disabled={!isSuper(role)} onClick={() => confirm('Revenir à la configuration par défaut ?') && setAll(DEFAULT_CONFIG)}>Réinitialiser aux valeurs par défaut</button>
      </>}
    </div>
  )
}

const TABS = [['aff', 'Affichage'], ['blocs', 'Blocs'], ['listes', 'Listes & en-tête'], ['mob', 'Niveau de mobilisation'], ['leg', 'Légende'], ['plan', 'Plannings'], ['auto', 'Remplissage auto'], ['eng', 'Engins & CIS'], ['stats', 'Statistiques'], ['staff', 'Gestion du personnel'], ['users', 'Rôles'], ['log', 'Activité'], ['data', 'Données']]

export default function Settings({ config, onSave, onBack, onLogout, role, selfId }) {
  const [c, setC] = useState(config)
  const [tab, setTab] = useState('aff')
  const [saved, setSaved] = useState(true)
  const set = (p) => { setC((x) => ({ ...x, ...p })); setSaved(false) }
  const setAll = (n) => { setC(n); setSaved(false) }
  const save = async () => { await onSave(c); setSaved(true) }
  return (
    <div className="app settings">
      <header className="top">
        <button onClick={onBack}>‹ Retour</button>
        <b>Paramètres</b>
        <div className="actions">
          {onLogout && <button onClick={onLogout}>Déconnexion</button>}
          <button className="primary" disabled={saved} onClick={save}>{saved ? 'Enregistré' : 'Enregistrer'}</button>
        </div>
      </header>
      <nav className="tabs">{TABS.filter(([k]) => !['users', 'staff', 'log'].includes(k) || canTab(role, 'users')).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
      <main>
        {tab === 'aff' && <Affichage c={c} set={set} />}
        {tab === 'blocs' && <Blocs c={c} set={set} />}
        {tab === 'listes' && <Listes c={c} set={set} />}
        {tab === 'mob' && <Mobilisation c={c} set={set} />}
        {tab === 'leg' && <Legende c={c} set={set} />}
        {tab === 'auto' && <Auto c={c} set={set} />}
        {tab === 'plan' && <Plannings c={c} set={set} />}
        {tab === 'eng' && <Engins c={c} set={set} />}
        {tab === 'stats' && <Stats config={config} />}
        {tab === 'staff' && <Personnel c={c} set={set} config={config} role={role} selfId={selfId} dirty={!saved} />}
        {tab === 'log' && <Activity config={config} />}
        {tab === 'users' && <Users role={role} selfId={selfId} config={config} />}
        {tab === 'data' && <Donnees c={c} setAll={setAll} role={role} config={config} selfId={selfId} />}
      </main>
    </div>
  )
}
