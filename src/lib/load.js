import { ymd } from './dates'

// ─────────────────────────────────────────────
// CARGA DE ENTRENAMIENTO (método RPE de sesión)
//  carga = RPE (1–10) × minutos de la sesión, en unidades arbitrarias (UA).
//  Aguda = carga de los últimos 7 días. Crónica = media semanal de los últimos 28 días.
//  Ratio aguda:crónica ≈ 0,8–1,3 zona habitual; > 1,5 pico de carga (más riesgo de lesión).
// ─────────────────────────────────────────────

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
export const mondayOf = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return ymd(d)
}

const isTraining = (s) => s && s.type !== 'rest_day'
export const isDone = (s, athleteId) => s.attendance?.[athleteId] === true || s.ratings?.[athleteId]?.rpe != null

// Carga de una sesión para una deportista (null si no hay RPE)
export function sessionLoad(s, athleteId) {
  const rpe = Number(s.ratings?.[athleteId]?.rpe)
  if (!Number.isFinite(rpe) || rpe <= 0) return null
  return Math.round(rpe * (Number(s.duration) || 60))
}

// Resumen de carga y cumplimiento de una deportista a partir de todas sus sesiones
export function athleteLoad(sessions = [], athleteId, today = ymd(new Date())) {
  const mine = sessions.filter(s => isTraining(s) && (s.athlete_ids || []).includes(athleteId))
  const done = mine.filter(s => s.date <= today && isDone(s, athleteId))
  const from7 = addDays(today, -6), from28 = addDays(today, -27)
  const sum = (from) => done.filter(s => s.date >= from && s.date <= today).reduce((a, s) => a + (sessionLoad(s, athleteId) || 0), 0)
  const acute = sum(from7)
  const chronic = sum(from28) / 4

  const mon = mondayOf(today), sun = addDays(mon, 6)
  const week = mine.filter(s => s.date >= mon && s.date <= sun)
  const weekDone = week.filter(s => isDone(s, athleteId))
  const missed = mine.filter(s => s.date < today && s.date >= addDays(today, -7) && !isDone(s, athleteId))
  const rpes7 = done.filter(s => s.date >= from7).map(s => Number(s.ratings?.[athleteId]?.rpe)).filter(v => v > 0)
  const avgRpe = rpes7.length ? rpes7.reduce((a, b) => a + b, 0) / rpes7.length : null
  const lastDone = done.map(s => s.date).sort().pop() || null
  const daysSince = lastDone ? Math.round((new Date(today + 'T12:00:00') - new Date(lastDone + 'T12:00:00')) / 86400000) : null
  const unrated = done.filter(s => s.date >= from7 && sessionLoad(s, athleteId) == null).length

  // Últimas 8 semanas (lunes a domingo)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(mon, -7 * (7 - i)), end = addDays(start, 6)
    const ws = done.filter(s => s.date >= start && s.date <= end)
    return { start, load: ws.reduce((a, s) => a + (sessionLoad(s, athleteId) || 0), 0), sessions: ws.length, current: i === 7 }
  })

  // Solo damos ratio si las 3 semanas anteriores tienen RPE: con poca historia la crónica sale
  // artificialmente baja y daría falsos «picos»
  const enoughHistory = weeks.slice(4, 7).every(w => w.load > 0)
  const ratio = enoughHistory && chronic > 0 ? acute / chronic : null

  return { acute, chronic, ratio, weekAssigned: week.length, weekDone: weekDone.length, missed: missed.length, avgRpe, lastDone, daysSince, unrated, weeks, assignedTotal: mine.length }
}

// "+85 % sobre su media" / "30 % menos que su media"
export const pctVsAvg = (r) => {
  const p = Math.round((r - 1) * 100)
  return p >= 0 ? `+${p} % sobre su media` : `${-p} % menos que su media`
}

// Lectura en palabras de la carga de la semana frente a su media de 4 semanas
export function loadStatus(l) {
  const r = l?.ratio
  if (r == null) return { word: 'Aún sin comparar', detail: 'Necesita 3 semanas valorando el RPE', color: 'var(--text-muted)' }
  if (r > 1.5) return { word: 'Muy alta', detail: pctVsAvg(r), color: 'var(--error)' }
  if (r > 1.3) return { word: 'Alta', detail: pctVsAvg(r), color: 'var(--warning)' }
  if (r < 0.8) return { word: 'Baja', detail: pctVsAvg(r), color: 'var(--text-muted)' }
  return { word: 'Normal', detail: 'Parecida a su media', color: 'var(--success)' }
}

// Avisos para la entrenadora, del más grave al más leve
export function loadFlags(l) {
  const out = []
  if (l.ratio != null && l.ratio > 1.5) out.push({ level: 3, text: 'Riesgo: entrena mucho más de lo habitual' })
  else if (l.ratio != null && l.ratio > 1.3) out.push({ level: 2, text: 'Entrena más de lo habitual' })
  if (l.avgRpe != null && l.avgRpe >= 8.5) out.push({ level: 2, text: `Esfuerzo muy alto (${l.avgRpe.toFixed(1).replace('.', ',')}/10)` })
  if (l.missed >= 2) out.push({ level: 2, text: `${l.missed} sesiones sin hacer en 7 días` })
  else if (l.missed === 1) out.push({ level: 1, text: '1 sesión sin hacer' })
  if (l.assignedTotal > 0 && l.daysSince != null && l.daysSince >= 5) out.push({ level: 2, text: `${l.daysSince} días sin registrar` })
  if (l.ratio != null && l.ratio < 0.8) out.push({ level: 1, text: 'Entrena menos de lo habitual' })
  if (l.unrated >= 2) out.push({ level: 1, text: `${l.unrated} sesiones sin valorar el esfuerzo` })
  return out.sort((a, b) => b.level - a.level)
}

