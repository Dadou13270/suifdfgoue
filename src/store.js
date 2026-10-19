import { useEffect, useState, useCallback, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, collection, onSnapshot, setDoc, getDoc, arrayUnion } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from 'firebase/auth'
import { DEFAULT_CONFIG } from './defaults.js'

const env = import.meta.env
const hasFirebase = !!env.VITE_FIREBASE_PROJECT_ID && !!env.VITE_FIREBASE_API_KEY
export const MODE = hasFirebase ? 'firebase' : 'local'

let db, auth
if (hasFirebase) {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
  })
  db = getFirestore(app)
  auth = getAuth(app)
}

/* ---------- mode local (localStorage + événements) ---------- */
const LS = 'fdf2:'
const bus = new EventTarget()
const mem = new Map()
const lsGet = (k) => {
  if (mem.has(k)) return mem.get(k)
  try { const v = JSON.parse(localStorage.getItem(LS + k)); if (v) mem.set(k, v); return v } catch { return null }
}
const lsSet = (k, v) => { mem.set(k, v); try { localStorage.setItem(LS + k, JSON.stringify(v)) } catch {} bus.dispatchEvent(new Event(k)) }
export const seedLocal = (k, v) => { if (!lsGet(k)) lsSet(k, v) }
const deepMerge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b
  const out = a && typeof a === 'object' && !Array.isArray(a) ? { ...a } : {}
  for (const k in b) out[k] = deepMerge(out[k], b[k])
  return out
}

export function subscribe(path, cb) {
  if (MODE === 'firebase') return onSnapshot(doc(db, ...path.split('/')), (s) => { const v = s.exists() ? s.data() : null; seen.set(path, v); cb(v) }, () => cb(null))
  const h = () => cb(lsGet(path))
  bus.addEventListener(path, h); h()
  return () => bus.removeEventListener(path, h)
}
const seen = new Map() // dernier état connu des documents (mode Firebase), pour le journal
async function write(path, data, merge) {
  const old = MODE === 'firebase' ? seen.get(path) : lsGet(path)
  if (MODE === 'firebase') await setDoc(doc(db, ...path.split('/')), data, { merge })
  else lsSet(path, merge ? deepMerge(lsGet(path) || {}, data) : data)
  logChange(path, old, data, merge)
}

/* ---------- journal d'activité : activity/{YYYY-MM-DD} = { items: [...] } ---------- */
let actor = { email: '', role: '', name: '' }
export const setActor = (a) => { actor = a }
export const getActor = () => actor
const NOLOG = /^(activity|meta|usersdemo)\b/
const short = (v) => { const s = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v); return s.length > 70 ? s.slice(0, 67) + '…' : s }
const flat = (o, pre = '', depth = 0, out = {}) => {
  if (o && typeof o === 'object' && !Array.isArray(o) && depth < 4) { Object.keys(o).forEach((k) => flat(o[k], pre ? `${pre}.${k}` : k, depth + 1, out)); if (!Object.keys(o).length && pre) out[pre] = {} }
  else out[pre] = o
  return out
}
const lab = (x) => (x && typeof x === 'object' ? x.code ? `${x.code} ${x.cis || ''}`.trim() : x.nom ? `${x.nom} ${x.prenom || ''}`.trim() : x.label || x.title || x.id || '' : String(x ?? ''))
function diffVals(p, o, n, out) {
  if (JSON.stringify(o) === JSON.stringify(n)) return
  if (Array.isArray(o) || Array.isArray(n)) {
    const A = Array.isArray(o) ? o : [], B = Array.isArray(n) ? n : []
    if ([...A, ...B].every((x) => x && typeof x === 'object' && x.id !== undefined)) {
      const ma = new Map(A.map((x) => [x.id, x])), mb = new Map(B.map((x) => [x.id, x]))
      B.forEach((x) => { if (!ma.has(x.id)) out.push({ p, o: '', n: '+ ' + short(lab(x)) }); else if (JSON.stringify(ma.get(x.id)) !== JSON.stringify(x)) out.push({ p, o: short(lab(ma.get(x.id))), n: '✎ ' + short(lab(x)) }) })
      A.forEach((x) => { if (!mb.has(x.id)) out.push({ p, o: '− ' + short(lab(x)), n: '' }) })
      return
    }
    out.push({ p, o: `${A.length} élément(s)`, n: `${B.length} élément(s)` }); return
  }
  out.push({ p, o: short(o), n: short(n) })
}
function logChange(path, old, data, merge) {
  try {
    if (NOLOG.test(path)) return
    const out = []
    const fo = flat(old || {}), fn = flat(data || {})
    const keys = merge ? Object.keys(fn) : [...new Set([...Object.keys(fo), ...Object.keys(fn)])]
    keys.filter((k) => !/(^|\.)(headsAuto|autoDone|auto)(\.|$)/.test(k)).forEach((k) => diffVals(k, fo[k] ?? (k in fo ? fo[k] : undefined), fn[k], out))
    const auto0 = merge && data && data.autoDone !== undefined
    if (!out.length && !auto0) return
    const auto = merge && data && data.autoDone !== undefined
    const item = { t: Date.now(), who: actor.email || '?', role: actor.role || '', path, ch: auto ? [{ p: 'auto', o: '', n: `${out.length} champ(s)` }] : out.slice(0, 30), more: auto ? 0 : Math.max(0, out.length - 30), auto: !!auto }
    appendLog(item)
  } catch {}
}
export function appendLog(item) {
  const d = new Date(item.t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  const path = `activity/${d.toISOString().slice(0, 10)}`
  if (MODE === 'firebase') return setDoc(doc(db, ...path.split('/')), { items: arrayUnion(item) }, { merge: true }).catch(() => {})
  lsSet(path, { items: [...(lsGet(path)?.items || []), item] })
}

/* ---------- hooks ---------- */
let pendingName = ''
export function useAuth() {
  const [user, setUser] = useState(MODE === 'firebase' ? undefined : { local: true, uid: 'local', email: 'essai@local' })
  const [profile, setProfile] = useState(undefined) // users/{uid} : undefined = chargement, null = absent
  const [localRole, setLocalRoleState] = useState(() => { try { return localStorage.getItem(LS + 'role') || 'superadmin' } catch { return 'superadmin' } })
  const creating = useRef(false)
  useEffect(() => (MODE === 'firebase' ? onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setProfile(undefined) }) : undefined), [])
  useEffect(() => {
    if (MODE !== 'firebase' || !user) return
    return subscribe(`users/${user.uid}`, setProfile)
  }, [user?.uid]) // eslint-disable-line
  // Premier compte créé : super administrateur ; les suivants : en attente d'un rôle
  useEffect(() => {
    if (MODE !== 'firebase' || !user || profile !== null || creating.current) return
    creating.current = true
    ;(async () => {
      try {
        const init = await getDoc(doc(db, 'meta', 'init')).catch(() => null)
        const first = !init?.exists()
        await setDoc(doc(db, 'users', user.uid), { email: user.email, name: pendingName || user.displayName || '', role: first ? 'superadmin' : 'pending', createdAt: Date.now() })
        if (first) await setDoc(doc(db, 'meta', 'init'), { by: user.uid, at: Date.now() })
      } finally { creating.current = false }
    })()
  }, [user, profile])
  // Rôle donné par l'administrateur dans Gestion du personnel (roster/{e-mail}) : appliqué par la personne elle-même
  // à la connexion, à condition que son adresse e-mail soit vérifiée.
  const [verified, setVerified] = useState(true)
  useEffect(() => { if (MODE === 'firebase') setVerified(!!user?.emailVerified) }, [user])
  useEffect(() => {
    if (MODE !== 'firebase' || !user?.email || !verified || !profile) return
    return subscribe(`roster/${user.email.toLowerCase()}`, (r) => {
      const next = r?.role
      if (!next || next === profile.role || profile.role === 'superadmin' || next === 'superadmin') return
      setDoc(doc(db, 'users', user.uid), { role: next, ...(profile.name ? {} : { name: user.displayName || `${r.prenom || ''} ${r.nom || ''}`.trim() }) }, { merge: true }).catch(() => {})
    })
  }, [user?.uid, verified, profile?.role]) // eslint-disable-line
  const resendVerify = async () => { if (auth?.currentUser) await sendEmailVerification(auth.currentUser) }
  const refreshVerify = async () => { const u = auth?.currentUser; if (!u) return; await u.reload(); await u.getIdToken(true); setVerified(!!u.emailVerified) }
  const setLocalRole = (r) => { setLocalRoleState(r); try { localStorage.setItem(LS + 'role', r) } catch {} }
  const role = MODE === 'firebase' ? (profile === undefined || profile === null ? undefined : profile.role || 'pending') : localRole
  return {
    user, role, setLocalRole, verified, resendVerify, refreshVerify,
    login: (e, p) => signInWithEmailAndPassword(auth, e, p),
    register: async (e, p, nom = '', prenom = '') => {
      pendingName = `${prenom} ${nom}`.trim()
      const cred = await createUserWithEmailAndPassword(auth, e, p)
      if (pendingName) await updateProfile(cred.user, { displayName: pendingName }).catch(() => {})
      await sendEmailVerification(cred.user).catch(() => {})
      return cred
    },
    logout: () => (MODE === 'firebase' ? signOut(auth) : undefined),
  }
}

// Liste des utilisateurs et attribution des rôles
export function useUsers(enabled) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!enabled) return
    if (MODE === 'firebase') return onSnapshot(collection(db, 'users'), (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setList([]))
    return subscribe('usersdemo/main', (v) => setList(v?.list || []))
  }, [enabled])
  const setRole = useCallback(async (id, role) => {
    const u = (list.find((x) => x.id === id) || {})
    appendLog({ t: Date.now(), who: actor.email || '?', role: actor.role || '', path: 'users/' + id, ch: [{ p: u.email || id, o: u.role || 'pending', n: role }], more: 0 })
    if (MODE === 'firebase') return setDoc(doc(db, 'users', id), { role }, { merge: true })
    const cur = lsGet('usersdemo/main')?.list || []
    lsSet('usersdemo/main', { list: cur.map((u) => (u.id === id ? { ...u, role } : u)) })
  }, [list])
  return [list, setRole]
}

// Mise à niveau d'une configuration enregistrée avant la « chaîne de commandement »
function migrateSigar(d) {
  if (!d?.blocks?.some((b) => b.id === 'sigar') || d.blocks.some((b) => b.id === 'sigar1')) return d
  const two = DEFAULT_CONFIG.blocks.filter((b) => b.id === 'sigar1' || b.id === 'sigar2')
  return { ...d, blocks: d.blocks.flatMap((b) => (b.id === 'sigar' ? two : [b])) }
}
function migrateHeadCis(d) {
  if (!d?.blocks || d.blocks.some((b) => b.headCis !== undefined)) return d
  const blocks = d.blocks.map((b) => (/^(giff|mil)\d/.test(b.id) ? { ...b, headCis: true } : b))
  const rules = d.autofill?.rules?.map((r) => (r.target?.startsWith('head:') && /^(giff|mil)/.test(r.target.slice(5)) ? { ...r, fmt: (r.fmt || '').replace('{aff}', '') } : r))
  return { ...d, blocks, ...(d.autofill && rules ? { autofill: { ...d.autofill, rules } } : {}) }
}
function migrateTag(d) {
  if (!d?.blocks) return d
  return { ...d, blocks: d.blocks.map((b) => ((/^(giff|mil)\d/.test(b.id) || b.id === 'mip') && b.tag === undefined ? { ...b, tag: 'MAT' } : b)) }
}
function migrateDuty(d) {
  if (!d?.blocks) return d
  return { ...d, blocks: d.blocks.map((b) => (b.section === 'cdt' && b.duty === undefined ? { ...b, duty: true } : b)) }
}
function migrateCadre(d) {
  if (!d?.plannings || d.plannings.some((p) => p.cols?.some((c) => c.cadre !== undefined))) return d
  const def = Object.fromEntries(DEFAULT_CONFIG.plannings.map((p) => [p.id, Object.fromEntries(p.cols.map((c) => [c.id, c.cadre]))]))
  return { ...d, plannings: d.plannings.map((p) => ({ ...p, cols: p.cols.map((c) => (def[p.id]?.[c.id] ? { ...c, cadre: def[p.id][c.id] } : c)) })) }
}
function migrateFdf(d) {
  if (!d?.plannings || d.plannings.some((p) => p.cols?.some((c) => c.fdf !== undefined))) return d
  const def = Object.fromEntries(DEFAULT_CONFIG.plannings.map((p) => [p.id, Object.fromEntries(p.cols.map((c) => [c.id, c.fdf]))]))
  return { ...d, plannings: d.plannings.map((p) => ({ ...p, cols: p.cols.map((c) => (def[p.id]?.[c.id] ? { ...c, fdf: def[p.id][c.id] } : c)) })) }
}
function migrateMil(d) {
  if (!d?.plannings || d.plannings.some((p) => p.cols?.some((c) => c.mil !== undefined))) return d
  return { ...d, plannings: d.plannings.map((p) => (p.id === 'chefsgiff' ? { ...p, cols: p.cols.map((c) => (/^M\d/.test(c.id) ? { ...c, mil: true } : c)) } : p)) }
}
function migrateAddable(d) {
  if (!d?.blocks || d.addableFixed) return d
  return { ...d, addableFixed: true, blocks: d.blocks.map((b) => (b.id === 'mip' || b.id === 'autres' ? { ...b, addable: false } : b)) }
}
function migrate(d) {
  d = migrateAddable(d)
  d = migrateMil(d)
  d = migrateFdf(migrateCadre(d))
  d = migrateDuty(migrateTag(migrateHeadCis(migrateSigar(d))))
  if (!d || d.cdtTitle !== undefined || !d.blocks) return d
  const order = ['giff1', 'giff2', 'giff3', 'giff4', 'mil1', 'mil2', 'sigar', 'sigar1', 'sigar2', 'mip', 'autres', 'dih', 'spec', 'mixte', 'coldep', 'pcs']
  const rank = (b) => { const i = order.indexOf(b.id); return i < 0 ? 99 : i }
  const blocks = d.blocks.map((b) => ({ ...b, ...(['mixte', 'coldep', 'pcs'].includes(b.id) ? { section: 'cdt' } : {}), ...(b.id === 'autres' ? { customName: true } : {}) }))
    .sort((a, b) => rank(a) - rank(b))
  return { ...d, cdtTitle: DEFAULT_CONFIG.cdtTitle, blocks }
}

export function useConfig(enabled) {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    if (!enabled) return
    return subscribe('config/main', (d) => setConfig(d ? { ...DEFAULT_CONFIG, ...migrate(d) } : DEFAULT_CONFIG))
  }, [enabled])
  const save = useCallback((c) => write('config/main', c, false), [])
  return [config, save]
}

export function useDays(dates, enabled) {
  const key = dates.join(',')
  const [days, setDays] = useState({})
  useEffect(() => {
    if (!enabled) return
    const offs = dates.map((d) => subscribe(`days/${d}`, (v) => setDays((p) => ({ ...p, [d]: v || {} }))))
    return () => offs.forEach((f) => f())
    // eslint-disable-next-line
  }, [key, enabled])
  const patch = useCallback((date, data) => write(`days/${date}`, data, true), [])
  return [days, patch]
}

export const writeDoc = (path, data, merge = true) => write(path, data, merge)

// Document générique : [données, fusion, remplacement]
export function useDoc(path, enabled = true) {
  const [d, setD] = useState(undefined)
  useEffect(() => (enabled ? subscribe(path, (v) => setD(v || {})) : undefined), [path, enabled])
  const patch = useCallback((p) => write(path, p, true), [path])
  const replace = useCallback((p) => write(path, p, false), [path])
  return [d, patch, replace]
}
