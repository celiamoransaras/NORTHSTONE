import { useState } from 'react'
import { createPortal } from 'react-dom'
import WeekRing from './WeekRing'
import Icon from './Icon'

// ─────────────────────────────────────────────
// CELEBRACIÓN AL TERMINAR + TARJETA PARA COMPARTIR
// Al valorar una sesión: el anillo de la semana se completa, resumen y una imagen
// vertical lista para Instagram (la marca Northstone viaja con cada historia).
// ─────────────────────────────────────────────
const RPE_WORD = ['', 'Muy fácil', 'Fácil', 'Ligero', 'Moderado', 'Algo duro', 'Duro', 'Muy duro', 'Muy muy duro', 'Casi máximo', 'Máximo']

async function drawCard({ session, rpe, weekDone, weekTotal, athleteName }) {
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  try { await document.fonts?.load?.("900 120px 'Barlow Condensed'"); await document.fonts?.load?.("600 40px 'Barlow'") } catch { /* fuentes del sistema */ }
  const bg = g.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0B1F33'); bg.addColorStop(1, '#0C4A6E')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  // textura suave
  g.globalAlpha = 0.06
  for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(W * 0.85, H * 0.2, 120 + i * 60, 0, Math.PI * 2); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke() }
  g.globalAlpha = 1
  const cond = (w, s) => `${w} ${s}px 'Barlow Condensed', 'Arial Narrow', sans-serif`
  const body = (w, s) => `${w} ${s}px 'Barlow', system-ui, sans-serif`
  g.fillStyle = '#fff'; g.font = cond(900, 56); g.textBaseline = 'top'
  g.fillText('NORTHSTONE', 80, 80)
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = body(600, 34)
  const d = new Date((session.date || '') + 'T12:00:00')
  g.fillText(isNaN(d) ? '' : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }), 80, 150)
  // Título (hasta 2 líneas)
  // Título: se reduce hasta caber en 2 líneas (sin cortar palabras)
  g.fillStyle = '#fff'
  const words = String(session.title || 'Entreno').toUpperCase().split(' ')
  let size = 124, lines = []
  for (; size >= 64; size -= 6) {
    g.font = cond(900, size); lines = []; let line = ''
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W - 160 && line) { lines.push(line); line = w } else line = t })
    lines.push(line)
    if (lines.length <= 2) break
  }
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 80, 280 + i * size))
  // Anillo
  const cx = W / 2, cy = 830, r = 200
  g.lineWidth = 34; g.lineCap = 'round'
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke()
  const p = weekTotal > 0 ? Math.min(weekDone / weekTotal, 1) : 1
  g.strokeStyle = p >= 1 ? '#34D399' : '#7DD3FC'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke()
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = cond(900, 150); g.textBaseline = 'middle'
  g.fillText(`${weekDone}/${weekTotal || weekDone}`, cx, cy - 10)
  g.font = body(600, 28); g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillText('sesiones esta semana', cx, cy + 82)
  // Datos
  const stats = [[`${session.duration || '–'}′`, 'minutos'], [rpe ? `${rpe}/10` : '–', rpe ? RPE_WORD[rpe].toLowerCase() : 'esfuerzo']]
  stats.forEach(([v, l], i) => {
    const x = W / 2 + (i === 0 ? -220 : 220)
    g.fillStyle = '#fff'; g.font = cond(900, 90); g.fillText(v, x, 1120)
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = body(600, 32); g.fillText(l, x, 1185)
  })
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.font = body(600, 28)
  g.fillText(`${athleteName ? athleteName.split(' ')[0] + ' · ' : ''}entrenando con Celia`, W / 2, 1280)
  return new Promise(res => c.toBlob(res, 'image/png'))
}

export default function Celebration({ session, rpe, weekDone, weekTotal, athleteName, onClose }) {
  const [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true)
    try {
      const blob = await drawCard({ session, rpe, weekDone, weekTotal, athleteName })
      const file = new File([blob], 'northstone-entreno.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mi entreno en Northstone' })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob); a.download = 'northstone-entreno.png'; a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      }
    } catch { /* compartir cancelado */ }
    setBusy(false)
  }
  const complete = weekTotal > 0 && weekDone >= weekTotal
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2100 }} />
      <div className="sheet" style={{ zIndex: 2101, textAlign: 'center' }} role="dialog" aria-label="Entreno completado">
        <div className="sheet-handle" />
        <div className="sheet-body" style={{ paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <WeekRing done={weekDone} total={weekTotal} size={150} />
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, textTransform: 'uppercase', lineHeight: 1.05 }}>
            {complete ? '¡Semana completa!' : '¡Entreno hecho!'}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>{session.title}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '18px 0 22px' }}>
            {[[`${session.duration || '–'} min`, 'clock'], [rpe ? `Esfuerzo ${rpe}/10 · ${RPE_WORD[rpe]}` : 'Valorado', 'bolt']].map(([t, ic]) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 20, background: 'var(--bg)', fontSize: 13, fontWeight: 700 }}>
                <Icon name={ic} size={16} /> {t}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={share} disabled={busy} style={{ gap: 8 }}>
            <Icon name="share" size={18} /> {busy ? 'Preparando imagen…' : 'Compartir mi entreno'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop: 8 }}>Cerrar</button>
        </div>
      </div>
    </>,
    document.body
  )
}
