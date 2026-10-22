// Rôles et droits d'accès (identiques aux règles Firestore fournies dans firestore.rules)
export const ROLES = {
  superadmin: { label: 'Super administrateur', rank: 4 },
  admin: { label: 'Administrateur', rank: 3 },
  chefcolonne: { label: 'Chef de colonne', rank: 2 },
  ogg: { label: 'OGG', rank: 1 },
  cds: { label: 'Centre de secours', rank: 1 },
  pending: { label: 'En attente de rôle', rank: 0 },
  refused: { label: 'Demande refusée', rank: 0 },
}
export const ASSIGNABLE = ['superadmin', 'admin', 'chefcolonne', 'ogg', 'cds', 'pending', 'refused']

export const TAB_LABELS = {
  dispositif: 'Dispositif (jour, semaine)', plannings: 'Plannings', engins: 'Engins', calendrier: 'Calendrier',
  carto: 'Carto CIS', cadres: 'Cadres', releves: 'Relèves', settings: 'Paramètres', users: 'Rôles des utilisateurs',
}
const ALL = ['dispositif', 'plannings', 'engins', 'calendrier', 'carto', 'cadres', 'releves']
export const FUNC_TABS = ALL
export const DEFAULT_ACCESS = {
  superadmin: [...ALL, 'settings', 'users'],
  admin: [...ALL, 'settings', 'users'],
  chefcolonne: ['dispositif', 'plannings', 'engins', 'carto', 'cadres', 'releves'],
  ogg: ['dispositif', 'engins', 'carto'],
  cds: ['dispositif', 'plannings', 'engins', 'calendrier', 'carto'],   // droits fixes : pas de Paramètres, Cadres, Relèves
  pending: [],
  refused: [],
}
export const EDITABLE_ROLES = ['admin', 'chefcolonne', 'ogg']
// Centre de secours : modifie la vue jour et semaine, lecture seule sur ces onglets
export const READONLY_TABS = { cds: ['plannings', 'engins', 'calendrier', 'carto'] }
export const isReadOnly = (role, tab) => !!READONLY_TABS[role]?.includes(tab)
// Choix / modification de la disposition : super administrateur et administrateur
export const canLayout = (role) => role === 'superadmin' || role === 'admin'

// Droits en vigueur (config/rights, modifiable par le super administrateur et l'administrateur)
let live = null
let liveV = 0
export const setRights = (r, v) => { live = r || null; liveV = v || 0 }
export const getAccess = () => {
  const o = { ...DEFAULT_ACCESS }
  if (live) EDITABLE_ROLES.forEach((r) => { if (Array.isArray(live[r])) o[r] = live[r] })
  // onglet « Relèves » ajouté après l'enregistrement des droits : ouvert par défaut tant que la matrice n'a pas été réenregistrée
  if (live && liveV < 2) EDITABLE_ROLES.forEach((r) => { if (DEFAULT_ACCESS[r].includes('releves') && !o[r].includes('releves')) o[r] = [...o[r], 'releves'] })
  o.superadmin = DEFAULT_ACCESS.superadmin
  o.admin = [...new Set([...o.admin, 'settings', 'users'])]   // l'administrateur garde toujours Paramètres et Rôles
  EDITABLE_ROLES.forEach((r) => { if (r !== 'admin') o[r] = o[r].filter((t) => t !== 'users') })
  return o
}
export const canTab = (role, tab) => !!getAccess()[role]?.includes(tab)
export const allowedTabs = (role) => ALL.filter((t) => canTab(role, t))
// Qui peut cocher / décocher quoi dans la matrice des droits
export const canEditRight = (actor, role, tab) => {
  if (!['superadmin', 'admin'].includes(actor) || role === 'superadmin' || role === 'cds' || tab === 'users') return false
  if (role === 'admin') return actor === 'superadmin' && tab !== 'settings'
  return true
}
// Réservé au super administrateur : import des données du classeur, réinitialisation
export const isSuper = (role) => role === 'superadmin'
// Rôles qu'un acteur peut attribuer ; un administrateur ne touche ni aux super administrateurs ni ne peut en créer
export const assignableBy = (actor) => (actor === 'superadmin' ? ASSIGNABLE : actor === 'admin' ? ['admin', 'chefcolonne', 'ogg', 'cds', 'pending', 'refused'] : [])
export const canEditUser = (actor, target) => actor === 'superadmin' || (actor === 'admin' && target.role !== 'superadmin')
