import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

// Capture de la page affichée -> PDF (A4, multi-pages) -> partage (mail / messagerie) ou téléchargement.
export async function captureToPdf(el, { title = '', subtitle = '', landscape: forceLand } = {}) {
  const wide = Math.max(el.scrollWidth, ...[...el.querySelectorAll('.tablewrap')].map((t) => t.scrollWidth))
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor || '#fff', useCORS: true,
    width: wide, windowWidth: wide, scrollX: 0, scrollY: -window.scrollY,
    onclone: (doc) => {
      doc.querySelectorAll('.tablewrap').forEach((t) => { t.style.overflow = 'visible'; t.style.maxHeight = 'none' })
      doc.querySelectorAll('th.sticky, td.sticky, .sticky').forEach((t) => { t.style.position = 'static' })
      doc.querySelectorAll('.combo').forEach((t) => t.remove())
      // html2canvas ne lit pas color-mix()/color() : conversion des couleurs calculées en rgba
      const cv = document.createElement('canvas'); cv.width = cv.height = 1
      const cx = cv.getContext('2d', { willReadFrequently: true })
      const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data; return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})` }
      const props = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color', 'caret-color']
      const win = doc.defaultView
      doc.querySelectorAll('*').forEach((n) => {
        const cs = win.getComputedStyle(n)
        props.forEach((p) => { const v = cs.getPropertyValue(p); if (v && v.startsWith('color(')) n.style.setProperty(p, rgba(v), 'important') })
        const bs = cs.getPropertyValue('box-shadow'); if (bs && bs.includes('color(')) n.style.setProperty('box-shadow', 'none', 'important')
        const bi = cs.getPropertyValue('background-image'); if (bi && bi.includes('color(')) n.style.setProperty('background-image', 'none', 'important')
      })
    },
  })
  const landscape = forceLand ?? canvas.width > canvas.height * 0.9
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight(), M = 8, HEAD = 10
  const iw = PW - 2 * M
  const mmPerPx = iw / canvas.width
  const pageContentH = PH - 2 * M - HEAD
  const slicePx = Math.floor(pageContentH / mmPerPx)
  const pages = Math.max(1, Math.ceil(canvas.height / slicePx))
  for (let i = 0; i < pages; i++) {
    if (i) pdf.addPage()
    const h = Math.min(slicePx, canvas.height - i * slicePx)
    const part = document.createElement('canvas'); part.width = canvas.width; part.height = h
    part.getContext('2d').drawImage(canvas, 0, i * slicePx, canvas.width, h, 0, 0, canvas.width, h)
    pdf.setFontSize(10); pdf.setTextColor(60)
    pdf.text(title, M, M + 4); pdf.text(`${subtitle}${pages > 1 ? `  ·  page ${i + 1}/${pages}` : ''}`, PW - M, M + 4, { align: 'right' })
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', M, M + HEAD, iw, h * mmPerPx)
  }
  return pdf.output('blob')
}

export async function sharePdf(blob, filename, subject, body) {
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: subject, text: body }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancel' }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\n(Joindre le fichier PDF qui vient d\'être téléchargé : ' + filename + ')')}`
  return 'downloaded'
}
