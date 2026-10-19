import React, { useContext } from 'react'
import { EngineCell, TextField, Lookup, LocField, DutyField } from './Cell.jsx'
import { Legend } from './DayView.jsx'
import { DayIndexProvider } from './engage.js'
import { isAddable } from './ExtraRows.jsx'
import HeadLine from './HeadLine.jsx'
import CustomBlock, { ConfigBlock, AddBlockButton } from './CustomBlock.jsx'
import { BlockTools } from './BlockTools.jsx'
import { useLayouts, LayoutBar, orderIds } from './Layouts.jsx'
import { isShown, cellKey, fmtShort, fmtDMY, fmtDow, weekNum, iso, listIdFor, guessFilter, baseTitle, locText, blockName, effBlock, hdrClass, isOff, paxOf } from './util.js'

export default function WeekView({ config, dates, days, onPatch, onOpen }) {
  const { fix } = useContext(Lookup)
  const today = iso(new Date())
  const lay = useLayouts()
  const seq = orderIds(lay.active, config.blocks.map((b) => b.id))
  const sorted = seq.map((id) => config.blocks.find((b) => b.id === id)).filter(Boolean)
  const shownWeek = (b) => dates.some((d) => isShown(b, days[d]))
  const hiddenWeek = sorted.filter((b) => !shownWeek(b))
  const ordered = [...sorted.filter((b) => b.section === 'cdt' && shownWeek(b)), ...sorted.filter((b) => b.section !== 'cdt' && shownWeek(b))]
  const exportCsv = () => {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const rows = [['Ligne', ...dates]]
    config.header.forEach((h) => rows.push([h.label, ...dates.map((d) => days[d]?.header?.[h.id])]))
    ordered.forEach((b) => {
      if (isAddable(b)) {
        rows.push([b.title, ...dates.map((d) => { const e = effBlock(b, days[d]); return [e.title, days[d]?.heads?.[b.id], ...e.rows.map((r) => `${r.label}=${days[d]?.cells?.[cellKey(b.id, r.id)]?.text || ''}`), locText(days[d]?.locs?.[b.id])].filter(Boolean).join(' | ') })])
        return
      }
      if (b.head) rows.push([baseTitle(b), ...dates.map((d) => [b.tag ? '' : days[d]?.headCis?.[b.id], days[d]?.heads?.[b.id]].filter(Boolean).join(' : '))])
      b.rows.forEach((r) => rows.push([`${b.title} ${r.label}`, ...dates.map((d) => days[d]?.cells?.[cellKey(b.id, r.id)]?.text)]))
      if (b.duty) rows.push([`${b.title} astreinte/caserné`, ...dates.map((d) => [days[d]?.duty?.[b.id]?.type, locText(days[d]?.duty?.[b.id])].filter(Boolean).join(' · '))])
      if (b.location) rows.push([`${b.title} emplacement`, ...dates.map((d) => locText(days[d]?.locs?.[b.id]))])
    })
    rows.push(['Blocs ajoutés', ...dates.map((d) => (days[d]?.customBlocks || []).map((b) => `${b.title}: ` + b.rows.map((r) => `${r.label}=${days[d]?.cells?.[cellKey(b.id, r.id)]?.text || ''}`).join(', ')).join(' | '))])
    const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dispositif_${dates[0]}.csv`; a.click()
  }
  const blockRows = (list) => list.map((b, bi) => (
              <React.Fragment key={b.id}>
                {bi === 0 && (
                  <tr className="secrow"><th colSpan={dates.length + 1}>{b.section === 'cdt' ? (config.cdtTitle || 'Chaîne de commandement') : 'Dispositif'}</th></tr>
                )}
                {isAddable(b) ? (
                  <tr><th className="sticky sub">{b.title}</th>
                    {dates.map((d) => <td key={d} className={`customcell ${off(d, b)}`}><DayIndexProvider cells={days[d]?.cells}><ConfigBlock compact b={b} day={days[d] || {}} config={config} onPatch={(p) => onPatch(d, p)} /></DayIndexProvider></td>)}
                  </tr>
                ) : <>
                <tr className="brow"><th className="sticky" colSpan={1}>{baseTitle(b)}</th>
                  {dates.map((d) => (
                    <td key={d} className={`${off(d, b)} paxcell`}><BlockTools b={effBlock(b, days[d])} day={days[d] || {}} onPatch={(p) => onPatch(d, p)} config={config} />{paxOf(config, effBlock(b, days[d]), days[d]) > 0 && <span className="pax abs">{paxOf(config, effBlock(b, days[d]), days[d])} PAX</span>}{b.customName && <TextField className="headfield" value={days[d]?.names?.[b.id]} placeholder="Nom personnalisé" onCommit={(t) => onPatch(d, { names: { [b.id]: t } })} />}{b.head && (b.headCis ? <HeadLine compact b={b} day={days[d] || {}} config={config} fix={fix} onPatch={(p) => onPatch(d, p)} /> : <div className={days[d]?.headsAuto?.[b.id] ? 'auto' : ''}><TextField className="headfield" value={days[d]?.heads?.[b.id]} placeholder={b.headHint} fix={fix}
                      onCommit={(t) => onPatch(d, { heads: { [b.id]: t }, headsAuto: { [b.id]: false } })} /></div>)}</td>
                  ))}
                </tr>
                {b.rows.map((r) => (
                  <tr key={r.id}>
                    <th className="sticky sub">{r.label}</th>
                    {dates.map((d) => (
                      <td key={d} className={off(d, b)}><DayIndexProvider cells={days[d]?.cells}><EngineCell ckey={cellKey(b.id, r.id)} compact cis={days[d]?.headCis?.[b.id]} filter={guessFilter(r)} listId={listIdFor(r)} cell={days[d]?.cells?.[cellKey(b.id, r.id)]} legend={config.legend}
                        onChange={(c) => onPatch(d, { cells: { [cellKey(b.id, r.id)]: c } })} /></DayIndexProvider></td>
                    ))}
                  </tr>
                ))}
                {b.duty && (
                  <tr><th className="sticky sub">🕒 Astreinte / Caserné</th>
                    {dates.map((d) => <td key={d} className={off(d, b)}><DutyField compact value={days[d]?.duty?.[b.id]} lists={config.lists} onChange={(v) => onPatch(d, { duty: { [b.id]: v } })} /></td>)}
                  </tr>
                )}
                {b.location && (
                  <tr><th className="sticky sub">📍 Emplacement et horaires</th>
                    {dates.map((d) => <td key={d} className={off(d, b)}><LocField compact value={days[d]?.locs?.[b.id]} lists={config.lists} onChange={(v) => onPatch(d, { locs: { [b.id]: v } })} /></td>)}
                  </tr>
                )}
                </>}
              </React.Fragment>
            ))
  const off = (d, b) => (isOff(config, days[d]?.header?.niveau, b.id) || !isShown(b, days[d]) ? 'off' : '')
  const dateRow = (top) => <tr><th className="sticky" style={{ top }}>Semaine {weekNum(dates[0])}</th>{dates.map((d) => <th key={d} className={d === today ? 'todaycol' : ''} style={{ top }}><button className="link" onClick={() => onOpen(d)}>{fmtShort(d)}</button></th>)}</tr>
  const cdtList = ordered.filter((b) => b.section === 'cdt')
  const mainList = ordered.filter((b) => b.section !== 'cdt')
  return (
    <>
      <div className="weekstrip">
        <div className="weektitle"><b>Semaine {weekNum(dates[0])}</b> <span className="muted">du {dates[0].slice(8).replace(/^0/, '')} au {fmtDMY(dates[6])}</span></div>
        <div className="days7">
          {dates.map((d) => (
            <button key={d} className={`dchip ${d === today ? 'today' : ''}`} onClick={() => onOpen(d)} title="Ouvrir ce jour">
              <span>{fmtDow(d)}</span><b>{d.slice(8)}</b><span className="muted">{d.slice(5, 7)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="weekbar"><Legend legend={config.legend} /><button onClick={exportCsv}>⭳ CSV</button></div>
      <LayoutBar lay={lay} />
      {hiddenWeek.length > 0 && <div className="line wrap addline">{hiddenWeek.map((b) => <button key={b.id} className="addbtn" title="Ajouter ce groupe à tous les jours de la semaine" onClick={() => dates.forEach((d) => onPatch(d, { shown: { [b.id]: true } }))}>+ {b.title}{b.tag ? ` ${b.tag}` : ''}</button>)}</div>}
      <div className="tablewrap">
        <table className="week wv">
          <colgroup><col style={{ width: 'clamp(90px, 9vw, 150px)' }} />{dates.map((d) => <col key={d} />)}</colgroup>
          <thead>
            <tr><th className="sticky" style={{ top: 0 }}>Semaine {weekNum(dates[0])}</th>{dates.map((d) => <th key={d} className={d === today ? 'todaycol' : ''} style={{ top: 0 }}><button className="link" onClick={() => onOpen(d)}>{fmtShort(d)}</button></th>)}</tr>
            {config.header.map((h, i) => (
              <tr key={h.id} className="hrow infor">
                <th className="sticky" style={{ top: 40 + i * 42 }}>{h.label}</th>
                {dates.map((d) => (
                  <th key={d} style={{ top: 40 + i * 42 }}>
                    <select className={hdrClass(h.id, days[d]?.header?.[h.id])} value={days[d]?.header?.[h.id] ?? ''} onChange={(e) => onPatch(d, { header: { [h.id]: e.target.value } })}>
                      <option value="">—</option>{(config.lists[h.list] || []).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody></tbody>
        </table>
      </div>
      {cdtList.length > 0 && <div className="tablewrap blocksep">
        <table className="week wv">
          <colgroup><col style={{ width: 'clamp(90px, 9vw, 150px)' }} />{dates.map((d) => <col key={d} />)}</colgroup>
          <thead>{dateRow(0)}</thead>
          <tbody>{blockRows(cdtList)}</tbody>
        </table>
      </div>}
      <div className="tablewrap blocksep">
        <table className="week wv">
          <colgroup><col style={{ width: 'clamp(90px, 9vw, 150px)' }} />{dates.map((d) => <col key={d} />)}</colgroup>
          <thead>{dateRow(0)}</thead>
          <tbody>
            {blockRows(mainList)}
            <tr className="secrow"><th colSpan={dates.length + 1}>Blocs ajoutés</th></tr>
            <tr>
              <th className="sticky sub">Autres blocs du jour</th>
              {dates.map((d) => (
                <td key={d} className="customcell"><DayIndexProvider cells={days[d]?.cells}>
                  {(days[d]?.customBlocks || []).map((b) => <CustomBlock key={b.id} compact b={b} day={days[d] || {}} config={config} onPatch={(p) => onPatch(d, p)} />)}
                  <AddBlockButton compact day={days[d] || {}} onPatch={(p) => onPatch(d, p)} />
                </DayIndexProvider></td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
