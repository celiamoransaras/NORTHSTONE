import { ymd } from '../lib/dates'
import SessionTargets from '../components/SessionTargets'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Sessions, Athletes, RPE } from '../lib/db'
import ConfirmSheet from '../components/ConfirmSheet'
import CopyWeekSheet from '../components/CopyWeekSheet'
import WeekView, { addDays } from '../components/WeekView'
import { loadGroups, loadBlocks, saveBlock, BlockPicker, GroupsSheet } from '../components/PlanningLibrary'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'
import { sendPushToAthletes, sendPushToCoach } from '../lib/pushNotifications'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TYPE_ICONS, TYPE_COLORS } from '../lib/constants'

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
const newEmptyForm = () => ({ title: '', date: ymd(new Date()), type: 'run', duration: 60, notes: '', exercises: [], athlete_ids: [] })
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
  const [form, setForm] = useState(newEmptyForm)
  const [editing, setEditing] = useState(null)
  const [detailSession, setDetailSession] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [replyDraft, setReplyDraft] = useState({}) // { [athleteId]: texto }
  const [tab, setTab] = useState(embedded ? 'upcoming' : 'week')
  const [filterType, setFilterType] = useState(() => sessionStorage.getItem('training_filter') || null)

  const setFilterTypePersisted = (value) => {
    if (value) sessionStorage.setItem('training_filter', value)
    else sessionStorage.removeItem('training_filter')
    setFilterType(value)
  }
  const [titleError, setTitleError] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [daySessionsToSelect, setDaySessionsToSelect] = useState([])
  const [libraryFor, setLibraryFor] = useState(null) // índice del entrenamiento con la biblioteca abierta
  const [libraryQuery, setLibraryQuery] = useState('')
  const [groups, setGroups] = useState(null)   // null = no disponible
  const [blocks, setBlocks] = useState(null)
  const [blockPickerOpen, setBlockPickerOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [athleteFilter, setAthleteFilter] = useState('')
  const [extraDates, setExtraDates] = useState([])
  const [snapshot, setSnapshot] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [movingId, setMovingId] = useState(null)
  const [templateQuery, setTemplateQuery] = useState('')
  const canPlan = !athleteId || coachView
  useEffect(() => {
    if (!canPlan) return
    loadGroups().then(setGroups)
    loadBlocks().then(setBlocks)
  }, [canPlan])

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
  // Abrir una sesión concreta al llegar desde Pendientes
  const location = useLocation()
  const [openedFromState, setOpenedFromState] = useState(false)
  useEffect(() => {
    const id = location.state?.openSessionId
    if (!id || openedFromState || !sessions.length) return
    const s = sessions.find(x => x.id === id)
    if (s) { openDetail(s); if (s.date < ymd(new Date())) setTab('past') }
    setOpenedFromState(true)
  }, [sessions, location.state, openedFromState]) // eslint-disable-line
  // "Nueva sesión" desde el botón flotante
  const [handledNew, setHandledNew] = useState(null)
  useEffect(() => {
    const t = location.state?.openNew
    if (!t || t === handledNew || loading) return
    setHandledNew(t); openNew()
  }, [location.state, loading]) // eslint-disable-line
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

  const today = ymd(new Date())
  const upcoming = sessions.filter(s => s.date >= today)
  const past = sessions.filter(s => s.date < today).reverse()
  const baseList = tab === 'upcoming' ? upcoming : past
  const q = search.trim().toLowerCase()
  const displayed = baseList
    .filter(s => !filterType || s.type === filterType)
    .filter(s => !athleteFilter || (s.athlete_ids || []).includes(athleteFilter))
    .filter(s => !q || `${s.title} ${s.notes || ''} ${(s.exercises || []).map(e => e.name).join(' ')}`.toLowerCase().includes(q))

  // ¿Hay cambios sin guardar en el formulario?
  const isDirty = () => sheet === 'form' && (JSON.stringify(form) !== snapshot || extraDates.length > 0)
  const closeForm = () => { if (isDirty()) setConfirmDiscard(true); else setSheet(null) }
  const openForm = (f, editId = null) => { setForm(f); setSnapshot(JSON.stringify(f)); setExtraDates([]); setEditing(editId); setShowTemplates(false); setTemplateQuery(''); setSheet('form') }

  const openNew = (date) => {
    const base = newEmptyForm()
    if (typeof date === 'string') base.date = date
    if (athleteId) base.athlete_ids = [athleteId]
    openForm(base)
  }
  const openEdit = (s) => openForm({ ...s, exercises: [...(s.exercises||[])], athlete_ids: [...(s.athlete_ids||[])] }, s.id)
  // Duplicar: mismo día de la semana siguiente (o el próximo que aún no haya pasado)
  const duplicateSession = (s) => {
    const { id: _id, attendance: _a, ratings: _r, session_athletes: _sa, ...rest } = s
    let date = addDays(s.date, 7)
    while (date < today) date = addDays(date, 7)
    openForm({ ...rest, date, exercises: (s.exercises||[]).map(e => ({ ...e, id: crypto.randomUUID() })), athlete_ids: [...(s.athlete_ids||[])] })
    toast('Copia preparada para el ' + new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) + ': revisa y guarda', 'info')
  }
  // Mover una sesión de día desde la vista semana
  const moveSession = async (s, newDate) => {
    setMovingId(s.id)
    const { error } = await supabase.from('sessions').update({ date: newDate }).eq('id', s.id)
    setMovingId(null)
    if (error) { toast('No se pudo mover', 'error'); return }
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, date: newDate } : x).sort((a, b) => a.date.localeCompare(b.date)))
    haptic('light')
    if ((s.athlete_ids || []).length && newDate >= today) {
      try {
        sendPushToAthletes(s.athlete_ids, { title: '📅 Sesión movida', body: `${s.title} · ${new Date(newDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`, url: '/?tab=training' })
      } catch { /* aviso opcional */ }
    }
  }
  const openDetail = (s) => {
    setDetailSession(s)
    setSheet('detail')
    // Precargar borradores con respuestas ya guardadas
    const drafts = {}
    Object.entries(s.ratings || {}).forEach(([aid, r]) => {
      if (r.coach_reply) drafts[aid] = r.coach_reply
    })
    setReplyDraft(drafts)
  }

  const saveReply = async (athleteId) => {
    // Si el draft está sin definir (nunca se tocó el input), leer el valor actual del campo
    const draftVal = replyDraft[athleteId]
    const reply = (draftVal !== undefined ? draftVal : detailSession.ratings?.[athleteId]?.coach_reply ?? '')?.trim() || null
    try {
      await RPE.setCoachReply(detailSession.id, athleteId, reply)
      setDetailSession(s => ({
        ...s,
        ratings: { ...s.ratings, [athleteId]: { ...s.ratings[athleteId], coach_reply: reply } }
      }))
      setReplyDraft(d => { const n = { ...d }; delete n[athleteId]; return n })
      toast('Respuesta guardada')
      if (reply) {
        try {
          sendPushToAthletes([athleteId], {
            title: '💬 Celia ha respondido a tu comentario',
            body: reply,
            url: `/?tab=training`,
          })
        } catch { /* notificación opcional */ }
      }
    } catch {
      toast('Error al guardar la respuesta', 'error')
    }
  }

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
        const prev = sessions.find(s => s.id === editing)
        await Sessions.update(editing, safeForm)
        // Notificar si cambia la fecha o se añaden deportistas nuevos
        const newAthletes = (safeForm.athlete_ids || []).filter(id => !prev?.athlete_ids?.includes(id))
        const dateChanged = prev?.date !== safeForm.date
        if (newAthletes.length || dateChanged) {
          const dateLabel = new Date(safeForm.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
          const targets = newAthletes.length ? newAthletes : safeForm.athlete_ids || []
          if (targets.length) {
            try {
              sendPushToAthletes(targets, {
                title: dateChanged ? '📅 Sesión modificada' : '📅 Nueva sesión asignada',
                body: `${safeForm.title} · ${dateLabel}`,
                url: '/?tab=training',
              })
            } catch { /* notificación opcional */ }
          }
        }
      } else {
        const dates = [...new Set([safeForm.date, ...extraDates.filter(Boolean)])].sort()
        for (const date of dates) await Sessions.create({ ...safeForm, date })
        // Notificar a los deportistas convocados
        if (safeForm.athlete_ids?.length) {
          const label = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
          const shortLabel = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
          try {
            sendPushToAthletes(safeForm.athlete_ids, {
              title: dates.length > 1 ? `📅 ${dates.length} sesiones nuevas` : '📅 Nueva sesión asignada',
              body: dates.length > 1 ? `${safeForm.title} · ${dates.map(shortLabel).join(', ')}` : `${safeForm.title} · ${label(dates[0])}`,
              url: '/?tab=training',
            })
          } catch { /* notificación opcional */ }
        }
      }
      await load()
      const n = editing ? 1 : new Set([safeForm.date, ...extraDates.filter(Boolean)]).size
      setSheet(null); setExtraDates([])
      haptic('success')
      toast(editing ? 'Sesión actualizada' : n > 1 ? `${n} sesiones creadas` : 'Sesión creada')
    } catch (err) {
      console.error('Error guardando sesión:', err)
      toast('Error: ' + (err?.message || JSON.stringify(err)), 'error')
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
    const existing = templates.find(t => t.title.trim().toLowerCase() === form.title.trim().toLowerCase())
    if (existing && !window.confirm(`Ya tienes una plantilla «${existing.title}». ¿Quieres sustituirla por esta sesión?`)) return
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
    toast('Plantilla guardada')
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
  const moveExercise = (idx, dir) => setForm(f => {
    const ex = [...f.exercises]; const j = idx + dir
    if (j < 0 || j >= ex.length) return f
    ;[ex[idx], ex[j]] = [ex[j], ex[idx]]
    return { ...f, exercises: ex }
  })
  const duplicateExercise = (idx) => setForm(f => {
    const ex = [...f.exercises]
    ex.splice(idx + 1, 0, { ...ex[idx], id: crypto.randomUUID(), videos: (ex[idx].videos || []).map(v => ({ ...v, id: crypto.randomUUID() })) })
    return { ...f, exercises: ex }
  })
  const addBlock = (b) => {
    setForm(f => ({ ...f, exercises: [...f.exercises, { name: b.name, notes: b.notes || '', videos: (b.videos || []).map(v => ({ ...v, id: crypto.randomUUID() })), id: crypto.randomUUID() }] }))
    setBlockPickerOpen(false)
    toast(`«${b.name}» añadido`)
  }
  const saveExerciseAsBlock = async (ex) => {
    try {
      const r = await saveBlock(ex)
      if (r === 'cancel') return
      toast(r === 'updated' ? 'Bloque actualizado' : 'Bloque guardado: ya puedes añadirlo a cualquier sesión')
      setBlocks(await loadBlocks())
    } catch (e) { toast(e?.message || 'No se pudo guardar', 'error') }
  }
  const selectAll = (ids) => setForm(f => ({ ...f, athlete_ids: ids }))
  const addGroup = (g) => setForm(f => {
    const ids = (g.athlete_ids || []).filter(id => athletes.some(a => a.id === id))
    const allIn = ids.every(id => f.athlete_ids.includes(id))
    return { ...f, athlete_ids: allIn ? f.athlete_ids.filter(id => !ids.includes(id)) : [...new Set([...f.athlete_ids, ...ids])] }
  })
  // Biblioteca de vídeos: todos los vídeos ya usados en sesiones anteriores (sin repetir)
  const videoLibrary = (() => {
    const seen = new Map()
    sessions.forEach(ss => (ss.exercises || []).forEach(e => (e.videos || []).forEach(v => {
      if (v?.url && !seen.has(v.url)) seen.set(v.url, { label: v.label || e.name || 'Vídeo', url: v.url })
    })))
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  })()
  const addVideoFromLibrary = (idx, v) => {
    const current = form.exercises[idx].videos || []
    if (current.some(x => x.url === v.url)) return
    updateExercise(idx, { videos: [...current, { label: v.label, url: v.url, id: crypto.randomUUID() }] })
  }
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
        <div className="page-header" style={{ gap: 8 }}>
          <h2 style={{ minWidth: 0, fontSize: 'clamp(20px, 6.2vw, 32px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Entrenos</h2>
          {showCreate && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSheet('copyWeek')} title="Copiar una semana de entrenos" aria-label="Copiar semana">⧉ Copiar</button>
              <button className="btn btn-primary btn-sm" onClick={() => openNew()}>+ Nueva</button>
            </div>
          )}
        </div>
      )}
      {embedded && showCreate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => openNew()}>+ Nueva sesión</button>
        </div>
      )}

      <div className="page-content">
        <div className="pill-tabs">
          {!embedded && <button className={`pill-tab ${tab==='week'?'active':''}`} onClick={() => setTab('week')}>Semana</button>}
          <button className={`pill-tab ${tab==='upcoming'?'active':''}`} onClick={() => { setTab('upcoming'); setFilterTypePersisted(null) }}>Próximos ({upcoming.length})</button>
          <button className={`pill-tab ${tab==='past'?'active':''}`} onClick={() => { setTab('past'); setFilterTypePersisted(null) }}>Historial ({past.length})</button>
          {!embedded && <button className={`pill-tab ${tab==='calendar'?'active':''}`} onClick={() => setTab('calendar')}>Calendario</button>}
        </div>

        {/* Buscar y filtrar por deportista */}
        {tab !== 'calendar' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {tab !== 'week' && (
              <input className="input" placeholder="🔍 Buscar sesión..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            )}
            {!athleteId && athletes.length > 1 && (
              <select className="input" value={athleteFilter} onChange={e => setAthleteFilter(e.target.value)} style={{ flex: tab === 'week' ? 1 : '0 0 42%', minWidth: 0 }}>
                <option value="">Todas las deportistas</option>
                {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
        )}

        {tab !== 'calendar' && tab !== 'week' && (() => {
          const typesInList = [...new Set(baseList.map(s => s.type).filter(Boolean))]
          if (typesInList.length < 2) return null
          return (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              <button
                onClick={() => setFilterTypePersisted(null)}
                style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1.5px solid var(--border)', background: !filterType ? 'var(--accent)' : 'var(--surface)', color: !filterType ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >Todos</button>
              {typesInList.map(type => {
                const opt = TYPE_OPTS.find(t => t.value === type)
                const active = filterType === type
                return (
                  <button
                    key={type}
                    onClick={() => setFilterTypePersisted(active ? null : type)}
                    style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1.5px solid ${active ? TYPE_COLORS[type] : 'var(--border)'}`, background: active ? TYPE_COLORS[type] : 'var(--surface)', color: active ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >{opt?.label || type}</button>
                )
              })}
            </div>
          )
        })()}

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Cargando...</div>
        ) : tab === 'week' ? (
          <WeekView sessions={sessions} athletes={athletes} athleteFilter={athleteFilter} moving={movingId}
            onOpen={openDetail} onCreate={(d) => openNew(d)} onMove={moveSession} />
        ) : tab === 'calendar' ? (
          <CalendarView sessions={sessions} onEmptyDay={showCreate ? (d) => openNew(d) : null} onSelectDay={daySessions => {
            if (daySessions.length === 1) { setDetailSession(daySessions[0]); setSheet('detail') }
            else { setDaySessionsToSelect(daySessions); setSheet('dayPicker') }
          }} />
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📅</div>
            <h3>{q || athleteFilter || filterType ? 'Nada coincide' : tab==='upcoming' ? 'Sin sesiones' : 'Sin historial'}</h3>
            <p>{q || athleteFilter || filterType ? 'Prueba con otra búsqueda o quita los filtros' : tab==='upcoming' ? 'No hay sesiones próximas' : 'Las sesiones pasadas aparecerán aquí'}</p>
          </div>
        ) : displayed.map(s => (
          <SessionCard key={s.id} session={s} athletes={athletes} onPress={() => openDetail(s)} formatDate={formatDate} />
        ))}
      </div>

      {/* Day session picker */}
      {sheet==='dayPicker' && daySessionsToSelect.length > 0 && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>Sesiones del {formatDate(daySessionsToSelect[0].date)}</h3>
              <button className="btn-close" aria-label="Cerrar" onClick={() => setSheet(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {showCreate && (
                  <button className="btn btn-secondary btn-full" onClick={() => openNew(daySessionsToSelect[0].date)}>+ Nueva sesión este día</button>
                )}
                {daySessionsToSelect.map(s => {
                  const typeOpt = TYPE_OPTS.find(t => t.value === s.type)
                  return (
                    <div key={s.id} onClick={() => { setDetailSession(s); setSheet('detail') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {typeOpt?.label} · ⏱ {s.duration} min · 👥 {s.athlete_ids?.length || 0}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail */}
      {sheet==='detail' && detailSession && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {embedded && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setSheet(null)} style={{ padding: '4px 8px', fontSize: 18, lineHeight: 1 }}>←</button>
                )}
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(detailSession.date)}</div>
                  <h3>{detailSession.title}</h3>
                </div>
              </div>
              {(!athleteId || coachView) && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => duplicateSession(detailSession)} title="Duplicar sesión">⧉</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(detailSession)}>✏️</button>
                </div>
              )}
              {!embedded && <button className="btn-close" aria-label="Cerrar" onClick={() => setSheet(null)}>✕</button>}
            </div>
            <div className="sheet-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span className="badge badge-amber">{TYPE_OPTS.find(t=>t.value===detailSession.type)?.label}</span>
                <span className="badge badge-gray">⏱ {detailSession.duration} min</span>
                <span className="badge badge-blue">👥 {detailSession.athlete_ids?.length||0} deportistas</span>
              </div>
              {detailSession.notes && <div style={{ color: 'var(--text-muted)', fontSize: 14, whiteSpace: 'pre-line', lineHeight: 1.5, marginBottom: 20 }}>{detailSession.notes}</div>}

              {(!athleteId || coachView) && (
                <SessionTargets session={detailSession}
                  athletes={(athleteId ? [athleteId] : (detailSession.athlete_ids || [])).map(id => athletes.find(a => a.id === id)).filter(Boolean)} />
              )}

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
                          {detailSession.date < ymd(new Date()) && !r && (
                            <div style={{ marginTop: 4, marginLeft: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Sin valorar aún
                            </div>
                          )}
                          {r && (r.rpe || r.fatigue_pre || r.fatigue_post || r.mood_post || r.rpe_notes) && (
                            <div style={{ marginTop: 6, marginLeft: 12 }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {r.fatigue_pre != null && <span style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>😴 Pre: <strong>{r.fatigue_pre}</strong></span>}
                                {r.rpe != null && <span style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>💪 RPE: <strong>{r.rpe}</strong></span>}
                                {r.fatigue_post != null && <span style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>🥵 Post: <strong>{r.fatigue_post}</strong></span>}
                                {r.mood_post != null && <span style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-muted)' }}>😊 Ánimo: <strong>{r.mood_post}</strong></span>}
                                {r.fatigue_pre >= 8 && <span style={{ fontSize: 12, background: 'var(--error-dim)', color: 'var(--error)', padding: '2px 8px', borderRadius: 6 }}>⚠️ Cansancio alto</span>}
                              </div>
                              {r.rpe_notes && (
                                <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--accent)', fontSize: 13, color: 'var(--text)', fontStyle: 'italic' }}>
                                  💬 "{r.rpe_notes}"
                                </div>
                              )}
                              <div style={{ marginTop: 6 }}>
                                {r.coach_reply && replyDraft[id] === undefined && (
                                  <div style={{ padding: '6px 10px', background: 'var(--accent-dim)', borderRadius: 8, borderLeft: '3px solid var(--accent)', fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                                    🏋️ "{r.coach_reply}"
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                  <input
                                    className="input"
                                    placeholder={r.rpe_notes ? 'Responder al comentario…' : 'Escribir mensaje al deportista…'}
                                    value={replyDraft[id] ?? r.coach_reply ?? ''}
                                    onChange={e => setReplyDraft(d => ({ ...d, [id]: e.target.value }))}
                                    style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                                  />
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => saveReply(id)}
                                    style={{ flexShrink: 0 }}
                                  >Enviar</button>
                                </div>
                              </div>
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
          <div className="overlay" onClick={closeForm} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar sesión' : 'Nueva sesión'}</h3>
              <button className="btn-close" aria-label="Cerrar" onClick={closeForm}>✕</button>
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
                  {templates.length > 5 && <input className="input" placeholder="Buscar plantilla..." value={templateQuery} onChange={e => setTemplateQuery(e.target.value)} />}
                  {templates.filter(t => !templateQuery.trim() || t.title.toLowerCase().includes(templateQuery.trim().toLowerCase())).map(tpl => (
                    <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <button onClick={() => loadTemplate(tpl)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{tpl.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{TYPE_OPTS.find(o => o.value === tpl.type)?.label || tpl.type} · {tpl.duration} min · {tpl.exercises?.length || 0} entrenamientos</div>
                      </button>
                      <button onClick={() => { if (window.confirm(`¿Borrar la plantilla «${tpl.title}»?`)) deleteTemplate(tpl.id) }} aria-label={`Borrar plantilla ${tpl.title}`} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>🗑</button>
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
              {!editing && (
                <div style={{ marginTop: -6, marginBottom: 14 }}>
                  {extraDates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70 }}>También el</span>
                      <input className="input" type="date" value={d} onChange={e => setExtraDates(x => x.map((y, j) => j === i ? e.target.value : y))} style={{ flex: 1 }} />
                      <button className="btn btn-ghost btn-sm" aria-label="Quitar día" onClick={() => setExtraDates(x => x.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExtraDates(x => [...x, addDays(x[x.length - 1] || form.date, 7)])}>
                    + Repetir otro día {extraDates.length === 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>(misma sesión en varias fechas)</span>}
                  </button>
                </div>
              )}
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
                <div style={{ display: 'flex', gap: 4 }}>
                  {blocks !== null && <button className="btn btn-ghost btn-sm" onClick={() => setBlockPickerOpen(true)}>📦 Bloques{blocks.length ? ` (${blocks.length})` : ''}</button>}
                  <button className="btn btn-ghost btn-sm" onClick={addExercise}>+ Añadir</button>
                </div>
              </div>
              {form.exercises.map((ex, idx) => (
                <div key={ex.id || idx} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" placeholder="Nombre del entrenamiento" value={ex.name} onChange={e => updateExercise(idx,{name:e.target.value})} style={{ flex: 1, minWidth: 0 }} />
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeExercise(idx)} aria-label="Quitar entrenamiento" style={{ color: 'var(--error)' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => moveExercise(idx, -1)}>↑ Subir</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={idx === form.exercises.length - 1} onClick={() => moveExercise(idx, 1)}>↓ Bajar</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => duplicateExercise(idx)}>⧉ Duplicar</button>
                      {blocks !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveExerciseAsBlock(ex)}>💾 Guardar bloque</button>}
                    </div>
                    <textarea className="input" placeholder={"Escribe aquí el detalle, una línea por ejercicio:\nej. Sentadilla 4x10\nPeso muerto 3x8\nPlancha 3x30s"}
                      rows={5} value={ex.notes} onChange={e => updateExercise(idx,{notes:e.target.value})} style={{ resize: 'vertical' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>🎬 Vídeos</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {videoLibrary.length > 0 && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setLibraryFor(libraryFor === idx ? null : idx); setLibraryQuery('') }}>📚 Biblioteca</button>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addVideo(idx)}>+ Añadir vídeo</button>
                      </div>
                    </div>
                    {libraryFor === idx && (
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 8, border: '1px solid var(--border)' }}>
                        <input className="input" placeholder="Buscar vídeo (ej. wall ball, trineo...)" value={libraryQuery}
                          onChange={e => setLibraryQuery(e.target.value)} style={{ marginBottom: 6 }} />
                        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {videoLibrary
                            .filter(v => !libraryQuery.trim() || v.label.toLowerCase().includes(libraryQuery.trim().toLowerCase()))
                            .map(v => {
                              const added = (ex.videos || []).some(x => x.url === v.url)
                              const yt = getYouTubeId(v.url)
                              return (
                                <button key={v.url} type="button" onClick={() => addVideoFromLibrary(idx, v)} disabled={added}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 8, border: 'none', background: added ? 'var(--success-dim)' : 'var(--card)', cursor: added ? 'default' : 'pointer', textAlign: 'left' }}>
                                  {yt
                                    ? <img src={`https://img.youtube.com/vi/${yt}/default.jpg`} alt="" width="48" height="36" style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                                    : <span style={{ fontSize: 20, width: 48, textAlign: 'center' }}>🎬</span>}
                                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{v.label}</span>
                                  <span style={{ fontSize: 12, color: added ? 'var(--success)' : 'var(--accent)', fontWeight: 700 }}>{added ? '✓' : '+ Añadir'}</span>
                                </button>
                              )
                            })}
                        </div>
                      </div>
                    )}
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
                <div className="section-title" style={{ margin: 0 }}>Deportistas convocados <span style={{ color: 'var(--text-muted)' }}>({form.athlete_ids.length})</span></div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {form.athlete_ids.length < athletes.length
                    ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectAll(athletes.map(a => a.id))}>Todas</button>
                    : <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectAll(athleteId ? [athleteId] : [])}>Ninguna</button>}
                  {groups !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGroupsOpen(true)}>👥 Grupos</button>}
                </div>
              </div>
              {groups?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {groups.map(g => {
                    const ids = (g.athlete_ids || []).filter(id => athletes.some(a => a.id === id))
                    const on = ids.length > 0 && ids.every(id => form.athlete_ids.includes(id))
                    return (
                      <button key={g.id} type="button" onClick={() => addGroup(g)}
                        style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-dim)' : 'var(--card)', color: on ? 'var(--accent)' : 'var(--text)' }}>
                        {on ? '✓ ' : '+ '}{g.name} <span style={{ color: 'var(--text-muted)' }}>{ids.length}</span>
                      </button>
                    )
                  })}
                </div>
              )}
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
      {confirmDiscard && (
        <ConfirmSheet
          icon="✋"
          title="¿Salir sin guardar?"
          message="Tienes cambios en esta sesión que todavía no has guardado. Si sales, se perderán."
          confirmLabel="Salir y descartar"
          onConfirm={() => { setConfirmDiscard(false); setExtraDates([]); setSheet(null) }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
      {blockPickerOpen && blocks !== null && (
        <BlockPicker blocks={blocks} onPick={addBlock} onClose={() => setBlockPickerOpen(false)} onDeleted={id => setBlocks(b => b.filter(x => x.id !== id))} />
      )}
      {groupsOpen && groups !== null && (
        <GroupsSheet athletes={athletes} groups={groups} toast={toast} onClose={() => setGroupsOpen(false)} onChange={async () => setGroups(await loadGroups())} />
      )}
      {sheet === 'copyWeek' && (
        <CopyWeekSheet sessions={sessions} athletes={athletes} toast={toast}
          onClose={() => setSheet(null)}
          onDone={async () => { setSheet(null); await load() }} />
      )}
    </>
  )

  return embedded
    ? <div style={{ padding: '0 0 8px' }}>{inner}</div>
    : <div className="page fade-in">{inner}</div>
}

function SessionCard({ session, athletes, onPress, formatDate }) {
  const typeColor = TYPE_COLORS[session.type] || '#9CA3AF'
  const typeOpt = TYPE_OPTS.find(t=>t.value===session.type)
  const typeLabel = typeOpt?.label?.replace(/^[^ ]+ /, '') || session.type
  const typeIcon = TYPE_ICONS[session.type] || '📅'
  const isToday = session.date === ymd(new Date())
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
          <div style={{ fontSize: 11, fontWeight: 800, color: isToday ? '#fff' : typeColor, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}>{days[date.getDay()]}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isToday ? '#fff' : 'var(--text)', lineHeight: 1.1, fontFamily: "'Barlow Condensed', sans-serif" }}>{date.getDate()}</div>
          <div style={{ fontSize: 11, color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>{months[date.getMonth()]}</div>
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {isToday && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--success)', padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase' }}>HOY</span>}
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

function CalendarView({ sessions, onSelectDay, onEmptyDay }) {
  const [current, setCurrent] = useState(new Date())
  const year = current.getFullYear()
  const month = current.getMonth()
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAYS = ['L','M','X','J','V','S','D']

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = ymd(new Date())

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
          <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const isToday = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` === today
          const hasSessions = byDay[day]
          const allDone = hasSessions && hasSessions.every(s => s.athlete_ids?.length > 0 && Object.values(s.attendance||{}).some(Boolean))
          return (
            <div key={day} onClick={() => hasSessions ? onSelectDay(hasSessions) : onEmptyDay?.(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)}
              title={hasSessions ? undefined : onEmptyDay ? 'Crear sesión este día' : undefined}
              style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 10, cursor: hasSessions || onEmptyDay ? 'pointer' : 'default',
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
