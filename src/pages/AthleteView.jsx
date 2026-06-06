import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Sessions, Injuries, Payments, Storage, RPE } from '../lib/db'
import { supabase } from '../lib/supabase'
import Messages from './Messages'
import DocsPage from './Documents'
import Progress from './Progress'
import { AchievementsHomeSection, StreakBadge, WeeklyPlan, calculateStreak, checkAndUnlockAchievements } from './Achievements'
import { Records } from '../lib/db'
import { usePushNotifications } from '../hooks/usePushNotifications'

const TYPE_ICONS  = { run:'🏃', fuerza:'💪', series:'⚡', endurance:'🫁', especifico:'🎯', ergometros:'🚣', cardio:'❤️', rest_day:'😴', strength:'💪', flexibility:'🧘', mixed:'⚡' }
const TYPE_COLORS = { run:'#10B981', fuerza:'#F59E0B', series:'#EF4444', endurance:'#3B82F6', especifico:'#8B5CF6', ergometros:'#14B8A6', cardio:'#EC4899', rest_day:'#9CA3AF', strength:'#F59E0B', flexibility:'#10B981', mixed:'#9CA3AF' }
const TYPE_LABELS = { run:'Run', fuerza:'Fuerza', series:'Series', endurance:'Endurance', especifico:'Específico', ergometros:'Ergómetros', cardio:'Cardio', rest_day:'Rest Day', strength:'Fuerza', flexibility:'Flexibilidad', mixed:'Mixta' }

// 6 tabs — Docs se mueve dentro de Salud
const NAV = [
  { id: 'home',     icon: '⊞',  label: 'Inicio' },
  { id: 'training', icon: '📅', label: 'Entrenos' },
  { id: 'health',   icon: '🩺', label: 'Salud' },
  { id: 'progress', icon: '📈', label: 'Progreso' },
  { id: 'payments', icon: '💳', label: 'Pagos' },
  { id: 'messages', icon: '💬', label: 'Chat' },
]

export default function AthleteView() {
  const { profile, signOut } = useAuth()
  const athlete = profile?.athletes
  const athleteId = profile?.athlete_id
  const [tab, setTab] = useState('home')
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unratedCount, setUnratedCount] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const { subscribed: pushSubscribed, loading: pushLoading, supported: pushSupported, enable: enablePush, disable: disablePush } = usePushNotifications({ athleteId })

  // Mensajes no leídos
  useEffect(() => {
    const checkUnread = async () => {
      const lastRead = localStorage.getItem('chat_last_read_athlete') || new Date(0).toISOString()
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('sender', 'coach').gt('created_at', lastRead)
      setUnreadMessages(count || 0)
    }
    checkUnread()
    const channel = supabase.channel('unread_athlete')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, checkUnread)
      .subscribe()
    return () => channel.unsubscribe()
  }, [])

  useEffect(() => {
    if (tab === 'messages') {
      localStorage.setItem('chat_last_read_athlete', new Date().toISOString())
      setUnreadMessages(0)
    }
  }, [tab])

  // Entrenos pasados sin valorar
  useEffect(() => {
    if (!athleteId) return
    const fetchUnrated = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data: assigned } = await supabase
        .from('session_athletes').select('session_id, rpe, sessions!inner(date)')
        .eq('athlete_id', athleteId)
        .lt('sessions.date', today)
      if (!assigned?.length) return
      setUnratedCount(assigned.filter(r => r.rpe == null).length)
    }
    fetchUnrated()
  }, [athleteId, tab])

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Header — sin botón Salir, avatar abre perfil */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 'var(--header-height)', background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 }}>
            <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
          </div>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>
            by Celia Morán Saras
          </div>
        </div>
        <div onClick={() => setProfileOpen(true)} style={{ cursor: 'pointer' }}>
          {athlete.avatar_url
            ? <img src={athlete.avatar_url} alt={athlete.name} className="avatar-ring" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            : <div className="avatar avatar-ring" style={{ width: 38, height: 38, background: athlete.color+'30', color: athlete.color, fontSize: 15 }}>{initials(athlete.name)}</div>
          }
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'     && <AthleteHome athlete={athlete} athleteId={athleteId} />}
        {tab === 'training' && <AthleteTrainingWithRPE athleteId={athleteId} />}
        {tab === 'health'   && <AthleteHealth athleteId={athleteId} />}
        {tab === 'progress' && <AthleteProgressTab athleteId={athleteId} />}
        {tab === 'payments' && <AthletePayments athleteId={athleteId} />}
        {tab === 'messages' && <Messages />}
      </main>

      {/* Bottom nav — 6 tabs, iconos más grandes */}
      <nav className="glass-nav" style={{ display: 'flex', height: 'var(--nav-height)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: tab===id ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', background: 'none', border: 'none', borderTop: tab===id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', transition: 'color 0.15s' }}>
            <span style={{ fontSize: 22, position: 'relative', display: 'inline-block' }}>
              {icon}
              {id === 'messages' && unreadMessages > 0 && <Badge count={unreadMessages} />}
              {id === 'training' && unratedCount > 0 && <Badge count={unratedCount} color="var(--warning)" />}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {/* Sheet de perfil — Salir aquí */}
      {profileOpen && (
        <>
          <div className="overlay" onClick={() => setProfileOpen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-body" style={{ paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                {athlete.avatar_url
                  ? <img src={athlete.avatar_url} alt={athlete.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div className="avatar" style={{ width: 56, height: 56, background: athlete.color+'30', color: athlete.color, fontSize: 20 }}>{initials(athlete.name)}</div>
                }
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20 }}>{athlete.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Deportista · Northstone</div>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => {
                  if (!pushSupported) {
                    alert('Para activar notificaciones, añade la app a tu pantalla de inicio:\nSafari → botón compartir → "Añadir a pantalla de inicio"')
                    return
                  }
                  pushSubscribed ? disablePush() : enablePush()
                }}
                disabled={pushLoading}
                style={{ marginBottom: 12 }}
              >
                {pushLoading ? 'Un momento...' : pushSubscribed ? '🔕 Desactivar notificaciones' : '🔔 Activar notificaciones'}
              </button>
              <button className="btn btn-secondary btn-full" onClick={signOut} style={{ color: 'var(--error)', borderColor: 'rgba(220,38,38,0.3)' }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Badge({ count, color = 'var(--error)' }) {
  return (
    <span style={{ position: 'absolute', top: -4, right: -8, background: color, color: '#fff', borderRadius: '50%', fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: "'Barlow Condensed', sans-serif" }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ---- Inicio del deportista ----
function AthleteHome({ athlete, athleteId }) {
  const [loading, setLoading] = useState(true)
  const [upcoming, setUpcoming] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [activeInjury, setActiveInjury] = useState(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const [sessions, injuries, records] = await Promise.all([
          Sessions.getByAthlete(athleteId),
          Injuries.getByAthlete(athleteId),
          Records.getByAthlete(athleteId),
        ])
        const today = new Date().toISOString().slice(0,10)
        setAllSessions(sessions)
        setUpcoming(sessions.filter(s => s.date >= today).slice(0,3))
        setActiveInjury(injuries.find(i => !i.date_end || i.date_end >= today) || null)
        const s = calculateStreak(sessions)
        setStreak(s)

        // Logros — en segundo plano, no bloquea la carga
        Promise.all([
          supabase.from('session_athletes').select('rpe, fatigue_pre').eq('athlete_id', athleteId).not('rpe', 'is', null),
          supabase.from('goals').select('id').eq('athlete_id', athleteId).eq('completed', true),
          supabase.from('messages').select('id').eq('sender', athleteId),
          supabase.from('wellness').select('date').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(7),
        ]).then(([rpeRes, goalRes, msgRes, wellnessRes]) => {
          const rpeData = rpeRes.data || []
          const goalCount = goalRes.data?.length || 0
          const msgCount = msgRes.data?.length || 0
          const earlyBird = rpeData.some(r => r.fatigue_pre != null)
          const wellnessDays = (wellnessRes.data || []).map(w => w.date)
          const today2 = new Date()
          let perfectWellness = wellnessDays.length >= 7
          if (perfectWellness) {
            for (let i = 0; i < 7; i++) {
              const d = new Date(today2)
              d.setDate(today2.getDate() - i)
              if (!wellnessDays.includes(d.toISOString().slice(0,10))) { perfectWellness = false; break }
            }
          }
          const firstSession = sessions.length > 0 ? new Date(sessions[0].date + 'T12:00:00') : null
          const daysSince = firstSession ? Math.floor((today2 - firstSession) / (1000*60*60*24)) : 0
          const TYPE_OPTS = ['run','fuerza','series','endurance','especifico','ergometros','cardio','rest_day']
          const usedTypes = new Set(sessions.map(s => s.type))
          const attendedCount = sessions.filter(s => s.attendance?.[athleteId] === true).length
          checkAndUnlockAchievements(athleteId, attendedCount, records.length, s, {
            firstGoal: goalCount >= 1, threeGoals: goalCount >= 3, tenGoals: goalCount >= 10,
            firstRpe: rpeData.length >= 1, tenRpe: rpeData.length >= 10, fiftyRpe: rpeData.length >= 50, hundredRpe: rpeData.length >= 100,
            firstMsg: msgCount >= 1, chat50: msgCount >= 50,
            earlyBird, perfectWeek: perfectWellness,
            month1: daysSince >= 30, month3: daysSince >= 90, month6: daysSince >= 180, year1: daysSince >= 365,
            allTypes: TYPE_OPTS.every(t => usedTypes.has(t)),
          }).catch(() => {})
        }).catch(() => {})

      } catch (e) {
        console.error('AthleteHome load error', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [athleteId])

  const now = new Date()
  const h = now.getHours()
  const greeting = h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: '28px 20px 20px' }}>
          <div className="skeleton" style={{ height: 12, width: 160, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 42, width: 220, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 3, width: 48, marginBottom: 28 }} />
        </div>
        <div className="page-content">
          <div className="skeleton" style={{ height: 72, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 100, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 18 }} />
        </div>
      </div>
    )
  }

  // Estado vacío: deportista nuevo sin datos
  const hasAnything = upcoming.length > 0 || allSessions.length > 0 || streak > 0

  return (
    <div className="page fade-in">
      {/* Hero con fecha — igual que el coach */}
      <div style={{ padding: '28px 20px 20px', background: `linear-gradient(160deg, ${athlete.color}12 0%, transparent 60%)` }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          {dayNames[now.getDay()]}, {now.getDate()} {monthNames[now.getMonth()]}
        </div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, marginBottom: 0 }}>{greeting},<br />{athlete.name.split(' ')[0]} 👋</h1>
        <div style={{ height: 3, width: 48, background: athlete.color, borderRadius: 2, marginTop: 14 }} />
      </div>

      <div className="page-content">

        {!hasAnything ? (
          /* Estado vacío — deportista nuevo */
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>🏋️</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>¡Bienvenida!</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 240, margin: '0 auto' }}>
              Tu entrenadora irá añadiendo sesiones y datos. ¡Pronto verás todo aquí!
            </div>
          </div>
        ) : (
          <>
            {/* Racha */}
            {streak > 0 && <StreakBadge streak={streak} />}

            {/* Plan semanal */}
            <WeeklyPlan sessions={allSessions} />

            {/* Lesión activa */}
            {activeInjury && (
              <div style={{ background: 'var(--error-dim)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🩹</span>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, textTransform: 'uppercase', color: 'var(--error)' }}>Lesión activa</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}><strong>{activeInjury.type}</strong> en {activeInjury.body_part}</div>
                </div>
              </div>
            )}

            <div className="divider" style={{ margin: '4px 0' }} />

            {/* Logros */}
            <AchievementsHomeSection athleteId={athleteId} />

            <div className="divider" style={{ margin: '4px 0' }} />

            {/* Próximas sesiones */}
            <div className="section-title">Mis próximas sesiones</div>
            {upcoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.4 }}>🌟</div>
                <div style={{ fontSize: 14 }}>Sin sesiones próximas</div>
              </div>
            ) : (
              <div className="card">
                {upcoming.map((s, i) => <AthleteSessionRow key={s.id} session={s} last={i === upcoming.length - 1} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---- Salud del deportista (lesiones + docs médicos) ----
function AthleteHealth({ athleteId }) {
  const [injuries, setInjuries] = useState([])
  const [medDocs, setMedDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [docsTab, setDocsTab] = useState(false)
  const fileRef = useRef()
  const SEVERITY_COLOR = { mild: 'var(--success)', moderate: 'var(--warning)', severe: 'var(--error)' }
  const SEVERITY_LABEL = { mild: 'Leve', moderate: 'Moderada', severe: 'Grave' }
  const today = new Date().toISOString().slice(0,10)

  const loadDocs = async () => {
    const { data } = await supabase.from('documents')
      .select('*').eq('athlete_id', athleteId).eq('category', 'medical')
      .order('created_at', { ascending: false })
    setMedDocs(data || [])
  }

  useEffect(() => {
    Promise.all([
      Injuries.getByAthlete(athleteId).then(setInjuries),
      loadDocs(),
    ]).then(() => setLoading(false))
  }, [athleteId])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const { url, name, size } = await Storage.uploadDocument(file)
      await supabase.from('documents').insert({
        title: name, file_url: url, file_name: name, file_size: size,
        athlete_id: athleteId, category: 'medical'
      })
      await loadDocs()
    } catch (err) { alert('Error al subir: ' + (err.message || err)) }
    setUploading(false)
  }

  if (loading) return (
    <div className="page">
      <div className="page-header"><h2>Mi Salud</h2></div>
      <div className="page-content">
        {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 18 }} />)}
      </div>
    </div>
  )

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Mi Salud</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setDocsTab(false)} className={`pill-tab${!docsTab ? ' active' : ''}`} style={{ fontSize: 12 }}>Lesiones</button>
          <button onClick={() => setDocsTab(true)} className={`pill-tab${docsTab ? ' active' : ''}`} style={{ fontSize: 12, position: 'relative' }}>
            Docs
            {medDocs.length > 0 && <span style={{ marginLeft: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 8, padding: '1px 6px', fontSize: 11 }}>{medDocs.length}</span>}
          </button>
        </div>
      </div>
      <div className="page-content">

        {!docsTab ? (
          /* Lesiones */
          injuries.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🏃</div>
              <h3>¡Sin lesiones!</h3>
              <p>Sigue así, tu cuerpo te lo agradece</p>
            </div>
          ) : (
            <div className="card">
              {injuries.map((inj, i) => {
                const sev = SEVERITY_COLOR[inj.severity] || 'var(--text-muted)'
                const isActive = !inj.date_end || inj.date_end >= today
                return (
                  <div key={inj.id} className="list-item" style={{ borderBottom: i < injuries.length-1 ? undefined : 'none', cursor: 'default', alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: sev+'15', border: `1.5px solid ${sev}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                      🩹
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{inj.type} · {inj.body_part}</span>
                        {isActive && <span className="badge badge-red" style={{ fontSize: 10 }}>Activa</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        {new Date(inj.date_start+'T12:00:00').toLocaleDateString('es-ES')}
                        {inj.date_end ? ` → ${new Date(inj.date_end+'T12:00:00').toLocaleDateString('es-ES')}` : ' → Hoy'}
                      </div>
                      <span className="badge" style={{ background: sev+'15', color: sev }}>{SEVERITY_LABEL[inj.severity]}</span>
                      {inj.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{inj.notes}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* Documentos médicos */
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Subiendo...' : '+ Subir documento'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleUpload} />
            {medDocs.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📄</div>
                <h3>Sin documentos</h3>
                <p>Sube tus informes médicos para tenerlos siempre a mano</p>
              </div>
            ) : medDocs.map(doc => (
              <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString('es-ES')}</div>
                  </div>
                  <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>Ver →</span>
                </div>
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ---- Pagos del deportista ----
function AthletePayments({ athleteId }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  useEffect(() => {
    Payments.getByAthlete(athleteId).then(data => { setPayments(data); setLoading(false) })
  }, [athleteId])

  const pending = payments.filter(p => p.status === 'pending')
  const paid    = payments.filter(p => p.status === 'paid')

  if (loading) return (
    <div className="page">
      <div className="page-header"><h2>Mis Pagos</h2></div>
      <div className="page-content">
        <div className="grid-2">{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 18 }} />)}</div>
        <div className="skeleton" style={{ height: 200, borderRadius: 18 }} />
      </div>
    </div>
  )

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>Mis Pagos</h2></div>
      <div className="page-content">

        {/* Stat cards */}
        {payments.length > 0 && (
          <div className="grid-2">
            <div className="stat-card">
              <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 22, opacity: 0.12 }}>✓</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{paid.length}</div>
              <div className="stat-label">Pagados</div>
            </div>
            <div className="stat-card">
              <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 22, opacity: 0.12 }}>⏳</div>
              <div className="stat-value" style={{ color: pending.length > 0 ? 'var(--error)' : 'var(--text-dim)' }}>{pending.length}</div>
              <div className="stat-label">Pendientes</div>
            </div>
          </div>
        )}

        {/* Alerta pendientes */}
        {pending.length > 0 && (
          <div style={{ background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, textTransform: 'uppercase', color: 'var(--error)' }}>
                {pending.length} pago{pending.length>1?'s':''} pendiente{pending.length>1?'s':''}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Contacta con tu entrenadora para regularizarlo</div>
            </div>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="empty-state"><div className="icon">💳</div><h3>Sin registros</h3></div>
        ) : (
          <div className="card">
            {payments.map((p, i) => (
              <div key={p.id} className="list-item" style={{ borderBottom: i < payments.length-1 ? undefined : 'none', cursor: 'default' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: p.status === 'paid' ? 'var(--success-dim)' : 'var(--error-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, fontWeight: 900, color: p.status === 'paid' ? 'var(--success)' : 'var(--error)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {p.status === 'paid' ? '✓' : '!'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{MONTHS[p.month]} {p.year}</div>
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

// ---- Tab Progreso ----
function AthleteProgressTab({ athleteId }) {
  const [sessions, setSessions] = useState([])
  useEffect(() => { Sessions.getByAthlete(athleteId).then(setSessions) }, [athleteId])
  return <Progress athleteId={athleteId} sessions={sessions} isCoach={false} />
}

// ---- Entrenos con RPE ----
function AthleteTrainingWithRPE({ athleteId }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [rpeSheet, setRpeSheet] = useState(null)
  const [preSheet, setPreSheet] = useState(null)
  const [detailSession, setDetailSession] = useState(null)
  const [rpe, setRpe] = useState(0)
  const [fatiguePre, setFatiguePre] = useState(0)
  const [fatiguePost, setFatiguePost] = useState(0)
  const [moodPost, setMoodPost] = useState(0)
  const [savingPre, setSavingPre] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attendanceMap, setAttendanceMap] = useState({})

  useEffect(() => {
    Sessions.getByAthlete(athleteId).then(data => { setSessions(data); setLoading(false) })
  }, [athleteId])

  useEffect(() => {
    const map = {}
    sessions.forEach(s => { map[s.id] = s.attendance?.[athleteId] || false })
    setAttendanceMap(map)
  }, [sessions, athleteId])

  const today = new Date().toISOString().slice(0,10)
  const past = sessions.filter(s => s.date < today).reverse()
  const upcoming = sessions.filter(s => s.date >= today)
  const canSave = rpe > 0 || fatiguePost > 0 || moodPost > 0

  useEffect(() => {
    if (!rpeSheet) return
    RPE.get(rpeSheet.id, athleteId).then(data => {
      if (data) { setRpe(data.rpe || 0); setFatiguePost(data.fatigue_post || 0); setMoodPost(data.mood_post || 0) }
    })
  }, [rpeSheet])

  useEffect(() => {
    if (!preSheet) return
    RPE.get(preSheet.id, athleteId).then(data => {
      if (data) setFatiguePre(data.fatigue_pre || 0)
    })
  }, [preSheet])

  const saveRpe = async () => {
    if (!canSave) return
    setSaving(true)
    await RPE.set(rpeSheet.id, athleteId, { rpe: rpe || null, fatigue_post: fatiguePost || null, mood_post: moodPost || null })
    setSaving(false)
    setRpeSheet(null)
    setRpe(0); setFatiguePost(0); setMoodPost(0)
  }

  const savePreFatigue = async () => {
    if (!fatiguePre) return
    setSavingPre(true)
    await RPE.set(preSheet.id, athleteId, { fatigue_pre: fatiguePre })
    setSavingPre(false)
    setPreSheet(null)
    setFatiguePre(0)
  }

  const formatDate = (d) => {
    const date = new Date(d+'T12:00:00')
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
  }

  const RPE_LABELS = ['','Muy fácil 😴','Fácil 🙂','Ligero 🙂','Moderado 😐','Algo duro 😐','Duro 😤','Muy duro 😤','Muy muy duro 🥵','Casi máximo 🔥','Máximo 🔥']
  const RPE_COLORS = ['','var(--success)','var(--success)','var(--success)','var(--success)','var(--warning)','var(--warning)','var(--warning)','var(--error)','var(--error)','var(--error)']

  if (loading) return (
    <div className="page">
      <div className="page-header"><h2>Mis entrenos</h2></div>
      <div className="page-content">
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 18 }} />)}
      </div>
    </div>
  )

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>Mis entrenos</h2></div>
      <div className="page-content">

        {upcoming.length > 0 && (
          <>
            <div className="section-title">Próximos</div>
            {upcoming.map(s => {
              const color = TYPE_COLORS[s.type] || 'var(--accent)'
              const icon = TYPE_ICONS[s.type] || '📅'
              const isToday = s.date === today
              return (
                <div key={s.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setDetailSession(s)}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: isToday ? 'var(--accent)' : `${color}15`, border: isToday ? 'none' : `1.5px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <div style={{ fontSize: 12, color: isToday ? 'var(--accent)' : color, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>{formatDate(s.date)}</div>
                        {isToday && <span className="badge badge-green" style={{ fontSize: 10 }}>HOY</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.duration} min{s.exercises?.length > 0 ? ` · 📋 ${s.exercises.length} ejercicios` : ''}</div>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setPreSheet(s); setFatiguePre(0) }}
                    style={{ marginTop: 12, width: '100%', padding: '8px 12px', borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>
                    😴 ¿Cómo llegas hoy?
                  </button>
                </div>
              )
            })}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: upcoming.length > 0 ? 8 : 0 }}>Historial</div>
            {past.map(s => {
              const color = TYPE_COLORS[s.type] || 'var(--accent)'
              const icon = TYPE_ICONS[s.type] || '📅'
              const attended = attendanceMap[s.id] || false
              return (
                <div key={s.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setDetailSession(s)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, border: `1.5px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>{formatDate(s.date)}</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
                      {s.exercises?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>📋 {s.exercises.length} ejercicios</div>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); setRpeSheet(s); setRpe(0) }}
                      className="btn btn-sm"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 8, fontSize: 12, flexShrink: 0 }}>
                      ⭐ Valorar
                    </button>
                  </div>
                  <button onClick={async e => {
                    e.stopPropagation()
                    setAttendanceMap(m => ({...m, [s.id]: !attended}))
                    try {
                      await Sessions.toggleAttendance(s.id, athleteId, attended)
                    } catch {
                      setAttendanceMap(m => ({...m, [s.id]: attended}))
                    }
                  }}
                    style={{ marginTop: 10, width: '100%', padding: '7px 12px', borderRadius: 10,
                      background: attended ? 'var(--success-dim)' : 'var(--bg)',
                      border: `1px solid ${attended ? 'var(--success)' : 'var(--border)'}`,
                      color: attended ? 'var(--success)' : 'var(--text-muted)',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12,
                      textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>
                    {attended ? '✓ Realicé esta sesión' : '¿Realizaste esta sesión?'}
                  </button>
                </div>
              )
            })}
          </>
        )}

        {sessions.length === 0 && (
          <div className="empty-state">
            <div className="icon">📅</div>
            <h3>Sin sesiones</h3>
            <p>Tu entrenadora irá añadiendo tus entrenos aquí</p>
          </div>
        )}
      </div>

      {/* Sheet: detalle sesión */}
      {detailSession && (
        <>
          <div className="overlay" onClick={() => setDetailSession(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(detailSession.date)}</div>
                <h3>{detailSession.title}</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetailSession(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span className="badge badge-gray">⏱ {detailSession.duration} min</span>
                {detailSession.type && (
                  <span className="badge" style={{ background: (TYPE_COLORS[detailSession.type]||'var(--accent)')+'15', color: TYPE_COLORS[detailSession.type]||'var(--accent)' }}>
                    {TYPE_ICONS[detailSession.type]} {TYPE_LABELS[detailSession.type] || detailSession.type}
                  </span>
                )}
              </div>
              {detailSession.notes && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{detailSession.notes}</div>}
              {detailSession.exercises?.length > 0 ? (
                <>
                  <div className="section-title">Ejercicios</div>
                  {detailSession.exercises.map((ex, i) => {
                    const ytId = ex.youtube_url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)?.[1]
                    return (
                      <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{ex.name}</span>
                          <span style={{ color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, flexShrink: 0, marginLeft: 8 }}>{ex.sets} × {ex.reps}</span>
                        </div>
                        {ex.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{ex.notes}</div>}
                        {ytId && (
                          <a href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: '#FF0000', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                            ▶ Ver en YouTube
                          </a>
                        )}
                      </div>
                    )
                  })}
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Sin ejercicios registrados</div>
              )}
              <div className="divider" />
              <button className="btn btn-primary btn-full" onClick={() => { setDetailSession(null); setRpeSheet(detailSession); setRpe(0) }}>
                ⭐ Valorar este entrenamiento
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sheet: pre-sesión */}
      {preSheet && (
        <PreSessionSheet
          session={preSheet}
          fatiguePre={fatiguePre}
          setFatiguePre={setFatiguePre}
          onSave={savePreFatigue}
          onClose={() => { setPreSheet(null); setFatiguePre(0) }}
          saving={savingPre}
          formatDate={formatDate}
        />
      )}

      {/* Sheet: valorar RPE */}
      {rpeSheet && (
        <>
          <div className="overlay" onClick={() => setRpeSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <button className="btn btn-ghost btn-sm" onClick={() => { setRpeSheet(null); setDetailSession(rpeSheet) }}>← Volver</button>
              <h3>Valorar sesión</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setRpeSheet(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div style={{ textAlign: 'center', marginBottom: 20, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase' }}>{rpeSheet.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(rpeSheet.date)}</div>
              </div>
              <ScaleRow label="💪 Esfuerzo percibido (RPE)" value={rpe} onChange={setRpe} colors={RPE_COLORS} labels={RPE_LABELS} />
              <ScaleRow label="🥵 Cansancio al acabar" value={fatiguePost} onChange={setFatiguePost}
                colors={['','var(--success)','var(--success)','var(--success)','var(--success)','var(--warning)','var(--warning)','var(--warning)','var(--error)','var(--error)','var(--error)']} />
              <ScaleRow label="😊 Ánimo al salir" value={moodPost} onChange={setMoodPost}
                colors={['','var(--error)','var(--error)','var(--warning)','var(--warning)','var(--warning)','var(--success)','var(--success)','var(--success)','var(--success)','var(--success)']} />
              <button className="btn btn-primary btn-full" onClick={saveRpe} disabled={!canSave || saving} style={{ marginTop: 8 }}>
                {saving ? 'Guardando...' : 'Guardar valoración'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PreSessionSheet({ session, fatiguePre, setFatiguePre, onSave, onClose, saving, formatDate }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>¿Cómo llegas?</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <div style={{ textAlign: 'center', marginBottom: 20, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase' }}>{session.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(session.date)}</div>
          </div>
          <ScaleRow label="😴 Cansancio pre-sesión" value={fatiguePre} onChange={setFatiguePre}
            colors={['','var(--success)','var(--success)','var(--success)','var(--success)','var(--warning)','var(--warning)','var(--warning)','var(--error)','var(--error)','var(--error)']} />
          {fatiguePre >= 8 && (
            <div style={{ background: 'var(--error-dim)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              ⚠️ <strong>Tu cansancio es muy alto.</strong> Valora con tu entrenadora si hacer la sesión.
            </div>
          )}
          <button className="btn btn-primary btn-full" onClick={onSave} disabled={!fatiguePre || saving} style={{ marginTop: 8 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  )
}

function AthleteSessionRow({ session, last }) {
  const date = new Date(session.date + 'T12:00:00')
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const isToday = session.date === new Date().toISOString().slice(0,10)
  const color = TYPE_COLORS[session.type] || 'var(--accent)'
  const icon = TYPE_ICONS[session.type] || '📅'

  return (
    <div className="list-item" style={{ borderBottom: last ? 'none' : undefined, cursor: 'default' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: isToday ? 'var(--accent)' : `${color}15`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: isToday ? 'none' : `1.5px solid ${color}30` }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: isToday ? '#fff' : color, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>{days[date.getDay()]}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? '#fff' : 'var(--text)', lineHeight: 1, fontFamily: "'Barlow Condensed', sans-serif" }}>{date.getDate()}</div>
        <div style={{ fontSize: 9, color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>{months[date.getMonth()]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{session.duration} min</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        {isToday && <span className="badge badge-green" style={{ fontSize: 10 }}>HOY</span>}
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
    </div>
  )
}

function ScaleRow({ label, value, onChange, colors, labels }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {[1,2,3,4,5,6,7,8,9,10].map(v => (
          <button key={v} onClick={() => onChange(v)}
            style={{ flex: 1, height: 42, borderRadius: 10, fontSize: 15, fontWeight: 800,
              border: `2px solid ${value === v ? colors[v] : 'var(--border)'}`,
              background: value === v ? colors[v]+'25' : 'var(--bg)',
              color: value === v ? colors[v] : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
              transition: 'all 0.1s' }}>
            {v}
          </button>
        ))}
      </div>
      {value > 0 && labels && (
        <div style={{ textAlign: 'center', fontSize: 13, color: colors[value], fontWeight: 600, marginTop: 6 }}>
          {labels[value]}
        </div>
      )}
    </div>
  )
}
