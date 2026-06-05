import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Athletes, Sessions, Injuries, Payments } from '../lib/db'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [recentInjuries, setRecentInjuries] = useState([])
  const [athleteMap, setAthleteMap] = useState({})

  useEffect(() => {
    const load = async () => {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const today = now.toISOString().slice(0, 10)

      const athletes = await Athletes.getAll()
      // Auto-crear pagos del mes si no existen
      if (athletes.length > 0) await Payments.ensureMonth(athletes, month, year)

      const [sessions, injuries, payments] = await Promise.all([
        Sessions.getAll(),
        Injuries.getAll(),
        Payments.getByMonth(month, year)
      ])

      const map = {}
      athletes.forEach(a => { map[a.id] = a })
      setAthleteMap(map)

      const upcoming = sessions.filter(s => s.date >= today).slice(0, 3)
      const activeInjuries = injuries.filter(i => !i.date_end || i.date_end >= today)
      const paidCount = payments.filter(p => p.status === 'paid').length
      const pendingPayments = payments.filter(p => p.status === 'pending').length
      const isStartOfMonth = now.getDate() <= 7

      setStats({
        active: athletes.filter(a => a.status === 'active').length,
        injured: athletes.filter(a => a.status === 'injured').length,
        sessionsThisMonth: sessions.filter(s => s.date.startsWith(`${year}-${String(month).padStart(2,'0')}`)).length,
        paidCount,
        totalPayments: athletes.length,
        pendingPayments,
        showPaymentReminder: pendingPayments > 0 && isStartOfMonth,
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
        <div className="skeleton" style={{ height: 16, width: 120, marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 40, width: 220, marginBottom: 24 }} />
        <div className="grid-2" style={{ gap: 12 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 18 }} />)}
        </div>
      </div>
    </div>
  )

  const today = new Date()
  const h = today.getHours()
  const greeting = h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  return (
    <div className="page fade-in">
      {/* Hero */}
      <div style={{ padding: '28px 20px 20px', background: 'linear-gradient(160deg, #1e3a8a08 0%, transparent 60%)' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>
          {dayNames[today.getDay()]}, {today.getDate()} {monthNames[today.getMonth()]}
        </div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, marginBottom: 2 }}>{greeting},<br />Celia 👋</h1>
        <div style={{ height: 3, width: 48, background: 'var(--accent-gradient)', borderRadius: 2, marginTop: 12 }} />
      </div>

      <div className="page-content" style={{ paddingTop: 4 }}>
        {stats.showPaymentReminder && (
          <div className="fade-in-1" onClick={() => navigate('/payments')} style={{ background: 'var(--accent-gradient)', borderRadius: 'var(--radius)', padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--accent-glow)' }}>
            <span style={{ fontSize: 26 }}>💳</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color: '#fff', textTransform: 'uppercase' }}>
                Pagos pendientes — {stats.monthName}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {stats.pendingPayments} deportista{stats.pendingPayments > 1 ? 's' : ''} sin pagar
              </div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20 }}>→</span>
          </div>
        )}

        <div className="section-title fade-in-1">Resumen del equipo</div>
        <div className="grid-2 fade-in-2">
          <StatCard value={stats.active} label="Activos" color="var(--success)" />
          <StatCard value={stats.injured} label="Lesionados" color="var(--error)" />
          <StatCard value={stats.sessionsThisMonth} label="Sesiones" color="var(--accent)" />
          <StatCard value={`${stats.paidCount}/${stats.totalPayments}`} label="Pagos al día" color="var(--info)" />
        </div>

        <div className="section-title" style={{ marginTop: 8 }}>Próximas sesiones</div>
        {upcomingSessions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>No hay sesiones programadas</div>
        ) : (
          <div className="card">
            {upcomingSessions.map((s, i) => <SessionRow key={s.id} session={s} last={i === upcomingSessions.length - 1} onClick={() => navigate('/training')} />)}
          </div>
        )}

        {recentInjuries.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 8 }}>Lesiones activas</div>
            <div className="card">
              {recentInjuries.map(inj => {
                const athlete = athleteMap[inj.athlete_id]
                return (
                  <div key={inj.id} className="list-item" onClick={() => navigate('/health')}>
                    <div className="avatar" style={{ background: 'var(--error-dim)', color: 'var(--error)', fontSize: 16 }}>🩹</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{athlete?.name || 'Deportista'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{inj.type} · {inj.body_part}</div>
                    </div>
                    <span className="badge badge-red">Activa</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {stats.pendingPayments > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 8 }}>Alertas</div>
            <div onClick={() => navigate('/payments')} style={{
              background: 'var(--accent-dim)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
            }}>
              <span style={{ fontSize: 24 }}>💳</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{stats.pendingPayments} pago{stats.pendingPayments > 1 ? 's' : ''} pendiente{stats.pendingPayments > 1 ? 's' : ''}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Toca para gestionar</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>›</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function SessionRow({ session, last, onClick }) {
  const typeColors = { strength: 'var(--accent)', cardio: 'var(--info)', flexibility: 'var(--success)', mixed: 'var(--text-muted)' }
  const typeLabels = { strength: 'Fuerza', cardio: 'Cardio', flexibility: 'Flexibilidad', mixed: 'Mixta' }
  const date = new Date(session.date + 'T12:00:00')
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return (
    <div className="list-item" onClick={onClick} style={{ borderBottom: last ? 'none' : undefined }}>
      <div style={{
        width: 52, height: 52, borderRadius: 'var(--radius-sm)',
        background: 'var(--border)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{dayNames[date.getDay()]}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{date.getDate()}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{monthNames[date.getMonth()]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{session.duration} min · {session.athlete_ids?.length || 0} deportistas</div>
      </div>
      <span className="badge" style={{ background: `${typeColors[session.type]}20`, color: typeColors[session.type] }}>
        {typeLabels[session.type] || session.type}
      </span>
    </div>
  )
}
