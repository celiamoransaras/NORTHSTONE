import { useState, useEffect } from 'react'
import { Achievements, Records } from '../lib/db'
import { supabase } from '../lib/supabase'
import { sendPushToAthletes } from '../lib/pushNotifications'

const ACHIEVEMENT_DEFS = [
  // Sesiones
  { type: 'first_session',   icon: '🏅', title: 'Primera sesión',       description: '¡Completaste tu primera sesión!' },
  { type: 'five_sessions',   icon: '💪', title: '5 sesiones',            description: '5 sesiones completadas. ¡Sigue así!' },
  { type: 'ten_sessions',    icon: '🔟', title: '10 sesiones',           description: '¡10 sesiones completadas!' },
  { type: 'twenty_sessions', icon: '🚀', title: '20 sesiones',           description: '¡Eres una máquina!' },
  { type: 'fifty_sessions',  icon: '👑', title: '50 sesiones',           description: '¡Leyenda del entrenamiento!' },
  // Rachas
  { type: 'streak_2',        icon: '🔥', title: 'Racha 2 semanas',       description: '2 semanas consecutivas entrenando' },
  { type: 'streak_4',        icon: '⚡', title: 'Racha 4 semanas',       description: '¡Un mes sin parar!' },
  { type: 'streak_8',        icon: '🌟', title: 'Racha 8 semanas',       description: '2 meses de constancia. ¡Increíble!' },
  { type: 'streak_12',       icon: '🏆', title: 'Racha 3 meses',         description: '3 meses seguidos. ¡Eres imparable!' },
  // Marcas
  { type: 'first_record',    icon: '📊', title: 'Primera marca',         description: '¡Registraste tu primera marca personal!' },
  { type: 'five_records',    icon: '📈', title: '5 marcas',              description: '5 marcas personales registradas' },
  { type: 'record_broken',   icon: '💥', title: 'Récord batido',         description: '¡Superaste tu mejor marca!' },
  // Objetivos
  { type: 'first_goal',      icon: '🎯', title: 'Primer objetivo',       description: '¡Completaste tu primer objetivo!' },
  { type: 'three_goals',     icon: '🎪', title: '3 objetivos',           description: '3 objetivos alcanzados. ¡A por más!' },
  // Valoraciones
  { type: 'first_rpe',       icon: '⭐', title: 'Primera valoración',    description: '¡Enviaste tu primera valoración de entreno!' },
  { type: 'ten_rpe',         icon: '🌈', title: '10 valoraciones',       description: '10 sesiones valoradas. ¡Muy comprometida!' },
  // Comunicación
  { type: 'first_message',   icon: '💬', title: 'Primera charla',        description: '¡Enviaste tu primer mensaje!' },
  // Especiales
  { type: 'early_bird',       icon: '🌅', title: 'Madrugadora',           description: 'Registraste tu cansancio antes de una sesión' },
  { type: 'wellness_week',    icon: '🧘', title: 'Semana consciente',     description: '7 días seguidos registrando tu estado' },
  { type: 'perfect_week',     icon: '✨', title: 'Semana perfecta',       description: '¡Asististe a todas las sesiones de la semana!' },
  // Sesiones avanzadas
  { type: 'hundred_sessions', icon: '💯', title: '100 sesiones',          description: '¡Triple dígito! Eres una atleta de élite' },
  { type: 'two_hundred',      icon: '🎖️', title: '200 sesiones',          description: '200 entrenamientos. Leyenda absoluta' },
  { type: 'three_hundred',    icon: '🌠', title: '300 sesiones',          description: '300 sesiones. No hay palabras.' },
  // Rachas largas
  { type: 'streak_16',        icon: '🔱', title: 'Racha 4 meses',         description: '4 meses sin faltar. ¡Eres increíble!' },
  { type: 'streak_26',        icon: '🦁', title: 'Medio año',             description: '6 meses consecutivos. ¡Una fiera!' },
  { type: 'streak_52',        icon: '🏵️', title: 'Un año seguido',        description: '52 semanas. La constancia es tu superpoder' },
  // Marcas avanzadas
  { type: 'ten_records',      icon: '📉', title: '10 marcas',             description: '10 marcas personales. ¡El progreso habla!' },
  { type: 'twenty_records',   icon: '🗂️', title: '20 marcas',             description: '20 registros. Cada número cuenta.' },
  // Objetivos avanzados
  { type: 'ten_goals',        icon: '🗺️', title: '10 objetivos',          description: '10 metas alcanzadas. ¡Imparable!' },
  // Valoraciones avanzadas
  { type: 'fifty_rpe',        icon: '🧠', title: '50 valoraciones',       description: '50 sesiones analizadas. ¡Muy autodisciplinada!' },
  { type: 'hundred_rpe',      icon: '🔬', title: '100 valoraciones',      description: 'Un año de autoconocimiento deportivo' },
  // Aniversarios
  { type: 'month_1',          icon: '🥉', title: 'Primer mes',            description: '1 mes entrenando con Northstone' },
  { type: 'month_3',          icon: '🥈', title: 'Tres meses',            description: '3 meses creciendo juntas' },
  { type: 'month_6',          icon: '🥇', title: 'Medio año',             description: '6 meses de compromiso. ¡Orgullosa de ti!' },
  { type: 'year_1',           icon: '🎂', title: 'Un año',                description: '365 días. Esto ya es un estilo de vida 🎉' },
  // Actitud
  { type: 'comeback',         icon: '🦅', title: 'Comeback',              description: 'Volviste después de una pausa. ¡Eso es carácter!' },
  { type: 'chat_50',          icon: '📱', title: 'Siempre conectada',     description: '50 mensajes con tu entrenadora' },
  { type: 'all_types',        icon: '🎨', title: 'Todoterreno',           description: 'Has entrenado todos los tipos de sesión' },
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

export async function checkAndUnlockAchievements(athleteId, attendedCount, recordsCount, streak, extras = {}) {
  const u = async (type) => {
    const def = ACHIEVEMENT_DEFS.find(d => d.type === type)
    if (!def) return
    const result = await Achievements.unlock(athleteId, def.type, def.title, def.description, def.icon)
    if (result?.newly_unlocked) {
      sendPushToAthletes([athleteId], {
        title: `${def.icon} ¡Nuevo logro desbloqueado!`,
        body: def.title,
        url: '/?tab=progress',
      })
    }
  }
  // Sesiones
  if (attendedCount >= 1)   await u('first_session')
  if (attendedCount >= 5)   await u('five_sessions')
  if (attendedCount >= 10)  await u('ten_sessions')
  if (attendedCount >= 20)  await u('twenty_sessions')
  if (attendedCount >= 50)  await u('fifty_sessions')
  if (attendedCount >= 100) await u('hundred_sessions')
  if (attendedCount >= 200) await u('two_hundred')
  if (attendedCount >= 300) await u('three_hundred')
  // Rachas
  if (streak >= 2)  await u('streak_2')
  if (streak >= 4)  await u('streak_4')
  if (streak >= 8)  await u('streak_8')
  if (streak >= 12) await u('streak_12')
  if (streak >= 16) await u('streak_16')
  if (streak >= 26) await u('streak_26')
  if (streak >= 52) await u('streak_52')
  // Marcas
  if (recordsCount >= 1)  await u('first_record')
  if (recordsCount >= 5)  await u('five_records')
  if (recordsCount >= 10) await u('ten_records')
  if (recordsCount >= 20) await u('twenty_records')
  // Extras opcionales
  if (extras.firstGoal)    await u('first_goal')
  if (extras.threeGoals)   await u('three_goals')
  if (extras.tenGoals)     await u('ten_goals')
  if (extras.firstRpe)     await u('first_rpe')
  if (extras.tenRpe)       await u('ten_rpe')
  if (extras.fiftyRpe)     await u('fifty_rpe')
  if (extras.hundredRpe)   await u('hundred_rpe')
  if (extras.firstMsg)     await u('first_message')
  if (extras.chat50)       await u('chat_50')
  if (extras.earlyBird)    await u('early_bird')
  if (extras.perfectWeek)  await u('perfect_week')
  if (extras.month1)       await u('month_1')
  if (extras.month3)       await u('month_3')
  if (extras.month6)       await u('month_6')
  if (extras.year1)        await u('year_1')
  if (extras.comeback)     await u('comeback')
  if (extras.allTypes)     await u('all_types')
}

export function StreakBadge({ streak }) {
  if (!streak) return null
  const msg = streak >= 52 ? { text: '¡Un año. Eres una leyenda! 🏵️', gradient: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }
    : streak >= 26 ? { text: '¡Medio año sin parar. Una fiera! 🦁', gradient: 'linear-gradient(135deg, #0EA5E9, #6366F1)' }
    : streak >= 16 ? { text: '¡4 meses. Absolutamente imparable! 🔱', gradient: 'linear-gradient(135deg, #059669, #0EA5E9)' }
    : streak >= 12 ? { text: '¡3 meses seguidos. Brutal! 🏆', gradient: 'linear-gradient(135deg, #D97706, #EF4444)' }
    : streak >= 8  ? { text: '¡2 meses de constancia. Increíble! 🌟', gradient: 'linear-gradient(135deg, #D97706, #F97316)' }
    : streak >= 4  ? { text: '¡Un mes sin parar! ⚡', gradient: 'linear-gradient(135deg, #F97316, #EF4444)' }
    : streak >= 2  ? { text: '¡Vas muy bien! 💪', gradient: 'linear-gradient(135deg, #F97316, #EF4444)' }
    : { text: '¡Sigue así!', gradient: 'linear-gradient(135deg, #F97316, #EF4444)' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: msg.gradient, borderRadius: 16, padding: '8px 16px', marginBottom: 4 }}>
      <span style={{ fontSize: 28 }}>🔥</span>
      <div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, color: '#fff', lineHeight: 1 }}>{streak} semana{streak > 1 ? 's' : ''}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>de racha. {msg.text}</div>
      </div>
    </div>
  )
}

// ---- Vista completa (para tab Progreso) ----
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
            <div key={def.type} className="card" style={{ padding: '12px 14px', opacity: isUnlocked ? 1 : 0.35, filter: isUnlocked ? 'none' : 'grayscale(1)', transition: 'all 0.3s' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{def.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{def.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{def.description}</div>
              {isUnlocked && data && (
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginTop: 6 }}>
                  ✓ {new Date(data.unlocked_at).toLocaleDateString('es-ES')}
                </div>
              )}
              {!isUnlocked && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>🔒 Bloqueado</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Vista resumen (para Home) ----
export function AchievementsHomeSection({ athleteId }) {
  const [achievements, setAchievements] = useState([])

  useEffect(() => {
    Achievements.getByAthlete(athleteId).then(setAchievements)
  }, [athleteId])

  const unlockedDefs = ACHIEVEMENT_DEFS.filter(d => achievements.find(a => a.type === d.type))
  const nextDef = ACHIEVEMENT_DEFS.find(d => !achievements.find(a => a.type === d.type))

  if (unlockedDefs.length === 0 && !nextDef) return null

  return (
    <div style={{ background: 'var(--card)', borderRadius: 22, padding: '18px 16px', border: '1.5px solid var(--border)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 14 }}>🏆 Mis logros</div>

      {/* Logros desbloqueados */}
      {unlockedDefs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, marginBottom: nextDef ? 16 : 0 }}>
          {unlockedDefs.map(def => (
            <div key={def.type} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 68 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #FCD34D, #F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
                {def.icon}
              </div>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                {def.title}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Próximo logro */}
      {nextDef && (
        <>
          {unlockedDefs.length > 0 && <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #F1F5F9, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, filter: 'grayscale(1)', opacity: 0.5 }}>
              {nextDef.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Próximo logro</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2, color: 'var(--text)' }}>{nextDef.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{nextDef.description}</div>
            </div>
            <div style={{ fontSize: 22, opacity: 0.25 }}>🔒</div>
          </div>
        </>
      )}
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
    <div style={{ background: 'var(--card)', borderRadius: 22, padding: '18px 16px', border: '1.5px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 14 }}>Semana actual</div>
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

      {todaySessions.length === 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          😴 Hoy no tienes sesión
        </div>
      )}
    </div>
  )
}
