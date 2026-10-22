import React, { useEffect, useMemo, useState } from 'react'
import { useDoc, useUsers, subscribe, writeDoc } from './store.js'
import { TextField } from './Cell.jsx'
import { ROLES, assignableBy, canEditUser } from './roles.js'
import { uid, syncCadres } from './util.js'
import { DEFAULT_CONFIG } from './defaults.js'

// Personnel + droits déduits de la fonction. La fonction donne un rôle (config.fonctions) ;
// le rôle est appliqué au compte dont l'e-mail correspond à celui de la fiche.
export function usePersonnel(config, role, selfId, enabled) {
  const [doc, patch] = useDoc('personnel/main', enabled)
  const [users, setRole] = useUsers(enabled)
  const list = doc?.list || []
  const fonctions = config?.fonctions || []
  const mapped = (p) => (p.role !== undefined ? p.role || 'pending' : fonctions.find((f) => f.id === p.fonction)?.role || 'pending')
  const linkOf = (p) => (p.email ? users.find((u) => (u.email || '').toLowerCase() === p.email.trim().toLowerCase()) : undefined)
  const needsSync = (p) => {
    const u = linkOf(p); const r = mapped(p)
    return !!u && u.id !== selfId && (u.role || 'pending') !== r && canEditUser(role, u) && assignableBy(role).includes(r)
  }
  const sync = async (p) => { const u = linkOf(p); if (u && needsSync(p)) await setRole(u.id, mapped(p)) }
  // Chaque fiche avec e-mail alimente roster/{e-mail} : c'est ce document que la personne lit pour recevoir son rôle à la connexion
  const save = (l) => {
    const key = (p) => (p.email || '').trim().toLowerCase()
    const prev = new Map(list.filter(key).map((p) => [key(p), p]))
    l.filter(key).forEach((p) => {
      const role = mapped(p) === 'pending' ? '' : mapped(p)
      const o = prev.get(key(p)); prev.delete(key(p))
      if (!o || o.role !== p.role || o.fonction !== p.fonction || o.nom !== p.nom || o.prenom !== p.prenom) writeDoc(`roster/${key(p)}`, { role, nom: p.nom || '', prenom: p.prenom || '' }, false)
    })
    prev.forEach((_, k) => writeDoc(`roster/${k}`, { role: '', nom: '', prenom: '' }, false))   // e-mail retiré de la fiche
    return patch({ list: l })
  }
  return { loaded: !!doc, list, save, users, linkOf, mapped, needsSync, sync, syncAll: () => Promise.all(list.map(sync)) }
}

const ROLE_OPTS = ['', 'ogg', 'cds', 'chefcolonne', 'admin', 'superadmin']

export default function Personnel({ c, set, config, role, selfId, dirty }) {
  const P = usePersonnel(config, role, selfId, true)
  const [cadres, patchCadres] = useDoc('cadres/main')
  // Cadres = reflet du Personnel
  const upC = cadres ? syncCadres(cadres.list, P.list) : null
  const upKey = upC ? upC.map((x) => `${x.nom}|${x.grade}|${x.prenom}`).join(';') : ''
  useEffect(() => { if (upC) patchCadres({ list: upC }) }, [upKey]) // eslint-disable-line
  const [q, setQ] = useState('')
  const [lt, setLt] = useState('')
  const initial = (c) => (String(c.nom || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase() || '#').replace(/[^A-Z]/, '#')
  // Noms présents dans les plannings (avec FDF / cadre d'emploi de leur colonne)
  const [plans, setPlans] = useState({})
  const pkey = (config.plannings || []).map((p) => p.id).join(',')
  useEffect(() => {
    const offs = (config.plannings || []).map((p) => subscribe(`planning/${p.id}`, (v) => setPlans((x) => ({ ...x, [p.id]: v?.days || {} }))))
    return () => offs.forEach((o) => o())
  }, [pkey]) // eslint-disable-line
  const norm = (s) => String(s || '').trim().toUpperCase()
  const fromPlans = useMemo(() => {
    const m = new Map()
    ;(config.plannings || []).forEach((pl) => Object.values(plans[pl.id] || {}).forEach((row) => pl.cols.forEach((col) => {
      const n = norm(row?.[col.id]); if (!n) return
      const e = m.get(n) || { nom: n, fdf: '', cadreEmploi: '' }
      if (!e.fdf && col.fdf) e.fdf = col.fdf
      if (!e.cadreEmploi && col.cadre) e.cadreEmploi = col.cadre
      m.set(n, e)
    })))
    return [...m.values()]
  }, [plans, config.plannings])
  const todo = fromPlans.filter((e) => { const p = P.list.find((x) => norm(x.nom) === e.nom); return !p || (!p.fdf && e.fdf) || (!p.cadreEmploi && e.cadreEmploi) })
  const importPlans = () => {
    const list = P.list.map((p) => { const e = fromPlans.find((x) => x.nom === norm(p.nom)); return e ? { ...p, fdf: p.fdf || e.fdf, cadreEmploi: p.cadreEmploi || e.cadreEmploi } : p })
    const have = new Set(list.map((p) => norm(p.nom)))
    const add = fromPlans.filter((e) => !have.has(e.nom)).map((e) => ({ id: uid(), nom: e.nom, prenom: '', grade: '', cadreEmploi: e.cadreEmploi, fdf: e.fdf, role: '', email: '' }))
    P.save([...add, ...list])
  }
  const grades = c.lists.grades || DEFAULT_CONFIG.lists.grades
  const fonctions = c.fonctions || []
  const fdfs = c.lists.fdf || DEFAULT_CONFIG.lists.fdf
  const cadresEmploi = c.lists.cadreEmploi || DEFAULT_CONFIG.lists.cadreEmploi
  const can = assignableBy(role)
  const upd = (id, p) => P.save(P.list.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const changeRole = (p, r) => {
    const next = { ...p, role: r }
    P.save(P.list.map((x) => (x.id === p.id ? next : x)))
    const u = P.linkOf(next)   // le rôle est appliqué tout de suite au compte lié
    if (u && u.id !== selfId && canEditUser(role, u) && can.includes(r || 'pending')) P.sync(next)
  }
  const importCadres = () => {
    const have = new Set(P.list.map((p) => `${p.nom}|${p.prenom}`.toLowerCase()))
    const add = (cadres?.list || []).filter((x) => !have.has(`${x.nom}|${x.prenom}`.toLowerCase()))
      .map((x) => ({ id: uid(), nom: x.nom, prenom: x.prenom, grade: x.grade || '', cadreEmploi: '', fdf: '', role: '', email: '' }))
    if (add.length) P.save([...P.list, ...add])
  }
  const shown = P.list.filter((p) => (!lt || initial(p) === lt) && (!q || `${p.nom} ${p.prenom}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr') || String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr'))
  const pending = P.list.filter(P.needsSync).length
  const tokens = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean).sort().join(' ')
  const linkedEmails = new Set(P.list.map((p) => (p.email || '').trim().toLowerCase()).filter(Boolean))
  const suggestions = P.users.filter((u) => u.email && !linkedEmails.has(u.email.toLowerCase()) && u.name)
    .map((u) => ({ u, p: P.list.find((p) => !(p.email || '').trim() && tokens(`${p.nom} ${p.prenom}`) === tokens(u.name)) })).filter((x) => x.p)

  return (
    <div>
      {suggestions.length > 0 && (
        <div className="banner">
          <b>Comptes reconnus par leur nom, à rattacher :</b>
          {suggestions.map(({ u, p }) => (
            <div className="line wrap" key={u.id}>
              <span>{u.name} ({u.email}) ↔ fiche {p.nom} {p.prenom}</span>
              <button className="primary" onClick={() => upd(p.id, { email: u.email })}>Rattacher : e-mail de la fiche = compte</button>
            </div>
          ))}
        </div>
      )}
      <h3>Personnel <span className="muted">{shown.length}{shown.length !== P.list.length ? `/${P.list.length}` : ''}</span></h3>
      <div className="line wrap small">
        {fdfs.map((f) => <span className="chip" key={f}>{f} : {P.list.filter((p) => p.fdf === f).length}</span>)}
        <span className="chip">Sans FDF : {P.list.filter((p) => !p.fdf).length}</span>
        <span className="chip">Comptes liés : {P.list.filter((p) => P.linkOf(p)).length}</span>
      </div>
      <div className="subbar">
        <input className="short" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="actions">
          <button onClick={P.syncAll} disabled={!pending || dirty} title={dirty ? 'Enregistrez d’abord les paramètres' : ''}>Appliquer les droits{pending ? ` (${pending})` : ''}</button>
          <button className="primary" onClick={() => P.save([{ id: uid(), nom: 'NOUVEAU', prenom: '', grade: '', cadreEmploi: '', fdf: '', role: '', email: '' }, ...P.list])}>+ Personne</button>
        </div>
      </div>
      <div className="alpha" role="group" aria-label="Filtrer par lettre">
        <button className={!lt ? 'on' : ''} onClick={() => setLt('')}>Tous</button>
        {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((L) => {
          const n = P.list.filter((p) => initial(p) === L).length
          return <button key={L} className={lt === L ? 'on' : ''} disabled={!n && lt !== L} onClick={() => setLt(lt === L ? '' : L)} title={`${n} nom(s)`}>{L}</button>
        })}
      </div>
      {P.loaded && !P.list.length && <p className="muted">Aucun personnel. Ajoutez des personnes.</p>}
      <div className="tablewrap">
        <table className="week pertable">
          <thead><tr><th className="sticky">Nom</th><th>Prénom</th><th>Grade</th><th>FDF</th><th>Cadre d'emploi</th><th>Rôle dans l'application</th><th>E-mail du compte</th><th>Droits</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => {
              const u = P.linkOf(p); const r = P.mapped(p)
              return (
                <tr key={p.id}>
                  <td className="sticky"><TextField value={p.nom} onCommit={(v) => upd(p.id, { nom: v.toUpperCase() })} /></td>
                  <td><TextField value={p.prenom} onCommit={(v) => upd(p.id, { prenom: v })} /></td>
                  <td><select value={p.grade || ''} onChange={(e) => upd(p.id, { grade: e.target.value })}><option value="">—</option>{grades.map((g) => <option key={g}>{g}</option>)}</select></td>
                  <td><select value={p.fdf || ''} onChange={(e) => upd(p.id, { fdf: e.target.value })}><option value="">—</option>{fdfs.map((g) => <option key={g}>{g}</option>)}</select></td>
                  <td><select value={p.cadreEmploi || ''} onChange={(e) => upd(p.id, { cadreEmploi: e.target.value })}><option value="">—</option>{cadresEmploi.map((g) => <option key={g}>{g}</option>)}</select></td>
                  <td><select value={p.role !== undefined ? p.role : (r === 'pending' ? '' : r)} onChange={(e) => changeRole(p, e.target.value)}>
                    {ROLE_OPTS.map((x) => <option key={x} value={x} disabled={!!x && !can.includes(x)}>{x ? ROLES[x].label : 'Aucun droit (en attente)'}</option>)}
                  </select></td>
                  <td><TextField value={p.email} placeholder="compte@exemple.fr" onCommit={(v) => upd(p.id, { email: v.trim() })} /></td>
                  <td className="rightcell">
                    <b>{ROLES[r].label}</b>
                    <span className="muted small">{!p.email ? 'Pas de compte lié' : !u ? 'Compte non créé' : (u.role || 'pending') === r ? 'Appliqué' : 'À appliquer'}</span>
                  </td>
                  <td><button className="danger" aria-label="Supprimer" onClick={() => P.save(P.list.filter((x) => x.id !== p.id))}>✕</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
