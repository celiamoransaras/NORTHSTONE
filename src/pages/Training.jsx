import { useState, useEffect } from 'react'
import { Sessions, Athletes } from '../lib/db'
import ConfirmSheet from '../components/ConfirmSheet'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'
import { sendPushToAthletes } from '../lib/pushNotifications'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
const emptyExercise = { name: '', notes: '', videos: [] }
const emptyVideo = { label: '', url: '' }

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
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [tab, setTab] = useState('upcoming')
  const [titleError, setTitleError] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)

  const loadTemplates = async () => {
    if (!user?.id) return
    const { data } = await supabase.from('session_templates').select('*').eq('coach_id', user.id).order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  const load = async () => {
    setLoading(true)
    const [sess, ath] = await Promise.all([
      athleteId ? Sessions.getByAthlete(athleteId) : Sessions.getAll(),
      Athletes.getActive()
    ])
    setSessions(sess)
    setAthletes(ath)
    setLoading(false)
  }
  useEffect(() => { load() }, [athleteId])
  useEffect(() => { loadTemplates() }, [user?.id])

  // Realtime: asistencia en tiempo real (vista entrenadora)
  useEffect(() => {
    if (athleteId) return // solo en vista coach
    const channel = supabase.channel('training_attendance')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'session_athletes' }, async (payload) => {
        const { session_id, athlete_id, attended } = payload.new
        // Actualizar lista de sesiones
        setSessions(prev => prev.map(s => {
          if (s.id !== session_id) return s
          return { ...s, attendance: { ...s.attendance, [athlete_id]: attended } }
        }))
        // Actualizar detail si está abierto en esa sesión
        setDetailSession(prev => {
          if (!prev || prev.id !== session_id) return prev
          return { ...prev, attendance: { ...prev.attendance, [athlete_id]: attended } }
        })
      })
      .subscribe()
    // Recarga al volver a la pestaña
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      channel.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [athleteId])

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
    if (!form.title.trim()) {
      setTitleError(true)
      haptic('error')
      setTimeout(() => setTitleError(false), 600)
      return
    }
    setSaving(true)
    try {
      const safeForm = { ...form }
      if (athleteId && !safeForm.athlete_ids.includes(athleteId)) {
        safeForm.athlete_ids = [...safeForm.athlete_ids, athleteId]
      }
      if (editing) {
        await Sessions.update(editing, safeForm)
      } else {
        await Sessions.create(safeForm)
        // Notificar a los deportistas convocados
        if (safeForm.athlete_ids?.length) {
          const dateLabel = new Date(safeForm.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
          sendPushToAthletes(safeForm.athlete_ids, {
            title: '📅 Nueva sesión asignada',
            body: `${safeForm.title} · ${dateLabel}`,
            url: '/',
          })
        }
      }
      await load()
      setSheet(null)
      haptic('success')
      toast(editing ? 'Sesión actualizada' : 'Sesión creada')
    } catch {
      toast('Error al guardar la sesión', 'error')
      haptic('error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await Sessions.delete(id)
      await load()
      setSheet(null)
      setConfirmDelete(null)
      haptic('medium')
      toast('Sesión eliminada')
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  const saveAsTemplate = async () => {
    if (!form.title.trim() || !user?.id) return
    // Si ya existe una con ese título, la reemplazamos
    const existing = templates.find(t => t.title === form.title)
    if (existing) {
      await supabase.from('session_templates').update({
        type: form.type, duration: form.duration, notes: form.notes, exercises: form.exercises
      }).eq('id', existing.id)
    } else {
      await supabase.from('session_templates').insert({
        coach_id: user.id, title: form.title, type: form.type,
        duration: form.duration, notes: form.notes, exercises: form.exercises
      })
    }
    await loadTemplates()
    toast('Plantilla guardada ✓')
    haptic('success')
  }
  const deleteTemplate = async (id) => {
    await supabase.from('session_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }
  const loadTemplate = (tpl) => {
    setForm(f => ({ ...f, title: tpl.title, type: tpl.type, duration: tpl.duration, notes: tpl.notes, exercises: tpl.exercises.map(e => ({...e, id: crypto.randomUUID()})) }))
    setShowTemplates(false)
  }

  const addExercise = () => setForm(f => ({ ...f, exercises: [...f.exercises, { ...emptyExercise, id: crypto.randomUUID() }] }))
  const updateExercise = (idx, data) => setForm(f => ({ ...f, exercises: f.exercises.map((e,i) => i===idx ? {...e,...data} : e) }))
  const removeExercise = (idx) => setForm(f => ({ ...f, exercises: f.exercises.filter((_,i) => i!==idx) }))
  const addVideo = (idx) => updateExercise(idx, { videos: [...(form.exercises[idx].videos||[]), { ...emptyVideo, id: crypto.randomUUID() }] })
  const updateVideo = (idx, vIdx, data) => updateExercise(idx, { videos: form.exercises[idx].videos.map((v,i) => i===vIdx ? {...v,...data} : v) })
  const removeVideo = (idx, vIdx) => updateExercise(idx, { videos: form.exercises[idx].videos.filter((_,i) => i!==vIdx) })
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
          {!embedded && <button className={`pill-tab ${tab==='calendar'?'active':''}`} onClick={() => setTab('calendar')}>Calendario</button>}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Cargando...</div>
        ) : tab === 'calendar' ? (
          <CalendarView sessions={sessions} onSelectDay={daySessions => { setDetailSession(daySessions[0]); setSheet('detail') }} />
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
                  <div className="section-title">Entrenamientos</div>
                  {detailSession.exercises.map((ex, i) => <ExerciseCard key={i} exercise={ex} />)}
                </>
              )}

              {(!athleteId || coachView) && detailSession.athlete_ids?.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: 16 }}>Asistencia</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detailSession.athlete_ids.map(id => {
                      const a = athletes.find(x=>x.id===id)
                      const attended = detailSession.attendance?.[id] || false
                      if (!a) return null
                      const r = detailSession.ratings?.[id]
                      return (
                        <div key={id}>
                          <div onClick={async () => {
                            await Sessions.toggleAttendance(detailSession.id, id, attended)
                            setDetailSession(s => ({ ...s, attendance: { ...s.attendance, [id]: !attended } }))
                          }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: attended ? 'var(--success-dim)' : 'var(--card)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${attended ? 'var(--success)' : 'var(--border)'}` }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: attended ? 'var(--success)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {attended && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                            </div>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{a.name}</span>
                            <span style={{ fontSize: 12, color: attended ? 'var(--success)' : 'var(--text-muted)' }}>{attended ? 'Asistió' : 'No asistió'}</span>
                          </div>
                          {r && (r.rpe || r.fatigue_pre || r.fatigue_post || r.mood_post || r.rpe_notes) && (
                            <div style={{ marginTop: 6, marginLeft: 12 }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {r.fatigue_pre != null && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>😴 Pre: <strong>{r.fatigue_pre}</strong></span>}
                                {r.rpe != null && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>💪 RPE: <strong>{r.rpe}</strong></span>}
                                {r.fatigue_post != null && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>🥵 Post: <strong>{r.fatigue_post}</strong></span>}
                                {r.mood_post != null && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>😊 Ánimo: <strong>{r.mood_post}</strong></span>}
                                {r.fatigue_pre >= 8 && <span style={{ fontSize: 11, background: 'var(--error-dim)', color: 'var(--error)', padding: '2px 8px', borderRadius: 6 }}>⚠️ Cansancio alto</span>}
                              </div>
                              {r.rpe_notes && (
                                <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--accent)', fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>
                                  💬 "{r.rpe_notes}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {(!athleteId || coachView) && (
                <><div className="divider" /><button className="btn btn-danger btn-full" onClick={() => setConfirmDelete(detailSession.id)}>🗑 Eliminar sesión</button></>
              )}
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Eliminar sesión"
          message="Esta acción no se puede deshacer. Se eliminará la sesión y todos sus datos."
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
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
              {/* Botón plantillas */}
              {templates.length > 0 && (
                <button type="button" onClick={() => setShowTemplates(s => !s)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  📋 Usar plantilla {showTemplates ? '▲' : '▼'}
                </button>
              )}
              {showTemplates && (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {templates.map(tpl => (
                    <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <button onClick={() => loadTemplate(tpl)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{tpl.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tpl.type} · {tpl.duration} min · {tpl.exercises?.length || 0} ejercicios</div>
                      </button>
                      <button onClick={() => deleteTemplate(tpl.id)} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Nombre *</label>
                <input className={`input${titleError ? ' input-error' : ''}`} placeholder="ej. Fuerza tren superior" value={form.title} onChange={e => { setForm(f=>({...f,title:e.target.value})); if(titleError) setTitleError(false) }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Fecha</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
                </div>
                <div style={{ width: 90 }} className="input-group">
                  <label className="input-label">Min</label>
                  <input className="input" type="number" min="1" value={form.duration} onChange={e => setForm(f=>({...f,duration:Math.max(1,parseInt(e.target.value)||60)}))} />
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
                <div className="section-title" style={{ margin: 0 }}>Entrenamientos</div>
                <button className="btn btn-ghost btn-sm" onClick={addExercise}>+ Añadir entrenamiento</button>
              </div>
              {form.exercises.map((ex, idx) => (
                <div key={ex.id || idx} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" placeholder="Nombre del entrenamiento" value={ex.name} onChange={e => updateExercise(idx,{name:e.target.value})} style={{ flex: 1 }} />
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeExercise(idx)} style={{ color: 'var(--error)' }}>✕</button>
                    </div>
                    <textarea className="input" placeholder={"Escribe aquí el detalle, una línea por ejercicio:\nej. Sentadilla 4x10\nPeso muerto 3x8\nPlancha 3x30s"}
                      rows={5} value={ex.notes} onChange={e => updateExercise(idx,{notes:e.target.value})} style={{ resize: 'vertical' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Vídeos</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => addVideo(idx)}>+ Añadir vídeo</button>
                    </div>
                    {(ex.videos||[]).map((v, vIdx) => (
                      <div key={v.id || vIdx} style={{ display: 'flex', gap: 6 }}>
                        <input className="input" placeholder="A qué ejercicio corresponde" value={v.label} onChange={e => updateVideo(idx,vIdx,{label:e.target.value})} style={{ flex: 1 }} />
                        <input className="input" placeholder="URL de YouTube" value={v.url} onChange={e => updateVideo(idx,vIdx,{url:e.target.value})} style={{ flex: 1 }} />
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeVideo(idx,vIdx)} style={{ color: 'var(--error)' }}>✕</button>
                      </div>
                    ))}
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

              <button type="button" onClick={saveAsTemplate}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', marginTop: 8 }}>
                💾 Guardar como plantilla
              </button>
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

const TYPE_ICONS_MAP = { run:'🏃', fuerza:'💪', series:'⚡', endurance:'🫁', especifico:'🎯', ergometros:'🚣', cardio:'❤️', rest_day:'😴', strength:'💪', flexibility:'🧘', mixed:'⚡' }

function SessionCard({ session, athletes, onPress, formatDate }) {
  const typeColor = TYPE_COLOR[session.type] || '#9CA3AF'
  const typeOpt = TYPE_OPTS.find(t=>t.value===session.type)
  const typeLabel = typeOpt?.label?.replace(/^[^ ]+ /, '') || session.type
  const typeIcon = TYPE_ICONS_MAP[session.type] || '📅'
  const isToday = session.date === new Date().toISOString().slice(0,10)
  const date = new Date(session.date + 'T12:00:00')
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return (
    <div onClick={onPress} style={{ cursor: 'pointer', background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onTouchEnd={e => e.currentTarget.style.transform = ''}>
      {/* Color strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${typeColor}, ${typeColor}88)` }} />
      <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
        {/* Date box */}
        <div style={{ width: 48, height: 56, borderRadius: 12, background: isToday ? typeColor : `${typeColor}15`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: isToday ? 'none' : `1.5px solid ${typeColor}30` }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: isToday ? '#fff' : typeColor, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}>{days[date.getDay()]}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isToday ? '#fff' : 'var(--text)', lineHeight: 1.1, fontFamily: "'Barlow Condensed', sans-serif" }}>{date.getDate()}</div>
          <div style={{ fontSize: 9, color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>{months[date.getMonth()]}</div>
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {isToday && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--success)', padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase' }}>HOY</span>}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 5, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: typeColor, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {typeIcon} {typeLabel}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {session.duration}m</span>
            {session.exercises?.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📋 {session.exercises.length}</span>}
            {session.athlete_ids?.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>👥 {session.athlete_ids.length}</span>}
          </div>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</span>
      </div>
    </div>
  )
}

function CalendarView({ sessions, onSelectDay }) {
  const [current, setCurrent] = useState(new Date())
  const year = current.getFullYear()
  const month = current.getMonth()
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAYS = ['L','M','X','J','V','S','D']

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().slice(0,10)

  const byDay = {}
  sessions.forEach(s => {
    const d = new Date(s.date + 'T12:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(s)
    }
  })

  const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)]

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date(year, month-1, 1))}>‹</button>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, textTransform: 'uppercase' }}>
          {MONTHS[month]} {year}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(new Date(year, month+1, 1))}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const isToday = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` === today
          const hasSessions = byDay[day]
          const allDone = hasSessions && hasSessions.every(s => s.athlete_ids?.length > 0 && Object.values(s.attendance||{}).some(Boolean))
          return (
            <div key={day} onClick={() => hasSessions && onSelectDay(hasSessions)}
              style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 10, cursor: hasSessions ? 'pointer' : 'default',
                background: isToday ? 'var(--accent)' : hasSessions ? 'var(--accent-dim)' : 'transparent' }}>
              <span style={{ fontSize: 14, fontWeight: isToday ? 800 : 400, color: isToday ? '#fff' : hasSessions ? 'var(--accent)' : 'var(--text)' }}>{day}</span>
              {hasSessions && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isToday ? '#fff' : 'var(--accent)', marginTop: 1 }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExerciseCard({ exercise }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{exercise.name}</div>
      {exercise.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>{exercise.notes}</div>}
      {exercise.videos?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {exercise.videos.map((v, i) => {
            const ytId = getYouTubeId(v.url)
            if (!ytId) return null
            return (
              <a key={v.id || i} href={`https://www.youtube.com/watch?v=${ytId}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FF0000', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                ▶ {v.label || 'Ver en YouTube'}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
