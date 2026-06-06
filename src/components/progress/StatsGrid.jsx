import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function StatsGrid({ athleteId, sessions }) {
  const [avgRpe, setAvgRpe] = useState(null)
  const [streak, setStreak] = useState(0)

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const sessionsThisMonth = sessions.filter(s => s.date.startsWith(monthStr)).length
  const totalHours = Math.round(sessions.reduce((a, s) => a + (s.duration || 0), 0) / 60)

  useEffect(() => {
    supabase.from('session_athletes').select('rpe').eq('athlete_id', athleteId).not('rpe', 'is', null)
      .then(({ data }) => {
        if (data?.length) setAvgRpe((data.reduce((a, r) => a + r.rpe, 0) / data.length).toFixed(1))
      })

    const getWeekKey = (dateStr) => {
      const d = new Date(dateStr + 'T12:00:00')
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7)
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    }
    const weeksWithSessions = new Set(sessions.map(s => getWeekKey(s.date)))
    let s = 0
    const check = new Date()
    while (true) {
      const key = getWeekKey(check.toISOString().slice(0, 10))
      if (weeksWithSessions.has(key)) { s++; check.setDate(check.getDate() - 7) }
      else break
    }
    setStreak(s)
  }, [athleteId, sessions])

  const cards = [
    { value: sessions.length, label: 'Sesiones totales', color: 'var(--accent)', icon: '📅' },
    { value: sessionsThisMonth, label: 'Este mes', color: '#8B5CF6', icon: '📆' },
    { value: `${totalHours}h`, label: 'Horas totales', color: 'var(--success)', icon: '⏱' },
    { value: avgRpe ?? '—', label: 'RPE medio', color: 'var(--error)', icon: '💪' },
  ]

  return (
    <div className="grid-2" style={{ gap: 10 }}>
      {cards.map(({ value, label, color, icon }) => (
        <div key={label} className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 20, opacity: 0.12 }}>{icon}</div>
          <div className="stat-value" style={{ color, fontSize: 36 }}>{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  )
}
