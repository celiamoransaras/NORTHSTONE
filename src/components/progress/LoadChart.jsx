import { TYPE_COLORS } from '../../lib/utils'

export default function LoadChart({ sessions }) {
  const weeks = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const wSessions = sessions.filter(s => {
      const sd = new Date(s.date + 'T12:00:00')
      return sd >= weekStart && sd <= weekEnd
    })
    const count = wSessions.length
    const mainType = count > 0
      ? Object.entries(wSessions.reduce((a, s) => { a[s.type] = (a[s.type] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1])[0][0]
      : null
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`
    weeks.push({ label, count, mainType, isThisWeek: i === 0 })
  }

  const max = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', marginBottom: 4 }}>Carga semanal</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Sesiones por semana — últimas 8 semanas</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 90 }}>
        {weeks.map((w, i) => {
          const h = max > 0 ? Math.max((w.count / max) * 72, w.count > 0 ? 8 : 2) : 2
          const color = w.count > 0 ? (TYPE_COLORS[w.mainType] || 'var(--accent)') : 'var(--border)'
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {w.count > 0 && (
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, color }}>{w.count}</div>
              )}
              <div style={{ width: '100%', height: h, borderRadius: 6, background: color, opacity: w.isThisWeek ? 1 : 0.7, transition: 'height 0.4s ease' }} />
              <div style={{ fontSize: 9, color: w.isThisWeek ? 'var(--accent)' : 'var(--text-dim)', fontWeight: w.isThisWeek ? 800 : 500, fontFamily: "'Barlow Condensed', sans-serif" }}>{w.isThisWeek ? 'HOY' : w.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
