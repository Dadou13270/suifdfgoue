import { jsPDF } from 'jspdf'

const fmt = (d) => { const [y, m, j] = d.split('-'); return `${j}/${m}/${y}` }
const clean = (s) => String(s ?? '').replace(/\u00B7/g, '-').replace(/[^ -ÿ’]/g, '').replace(/’/g, "'")

// Listing PDF vectoriel : répartition du personnel + liste des occupations de chaque agent.
export function agentsToPdf(agents, { from, to, cols }) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight(), M = 12
  let y = M
  let page = 1
  const foot = () => { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`Page ${page}`, PW - M, PH - 6, { align: 'right' }); pdf.text(`Edité le ${fmt(new Date().toISOString().slice(0, 10))}`, M, PH - 6) }
  const need = (h) => { if (y + h > PH - 12) { foot(); pdf.addPage(); page++; y = M } }

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(185, 28, 28)
  pdf.text('Dispositif FDF - Listing par agent', M, y + 5); y += 8
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(80)
  pdf.text(`Période du ${fmt(from)} au ${fmt(to)} - ${agents.length} agent(s)`, M, y + 3); y += 9

  // Répartition globale par type d'occupation
  const tot = {}; agents.forEach((a) => cols.forEach((c) => { if (a.by[c]) tot[c] = (tot[c] || 0) + a.by[c] }))
  const sum = Object.entries(tot)
  if (sum.length) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(30); pdf.text('Répartition du personnel', M, y + 3); y += 6
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
    sum.forEach(([c, n]) => { need(5); pdf.text(clean(c), M + 2, y + 3); pdf.text(String(n), M + 90, y + 3, { align: 'right' }); y += 4.6 })
    y += 3
  }

  agents.forEach((a) => {
    const list = [...a.list].sort((p, q) => p.date.localeCompare(q.date))
    need(14)
    pdf.setFillColor(243, 244, 246); pdf.rect(M, y, PW - 2 * M, 6.5, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(20)
    pdf.text(clean(`${a.grade ? a.grade + ' ' : ''}${a.nom}${a.aff ? ` (${a.aff})` : ''}`), M + 2, y + 4.6)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
    pdf.text(`${a.total} occupation(s) - ${a.days.size} jour(s)${a.eng ? ` - ${a.eng} engagé(s)` : ''}`, PW - M - 2, y + 4.6, { align: 'right' })
    y += 8.5
    pdf.setFontSize(8.5); pdf.setTextColor(50)
    list.forEach((l) => {
      need(4.4)
      pdf.text(fmt(l.date), M + 3, y + 3)
      pdf.text(clean(`${l.group} - ${l.col}${l.engaged ? ' - engagé' : ''}`), M + 25, y + 3, { maxWidth: PW - 2 * M - 27 })
      y += 4.2
    })
    y += 2.5
  })
  foot()
  return pdf.output('blob')
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
