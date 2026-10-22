import { useEffect, useMemo, useRef, useState } from 'react'
import { ymd } from '../lib/dates'
import { TYPE_ICONS, TYPE_COLORS } from '../lib/constants'

// ─────────────────────────────────────────────
// Vista de semana para planificar: lunes a domingo, crear en un día con "+",
// arrastrar una sesión a otro día (asa ⠿, funciona con el dedo y con el ratón); tocarla la abre,
// y ver cuántas sesiones tiene cada deportista.
// ─────────────────────────────────────────────
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const mondayOf = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return ymd(d)
}
export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
const short = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function WeekView({ sessions, athletes, athleteFilter, onOpen, onCreate, onMove, moving }) {
  const today = ymd(new Date())
  const [monday, setMonday] = useState(() => mondayOf(today))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])
  const sunday = days[6]
  const athleteById = useMemo(() => Object.fromEntries(athletes.map(a => [a.id, a])), [athletes])

  // ---- Arrastrar y soltar ----
  const [drag, setDrag] = useState(null) // { s, x, y, over }
  const dragRef = useRef(null)
  dragRef.current = drag
  const dayAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-day]')?.getAttribute('data-day') || null
  const startDrag = (e, s) => {
    if (moving) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* no hace falta para arrastrar */ }
    setDrag({ s, x: e.clientX, y: e.clientY, over: s.date })
  }
  useEffect(() => {
    if (!drag) return
    const move = (e) => {
      const over = dayAt(e.clientX, e.clientY)
      setDrag(d => d && { ...d, x: e.clientX, y: e.clientY, over: over || d.over })
      if (e.clientY < 70) window.scrollBy(0, -12)
      else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 12)
    }
    const end = (e) => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      const target = e.type === 'pointercancel' ? null : (dayAt(e.clientX, e.clientY) || d.over)
      if (target && target !== d.s.date) onMove(d.s, target)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) }
  }, [!!drag]) // eslint-disable-line

  const weekSessions = sessions.filter(s => s.date >= monday && s.date <= sunday)
    .filter(s => !athleteFilter || (s.athlete_ids || []).includes(athleteFilter))
  const byDay = Object.fromEntries(days.map(d => [d, weekSessions.filter(s => s.date === d)]))

  // Sesiones por deportista en la semana (sin contar días de descanso)
  const load = athletes.map(a => ({ a, n: weekSessions.filter(s => s.type !== 'rest_day' && (s.athlete_ids || []).includes(a.id)).length }))
    .filter(x => !athleteFilter || x.a.id === athleteFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonday(m => addDays(m, -7))} aria-label="Semana anterior">‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, textTransform: 'uppercase' }}>{short(monday)} – {short(sunday)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{weekSessions.length} sesion{weekSessions.length === 1 ? '' : 'es'}{monday === mondayOf(today) ? ' · esta semana' : ''}</div>
        </div>
        {monday !== mondayOf(today) && <button className="btn btn-ghost btn-sm" onClick={() => setMonday(mondayOf(today))}>Hoy</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setMonday(m => addDays(m, 7))} aria-label="Semana siguiente">›</button>
      </div>

      {load.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {load.map(({ a, n }) => (
            <div key={a.id} title={`${a.name}: ${n} sesiones`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'var(--card)', border: `1px solid ${n === 0 ? 'var(--warning)' : 'var(--border)'}`, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color || 'var(--accent)' }} />
              <span style={{ fontWeight: 700 }}>{a.name.split(' ')[0]}</span>
              <span style={{ color: n === 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 800 }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      {days.map((d, i) => {
        const list = byDay[d]
        const isToday = d === today
        return (
          <div key={d} data-day={d} className="card" style={{ padding: '10px 12px', border: drag && drag.over === d ? '2px dashed var(--accent)' : isToday ? '1.5px solid var(--accent)' : undefined, background: drag && drag.over === d ? 'var(--accent-dim)' : undefined, opacity: d < today && !(drag && drag.over === d) ? 0.75 : 1, transition: 'background 0.12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: list.length ? 8 : 0 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                {DAY_NAMES[i]} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{new Date(d + 'T12:00:00').getDate()}</span>
                {isToday && <span style={{ marginLeft: 6, fontSize: 11, color: '#fff', background: 'var(--accent)', padding: '1px 6px', borderRadius: 5 }}>HOY</span>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onCreate(d)} aria-label={`Nueva sesión el ${DAY_NAMES[i]}`} style={{ fontWeight: 800 }}>+ Sesión</button>
            </div>
            {list.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Sin sesiones</div>}
            {list.map(s => {
              const color = TYPE_COLORS[s.type] || 'var(--accent)'
              const ids = s.athlete_ids || []
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px', borderRadius: 10, background: 'var(--bg)', borderLeft: `4px solid ${color}`, marginTop: 6, opacity: moving === s.id || drag?.s.id === s.id ? 0.4 : 1 }}>
                  <span onPointerDown={e => startDrag(e, s)} role="button" aria-label={`Arrastrar ${s.title} a otro día`} title="Mantén y arrastra a otro día"
                    style={{ touchAction: 'none', cursor: 'grab', minWidth: 28, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 18, userSelect: 'none' }}>⠿</span>
                  <div onClick={() => onOpen(s)} role="button" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TYPE_ICONS[s.type] || '📅'} {s.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {s.duration}′</span>
                      {ids.slice(0, 6).map(id => {
                        const a = athleteById[id]
                        if (!a) return null
                        const done = s.attendance?.[id] === true
                        return <span key={id} title={a.name} style={{ fontSize: 11, fontWeight: 800, padding: '1px 5px', borderRadius: 6, background: done ? 'var(--success-dim)' : `${a.color || '#888'}22`, color: done ? 'var(--success)' : (a.color || 'var(--text-muted)') }}>{done ? '✓' : ''}{initials(a.name)}</span>
                      })}
                      {ids.length > 6 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{ids.length - 6}</span>}
                    </div>
                  </div>
                  <button onClick={() => onOpen(s)} className="btn btn-ghost btn-sm" aria-label={`Abrir ${s.title}`} title="Abrir la sesión" style={{ padding: 0, minWidth: 40, minHeight: 40, fontSize: 18, color: 'var(--text-dim)' }}>›</button>
                </div>
              )
            })}
          </div>
        )
      })}
      {drag && (
        <div style={{ position: 'fixed', left: Math.max(8, Math.min(window.innerWidth - 228, drag.x - 110)), top: drag.y - 64, width: 220, pointerEvents: 'none', zIndex: 3000, padding: '10px 12px', borderRadius: 12, background: 'var(--card)', border: '1.5px solid var(--accent)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {TYPE_ICONS[drag.s.type] || '📅'} {drag.s.title}
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, marginTop: 2 }}>→ {DAY_NAMES[(new Date(drag.over + 'T12:00:00').getDay() + 6) % 7]} {new Date(drag.over + 'T12:00:00').getDate()}</div>
        </div>
      )}
    </div>
  )
}
