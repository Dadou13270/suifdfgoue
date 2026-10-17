import { cellKey } from './util.js'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Complète la saisie : « CCFM-99 » -> « CCFM-99 VIT », « MAIRE » -> « MAIRE (CHM) »
export function makeFix(fleet = [], cadres = []) {
  const count = {}
  fleet.forEach((e) => { count[e.code.toLowerCase()] = (count[e.code.toLowerCase()] || 0) + 1 })
  const uniq = fleet.filter((e) => e.cis && count[e.code.toLowerCase()] === 1)
  return (text) => {
    let t = (text || '').trim()
    if (!t) return t
    const cad = cadres.find((c) => c.nom && c.nom.toLowerCase() === t.toLowerCase())
    if (cad && cad.aff && /^[A-Z]{2,4}$/.test(cad.aff)) return `${cad.nom} (${cad.aff})`
    uniq.forEach((e) => {
      const re = new RegExp(`(^|[\\s(\\-/+])(${esc(e.code)})(?![\\w-])(?!\\s+${esc(e.cis)}(?![\\w]))`, 'gi')
      t = t.replace(re, (_m, a) => `${a}${e.code} ${e.cis}`)
    })
    return t
  }
}

const render = (tpl, t) => tpl.replace('{s}', t.s || '').replace('{g}', t.g || '').replace('{v}', t.v || '').replace('{l}', t.l || '').replace('{aff}', t.aff ? ` (${t.aff})` : '').trim()
const label = (e) => `${e.code} ${e.cis}`.trim()

// Calcule ce que le calendrier perpétuel, les plannings et les réglages imposent pour un jour donné
export function computeFills({ config, date, plans, cal, cadres, fleet = [], pers }) {
  const af = config.autofill || {}
  const out = { cells: {}, heads: {}, locs: {}, headCis: {} }
  const dom = Number(date.slice(8))
  const lines = cal?.lines || []
  const used = new Set()
  const avail = (e) => config.statuses?.find((s) => s.id === e.status)?.avail !== false && e.status !== 'INDISPONIBLE'
  const prefixOf = (lbl) => lbl.split('.')[0].replace(/\s/g, '').toUpperCase() + '-'
  const free = (cat, cis) => fleet.find((e) => e.cat === cat && e.cis === cis && avail(e) && !used.has(e.id))

  // 1) calendrier perpétuel : « PDB » / « CBE2 » -> engin du parc « CCFM-12 PDB »
  if (af.calendar !== false) {
    lines.forEach((l) => {
      const v = (l.vals?.[dom - 1] || '').trim()
      if (!l.target || !v) return
      const [b, r] = l.target.split(':')
      let text = v
      const m = /^([A-Z]{2,4})(\d?)$/.exec(v)
      if (m && fleet.length) {
        const pre = prefixOf(l.label)
        const list = fleet.filter((e) => e.cis === m[1] && e.code.toUpperCase().startsWith(pre) && avail(e))
        const e = m[2] ? list[Number(m[2]) - 1] : list.find((x) => !used.has(x.id)) || list[0]
        if (e) { used.add(e.id); text = label(e) }
      }
      out.cells[cellKey(b, r)] = text
    })
  }

  const affOf = (nom) => {
    const c = (cadres?.list || []).find((x) => x.nom && x.nom.toLowerCase() === nom.toLowerCase())
    return c && /^[A-Z]{2,4}$/.test(c.aff || '') ? c.aff : ''
  }
  const gradeOf = (nom) => {
    const n = nom.toLowerCase()
    const c = (cadres?.list || []).find((x) => x.nom && x.nom.toLowerCase() === n && x.grade)
    return c?.grade || (pers?.list || []).find((x) => x.nom && x.nom.toLowerCase() === n && x.grade)?.grade || ''
  }
  let cisOf = ''
  const put = (target, text) => {
    if (!target) return
    const [kind, b, row] = target.split(':')
    if (kind === 'head') { out.heads[b] = text; if (cisOf) out.headCis[b] = cisOf }
    else out.cells[cellKey(b, row)] = text
  }

  // 2) règles : plannings, secteur du calendrier, ligne du calendrier = groupement
  ;(af.rules || []).forEach((r) => {
    let name = '', sector = '', lbl = ''
    if (r.kind === 'match') {
      const want = (r.value || '{groupement}').replace('{groupement}', config.groupement || '').toLowerCase()
      const line = lines.find((l) => l.group === r.group && (l.label || '').toUpperCase().startsWith((r.labelPrefix || '').toUpperCase()) && (l.vals?.[dom - 1] || '').trim().toLowerCase() === want)
      if (!line) return
      lbl = line.label
      cisOf = ''
      put(r.target, render(r.fmt || '{l}', { l: lbl }))
      return
    }
    const days = plans?.[r.planning]?.days
    if (!days) return
    let col = r.col
    if (r.kind === 'sector') {
      const line = lines.find((l) => l.group === 'Secteur des GIFF' && l.label === r.calLine)
      sector = (line?.vals?.[dom - 1] || '').trim()
      col = sector
    }
    name = (days[date]?.[col] || '').trim()
    if (!name) return
    const aff = affOf(name)
    cisOf = aff
    const g = gradeOf(name)
    const shownName = (r.grade ?? af.grade) && g && !(r.fmt || '').includes('{g}') ? `${g} ${name}` : name
    // engin du cadre : parc de la catégorie voulue, au CIS d'affectation du cadre
    const eng = r.engineCat && aff ? free(r.engineCat, aff) : null
    if (eng) used.add(eng.id)
    if (eng && r.engineTarget && r.engineTarget === r.target) put(r.target, `${shownName} - ${label(eng)}`)
    else {
      put(r.target, render(r.fmt || '{v}{aff}', { v: shownName, g, aff, s: sector }))
      if (eng && r.engineTarget) put(r.engineTarget, label(eng))
    }
  })

  // 3) emplacement et horaires par défaut de chaque bloc
  config.blocks.forEach((b) => {
    if (b.location && (b.defPlace || b.defStart || b.defEnd)) out.locs[b.id] = { place: b.defPlace || '', start: b.defStart || '', end: b.defEnd || '' }
  })
  return out
}

// Applique les compléments sur le document du jour. overwrite=false : seulement les champs vides.
export function buildPatch(day, fills, overwrite) {
  const cells = {}, heads = {}, headsAuto = {}, locs = {}, headCis = {}
  let n = 0
  Object.entries(fills.cells).forEach(([k, text]) => {
    const cur = day.cells?.[k]
    if (overwrite ? cur?.text !== text : !cur?.text) { cells[k] = { text, auto: true }; n++ }
  })
  Object.entries(fills.heads).forEach(([k, text]) => {
    const cur = day.heads?.[k]
    if (overwrite ? cur !== text : !cur) { heads[k] = text; headsAuto[k] = true; n++ }
  })
  Object.entries(fills.headCis || {}).forEach(([k, v]) => {
    if (overwrite || !day.headCis?.[k]) { headCis[k] = v; n++ }
  })
  Object.entries(fills.locs).forEach(([k, v]) => {
    const cur = day.locs?.[k]
    const empty = !cur || (typeof cur === 'object' ? !cur.place && !cur.start && !cur.end : !cur)
    if (overwrite || empty) { locs[k] = { ...v, auto: true }; n++ }
  })
  const patch = { autoDone: true }
  if (Object.keys(cells).length) patch.cells = cells
  if (Object.keys(heads).length) { patch.heads = heads; patch.headsAuto = headsAuto }
  if (Object.keys(locs).length) patch.locs = locs
  if (Object.keys(headCis).length) patch.headCis = headCis
  return { patch, n }
}
