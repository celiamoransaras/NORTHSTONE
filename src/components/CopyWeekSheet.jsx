import { useMemo, useState } from 'react'
import { ymd } from '../lib/dates'
import { Sessions } from '../lib/db'
import { sendPushToAthletes } from '../lib/pushNotifications'
import { TYPE_ICONS } from '../lib/constants'

// Lunes de la semana de una fecha (YYYY-MM-DD)
const mondayOf = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return ymd(d)
}
const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
const weekLabel = (monday) => {
  const a = new Date(monday + 'T12:00:00')
  const b = new Date(addDays(monday, 6) + 'T12:00:00')
  const f = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${f(a)} – ${f(b)}`
}
const DAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// ─────────────────────────────────────────────
// Copiar una semana de entrenos (de una deportista o de todo el equipo)
// a otra semana y/o a otras deportistas, en un solo paso.
// ─────────────────────────────────────────────
export default function CopyWeekSheet({ sessions, athletes, onClose, onDone, toast }) {
  const thisMonday = mondayOf(ymd(new Date()))
  const [sourceAthlete, setSourceAthlete] = useState('all')
  const [sourceWeek, setSourceWeek] = useState(thisMonday)
  const [targetWeek, setTargetWeek] = useState(addDays(thisMonday, 7))
  const [targets, setTargets] = useState([])
  const [selected, setSelected] = useState(null) // ids de sesiones a copiar (null = todas)
  const [saving, setSaving] = useState(false)

  const weekSessions = useMemo(() => {
    const end = addDays(sourceWeek, 6)
    return sessions
      .filter(s => s.date >= sourceWeek && s.date <= end)
      .filter(s => sourceAthlete === 'all' || (s.athlete_ids || []).includes(sourceAthlete))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [sessions, sourceWeek, sourceAthlete])

  const chosen = weekSessions.filter(s => !selected || selected.includes(s.id))
  const shiftDays = Math.round((new Date(targetWeek + 'T12:00:00') - new Date(sourceWeek + 'T12:00:00')) / 86400000)
  const canCopy = chosen.length > 0 && targets.length > 0 && !saving

  const toggleTarget = (id) => setTargets(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id])
  const toggleSession = (id) => setSelected(sel => {
    const base = sel || weekSessions.map(s => s.id)
    return base.includes(id) ? base.filter(x => x !== id) : [...base, id]
  })

  const copy = async () => {
    if (!canCopy) return
    setSaving(true)
    try {
      for (const s of chosen) {
        await Sessions.create({
          title: s.title,
          date: addDays(s.date, shiftDays),
          type: s.type,
          duration: s.duration,
          notes: s.notes,
          exercises: (s.exercises || []).map(e => ({ name: e.name, notes: e.notes, videos: e.videos || [] })),
          athlete_ids: targets,
        })
      }
      try {
        sendPushToAthletes(targets, {
          title: '📅 Tu semana de entrenos está lista',
          body: `${chosen.length} sesion${chosen.length > 1 ? 'es' : ''} · semana del ${weekLabel(targetWeek)}`,
          url: '/?tab=training',
        })
      } catch { /* notificación opcional */ }
      toast(`${chosen.length} sesion${chosen.length > 1 ? 'es copiadas' : ' copiada'} ✓`)
      onDone()
    } catch (err) {
      toast('Error al copiar: ' + (err?.message || err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const WeekPicker = ({ value, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(addDays(value, -7))} aria-label="Semana anterior">‹</button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{weekLabel(value)}</div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(addDays(value, 7))} aria-label="Semana siguiente">›</button>
    </div>
  )

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>Copiar semana</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <div className="section-title" style={{ marginTop: 0 }}>1 · Qué semana copias</div>
          <select className="input" value={sourceAthlete} onChange={e => { setSourceAthlete(e.target.value); setSelected(null) }} style={{ marginBottom: 8 }}>
            <option value="all">Todas las sesiones del equipo</option>
            {athletes.map(a => <option key={a.id} value={a.id}>Sesiones de {a.name}</option>)}
          </select>
          <WeekPicker value={sourceWeek} onChange={v => { setSourceWeek(v); setSelected(null) }} />

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weekSessions.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No hay sesiones esa semana</div>
            )}
            {weekSessions.map(s => {
              const on = !selected || selected.includes(s.id)
              return (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--card)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggleSession(s.id)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: 16 }}>{TYPE_ICONS[s.type] || '📅'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {DAY[new Date(s.date + 'T12:00:00').getDay()]} {new Date(s.date + 'T12:00:00').getDate()} → {DAY[new Date(addDays(s.date, shiftDays) + 'T12:00:00').getDay()]} {new Date(addDays(s.date, shiftDays) + 'T12:00:00').getDate()}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>

          <div className="section-title">2 · A qué semana</div>
          <WeekPicker value={targetWeek} onChange={setTargetWeek} />

          <div className="section-title">3 · Para quién</div>
          {athletes.map(a => (
            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card)', borderRadius: 'var(--radius-sm)', border: targets.includes(a.id) ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', marginBottom: 6 }}>
              <input type="checkbox" checked={targets.includes(a.id)} onChange={() => toggleTarget(a.id)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
              <span style={{ fontSize: 14 }}>{a.name}</span>
            </label>
          ))}

          <button className="btn btn-primary btn-full" onClick={copy} disabled={!canCopy} style={{ marginTop: 16, opacity: canCopy ? 1 : 0.5 }}>
            {saving ? 'Copiando...' : `Copiar ${chosen.length} sesion${chosen.length === 1 ? '' : 'es'}${targets.length ? ` a ${targets.length} deportista${targets.length > 1 ? 's' : ''}` : ''}`}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Se crean sesiones nuevas: las originales no cambian y podrás editar cada copia.
          </div>
        </div>
      </div>
    </>
  )
}
