export const iso = (d) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10)
}
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
export const fmtLong = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const fmtShort = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
export const mondayOf = (s) => { const d = new Date(s + 'T12:00:00'); const w = (d.getDay() + 6) % 7; return addDays(s, -w) }
export const uid = () => Math.random().toString(36).slice(2, 8)
export const cellKey = (b, r) => `${b}__${r}`
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)

// Type d'engin proposé dans la liste déroulante d'une ligne (ex. VLTT, CCFM, CCFS6) ; '@names' = cadres
export const guessFilter = (row) => {
  if (row.filter !== undefined) return row.filter
  const l = (row.label || '').toUpperCase()
  const m = /^(VLTT|CCFM|CCFS6|CCFS13|CCFS9|CCGC|VPCE|VPC|PCTT|CECDT|VPSI)/.exec(l)
  return m ? m[1] : ''
}
export const listIdFor = (row) => {
  const f = guessFilter(row)
  return !f ? 'eng-list' : f === '@names' ? 'dl-names' : `dl-${f.replace(/\W/g, '_')}`
}
// Emplacement + horaires : ancien format (texte) ou {place,start,end}
export const locOf = (v) => (v && typeof v === 'object' ? v : { place: v || '', start: '', end: '' })
export const locText = (v) => { const o = locOf(v); return [o.place, o.start && o.end ? `${o.start}-${o.end}` : o.start].filter(Boolean).join(' · ') }

export const fmtDMY = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
export const fmtDow = (s) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })
export const weekNum = (s) => {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}
export const baseTitle = (b) => (b.tag ? `${b.title.replace(/^(GIFF)(\d)/, '$1 $2')} ${b.tag}` : b.title)
export const blockName = (b, day) => (day?.names?.[b.id] ? `${baseTitle(b)} · ${day.names[b.id]}` : baseTitle(b))

// Bloc effectif d'un jour : configuration d'origine, ou version personnalisée ce jour-là (⚙)
export const effBlock = (b, day) => {
  const o = day?.overrides?.[b.id]
  return o ? { ...b, ...o } : { ...b, rows: [...b.rows, ...(day?.extra?.[b.id] || [])] }
}

// Couleur des listes d'en-tête : validation (Validé vert / Estimé bleu), niveau (jaune), groupes de commandement (violet)
export const hdrClass = (id, v) => {
  const t = String(v ?? '').trim().toLowerCase()
  if (!t) return ''
  if (id === 'validation') return t.startsWith('valid') ? 'hc-green' : t.startsWith('estim') ? 'hc-blue' : ''
  if (id === 'niveau') return 'hc-yellow'
  if (id === 'gdc') return 'hc-violet'
  return ''
}
