import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { seedLocal } from './store.js'
import { seed } from './seed.js'
import { addDays } from './util.js'
import './styles.css'

// Plannings d'exemple décalés de 60 jours pour couvrir la période actuelle
const shift = (m) => Object.fromEntries(Object.entries(m).map(([d, v]) => [addDays(d, 60), v]))
seedLocal('planning/chefsgiff', { days: shift(seed.chefsgiff) })
seedLocal('planning/gcdt', { days: shift(seed.gcdt) })
seedLocal('planning/vpc', { days: shift(seed.vpc) })
seedLocal('fleet/main', { engins: seed.fleet, cats: seed.cats })
seedLocal('cadres/main', { list: seed.cadres, besoins: seed.besoins })
seedLocal('calendar/main', { lines: seed.cal.lines })
seedLocal('usersdemo/main', { list: [
  { id: 'local', email: 'essai@local', name: 'Vous (essai)', role: 'superadmin' },
  { id: 'u2', email: 'admin@exemple.fr', name: 'Administrateur exemple', role: 'admin' },
  { id: 'u3', email: 'chef.colonne@exemple.fr', name: 'Chef de colonne exemple', role: 'chefcolonne' },
  { id: 'u4', email: 'ogg@exemple.fr', name: 'OGG exemple', role: 'ogg' },
  { id: 'u5', email: 'nouveau@exemple.fr', name: 'Nouveau compte', role: 'pending' },
] })
seedLocal('personnel/main', { list: [
  { id: 'p1', nom: 'DURAND', prenom: 'Alex', grade: 'LCL', fonction: 'f_admin', email: 'admin@exemple.fr' },
  { id: 'p2', nom: 'MARTIN', prenom: 'Sam', grade: 'CDT', fonction: 'f_cdc', email: 'chef.colonne@exemple.fr' },
  { id: 'p3', nom: 'BERNARD', prenom: 'Jo', grade: 'CNE', fonction: 'f_ogg', email: 'ogg@exemple.fr' },
  { id: 'p4', nom: 'PETIT', prenom: 'Camille', grade: 'LTN1', fonction: 'f_cdc', email: 'nouveau@exemple.fr' },
] })
createRoot(document.getElementById('root')).render(<App />)
