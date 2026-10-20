// Exportar entrenos a calendario (.ics): eventos de día completo con aviso a las 8:00
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const d8 = (dateStr) => dateStr.replace(/-/g, '')
const nextDay = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
// Las líneas de un .ics no deben pasar de 75 octetos: se parten con salto + espacio
const fold = (line) => {
  const out = []
  let cur = ''
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = ' ' + ch } else cur += ch
  }
  out.push(cur)
  return out.join('\r\n')
}

export function buildICS(sessions = []) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Northstone//Entrenos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Northstone']
  sessions.forEach(s => {
    if (!s?.date) return
    const desc = [
      s.duration ? `${s.duration} min` : '',
      s.notes || '',
      ...(s.exercises || []).map(e => `• ${e.name}${e.notes ? ': ' + e.notes.replace(/\n+/g, ' · ') : ''}`),
      'Ábrela en Northstone para ver los detalles y valorarla.',
    ].filter(Boolean).join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id || s.date + '-' + s.title}@northstone`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d8(s.date)}`,
      `DTEND;VALUE=DATE:${nextDay(s.date)}`,
      `SUMMARY:${esc('🏋️ ' + (s.title || 'Entreno'))}`,
      `DESCRIPTION:${esc(desc)}`,
      'URL:https://northstone-nine.vercel.app/?tab=training',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(s.title || 'Entreno')}`, 'TRIGGER;RELATED=START:PT8H', 'END:VALARM',
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

export function downloadICS(sessions, filename = 'northstone-entrenos.ics') {
  const blob = new Blob([buildICS(sessions)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
