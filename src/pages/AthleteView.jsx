/**
 * Vista que ve un deportista cuando inicia sesión.
 * Solo muestra sus datos: sesiones, lesiones y pagos propios.
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Sessions, Injuries, Payments, Storage, RPE } from '../lib/db'
import { supabase } from '../lib/supabase'
import Training from './Training'
import Messages from './Messages'
import DocsPage from './Documents'
import Progress from './Progress'

const NAV = [
  { id: 'home',      icon: '🏠', label: 'Inicio' },
  { id: 'training',  icon: '📅', label: 'Entrenos' },
  { id: 'health',    icon: '🩺', label: 'Salud' },
  { id: 'progress',  icon: '📈', label: 'Progreso' },
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 'var(--header-height)', background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 }}>
            <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
          </div>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>
            by Celia Morán Saras
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {athlete.avatar_url
            ? <img src={athlete.avatar_url} alt={athlete.name} className="avatar-ring" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
            : <div className="avatar avatar-ring" style={{ width: 38, height: 38, background: athlete.color+'30', color: athlete.color, fontSize: 15 }}>{initials(athlete.name)}</div>
          }
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Salir</button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'home'      && <AthleteHome athlete={athlete} athleteId={athleteId} />}
        {tab === 'training'  && <AthleteTrainingWithRPE athleteId={athleteId} />}
        {tab === 'health'    && <AthleteHealth athleteId={athleteId} />}
        {tab === 'progress'  && <AthleteProgressTab athleteId={athleteId} />}
        {tab === 'documents' && <DocsPage />}
        {tab === 'messages'  && <Messages />}
      </main>

      {/* Bottom nav — glass */}
      <nav className="glass-nav" style={{ display: 'flex', height: 'var(--nav-height)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ id, icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: tab===id ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', background: 'none', border: 'none', borderTop: tab===id ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', transition: 'color 0.15s' }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
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
      setActiveInjury(injuries.find(i => !i.date_end || i.date_end >= today) || null)
    }
    load()
  }, [athleteId])

  const h = new Date().getHours()
  const greeting = h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="page fade-in">
      <div style={{ padding: '28px 20px 20px', background: `linear-gradient(160deg, ${athlete.color}12 0%, transparent 60%)` }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{greeting}</div>
        <h1 style={{ fontSize: 36, lineHeight: 1.05, marginBottom: 2 }}>{athlete.name.split(' ')[0]} 👋</h1>
        <div style={{ height: 3, width: 48, background: athlete.color, borderRadius: 2, marginTop: 12 }} />
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
                  <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-sm)', background: 'var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
  const [medDocs, setMedDocs] = useState([])
  const [uploading, setUploading] = useState(false)
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
    Injuries.getByAthlete(athleteId).then(setInjuries)
    loadDocs()
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
    } catch { }
    setUploading(false)
  }

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>Mi Salud</h2></div>
      <div className="page-content">

        {/* Lesiones */}
        <div className="section-title">Lesiones</div>
        {injuries.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}><div className="icon">🏃</div><h3>¡Sin lesiones!</h3></div>
        ) : injuries.map(inj => {
          const sev = SEVERITY_COLOR[inj.severity] || 'var(--text-muted)'
          const isActive = !inj.date_end || inj.date_end >= today
          return (
            <div key={inj.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{inj.type} · {inj.body_part}</span>
                <span className="badge" style={{ background: sev+'20', color: sev }}>{SEVERITY_LABEL[inj.severity]}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {new Date(inj.date_start+'T12:00:00').toLocaleDateString('es-ES')}
                {inj.date_end ? ` → ${new Date(inj.date_end+'T12:00:00').toLocaleDateString('es-ES')}` : ' → Activa'}
                {isActive && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Activa</span>}
              </div>
              {inj.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{inj.notes}</div>}
            </div>
          )
        })}

        {/* Documentos médicos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div className="section-title" style={{ margin: 0 }}>Documentos médicos</div>
          <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : '+ Subir'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleUpload} />

        {medDocs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 0' }}>Sin documentos médicos</div>
        ) : medDocs.map(doc => (
          <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}>
            <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString('es-ES')}</div>
              </div>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>Ver →</span>
            </div>
          </a>
        ))}
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

// ---- Tab Progreso ----
function AthleteProgressTab({ athleteId }) {
  const [sessions, setSessions] = useState([])
  useEffect(() => { Sessions.getByAthlete(athleteId).then(setSessions) }, [athleteId])
  return <Progress athleteId={athleteId} sessions={sessions} isCoach={false} />
}

// ---- Entrenos con RPE ----
function AthleteTrainingWithRPE({ athleteId }) {
  const [sessions, setSessions] = useState([])
  const [rpeSheet, setRpeSheet] = useState(null)
  const [detailSession, setDetailSession] = useState(null)
  const [rpe, setRpe] = useState(0)
  const [fatiguePre, setFatiguePre] = useState(0)
  const [fatiguePost, setFatiguePost] = useState(0)
  const [moodPost, setMoodPost] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => { Sessions.getByAthlete(athleteId).then(setSessions) }, [athleteId])

  const today = new Date().toISOString().slice(0,10)
  const past = sessions.filter(s => s.date < today).reverse()
  const upcoming = sessions.filter(s => s.date >= today)

  const saveRpe = async () => {
    if (!rpe) return
    setSaving(true)
    await RPE.set(rpeSheet.id, athleteId, {
      rpe,
      fatigue_pre: fatiguePre || null,
      fatigue_post: fatiguePost || null,
      mood_post: moodPost || null,
    })
    setSaving(false)
    setRpeSheet(null)
    setRpe(0); setFatiguePre(0); setFatiguePost(0); setMoodPost(0)
  }

  const formatDate = (d) => {
    const date = new Date(d+'T12:00:00')
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
  }

  const RPE_LABELS = ['','Muy fácil 😴','Fácil 🙂','Ligero 🙂','Moderado 😐','Algo duro 😐','Duro 😤','Muy duro 😤','Muy muy duro 🥵','Casi máximo 🔥','Máximo 🔥']
  const RPE_COLORS = ['','var(--success)','var(--success)','var(--success)','var(--success)','var(--warning)','var(--warning)','var(--warning)','var(--error)','var(--error)','var(--error)']

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>Mis entrenos</h2></div>
      <div className="page-content">
        {upcoming.length > 0 && <>
          <div className="section-title">Próximos</div>
          {upcoming.map(s => (
            <div key={s.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setDetailSession(s)}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{formatDate(s.date)}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.duration} min {s.exercises?.length > 0 && `· 📋 ${s.exercises.length} ejercicios`}</div>
            </div>
          ))}
        </>}

        {past.length > 0 && <>
          <div className="section-title" style={{ marginTop: 8 }}>Historial</div>
          {past.map(s => (
            <div key={s.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setDetailSession(s)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{formatDate(s.date)}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{s.title}</div>
                  {s.exercises?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>📋 {s.exercises.length} ejercicios</div>}
                </div>
                <button onClick={e => { e.stopPropagation(); setRpeSheet(s); setRpe(0) }}
                  className="btn btn-sm"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 8, fontSize: 12 }}>
                  ⭐ Valorar
                </button>
              </div>
            </div>
          ))}
        </>}

        {sessions.length === 0 && (
          <div className="empty-state"><div className="icon">📅</div><h3>Sin sesiones</h3></div>
        )}
      </div>

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

      {rpeSheet && (
        <>
          <div className="overlay" onClick={() => setRpeSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>Valorar sesión</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setRpeSheet(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div style={{ textAlign: 'center', marginBottom: 20, padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, textTransform: 'uppercase' }}>{rpeSheet.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(rpeSheet.date)}</div>
              </div>

              {/* Cansancio pre-sesión */}
              <ScaleRow label="😴 Cansancio al empezar" value={fatiguePre} onChange={setFatiguePre}
                colors={['','var(--success)','var(--success)','var(--success)','var(--success)','var(--warning)','var(--warning)','var(--warning)','var(--error)','var(--error)','var(--error)']} />

              {fatiguePre >= 8 && (
                <div style={{ background: 'var(--error-dim)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
                  ⚠️ <strong>Tu cansancio pre-sesión es superior a 7,5.</strong> Valora con tu entrenadora si realizar la sesión.
                </div>
              )}

              {/* RPE */}
              <ScaleRow label="💪 Esfuerzo percibido (RPE)" value={rpe} onChange={setRpe}
                colors={RPE_COLORS} labels={RPE_LABELS} />

              {/* Cansancio post-sesión */}
              <ScaleRow label="🥵 Cansancio al acabar" value={fatiguePost} onChange={setFatiguePost}
                colors={['','var(--success)','var(--success)','var(--success)','var(--success)','var(--warning)','var(--warning)','var(--warning)','var(--error)','var(--error)','var(--error)']} />

              {/* Ánimo */}
              <ScaleRow label="😊 Ánimo al salir" value={moodPost} onChange={setMoodPost}
                colors={['','var(--error)','var(--error)','var(--warning)','var(--warning)','var(--warning)','var(--success)','var(--success)','var(--success)','var(--success)','var(--success)']} />

              <button className="btn btn-primary btn-full" onClick={saveRpe} disabled={!rpe || saving} style={{ marginTop: 8 }}>
                {saving ? 'Guardando...' : 'Guardar valoración'}
              </button>
            </div>
          </div>
        </>
      )}
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
