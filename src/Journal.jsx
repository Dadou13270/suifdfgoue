import React, { useEffect, useState } from 'react'
import { uid } from './util.js'

const hm = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
const dmy = (iso) => new Date(iso).toLocaleDateString('fr-FR')

// Main courante du jour : entrées horodatées (days/<date>.journal = { id: {at, by, text, editedAt?} })
export default function Journal({ journal, onPatch, who, onClose }) {
  const [txt, setTxt] = useState('')
  const [editId, setEditId] = useState('')
  const [editTxt, setEditTxt] = useState('')
  const [delId, setDelId] = useState('')
  const items = Object.entries(journal || {}).filter(([, v]) => v && v.at).map(([id, v]) => ({ id, ...v })).sort((a, b) => a.at.localeCompare(b.at))
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const add = () => { const t = txt.trim(); if (!t) return; onPatch({ journal: { [uid()]: { at: new Date().toISOString(), by: who || '', text: t } } }); setTxt('') }
  const save = (id) => { const t = editTxt.trim(); if (!t) return; onPatch({ journal: { [id]: { text: t, editedAt: new Date().toISOString() } } }); setEditId('') }
  const del = (id) => { onPatch({ journal: { [id]: null } }); setDelId('') }
  return (
    <div className="jr-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="jr-box" role="dialog" aria-modal="true" aria-label="Main courante">
        <div className="jr-head"><h3>Main courante</h3><button aria-label="Fermer" onClick={onClose}>✕</button></div>
        <div className="jr-list">
          {!items.length && <p className="muted">Aucune information pour ce jour.</p>}
          {items.map((it) => (
            <div className="jr-item" key={it.id}>
              <div className="jr-meta"><b>{hm(it.at)}</b> <span className="muted">{dmy(it.at)}{it.by ? ` · ${it.by}` : ''}{it.editedAt ? ` · modifié à ${hm(it.editedAt)}` : ''}</span></div>
              {editId === it.id ? (
                <>
                  <textarea className="jr-ta" value={editTxt} onChange={(e) => setEditTxt(e.target.value)} rows={3} autoFocus />
                  <div className="jr-act"><button className="primary" onClick={() => save(it.id)}>Enregistrer</button><button onClick={() => setEditId('')}>Annuler</button></div>
                </>
              ) : (
                <>
                  <div className="jr-text">{it.text}</div>
                  <div className="jr-act">
                    {delId === it.id
                      ? <><span className="small">Supprimer cette information ?</span><button className="danger" onClick={() => del(it.id)}>Oui, supprimer</button><button onClick={() => setDelId('')}>Non</button></>
                      : <><button onClick={() => { setEditId(it.id); setEditTxt(it.text); setDelId('') }}>Modifier</button><button className="danger" onClick={() => setDelId(it.id)}>Supprimer</button></>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="jr-new">
          <textarea className="jr-ta" placeholder="Nouvelle information (horodatée automatiquement)…" value={txt} onChange={(e) => setTxt(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add() }} />
          <button className="primary" disabled={!txt.trim()} onClick={add}>Ajouter</button>
        </div>
      </div>
    </div>
  )
}
