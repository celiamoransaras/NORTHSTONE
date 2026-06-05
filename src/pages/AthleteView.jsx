/**
 * Vista que ve un deportista cuando inicia sesión.
 * Solo muestra sus datos: sesiones, lesiones y pagos propios.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Sessions, Injuries, Payments } from '../lib/db'
import Training from './Training'
import Messages from './Messages'
import Documents from './Documents'

const NAV = [
  { id: 'home',      icon: '🏠', label: 'Inicio' },
  { id: 'training',  icon: '📅', label: 'Entrenos' },
  { id: 'health',    icon: '🩺', label: 'Salud' },
  { id: 'payments',  icon: '💳', label: 'Pagos' },
  { id: 'documents', icon: '📂', label: 'Docs' },
  { id: 'messages',  icon: '💬', label: 'Chat' },
]

export default function AthleteView() {
  const { profile, signOut } = useAuth()
  const athlete = profile?.athletes
  const athleteId = profile?.athlete_id
  const [tab, setTab] = useState('home')

  if (!athlete) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: 32, textAlign: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ marginBottom: 8 }}>Perfil no vinculado</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
          Tu cuenta aún no está vinculada a un deportista. Pide a tu entrenadora que añada tu email en la app.
        </p>
        <button className="btn btn-secondary" onClick={signOut}>Cerrar sesión</button>
      </div>
    )
  }

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 'var(--header-height)', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ background: athlete.color+'30', color: athlete.color }}>{initials(athlete.name)}</div>
          <button className="btn btn-ghost btn-sm" onClick={signOut} style={{ fontSize: 12 }}>Salir</button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'     && <AthleteHome athlete={athlete} athleteId={athleteId} />}
        {tab === 'training' && <Training athleteId={athleteId} />}
        {tab === 'health'   && <AthleteHealth athleteId={athleteId} />}
        {tab === 'payments' && <AthletePayments athleteId={athleteId} />}
        {tab === 'documents' && <Documents />}
        {tab === 'messages' && <Messages />}
      </main>

      {/* Bottom nav */}
      <nav style={{ display: 'flex', height: 'var(--nav-height)', background: 'var(--surface)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {NAV.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: tab===id ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', background: 'none', border: 'none', borderTop: tab===id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ---- Inicio del deportista ----
function AthleteHome({ athlete, athleteId }) {
  const [upcoming, setUpcoming] = useState([])
  const [activeInjury, setActiveInjury] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [sessions, injuries] = await Promise.all([
        Sessions.getByAthlete(athleteId),
        Injuries.getByAthlete(athleteId)
      ])
      const today = new Date().toISOString().slice(0,10)
      setUpcoming(sessions.filter(s => s.date >= today).slice(0,3))
      setActiveInjury(injuries.find(i => !i.date_end) || null)
    }
    load()
  }, [athleteId])

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Mi perfil</div>
          <h1>Hola, {athlete.name.split(' ')[0]} 👋</h1>
        </div>
      </div>
      <div className="page-content">
        {/* Athlete card */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar" style={{ width: 56, height: 56, fontSize: 22, background: athlete.color+'30', color: athlete.color }}>
              {athlete.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{athlete.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{athlete.sport || 'Deportista'}</div>
            </div>
          </div>
          {activeInjury && (
            <div style={{ marginTop: 14, background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13 }}>
              🩹 Lesión activa: <strong>{activeInjury.type}</strong> en {activeInjury.body_part}
            </div>
          )}
        </div>

        {/* Próximas sesiones */}
        <div className="section-title">Mis próximas sesiones</div>
        {upcoming.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 0' }}>No tienes sesiones próximas</div>
        ) : (
          <div className="card">
            {upcoming.map((s, i) => {
              const d = new Date(s.date+'T12:00:00')
              const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
              const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
              return (
                <div key={s.id} className="list-item" style={{ borderBottom: i < upcoming.length-1 ? undefined : 'none', cursor: 'default' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{days[d.getDay()]}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{months[d.getMonth()]}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.duration} min</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Salud del deportista ----
function AthleteHealth({ athleteId }) {
  const [injuries, setInjuries] = useState([])
  const SEVERITY_COLOR = { mild: 'var(--success)', moderate: 'var(--warning)', severe: 'var(--error)' }
  const SEVERITY_LABEL = { mild: 'Leve', moderate: 'Moderada', severe: 'Grave' }

  useEffect(() => { Injuries.getByAthlete(athleteId).then(setInjuries) }, [athleteId])

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>Mi Salud</h2></div>
      <div className="page-content">
        {injuries.length === 0 ? (
          <div className="empty-state"><div className="icon">🏃</div><h3>¡Sin lesiones!</h3><p>Tu historial está limpio</p></div>
        ) : injuries.map(inj => {
          const sev = SEVERITY_COLOR[inj.severity] || 'var(--text-muted)'
          return (
            <div key={inj.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{inj.type} · {inj.body_part}</span>
                <span className="badge" style={{ background: sev+'20', color: sev }}>{SEVERITY_LABEL[inj.severity]}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {new Date(inj.date_start+'T12:00:00').toLocaleDateString('es-ES')}
                {inj.date_end ? ` → ${new Date(inj.date_end+'T12:00:00').toLocaleDateString('es-ES')}` : ' → Activa'}
              </div>
              {inj.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{inj.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Pagos del deportista ----
function AthletePayments({ athleteId }) {
  const [payments, setPayments] = useState([])
  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  useEffect(() => { Payments.getByAthlete(athleteId).then(setPayments) }, [athleteId])

  const pending = payments.filter(p => p.status === 'pending')

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>Mis Pagos</h2></div>
      <div className="page-content">
        {pending.length > 0 && (
          <div style={{ background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 4 }}>
            <div style={{ fontWeight: 600 }}>⚠️ Tienes {pending.length} pago{pending.length>1?'s':''} pendiente{pending.length>1?'s':''}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Contacta con tu entrenadora para regularizarlo</div>
          </div>
        )}
        {payments.length === 0 ? (
          <div className="empty-state"><div className="icon">💳</div><h3>Sin registros</h3></div>
        ) : (
          <div className="card">
            {payments.map((p, i) => (
              <div key={p.id} className="list-item" style={{ borderBottom: i < payments.length-1 ? undefined : 'none', cursor: 'default' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[p.month]} {p.year}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.amount}€</div>
                </div>
                {p.status === 'paid'
                  ? <span className="badge badge-green">✓ Pagado</span>
                  : <span className="badge badge-red">Pendiente</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
