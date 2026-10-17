import React, { useState } from 'react'
import { useUsers, writeDoc } from './store.js'
import { usePersonnel } from './Personnel.jsx'
import { ROLES, TAB_LABELS, assignableBy, canEditUser, getAccess, canEditRight, DEFAULT_ACCESS, EDITABLE_ROLES } from './roles.js'

export default function Users({ role, selfId, config }) {
  const [users, setRole] = useUsers(true)
  const P = usePersonnel(config, role, selfId, true)
  const personOf = (u) => P.list.find((p) => p.email && (u.email || '').toLowerCase() === p.email.trim().toLowerCase())
  const opts = assignableBy(role)
  const access = getAccess()
  const save = (next) => writeDoc('config/rights', { roles: next }, false)
  const toggle = (r, t) => {
    const cur = Object.fromEntries(EDITABLE_ROLES.map((x) => [x, [...access[x]]]))
    cur[r] = cur[r].includes(t) ? cur[r].filter((x) => x !== t) : [...cur[r], t]
    save(cur)
  }
  const reset = () => save(Object.fromEntries(EDITABLE_ROLES.map((x) => [x, DEFAULT_ACCESS[x]])))
  const sorted = [...users].sort((a, b) => (ROLES[b.role]?.rank || 0) - (ROLES[a.role]?.rank || 0) || (a.email || '').localeCompare(b.email || ''))
  const [pick, setPick] = useState({})
  const waiting = users.filter((u) => (u.role || 'pending') === 'pending' && !personOf(u) && canEditUser(role, u) && u.id !== selfId)
  const grantable = opts.filter((r) => !['pending', 'refused', 'superadmin'].includes(r) || (r === 'superadmin' && role === 'superadmin' && false))
  return (
    <div>
      {waiting.length > 0 && (
        <div className="banner">
          <b>Demandes en attente de validation ({waiting.length})</b>
          <p className="small">Ces personnes se sont inscrites avec une adresse qui ne figure pas dans Gestion du personnel. Elles n'ont aucun accès tant que vous ne les avez pas acceptées.</p>
          {waiting.map((u) => (
            <div className="line wrap" key={u.id}>
              <span><b>{u.name || '(sans nom)'}</b> · {u.email}</span>
              <select value={pick[u.id] || 'ogg'} onChange={(e) => setPick({ ...pick, [u.id]: e.target.value })}>
                {grantable.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
              <button className="primary" onClick={() => setRole(u.id, pick[u.id] || 'ogg')}>Accepter</button>
              <button className="danger" onClick={() => setRole(u.id, 'refused')}>Refuser</button>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">Un nouvel utilisateur crée son compte et reste « en attente » jusqu'à l'attribution d'un rôle. Le premier compte créé est super administrateur.
        {role === 'admin' && " Un administrateur ne peut ni attribuer ni modifier le rôle de super administrateur."}</p>
      <div className="tablewrap">
        <table className="week usertable">
          <thead><tr><th>Utilisateur</th><th>Rôle</th></tr></thead>
          <tbody>
            {sorted.map((u) => {
              const self = u.id === selfId
              const person = personOf(u)
              const fn = person && person.cadreEmploi ? { label: person.cadreEmploi } : null
              const editable = !self && canEditUser(role, u) && !person
              return (
                <tr key={u.id}>
                  <td>{u.name && <b>{u.name} </b>}{u.email || u.id}{self && <span className="chip small">vous</span>}{person && <div className="muted small">{person.prenom} {person.nom}{fn ? ` · ${fn.label}` : ''} · rôle défini dans Gestion du personnel</div>}</td>
                  <td>
                    <select value={u.role || 'pending'} disabled={!editable} onChange={(e) => setRole(u.id, e.target.value)}>
                      {[...new Set([u.role || 'pending', ...opts])].map((r) => <option key={r} value={r} disabled={!opts.includes(r)}>{ROLES[r]?.label || r}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
            {!sorted.length && <tr><td colSpan={2} className="muted">Aucun utilisateur.</td></tr>}
          </tbody>
        </table>
      </div>
      <h3>Droits par rôle</h3>
      <p className="muted small">Cochez les onglets accessibles à chaque rôle. Le super administrateur a toujours tous les droits ; l'administrateur garde Paramètres et Rôles ; seul le super administrateur modifie les droits de l'administrateur. La colonne « Rôles » est fixe.</p>
      <div className="tablewrap">
        <table className="week permtable">
          <thead><tr><th>Rôle</th>{Object.entries(TAB_LABELS).map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {['superadmin', 'admin', 'chefcolonne', 'ogg'].map((r) => (
              <tr key={r}><th>{ROLES[r].label}</th>
                {Object.keys(TAB_LABELS).map((t) => {
                  const on = access[r].includes(t)
                  const edit = canEditRight(role, r, t)
                  return <td key={t} className="ck"><input type="checkbox" checked={on} disabled={!edit} aria-label={`${ROLES[r].label} : ${TAB_LABELS[t]}`} onChange={() => toggle(r, t)} title={edit ? '' : 'Verrouillé'} /></td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="line"><button onClick={reset} disabled={!['superadmin', 'admin'].includes(role)}>Rétablir les droits par défaut</button></div>
      <p className="muted small">Réservé au super administrateur : import des données du classeur, réinitialisation de la configuration, rôle super administrateur. Les droits sont aussi appliqués côté serveur par les règles Firestore.</p>
    </div>
  )
}
