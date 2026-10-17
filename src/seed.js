import seed from './seed.json'
// Données initiales issues du classeur Excel (plannings, parc, calendrier, cadres)
export async function applySeed(w) {
  await w('planning/chefsgiff', { days: seed.chefsgiff }, false)
  await w('planning/gcdt', { days: seed.gcdt }, false)
  await w('planning/vpc', { days: seed.vpc }, false)
  await w('fleet/main', { engins: seed.fleet, cats: seed.cats }, false)
  await w('cadres/main', { list: seed.cadres, besoins: seed.besoins }, false)
  await w('calendar/main', { lines: seed.cal.lines }, false)
}
export { seed }
