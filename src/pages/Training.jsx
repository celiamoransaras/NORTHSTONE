import { useState, useEffect } from 'react'
import { Sessions, Athletes } from '../lib/db'

const TYPE_OPTS = [
  { value: 'run',        label: '🏃 Run' },
  { value: 'fuerza',     label: '💪 Fuerza' },
  { value: 'series',     label: '⚡ Series' },
  { value: 'endurance',  label: '🫁 Endurance' },
  { value: 'especifico', label: '🎯 Específico' },
  { value: 'ergometros', label: '🚣 Ergómetros' },
  { value: 'cardio',     label: '❤️ Cardio' },
  { value: 'rest_day',   label: '😴 Rest Day' },
]
const TYPE_COLOR = {
  run: '#10B981', fuerza: '#F59E0B', series: '#EF4444',
  endurance: '#3B82F6', especifico: '#8B5CF6',
  ergometros: '#14B8A6', cardio: '#EC4899', rest_day: '#707070',
  strength: '#F59E0B', flexibility: '#10B981', mixed: '#707070'
}
const emptyForm = { title: '', date: new Date().toISOString().slice(0,10), type: 'run', duration: 60, notes: '', exercises: [], athlete_ids: [] }
const emptyExercise = { name: '', sets: 3, reps: '10', notes: '', youtube_url: '' }

function getYouTubeId(url) {
  const m = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export default function Training({ athleteId = null, coachView = false, embedded = false }) {
  const [sessions, setSessions] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [detailSession, setDetailSession] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('upcoming')

  const load = async () => {
    setLoading(true)
    const [sess, ath] = await Promise.all([
      athleteId ? Sessions.getByAthlete(athleteId) : Sessions.getAll(),
      Athletes.getAll()
    ])
    setSessions(sess)
    setAthletes(ath)
    setLoading(false)
  }
  useEffect(() => { load() }, [athleteId])

  const today = new Date().toISOString().slice(0,10)
  const upcoming = sessions.filter(s => s.date >= today)
  const past = sessions.filter(s => s.date < today).reverse()
  const displayed = tab === 'upcoming' ? upcoming : past

  const openNew = () => {
    const base = { ...emptyForm }
    if (athleteId) base.athlete_ids = [athleteId]
    setForm(base); setEditing(null); setSheet('form')
  }
  const openEdit = (s) => { setForm({ ...s, exercises: [...(s.exercises||[])], athlete_ids: [...(s.athlete_ids||[])] }); setEditing(s.id); setSheet('form') }
  const openDetail = (s) => { setDetailSession(s); setSheet('detail') }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    if (editing) await Sessions.update(editing, form)
    else await Sessions.create(form)
    await load(); setSaving(false); setSheet(null)
  }

  const remove = async (id) => { await Sessions.delete(id); await load(); setSheet(null) }

  const addExercise = () => setForm(f => ({ ...f, exercises: [...f.exercises, { ...emptyExercise, id: Date.now().toString() }] }))
  const updateExercise = (idx, data) => setForm(f => ({ ...f, exercises: f.exercises.map((e,i) => i===idx ? {...e,...data} : e) }))
  const removeExercise = (idx) => setForm(f => ({ ...f, exercises: f.exercises.filter((_,i) => i!==idx) }))
  const toggleAthlete = (id) => setForm(f => ({ ...f, athlete_ids: f.athlete_ids.includes(id) ? f.athlete_ids.filter(x=>x!==id) : [...f.athlete_ids, id] }))

  const formatDate = (dateStr) => {
    const d = new Date(dateStr+'T12:00:00')
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
  }

  const showCreate = !athleteId || coachView

  const inner = (
    <>
      {!embedded && (
        <div className="page-header">
          <h2>Entrenamientos</h2>
          {showCreate && <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nuevo</button>}
        </div>
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva sesión</button>
        </div>
      )}

      <div className="page-content">
        <div className="pill-tabs">
          <button className={`pill-tab ${tab==='upcoming'?'active':''}`} onClick={() => setTab('upcoming')}>Próximos ({upcoming.length})</button>
          <button className={`pill-tab ${tab==='past'?'active':''}`} onClick={() => setTab('past')}>Historial ({past.length})</button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Cargando...</div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📅</div>
            <h3>{tab==='upcoming' ? 'Sin sesiones' : 'Sin historial'}</h3>
            <p>{tab==='upcoming' ? 'No hay sesiones próximas' : 'Las sesiones pasadas aparecerán aquí'}</p>
          </div>
        ) : displayed.map(s => (
          <SessionCard key={s.id} session={s} athletes={athletes} onPress={() => openDetail(s)} formatDate={formatDate} />
        ))}
      </div>

      {/* Detail */}
      {sheet==='detail' && detailSession && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(detailSession.date)}</div>
                <h3>{detailSession.title}</h3>
              </div>
              {(!athleteId || coachView) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(detailSession)}>✏️</button>}
            </div>
            <div className="sheet-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span className="badge badge-amber">{TYPE_OPTS.find(t=>t.value===detailSession.type)?.label}</span>
                <span className="badge badge-gray">⏱ {detailSession.duration} min</span>
                <span className="badge badge-blue">👥 {detailSession.athlete_ids?.length||0} deportistas</span>
              </div>
              {detailSession.notes && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>{detailSession.notes}</div>}

              {detailSession.exercises?.length > 0 && (
                <>
                  <div className="section-title">Ejercicios</div>
                  {detailSession.exercises.map((ex, i) => <ExerciseCard key={i} exercise={ex} />)}
                </>
              )}

              {!athleteId && detailSession.athlete_ids?.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: 16 }}>Deportistas convocados</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {detailSession.athlete_ids.map(id => {
                      const a = athletes.find(x=>x.id===id)
                      return a ? (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                          <span style={{ fontSize: 13 }}>{a.name}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </>
              )}

              {(!athleteId || coachView) && (
                <><div className="divider" /><button className="btn btn-danger btn-full" onClick={() => remove(detailSession.id)}>🗑 Eliminar sesión</button></>
              )}
            </div>
          </div>
        </>
      )}

      {/* Form */}
      {sheet==='form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar sesión' : 'Nueva sesión'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className="input" placeholder="ej. Fuerza tren superior" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Fecha</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
                <div style={{ width: 90 }} className="input-group">
                  <label className="input-label">Min</label>
                  <input className="input" type="number" value={form.duration} onChange={e => setForm(f=>({...f,duration:parseInt(e.target.value)||60}))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Tipo</label>
                <select className="input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                  {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Notas</label>
                <textarea className="input" placeholder="Indicaciones, objetivos..." value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="section-title" style={{ margin: 0 }}>Ejercicios</div>
                <button className="btn btn-ghost btn-sm" onClick={addExercise}>+ Añadir</button>
              </div>
              {form.exercises.map((ex, idx) => (
                <div key={idx} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" placeholder="Nombre del ejercicio" value={ex.name} onChange={e => updateExercise(idx,{name:e.target.value})} style={{ flex: 1 }} />
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeExercise(idx)} style={{ color: 'var(--error)' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" type="number" placeholder="Series" value={ex.sets} onChange={e => updateExercise(idx,{sets:e.target.value})} style={{ width: 72 }} />
                      <input className="input" placeholder="Reps / Tiempo" value={ex.reps} onChange={e => updateExercise(idx,{reps:e.target.value})} />
                    </div>
                    <input className="input" placeholder="🎬 URL de YouTube (opcional)" value={ex.youtube_url} onChange={e => updateExercise(idx,{youtube_url:e.target.value})} />
                    <input className="input" placeholder="Notas (peso, ritmo...)" value={ex.notes} onChange={e => updateExercise(idx,{notes:e.target.value})} />
                  </div>
                </div>
              ))}

              <div className="section-title" style={{ marginTop: 8 }}>Deportistas convocados</div>
              {athletes.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card)', borderRadius: 'var(--radius-sm)', border: form.athlete_ids.includes(a.id) ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', marginBottom: 6 }}>
                  <input type="checkbox" checked={form.athlete_ids.includes(a.id)} onChange={() => toggleAthlete(a.id)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                  <span style={{ fontSize: 14 }}>{a.name}</span>
                </label>
              ))}

              <button className="btn btn-primary btn-full" onClick={save} disabled={saving} style={{ marginTop: 20 }}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sesión'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )

  return embedded
    ? <div style={{ padding: '0 0 8px' }}>{inner}</div>
    : <div className="page fade-in">{inner}</div>
}

function SessionCard({ session, athletes, onPress, formatDate }) {
  const typeColor = TYPE_COLOR[session.type] || 'var(--text-muted)'
  const typeLabel = TYPE_OPTS.find(t=>t.value===session.type)?.label || session.type
  const isToday = session.date === new Date().toISOString().slice(0,10)

  return (
    <div className="card" onClick={onPress} style={{ cursor: 'pointer' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: typeColor, fontWeight: 700 }}>{formatDate(session.date)}</span>
            {isToday && <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 6px' }}>HOY</span>}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⏱ {session.duration}min</span>
        </div>
        <h4 style={{ marginBottom: 6 }}>{session.title}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="tag">{typeLabel}</span>
          {session.exercises?.length > 0 && <span className="tag">📋 {session.exercises.length} ejercicios</span>}
          {session.athlete_ids?.length > 0 && <span className="tag">👥 {session.athlete_ids.length}</span>}
        </div>
      </div>
    </div>
  )
}

function ExerciseCard({ exercise }) {
  const ytId = getYouTubeId(exercise.youtube_url)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>{exercise.name}</span>
        <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>{exercise.sets} × {exercise.reps}</span>
      </div>
      {exercise.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{exercise.notes}</div>}
      {ytId && (
        <div className="yt-embed" style={{ marginTop: 10 }}>
          <iframe src={`https://www.youtube.com/embed/${ytId}`} title={exercise.name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}
    </div>
  )
}
