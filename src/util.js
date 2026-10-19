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
  if (f === '@names') { const m = /FDF\s*([345])/i.exec(row.label || ''); return m ? `dl-fdf${m[1]}` : 'dl-names' }   // chaîne de commandement : seules les personnes du FDF de la ligne
  return !f ? 'eng-list' : `dl-${f.replace(/\W/g, '_')}`
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

// Effectif (PAX) d'un bloc : somme, sur les lignes remplies, de l'équipage de l'engin (type lu dans le code saisi,
// sinon dans le libellé de la ligne). Chaîne de commandement : 1 personne par ligne remplie (2 quand le module est complet). Les lignes d'un bloc SIGAR comptent l'effectif SIGAR.
import { DEFAULT_CONFIG } from './defaults.js'
export const paxOf = (config, b, day) => {
  const crew = (config.crew || DEFAULT_CONFIG.crew).map((c) => ({ key: String(c.key || '').toUpperCase(), pax: Number(c.pax) || 0 })).filter((c) => c.key)
    .sort((a, z) => z.key.length - a.key.length)
  const sig = config.sigarPax ?? DEFAULT_CONFIG.sigarPax
  const typeOf = (t) => crew.find((c) => t === c.key || t.startsWith(c.key + '-') || t.startsWith(c.key + ' '))
  let n = 0
  ;(b.rows || []).forEach((r) => {
    const t = String(day?.cells?.[cellKey(b.id, r.id)]?.text || '').trim().toUpperCase()
    if (!t) return
    if (b.section === 'cdt') { n += Number(config.cdtPax ?? DEFAULT_CONFIG.cdtPax) || 0; return }
    if (/^sigar/i.test(b.id)) { n += Number(sig) || 0; return }
    const c = typeOf(t) || crew.find((x) => String(r.label || '').toUpperCase().startsWith(x.key))
    if (c) n += c.pax
  })
  return n
}

// Blocs grisés selon le niveau de mobilisation choisi (Paramètres › Niveau de mobilisation)
export const isOff = (config, niveau, blockId) => !!niveau && (config.mobil?.[niveau] || []).includes(blockId)

// Cadres = reflet du Personnel : noms absents du Personnel retirés, personnes avec FDF ajoutées, grade/prénom reportés
export const syncCadres = (cadresList, persList) => {
  const nn = (x) => String(x || '').trim().toUpperCase()
  const P = (persList || []).filter((p) => p.nom)
  if (!P.length) return null
  const purge = P.some((p) => p.fdf)   // retrait des noms absents seulement une fois le Personnel géré (FDF renseignés)
  const m = new Map(P.map((p) => [nn(p.nom), p]))
  const cur = cadresList || []
  let changed = false
  const out = []
  const seen = new Set()
  cur.forEach((c) => {
    const k = nn(c.nom), p = m.get(k)
    if (seen.has(k) || (!p && purge)) { changed = true; return }
    if (!p) { seen.add(k); out.push(c); return }
    seen.add(k)
    const n = { ...c }
    if (p.grade && p.grade !== c.grade) n.grade = p.grade
    if (p.prenom && p.prenom !== c.prenom) n.prenom = p.prenom
    if (n.grade !== c.grade || n.prenom !== c.prenom) changed = true
    out.push(n)
  })
  const add = P.filter((p) => !seen.has(nn(p.nom)) && (seen.add(nn(p.nom)), true))
    .map((p) => ({ id: uid(), grade: p.grade || '', nom: nn(p.nom), prenom: p.prenom || '', dispos: 0, giff: '', mil: false, fonct: '', cdg: '', aff: '', just: '' }))
  if (add.length) changed = true
  return changed ? [...add, ...out] : null
}

// Groupe masqué par défaut (Paramètres › Blocs) : visible seulement si ajouté pour le jour
export const isShown = (b, day) => b.show !== false || !!day?.shown?.[b.id]
