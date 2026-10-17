// Essai (artefact) : bibliothèques PDF non embarquées
const no = () => { throw new Error('pdf-indisponible') }
export default no
export const jsPDF = function () { no() }
