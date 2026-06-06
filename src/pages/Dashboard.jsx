import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Athletes, Sessions, Injuries, Payments } from '../lib/db'
import { supabase } from '../lib/supabase'
import { getDismissed, dismissFatigueAlert, subscribeAlerts } from '../lib/alertState'

const TYPE_ICONS = { run:'🏃', fuerza:'💪', series:'⚡', endurance:'🫁', especifico:'🎯', ergometros:'🚣', cardio:'❤️', rest_day:'😴', strength:'💪', flexibility:'🧘', mixed:'⚡' }
const TYPE_COLORS = { run:'#10B981', fuerza:'#F59E0B', series:'#EF4444', endurance:'#3B82F6', especifico:'#8B5CF6', ergometros:'#14B8A6', cardio:'#EC4899', rest_day:'#9CA3AF', strength:'#F59E0B', cardio_:'#3B82F6', flexibility:'#10B981', mixed:'#9CA3AF' }
const TYPE_LABELS = { run:'Run', fuerza:'Fuerza', series:'Series', endurance:'Endurance', especifico:'Específico', ergometros:'Ergómetros', cardio:'Cardio', rest_day:'Rest Day', strength:'Fuerza', flexibility:'Flexibilidad', mixed:'Mixta' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [recentInjuries, setRecentInjuries] = useState([])
  const [athleteMap, setAthleteMap] = useState({})
  const [dismissedAlerts, setDismissedAlerts] = useState(() => getDismissed())

  useEffect(() => {
    return subscribeAlerts(() => setDismissedAlerts(new Set(getDismissed())))
  }, [])

  const dismissAlert = (athleteId) => {
    dismissFatigueAlert(athleteId)
    setDismissedAlerts(new Set(getDismissed()))
  }

  useEffect(() => {
    const load = async () => {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const today = now.toISOString().slice(0, 10)

      const athletes = await Athletes.getAll()
      if (athletes.length > 0) await Payments.ensureMonth(athletes, month, year)

      const [sessions, injuries, payments, fatigueAlerts] = await Promise.all([
        Sessions.getAll(),
        Injuries.getAll(),
        Payments.getByMonth(month, year),
        supabase.from('session_athletes')
          .select('athlete_id, fatigue_pre, sessions(title, date)')
          .gte('fatigue_pre', 8)
          .then(({ data }) => (data || []).filter(d => d.sessions && d.sessions.date >= today))
      ])

      const map = {}
      athletes.forEach(a => { map[a.id] = a })
      setAthleteMap(map)

      const upcoming = sessions.filter(s => s.date >= today).slice(0, 3)
      const activeInjuries = injuries.filter(i => !i.date_end || i.date_end >= today)
      const paidCount = payments.filter(p => p.status === 'paid').length
      const pendingPayments = payments.filter(p => p.status === 'pending').length

      setStats({
        active: athletes.filter(a => a.status === 'active').length,
        injured: new Set(activeInjuries.map(i => i.athlete_id)).size,
        sessionsThisMonth: sessions.filter(s => s.date.startsWith(`${year}-${String(month).padStart(2,'0')}`)).length,
        paidCount,
        totalPayments: athletes.length,
        pendingPayments,
        fatigueAlerts,
        monthName: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][month-1],
      })
      setUpcomingSessions(upcoming)
      setRecentInjuries(activeInjuries.slice(0, 3))
    }
    load()
  }, [])

  if (!stats) return (
    <div className="page">
      <div style={{ padding: '32px 20px 0' }}>
        <div className="skeleton" style={{ height: 14, width: 140, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 44, width: 240, marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 3, width: 48, marginBottom: 28 }} />
        <div className="grid-2" style={{ gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 18 }} />)}
        </div>
        <div className="skeleton" style={{ height: 12, width: 120, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 160, borderRadius: 18 }} />
      </div>
    </div>
  )

  const today = new Date()
  const h = today.getHours()
  const greeting = h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const visibleFatigueAlerts = stats.fatigueAlerts?.filter(a => !dismissedAlerts.has(a.athlete_id)) || []

  return (
    <div className="page fade-in">
      {/* Hero */}
      <div style={{ padding: '28px 20px 20px', background: 'linear-gradient(160deg, rgba(37,99,235,0.05) 0%, transparent 60%)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          {dayNames[today.getDay()]}, {today.getDate()} {monthNames[today.getMonth()]}
        </div>
        <h1 style={{ fontSize: 38, lineHeight: 1.0, marginBottom: 0 }}>{greeting},<br />Celia 👋</h1>
        <div style={{ height: 3, width: 48, background: 'var(--accent-gradient)', borderRadius: 2, marginTop: 14 }} />
      </div>

      <div className="page-content" style={{ paddingTop: 4 }}>

        {/* Alerta cansancio */}
        {visibleFatigueAlerts.length > 0 && (
          <div className="fade-in-1" style={{ borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(220,38,38,0.12)' }}>
            <div style={{ background: 'var(--error)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cansancio alto pre-sesión
              </span>
            </div>
            {visibleFatigueAlerts.map((a, i) => {
              const athlete = athleteMap[a.athlete_id]
              return (
                <div key={i} onClick={() => {
                  dismissAlert(a.athlete_id)
                  navigate('/messages', { state: { chatId: a.athlete_id, fatigueAlert: { name: athlete?.name, fatigue: a.fatigue_pre, session: a.sessions?.title, athleteId: a.athlete_id } } })
                }} style={{ background: 'var(--card)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: i < visibleFatigueAlerts.length-1 ? '1px solid var(--border)' : 'none' }}>
                  {athlete?.avatar_url
                    ? <img src={athlete.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: athlete?.color+'20', color: athlete?.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {athlete?.name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'}
                      </div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{athlete?.name || 'Deportista'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.sessions?.title}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: 'var(--error)', lineHeight: 1 }}>{a.fatigue_pre}<span style={{ fontSize: 12 }}>/10</span></div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Hablar →</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagos pendientes — solo inicio de mes */}
        {stats.pendingPayments > 0 && today.getDate() <= 7 && (
          <div className="fade-in-1" onClick={() => navigate('/payments')} style={{ background: 'var(--accent-gradient)', borderRadius: 'var(--radius)', padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--accent-glow)' }}>
            <span style={{ fontSize: 24 }}>💳</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, color: '#fff', textTransform: 'uppercase' }}>
                {stats.pendingPayments} pago{stats.pendingPayments > 1 ? 's' : ''} pendiente{stats.pendingPayments > 1 ? 's' : ''} — {stats.monthName}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Toca para gestionar</div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 22 }}>→</span>
          </div>
        )}

        {/* Stats */}
        <div className="section-title fade-in-1">Resumen</div>
        <div className="grid-2 fade-in-2">
          <StatCard value={stats.active} label="Activos" color="var(--success)" icon="👥" onClick={() => navigate('/athletes')} />
          <StatCard value={stats.injured} label="Lesionados" color="var(--error)" icon="🩹" onClick={() => navigate('/health')} />
          <StatCard value={stats.sessionsThisMonth} label="Sesiones" color="var(--accent)" icon="📅" onClick={() => navigate('/training')} />
          <StatCard value={`${stats.paidCount}/${stats.totalPayments}`} label="Pagos al día" color="#059669" icon="💳" onClick={() => navigate('/payments')} />
        </div>

        {/* Próximas sesiones */}
        {upcomingSessions.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 4 }}>Próximas sesiones</div>
            <div className="card fade-in-3">
              {upcomingSessions.map((s, i) => (
                <SessionRow key={s.id} session={s} last={i === upcomingSessions.length - 1} onClick={() => navigate('/training')} />
              ))}
            </div>
          </>
        )}

        {/* Lesiones activas */}
        {recentInjuries.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 4 }}>Lesiones activas</div>
            <div className="card fade-in-4">
              {recentInjuries.map((inj, i) => {
                const athlete = athleteMap[inj.athlete_id]
                const SEV = { mild: { color: 'var(--success)', label: 'Leve' }, moderate: { color: 'var(--warning)', label: 'Moderada' }, severe: { color: 'var(--error)', label: 'Grave' } }
                const sev = SEV[inj.severity] || SEV.mild
                return (
                  <div key={inj.id} className="list-item" onClick={() => navigate('/health')}
                    style={{ borderBottom: i < recentInjuries.length-1 ? undefined : 'none' }}>
                    {athlete?.avatar_url
                      ? <img src={athlete.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div className="avatar" style={{ background: athlete?.color+'20', color: athlete?.color }}>
                          {athlete?.name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'}
                        </div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{athlete?.name || 'Deportista'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{inj.type} · {inj.body_part}</div>
                    </div>
                    <span className="badge" style={{ background: sev.color+'15', color: sev.color }}>{sev.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Empty state si no hay nada próximo */}
        {upcomingSessions.length === 0 && recentInjuries.length === 0 && visibleFatigueAlerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🌟</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase', color: 'var(--text-dim)' }}>Todo en orden</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Sin sesiones ni alertas pendientes</div>
          </div>
        )}

      </div>
    </div>
  )
}

function StatCard({ value, label, color, icon, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 22, opacity: 0.15 }}>{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function SessionRow({ session, last, onClick }) {
  const date = new Date(session.date + 'T12:00:00')
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const isToday = session.date === new Date().toISOString().slice(0,10)
  const color = TYPE_COLORS[session.type] || 'var(--accent)'
  const icon = TYPE_ICONS[session.type] || '📅'
  const label = TYPE_LABELS[session.type] || session.type

  return (
    <div className="list-item" onClick={onClick} style={{ borderBottom: last ? 'none' : undefined }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: isToday ? 'var(--accent)' : `${color}15`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: isToday ? 'none' : `1.5px solid ${color}30` }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: isToday ? '#fff' : color, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>{days[date.getDay()]}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? '#fff' : 'var(--text)', lineHeight: 1, fontFamily: "'Barlow Condensed', sans-serif" }}>{date.getDate()}</div>
        <div style={{ fontSize: 9, color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>{months[date.getMonth()]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{session.duration} min · {session.athlete_ids?.length || 0} deportistas</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {isToday && <span className="badge badge-green" style={{ fontSize: 10 }}>HOY</span>}
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
    </div>
  )
}
