import { useState, useEffect } from 'react'
import { Achievements, Records } from '../lib/db'
import { supabase } from '../lib/supabase'

const ACHIEVEMENT_DEFS = [
  { type: 'first_session',  icon: '🏅', title: 'Primera sesión',    description: '¡Completaste tu primera sesión!' },
  { type: 'five_sessions',  icon: '💪', title: '5 sesiones',         description: '5 sesiones completadas. ¡Sigue así!' },
  { type: 'ten_sessions',   icon: '🔟', title: '10 sesiones',        description: '¡10 sesiones completadas!' },
  { type: 'twenty_sessions',icon: '🚀', title: '20 sesiones',        description: '¡Eres una máquina!' },
  { type: 'first_record',   icon: '🏆', title: 'Primera marca',      description: '¡Registraste tu primera marca personal!' },
  { type: 'streak_2',       icon: '🔥', title: 'Racha de 2 semanas', description: '2 semanas consecutivas entrenando' },
  { type: 'streak_4',       icon: '⚡', title: 'Racha de 4 semanas', description: '¡Un mes sin parar!' },
  { type: 'streak_8',       icon: '🌟', title: 'Racha de 8 semanas', description: '2 meses de constancia. ¡Increíble!' },
]

export function calculateStreak(sessions) {
  const today = new Date()
  const getWeekKey = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7)
    return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`
  }
  const weeksWithSessions = new Set(sessions.map(s => getWeekKey(s.date)))
  let streak = 0
  let check = new Date(today)
  while (true) {
    const key = getWeekKey(check.toISOString().slice(0,10))
    if (weeksWithSessions.has(key)) { streak++; check.setDate(check.getDate() - 7) }
    else break
  }
  return streak
}

export async function checkAndUnlockAchievements(athleteId, attendedCount, records, streak) {
  if (attendedCount >= 1)  await Achievements.unlock(athleteId, 'first_session',   '¡Primera sesión!',     '¡Completaste tu primera sesión!', '🏅')
  if (attendedCount >= 5)  await Achievements.unlock(athleteId, 'five_sessions',   '5 sesiones',           '5 sesiones completadas. ¡Sigue así!', '💪')
  if (attendedCount >= 10) await Achievements.unlock(athleteId, 'ten_sessions',    '10 sesiones',          '¡10 sesiones completadas!', '🔟')
  if (attendedCount >= 20) await Achievements.unlock(athleteId, 'twenty_sessions', '20 sesiones',          '¡Eres una máquina!', '🚀')
  if (records >= 1)        await Achievements.unlock(athleteId, 'first_record',    'Primera marca',        '¡Registraste tu primera marca personal!', '🏆')
  if (streak >= 2)         await Achievements.unlock(athleteId, 'streak_2',        'Racha de 2 semanas',   '2 semanas consecutivas entrenando', '🔥')
  if (streak >= 4)         await Achievements.unlock(athleteId, 'streak_4',        'Racha de 4 semanas',   '¡Un mes sin parar!', '⚡')
  if (streak >= 8)         await Achievements.unlock(athleteId, 'streak_8',        'Racha de 8 semanas',   '2 meses de constancia. ¡Increíble!', '🌟')
}

export function StreakBadge({ streak }) {
  if (!streak) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #F97316, #EF4444)', borderRadius: 16, padding: '8px 16px', marginBottom: 4 }}>
      <span style={{ fontSize: 28 }}>🔥</span>
      <div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, color: '#fff', lineHeight: 1 }}>{streak} semana{streak > 1 ? 's' : ''}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>de racha. ¡Sigue así!</div>
      </div>
    </div>
  )
}

export default function AchievementsSection({ athleteId }) {
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    Achievements.getByAthlete(athleteId).then(setAchievements)
  }, [athleteId])

  const unlocked = new Set(achievements.map(a => a.type))

  return (
    <div>
      <div className="section-title" style={{ marginBottom: 10 }}>🏆 Logros</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ACHIEVEMENT_DEFS.map(def => {
          const isUnlocked = unlocked.has(def.type)
          const data = achievements.find(a => a.type === def.type)
          return (
            <div key={def.type} className="card" style={{ padding: '12px 14px', opacity: isUnlocked ? 1 : 0.4, filter: isUnlocked ? 'none' : 'grayscale(1)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{def.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{def.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{def.description}</div>
              {isUnlocked && data && (
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginTop: 6 }}>
                  {new Date(data.unlocked_at).toLocaleDateString('es-ES')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WeeklyPlan({ sessions }) {
  const TYPE_COLORS = { run: '#10B981', fuerza: '#F59E0B', series: '#EF4444', endurance: '#3B82F6', especifico: '#8B5CF6', ergometros: '#14B8A6', cardio: '#EC4899', rest_day: '#9CA3AF' }
  const TYPE_ICONS = { run: '🏃', fuerza: '💪', series: '⚡', endurance: '🫁', especifico: '🎯', ergometros: '🚣', cardio: '❤️', rest_day: '😴' }

  const today = new Date()
  const todayStr = today.toISOString().slice(0,10)
  const dow = today.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const DAYS = ['L','M','X','J','V','S','D']
  const week = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const todaySessions = sessions.filter(s => s.date === todayStr)

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Semana actual</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {week.map((day, i) => {
          const dateStr = day.toISOString().slice(0,10)
          const daySessions = sessions.filter(s => s.date === dateStr)
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: isToday ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase' }}>{DAYS[i]}</div>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: isToday ? 'var(--accent)' : 'transparent', border: isToday ? 'none' : `1.5px solid ${daySessions.length > 0 ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? '#fff' : isPast ? 'var(--text-muted)' : 'var(--text)' }}>{day.getDate()}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                {daySessions.map(s => (
                  <div key={s.id} style={{ fontSize: 14 }} title={s.title}>{TYPE_ICONS[s.type] || '📅'}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {todaySessions.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Hoy</div>
          {todaySessions.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{TYPE_ICONS[s.type] || '📅'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.duration} min</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {todaySessions.length === 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          😴 Hoy no tienes sesión
        </div>
      )}
    </div>
  )
}
