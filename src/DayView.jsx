import React, { useContext, useState } from 'react'
import { EngineCell, TextField, Lookup, LocField, DutyField, NotifyBar } from './Cell.jsx'
import { cellKey, listIdFor, guessFilter, blockName, hdrClass, isOff, effBlock, paxOf, isShown } from './util.js'
import { BlockTools } from './BlockTools.jsx'
import { canLayout, canValidate } from './roles.js'
import { useLayouts, LayoutBar, reconcile, moveBefore, moveToRowEnd, moveNewRow, step } from './Layouts.jsx'
import { useEngage, DayIndexProvider } from './engage.js'
import { isAddable } from './ExtraRows.jsx'
import HeadLine from './HeadLine.jsx'
import CustomBlock, { ConfigBlock, AddBlockButton } from './CustomBlock.jsx'

export function Legend({ legend }) {
  return (
    <div className="legend">
      {legend.map((l) => (
        <span key={l.id} className="lg" title={l.desc}><i style={{ background: l.color }} />{l.label}</span>
      ))}
    </div>
  )
}

export function Block({ b, config, day, onPatch, compact }) {
  const { fix } = useContext(Lookup)
  const [open, setOpen] = useState(true)
  const engage = useEngage()
  const pax = paxOf(config, effBlock(b, day), day)
  const head = day.heads?.[b.id]
  return (
    <section className={`card block${compact ? ' compact' : ''}${isOff(config, day.header?.niveau, b.id) ? ' off' : ''}`}>
      <div className="bheadrow">
        <button className="bhead" onClick={() => setOpen(!open)}>
          <b>{blockName(b, day)}</b><span className="chev">{open ? '▾' : '▸'}</span>
        </button>
        {pax > 0 && <span className="pax">{pax} PAX</span>}
        <BlockTools b={effBlock(b, day)} day={day} onPatch={onPatch} config={config} />
      </div>
      {open && (
        <div className="bbody">
          {b.customName && <TextField className="headfield" value={day.names?.[b.id]} placeholder="Nom personnalisé (ex. Renfort CIS…)" onCommit={(t) => onPatch({ names: { [b.id]: t } })} />}
          {b.head && (b.headCis ? <HeadLine compact={compact} b={b} day={day} config={config} onPatch={onPatch} fix={fix} />
            : <div className={day.headsAuto?.[b.id] ? 'auto' : ''}><TextField className="headfield" value={head} fix={fix} placeholder={b.headHint || 'Chef / intitulé'}
            onCommit={(t) => onPatch({ heads: { [b.id]: t }, headsAuto: { [b.id]: false } })} /></div>)}
          {b.rows.map((r) => (
            <div className="row" key={r.id}>
              <label>{r.label}</label>
              <EngineCell compact={compact} ckey={cellKey(b.id, r.id)} cis={day.headCis?.[b.id]} filter={guessFilter(r)} listId={listIdFor(r)} cell={day.cells?.[cellKey(b.id, r.id)]} legend={config.legend}
                onChange={(c) => onPatch({ cells: { [cellKey(b.id, r.id)]: c }, ...(day.notif?.[b.id] && (c?.text || '') !== (day.cells?.[cellKey(b.id, r.id)]?.text || '') ? { notif: { [b.id]: null } } : {}) })} />
            </div>
          ))}
          {b.duty && (
            <div className="row loc">
              <label>🕒 Astreinte / Caserné</label>
              <DutyField compact={compact} value={day.duty?.[b.id]} lists={config.lists} onChange={(v) => onPatch({ duty: { [b.id]: v } })} />
            </div>
          )}
          {b.location && (
            <div className="row loc">
              <label>📍 Emplacement et horaires</label>
              <LocField compact={compact} value={day.locs?.[b.id]} lists={config.lists} onChange={(v) => onPatch({ locs: { [b.id]: v } })} />
            </div>
          )}
          {b.rows.length > 0 && <NotifyBar compact={compact} label={b.section === 'cdt' ? 'Cadres informés' : 'CIS informés'} notif={day.notif?.[b.id]} onNotif={(v) => onPatch({ notif: { [b.id]: v } })} engaged={day.engaged?.[b.id]} onEngaged={(v) => { engage(effBlock(b, day), day, v); onPatch({ engaged: { [b.id]: v } }) }} aladin={day.aladin?.[b.id]} onAladin={(v) => { engage(effBlock(b, day), day, v, 'aladin'); onPatch({ aladin: { [b.id]: v } }) }} />}
        </div>
      )}
    </section>
  )
}

function ValidBar({ v, can, onCancel }) {
  if (v?.at) {
    const t = new Date(v.at)
    const h = t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
    const j = t.toLocaleDateString('fr-FR')
    return (
      <div className="validbar ok" role="status">
        <span>✅ <b>Dispositif validé à {h} le {j}</b>{v.by ? ` par ${v.by}` : ''}</span>
        {can && <button onClick={onCancel}>Annuler la validation</button>}
      </div>
    )
  }
  return null
}

export default function DayView({ config, day, onPatch, role, who, date }) {
  const lay = useLayouts()
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState([])
  const [drag, setDrag] = useState(null)
  const hiddenOpt = config.blocks.filter((b) => !isShown(b, day))
  const vis = config.blocks.filter((b) => isShown(b, day))
  const customs = day.customBlocks || []
  const render = (b) => (customs.some((c) => c.id === b.id) ? <CustomBlock key={b.id} b={b} config={config} day={day} onPatch={onPatch} />
    : isAddable(b) ? <ConfigBlock key={b.id} off={isOff(config, day.header?.niveau, b.id)} b={b} config={config} day={day} onPatch={onPatch} />
    : <Block key={b.id} b={b} config={config} day={day} onPatch={onPatch} />)
  const byId = Object.fromEntries([...vis, ...customs].map((b) => [b.id, b]))
  const grp = (b) => (/^giff/.test(b.id) ? 0 : /^(mil|sigar)/.test(b.id) ? 1 : b.id === 'spec' ? 2 : 3)
  const defRows = (() => {
    const rows = [vis.filter((b) => b.section === 'cdt').map((b) => b.id), [], [], [], [], []]
    vis.filter((b) => b.section === 'gs').forEach((b) => rows[5].push(b.id))
    vis.filter((b) => b.section !== 'cdt' && b.section !== 'gs').forEach((b) => rows[1 + grp(b)].push(b.id))
    customs.forEach((b) => rows[b.section === 'gs' ? 5 : 4].push(b.id))
    return rows.filter((r) => r.length)
  })()
  const allIds = defRows.flat()
  const custom = !!lay.active
  const rows = edit ? reconcile(draft, allIds) : custom ? reconcile(lay.active.rows, allIds) : defRows
  const startEdit = () => { setDraft(rows); setEdit(true) }
  const mv = (fn) => setDraft((r) => fn(reconcile(r, allIds)))
  const addLine = (
    <div className="line addline" key="__add">
      <AddBlockButton day={day} onPatch={onPatch} gsTitle={config.gsTitle || 'Groupes spécialisés'} />
      {hiddenOpt.map((b) => <button key={b.id} className="addbtn" onClick={() => onPatch({ shown: { [b.id]: true } })}>+ {b.title}{b.tag ? ` ${b.tag}` : ''}</button>)}
      <span className="muted small">Bloc propre à ce jour. Pour un bloc permanent : Paramètres › Blocs.</span>
    </div>
  )
  const cell = (id) => {
    const b = byId[id]; if (!b) return null
    if (!edit) return render(b)
    return (
      <div key={id} className={`lay-item ${drag === id ? 'dragging' : ''}`} draggable onDragStart={(e) => { setDrag(id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id) } catch {} }}
        onDragEnd={() => setDrag(null)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag) mv((r) => moveBefore(r, drag, id)); setDrag(null) }}>
        <div className="lay-ctl"><b>⠿ {b.title}{b.tag ? ` ${b.tag}` : ''}</b>
          <span>{[['l', '◀'], ['r', '▶'], ['u', '▲'], ['d', '▼']].map(([k, s]) => <button key={k} aria-label={`Déplacer ${k}`} onClick={() => mv((r) => step(r, id, k))}>{s}</button>)}</span></div>
        <div className="lay-ghost">{render(b)}</div>
      </div>
    )
  }
  return (
    <DayIndexProvider cells={day.cells}>
      <section className="card headcard">
        {config.header.map((h) => (
          <div className="hf" key={h.id}>
            <label>{h.label}</label>
            <select className={hdrClass(h.id, day.header?.[h.id])} value={day.header?.[h.id] ?? ''} onChange={(e) => onPatch({ header: { [h.id]: e.target.value } })}>
              <option value="">—</option>
              {(config.lists[h.list] || []).map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </section>
      {canLayout(role) && <LayoutBar lay={lay} editable edit={edit} onEdit={startEdit} onCancel={() => setEdit(false)} onSave={(l, cb) => cb(reconcile(draft, allIds))} />}
      <ValidBar v={day.validated} can={canValidate(role)} onCancel={() => onPatch({ validated: null })} />
      <Legend legend={config.legend} />
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          {(() => {
            const sec = (id) => (byId[id]?.section === 'cdt' ? 'cdt' : byId[id]?.section === 'gs' ? 'gs' : 'main')
            const has = (x, s) => x.some((id) => sec(id) === s)
            const first = (s) => has(r, s) && !rows.slice(0, i).some((x) => has(x, s))
            const multi = ['cdt', 'gs'].some((s) => rows.some((x) => has(x, s)))
            return <>
              {first('cdt') && <h3 className="sectitle">{config.cdtTitle || 'Chaîne de commandement'}</h3>}
              {multi && first('main') && <h3 className="sectitle">Dispositif</h3>}
              {first('gs') && <h3 className="sectitle">{config.gsTitle || 'Groupes spécialisés'}</h3>}
            </>
          })()}
          <div className="grid rowgrid" style={{ '--n': 4 }} onDragOver={edit ? (e) => e.preventDefault() : undefined}>
            {r.map(cell)}
            {edit && <div className="lay-end" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag) mv((x) => moveToRowEnd(x, drag, i)); setDrag(null) }}>⇥ ici</div>}
            {!edit && i === rows.length - 1 && addLine}
          </div>
        </React.Fragment>
      ))}
      {edit && <div className="lay-new" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag) mv((x) => moveNewRow(x, drag)); setDrag(null) }}>＋ Déposer ici pour une nouvelle ligne</div>}
      {!rows.length && addLine}
      <section className="card">
        <label className="lbl">Commentaire du jour</label>
        <textarea className="comment" defaultValue={day.comment || ''} key={day.comment}
          onBlur={(e) => e.target.value !== (day.comment || '') && onPatch({ comment: e.target.value })} />
      </section>
    </DayIndexProvider>
  )
}
