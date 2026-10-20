import { ymd } from '../lib/dates'

// Cuenta atrás hacia el próximo objetivo con fecha (competición, test, marca...)
const DAY = 86400000
export const daysUntil = (dateStr) => {
  const today = new Date(ymd(new Date()) + 'T12:00:00')
  return Math.round((new Date(dateStr + 'T12:00:00') - today) / DAY)
}
const EVENT_RE = /hyrox|deka|carrera|competi|marat|media|10\s?k|5\s?k|trail|triatl|duatl|crossfit|open|campeonato|prueba|race/i
export const goalIcon = (title = '') => EVENT_RE.test(title) ? '🏁' : '🎯'
export const countdownLabel = (days) =>
  days === 0 ? '¡Es hoy!' : days === 1 ? 'Mañana' : days < 29 ? `Faltan ${days} días` : `Faltan ${Math.floor(days / 7)} semanas`
export const formatGoalDate = (d) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })

export default function GoalCountdown({ goal, color = 'var(--accent)', onClick }) {
  if (!goal?.deadline) return null
  const days = daysUntil(goal.deadline)
  if (days < 0) return null
  const hasTarget = goal.target_value != null && Number(goal.target_value) > 0
  const pct = hasTarget ? Math.max(0, Math.min(100, Math.round((Number(goal.current_value) || 0) / Number(goal.target_value) * 100))) : null
  const big = days < 29 ? days : Math.floor(days / 7)
  const unit = days < 29 ? (days === 1 ? 'día' : 'días') : 'semanas'
  return (
    <div className="card" onClick={onClick} role={onClick ? 'button' : undefined}
      style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: onClick ? 'pointer' : 'default', border: `1.5px solid ${color}40`, background: `linear-gradient(135deg, ${color}10, transparent)` }}>
      <div style={{ minWidth: 62, textAlign: 'center', flexShrink: 0 }}>
        {days === 0
          ? <div style={{ fontSize: 34, lineHeight: 1 }}>🔥</div>
          : <>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, lineHeight: 1, color }}>{big}</div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>{unit}</div>
            </>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {goalIcon(goal.title)} {days === 0 ? 'Hoy es el día' : 'Tu próximo objetivo'}
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{formatGoalDate(goal.deadline)}</div>
        {pct !== null && (
          <div style={{ marginTop: 8, height: 5, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        )}
      </div>
      {onClick && <span style={{ color: 'var(--text-dim)', fontSize: 20 }}>›</span>}
    </div>
  )
}
