import { createContext, createElement, useContext, useMemo } from 'react'
import { Lookup } from './Cell.jsx'
import { writeDoc, useDoc } from './store.js'
import { cellKey, blockName } from './util.js'

export const ENG = 'engage'
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Engins du parc cités dans un texte (un seul par libellé « CODE CIS »)
function matches(fleet, texts) {
  const out = []
  const seen = new Set()
  texts.forEach((t) => {
    fleet.forEach((e) => {
      const code = String(e.code || '').toUpperCase()
      if (!code) return
      const cis = String(e.cis || '').toUpperCase()
      const lab = `${code} ${cis}`.trim()
      if (seen.has(lab)) return
      if (cis && t.includes(`${code} ${cis}`)) { seen.add(lab); out.push(e); return }
      if (new RegExp(`(^|[^A-Z0-9-])${esc(code)}(?![A-Z0-9-])`).test(t)) {
        const same = fleet.filter((x) => String(x.code || '').toUpperCase() === code)
        if (same.length === 1 || !cis || t.includes(cis)) { seen.add(lab); out.push(e) }
      }
    })
  })
  return out
}
export const labelOf = (e) => `${e.code} ${e.cis}`.trim().toUpperCase()
export const labelsIn = (fleet, text) => new Set(matches(fleet, [String(text || '').toUpperCase()]).map(labelOf))

// Engins du parc cités dans les lignes du bloc
export function enginesOf(fleet, b, day) {
  const texts = b.rows.map((r) => String(day.cells?.[cellKey(b.id, r.id)]?.text || '').toUpperCase()).filter(Boolean)
  return new Set(matches(fleet, texts).map((e) => e.id))
}

// Index des engins déjà pris dans la journée : un engin ne peut figurer qu'une fois
export function buildIndex(fleet, cells) {
  const per = new Map()
  const count = new Map()
  Object.entries(cells || {}).forEach(([k, c]) => {
    const l = labelsIn(fleet, c?.text)
    if (l.size) { per.set(k, l); l.forEach((x) => count.set(x, (count.get(x) || 0) + 1)) }
  })
  return {
    takenFor: (key) => { const own = per.get(key); const out = new Set(); count.forEach((n, l) => { if (n - (own?.has(l) ? 1 : 0) > 0) out.add(l) }); return out },
    dupOf: (key) => { const own = per.get(key); return own ? [...own].some((l) => count.get(l) > 1) : false },
  }
}
export const DayIndex = createContext(null)
const cache = new WeakMap()
export function DayIndexProvider({ cells, children }) {
  const { fleet = [] } = useContext(Lookup)
  const idx = useMemo(() => {
    if (!cells || typeof cells !== 'object') return buildIndex(fleet, cells)
    const hit = cache.get(cells)
    if (hit && hit.fleet === fleet) return hit.idx
    const idx = buildIndex(fleet, cells)
    cache.set(cells, { fleet, idx })
    return idx
  }, [fleet, cells])
  return createElement(DayIndex.Provider, { value: idx }, children)
}

export const freeStatus = (e, statuses) => {
  const ok = (id) => statuses.find((s) => s.id === id)?.avail
  return e.prev && e.prev !== ENG && ok(e.prev) ? e.prev : (statuses.find((s) => s.avail)?.id || statuses[0]?.id)
}
export const strip = ({ eng, prev, ...e }) => e

export function useEngage() {
  const { fleet = [], statuses = [], date } = useContext(Lookup)
  // b : bloc effectif ; v : nouvel état d'engagement (null = désengagé)
  return (b, day, v) => {
    if (!fleet.length) return
    const key = `${date}|${b.id}`
    const had = day.engaged?.[b.id]?.at
    let list = fleet
    if (v && v.at && !had) {
      const ids = enginesOf(fleet, b, day)
      if (!ids.size) return
      const meta = { key, date, group: blockName(b, day), at: v.at, by: v.by || '', note: v.note || '' }
      list = fleet.map((e) => (ids.has(e.id) ? { ...e, prev: e.status === ENG ? e.prev : e.status, status: ENG, eng: meta } : e))
    } else if (v && v.at) {
      list = fleet.map((e) => (e.eng?.key === key ? { ...e, eng: { ...e.eng, note: v.note || '' } } : e))
    } else {
      list = fleet.map((e) => (e.eng?.key === key ? { ...strip(e), status: freeStatus(e, statuses) } : e))
    }
    writeDoc('fleet/main', { engins: list }, true)
  }
}

export const releaseOne = (fleet, id, statuses) => fleet.map((e) => (e.id === id ? { ...strip(e), status: freeStatus(e, statuses) } : e))

// Engins cités dans le dispositif du jour (hors engins déjà engagés) : indisponibles tant qu'ils y figurent
export function usePlaced(fleet, date) {
  const [day] = useDoc(`days/${date}`)
  return useMemo(() => {
    const labs = new Set()
    Object.values(day?.cells || {}).forEach((c) => labelsIn(fleet, c?.text).forEach((l) => labs.add(l)))
    return new Set(fleet.filter((e) => e.status !== ENG && labs.has(labelOf(e))).map((e) => e.id))
  }, [day, fleet])
}
