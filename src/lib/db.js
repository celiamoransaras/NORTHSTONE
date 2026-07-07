/**
 * NORTHSTONE — Capa de datos con Supabase
 * Todas las operaciones son async/await
 */
import { supabase } from './supabase'

// ---- ATHLETES ----
export const Athletes = {
  getAll: async () => {
    const { data } = await supabase.from('athletes').select('*').order('name')
    return data || []
  },
  getActive: async () => {
    const { data } = await supabase.from('athletes').select('*').neq('status', 'inactive').order('name')
    return data || []
  },
  getById: async (id) => {
    const { data } = await supabase.from('athletes').select('*').eq('id', id).single()
    return data
  },
  getByEmail: async (email) => {
    const { data } = await supabase.from('athletes').select('*').eq('email', email).single()
    return data
  },
  create: async (athlete) => {
    const { data } = await supabase.from('athletes').insert(athlete).select().single()
    return data
  },
  update: async (id, updates) => {
    const { data } = await supabase.from('athletes').update(updates).eq('id', id).select().single()
    return data
  },
  delete: async (id) => {
    await supabase.from('athletes').delete().eq('id', id)
  }
}

// ---- SESSIONS ----
const mapExercises = (exercises) => (exercises || [])
  .slice()
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  .map(e => ({ ...e, videos: e.videos || [] }))

export const Sessions = {
  getAll: async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*, exercises(*), session_athletes(athlete_id, attended, rpe, rpe_notes, fatigue_pre, fatigue_post, mood_post, coach_reply)')
      .order('date')
    return (data || []).map(s => ({
      ...s,
      exercises: mapExercises(s.exercises),
      athlete_ids: (s.session_athletes || []).map(sa => sa.athlete_id),
      attendance: (s.session_athletes || []).reduce((acc, sa) => ({ ...acc, [sa.athlete_id]: sa.attended }), {}),
      ratings: (s.session_athletes || []).reduce((acc, sa) => ({ ...acc, [sa.athlete_id]: { rpe: sa.rpe, rpe_notes: sa.rpe_notes, fatigue_pre: sa.fatigue_pre, fatigue_post: sa.fatigue_post, mood_post: sa.mood_post, coach_reply: sa.coach_reply } }), {})
    }))
  },
  getByAthlete: async (athleteId) => {
    const { data } = await supabase
      .from('session_athletes')
      .select('sessions(*, exercises(*), session_athletes(athlete_id, attended, rpe, rpe_notes, fatigue_pre, fatigue_post, mood_post, coach_reply))')
      .eq('athlete_id', athleteId)
    return (data || []).map(r => r.sessions).filter(Boolean).map(s => ({
      ...s,
      exercises: mapExercises(s.exercises),
      athlete_ids: (s.session_athletes || []).map(sa => sa.athlete_id),
      attendance: (s.session_athletes || []).reduce((acc, sa) => ({ ...acc, [sa.athlete_id]: sa.attended }), {}),
      ratings: (s.session_athletes || []).reduce((acc, sa) => ({ ...acc, [sa.athlete_id]: { rpe: sa.rpe, rpe_notes: sa.rpe_notes, fatigue_pre: sa.fatigue_pre, fatigue_post: sa.fatigue_post, mood_post: sa.mood_post, coach_reply: sa.coach_reply } }), {})
    })).sort((a,b) => a.date.localeCompare(b.date))
  },
  getById: async (id) => {
    const { data } = await supabase
      .from('sessions')
      .select('*, exercises(*), session_athletes(athlete_id)')
      .eq('id', id)
      .single()
    if (!data) return null
    return { ...data, exercises: mapExercises(data.exercises), athlete_ids: (data.session_athletes || []).map(sa => sa.athlete_id) }
  },
  create: async ({ exercises = [], athlete_ids = [], ...session }) => {
    const { data: newSession } = await supabase.from('sessions').insert(session).select().single()
    if (!newSession) return null

    if (exercises.length) {
      await supabase.from('exercises').insert(exercises.map((e, i) => ({
        session_id: newSession.id,
        name: e.name || 'Entrenamiento',
        notes: e.notes || null,
        videos: (e.videos || []).filter(v => v.url),
        sort_order: i
      })))
    }
    if (athlete_ids.length) {
      await supabase.from('session_athletes').insert(athlete_ids.map(id => ({ session_id: newSession.id, athlete_id: id })))
    }
    return newSession
  },
  update: async (id, { exercises = [], athlete_ids = [], attendance, session_athletes, ratings, id: _id, ...session }) => {
    await supabase.from('sessions').update(session).eq('id', id)

    // Actualizar ejercicios (delete + reinsert)
    if (exercises) {
      await supabase.from('exercises').delete().eq('session_id', id)
      if (exercises.length) {
        await supabase.from('exercises').insert(exercises.map((e, i) => ({
          session_id: id,
          name: e.name || 'Entrenamiento',
          notes: e.notes || null,
          videos: (e.videos || []).filter(v => v.url),
          sort_order: i
        })))
      }
    }

    // Actualizar deportistas convocadas preservando asistencia/RPE existentes
    if (athlete_ids) {
      // Obtener registros actuales para no perder attended/rpe
      const { data: existing } = await supabase
        .from('session_athletes')
        .select('athlete_id, attended, rpe, fatigue_pre, fatigue_post, mood_post, rpe_notes')
        .eq('session_id', id)
      const existingMap = {}
      ;(existing || []).forEach(r => { existingMap[r.athlete_id] = r })

      // Eliminar los que ya no están convocados
      const toRemove = (existing || []).filter(r => !athlete_ids.includes(r.athlete_id))
      if (toRemove.length) {
        await supabase.from('session_athletes').delete().eq('session_id', id)
          .in('athlete_id', toRemove.map(r => r.athlete_id))
      }

      // Insertar los nuevos preservando datos de los que ya existían
      const toInsert = athlete_ids
        .filter(aid => !existingMap[aid])
        .map(aid => ({ session_id: id, athlete_id: aid }))
      if (toInsert.length) {
        await supabase.from('session_athletes').insert(toInsert)
      }
    }
  },
  delete: async (id) => {
    await supabase.from('sessions').delete().eq('id', id)
  },
  toggleAttendance: async (sessionId, athleteId, current) => {
    await supabase.from('session_athletes')
      .update({ attended: !current })
      .eq('session_id', sessionId).eq('athlete_id', athleteId)
  }
}

// ---- INJURIES ----
export const Injuries = {
  getAll: async () => {
    const { data } = await supabase.from('injuries').select('*').neq('type', 'cycle').order('date_start', { ascending: false })
    return data || []
  },
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('injuries').select('*').eq('athlete_id', athleteId).neq('type', 'cycle').order('date_start', { ascending: false })
    return data || []
  },
  create: async (injury) => {
    const { data } = await supabase.from('injuries').insert(injury).select().single()
    return data
  },
  update: async (id, updates) => {
    const { data } = await supabase.from('injuries').update(updates).eq('id', id).select().single()
    return data
  },
  delete: async (id) => {
    await supabase.from('injuries').delete().eq('id', id)
  }
}

// ---- PAYMENTS ----
export const Payments = {
  getAll: async () => {
    const { data } = await supabase.from('payments').select('*')
    return data || []
  },
  getByMonth: async (month, year) => {
    const { data } = await supabase.from('payments').select('*').eq('month', month).eq('year', year)
    return data || []
  },
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('payments').select('*').eq('athlete_id', athleteId).order('year', { ascending: false }).order('month', { ascending: false })
    return data || []
  },
  ensureMonth: async (athletes, month, year) => {
    const existing = await Payments.getByMonth(month, year)
    const existingIds = existing.map(p => p.athlete_id)
    const missing = athletes.filter(a => {
      if (existingIds.includes(a.id)) return false
      return a.monthly_fee != null && a.monthly_fee >= 0
    })
    if (missing.length) {
      await supabase.from('payments').insert(missing.map(a => ({
        athlete_id: a.id, month, year,
        amount: a.monthly_fee,
        status: 'pending'
      })))
    }
    return Payments.getByMonth(month, year)
  },
  toggle: async (id, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid'
    await supabase.from('payments').update({
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null
    }).eq('id', id)
  }
}

// ---- STORAGE ----
export const Storage = {
  uploadAvatar: async (athleteId, file) => {
    const ext = file.name.split('.').pop()
    const path = `${athleteId}.${ext}`
    await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  },
  uploadDocument: async (file) => {
    const path = `${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documents').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('documents').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name, size: file.size }
  }
}

// ---- DOCUMENTS ----
export const Documents = {
  getAll: async () => {
    const { data } = await supabase.from('documents').select('*')
      .or('category.is.null,category.eq.general')
      .order('created_at', { ascending: false })
    return data || []
  },
  getMedical: async (athleteId) => {
    const { data } = await supabase.from('documents').select('*')
      .eq('athlete_id', athleteId).eq('category', 'medical')
      .order('created_at', { ascending: false })
    return data || []
  },
  getForAthlete: async (athleteId) => {
    // Docs generales del coach + docs específicos del deportista (no médicos)
    const { data } = await supabase.from('documents').select('*')
      .or(`category.is.null,category.eq.general,and(athlete_id.eq.${athleteId},category.eq.athlete)`)
      .order('created_at', { ascending: false })
    return data || []
  },
  create: async (doc) => {
    const { data } = await supabase.from('documents').insert(doc).select().single()
    return data
  },
  delete: async (id) => {
    await supabase.from('documents').delete().eq('id', id)
  }
}

// ---- MESSAGES ----
export const Messages = {
  getGroup: async (group) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', group)
      .order('created_at')
    return (data || []).map(m => ({
      id: m.id,
      group: m.group_id,
      sender: m.sender,
      senderName: m.sender_name,
      text: m.text,
      file_url: m.file_url,
      file_type: m.file_type,
      ts: m.created_at
    }))
  },
  send: async (group, text, sender = 'me', senderName = null, fileUrl = null, fileType = null) => {
    const { data } = await supabase.from('messages').insert({
      group_id: group, sender, sender_name: senderName, text,
      file_url: fileUrl, file_type: fileType
    }).select().single()
    return data
  },
  uploadFile: async (file) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${Date.now()}_${safeName}`
    const { error } = await supabase.storage.from('chat').upload(path, file, { upsert: true })
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from('chat').getPublicUrl(path)
    return { url: data.publicUrl, type: file.type, name: file.name }
  },
  getLatestPerGroup: async (groupIds) => {
    const { data } = await supabase
      .from('messages')
      .select('group_id, created_at, sender')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(groupIds.length * 20)
    const seen = {}
    ;(data || []).forEach(m => { if (!seen[m.group_id]) seen[m.group_id] = m })
    return seen
  },
  subscribe: (group, callback) => {
    return supabase
      .channel(`messages:${group}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${group}` }, callback)
      .subscribe()
  }
}

// ---- RECORDS ----
export const Records = {
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('personal_records').select('*').eq('athlete_id', athleteId).order('date', { ascending: false })
    return data || []
  },
  create: async (record) => {
    const { data } = await supabase.from('personal_records').insert(record).select().single()
    return data
  },
  update: async (id, updates) => {
    const { data } = await supabase.from('personal_records').update(updates).eq('id', id).select().single()
    return data
  },
  delete: async (id) => { await supabase.from('personal_records').delete().eq('id', id) }
}

// ---- GOALS ----
export const Goals = {
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('goals').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false })
    return data || []
  },
  create: async (goal) => {
    const { data } = await supabase.from('goals').insert(goal).select().single()
    return data
  },
  update: async (id, updates) => {
    const { data } = await supabase.from('goals').update(updates).eq('id', id).select().single()
    return data
  },
  delete: async (id) => { await supabase.from('goals').delete().eq('id', id) }
}

// ---- WELLNESS ----
export const Wellness = {
  getToday: async (athleteId) => {
    const today = new Date().toISOString().slice(0,10)
    const { data } = await supabase.from('wellness').select('*').eq('athlete_id', athleteId).eq('date', today).single()
    return data
  },
  getByAthlete: async (athleteId, limit = 14) => {
    const { data } = await supabase.from('wellness').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(limit)
    return data || []
  },
  getAll: async () => {
    const { data } = await supabase.from('wellness').select('*, athletes(name, color)').order('date', { ascending: false }).limit(50)
    return data || []
  },
  getLatestPerAthlete: async () => {
    const { data, error } = await supabase.from('wellness').select('*, athletes(name, color)').order('date', { ascending: false }).limit(100)
if (!data) return []
    const seen = new Set()
    return data.filter(e => { if (seen.has(e.athlete_id)) return false; seen.add(e.athlete_id); return true })
  },
  upsert: async (entry) => {
    const { data } = await supabase.from('wellness').upsert(entry, { onConflict: 'athlete_id,date' }).select().single()
    return data
  }
}

// ---- REACTIONS ----
export const Reactions = {
  getByChat: async (groupId) => {
    const { data } = await supabase.from('message_reactions').select('*').eq('group_id', groupId)
    return data || []
  },
  toggle: async (messageId, senderId, emoji, groupId) => {
    const { data: existing } = await supabase.from('message_reactions')
      .select('id').eq('message_id', messageId).eq('sender_id', senderId).eq('emoji', emoji).single()
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, sender_id: senderId, emoji, group_id: groupId })
    }
  }
}

// ---- ACHIEVEMENTS ----
export const Achievements = {
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('achievements').select('*').eq('athlete_id', athleteId).order('unlocked_at')
    return data || []
  },
  unlock: async (athleteId, type, title, description, icon) => {
    const { data: existing } = await supabase.from('achievements').select('id').eq('athlete_id', athleteId).eq('type', type).maybeSingle()
    if (existing) return { newly_unlocked: false }
    await supabase.from('achievements').insert({ athlete_id: athleteId, type, title, description, icon })
    return { newly_unlocked: true }
  }
}

// ---- Ciclo menstrual (usa tabla injuries con type='cycle') ----
export const Cycle = {
  // Registrar inicio de regla
  log: async (athleteId, startDate) => {
    const { data } = await supabase.from('injuries').insert({
      athlete_id: athleteId,
      date_start: startDate,
      type: 'cycle',
      body_part: '',
      severity: 'mild',
      notes: ''
    }).select().single()
    // Mantener solo los últimos 3 ciclos — borrar los más antiguos
    const { data: all } = await supabase.from('injuries')
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('type', 'cycle')
      .order('date_start', { ascending: false })
    if (all && all.length > 3) {
      const toDelete = all.slice(3).map(c => c.id)
      await supabase.from('injuries').delete().in('id', toDelete)
    }
    return data
  },
  // Marcar fin de la regla
  end: async (cycleId, endDate) => {
    await supabase.from('injuries').update({ date_end: endDate }).eq('id', cycleId)
  },
  // Añadir síntoma al ciclo actual (guardado en notas como JSON)
  addSymptom: async (cycleId, phase, text) => {
    const { data: current } = await supabase.from('injuries').select('notes').eq('id', cycleId).single()
    let parsed = {}
    try { parsed = JSON.parse(current?.notes || '{}') } catch { parsed = {} }
    const symptoms = parsed.symptoms || []
    symptoms.unshift({ date: new Date().toISOString().slice(0,10), phase, text })
    const newNotes = JSON.stringify({ ...parsed, symptoms })
    await supabase.from('injuries').update({ notes: newNotes }).eq('id', cycleId)
    return symptoms
  },
  // Obtener síntomas de un ciclo
  getSymptoms: (cycle) => {
    if (!cycle?.notes) return []
    try { return JSON.parse(cycle.notes).symptoms || [] } catch { return [] }
  },
  // Obtener historial de ciclos de una deportista
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('injuries')
      .select('id, date_start, date_end, notes')
      .eq('athlete_id', athleteId)
      .eq('type', 'cycle')
      .order('date_start', { ascending: false })
    return data || []
  },
  // Duración del ciclo — guardado en Supabase (campo cycle_length en athletes)
  getCycleLength: (athleteId) => 28, // fallback, valor real viene del perfil
  setCycleLength: async (athleteId, length) => {
    await supabase.from('athletes').update({ cycle_length: length }).eq('id', athleteId)
  },
  // Calcular fase actual — acepta objeto ciclo {date_start, date_end} o string fecha
  // cycleLength: duración configurada por la deportista (por defecto 28)
  getPhase: (cycleOrDate, cycleLength = 28) => {
    if (!cycleOrDate) return null
    const cycle = typeof cycleOrDate === 'string'
      ? { date_start: cycleOrDate, date_end: null }
      : cycleOrDate
    const { date_start, date_end } = cycle
    const start = new Date(date_start + 'T12:00:00')
    const today = new Date()
    const dayOfCycle = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1
    if (dayOfCycle < 1) return null
    const day = ((dayOfCycle - 1) % cycleLength) + 1
    // Ovulación: 14 días antes del fin del ciclo (fase lútea siempre ~14d)
    const ovulationDay = cycleLength - 14

    if (date_end) {
      const end = new Date(date_end + 'T12:00:00')
      const periodDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
      if (day <= periodDays)   return { phase: 'menstrual', day, label: 'Menstrual', emoji: '🩸', color: '#DC2626', desc: 'Tómate con calma, escucha tu cuerpo', periodEnded: true, periodDays }
      if (day < ovulationDay)  return { phase: 'folicular', day, label: 'Folicular', emoji: '🌱', color: '#059669', desc: 'Buena energía, ideal para entrenar fuerte', periodEnded: true }
      if (day === ovulationDay) return { phase: 'ovulacion', day, label: 'Ovulación', emoji: '⚡', color: '#7C3AED', desc: 'Pico de energía y fuerza', periodEnded: true }
      return                    { phase: 'lutea',    day, label: 'Lútea',    emoji: '🌙', color: '#D97706', desc: 'Puede aparecer más fatiga o sensibilidad', periodEnded: true }
    } else {
      // Sin fecha de fin — día ≤5 asume fase menstrual activa
      if (day <= 5)            return { phase: 'menstrual', day, label: 'Menstrual', emoji: '🩸', color: '#DC2626', desc: 'Tómate con calma, escucha tu cuerpo', periodEnded: false }
      if (day < ovulationDay)  return { phase: 'folicular', day, label: 'Folicular', emoji: '🌱', color: '#059669', desc: 'Buena energía, ideal para entrenar fuerte', periodEnded: null }
      if (day === ovulationDay) return { phase: 'ovulacion', day, label: 'Ovulación', emoji: '⚡', color: '#7C3AED', desc: 'Pico de energía y fuerza', periodEnded: null }
      return                    { phase: 'lutea',    day, label: 'Lútea',    emoji: '🌙', color: '#D97706', desc: 'Puede aparecer más fatiga o sensibilidad', periodEnded: null }
    }
  }
}

// ---- RPE ----
export const RPE = {
  set: async (sessionId, athleteId, fields) => {
    await supabase.from('session_athletes').update(fields).eq('session_id', sessionId).eq('athlete_id', athleteId)
  },
  get: async (sessionId, athleteId) => {
    const { data } = await supabase.from('session_athletes').select('rpe, rpe_notes, fatigue_pre, fatigue_post, mood_post, coach_reply').eq('session_id', sessionId).eq('athlete_id', athleteId).single()
    return data
  },
  setCoachReply: async (sessionId, athleteId, reply) => {
    await supabase.from('session_athletes').update({ coach_reply: reply || null }).eq('session_id', sessionId).eq('athlete_id', athleteId)
  }
}

// ---- NUTRITION ----
const DAYS_ES = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
export const Nutrition = {
  DAYS: DAYS_ES,
  DAY_LABELS: { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' },
  DAY_SHORT:  { monday:'L', tuesday:'M', wednesday:'X', thursday:'J', friday:'V', saturday:'S', sunday:'D' },
  getTodayKey: () => {
    const d = new Date().getDay() // 0=dom,1=lun...
    return DAYS_ES[d === 0 ? 6 : d - 1]
  },
  getPlan: async (athleteId, month, year) => {
    const { data } = await supabase.from('nutrition_plans').select('*')
      .eq('athlete_id', athleteId).eq('month', month).eq('year', year).single()
    return data || null
  },
  getLatestPlan: async (athleteId) => {
    const { data } = await supabase.from('nutrition_plans').select('*')
      .eq('athlete_id', athleteId).order('year', { ascending: false }).order('month', { ascending: false }).limit(1).single()
    return data || null
  },
  savePlan: async (athleteId, month, year, days, notes) => {
    await supabase.from('nutrition_plans').upsert(
      { athlete_id: athleteId, month, year, days, notes, updated_at: new Date().toISOString() },
      { onConflict: 'athlete_id,month,year' }
    )
  },
  getLogs: async (athleteId) => {
    const since = new Date(); since.setDate(since.getDate() - 30)
    const { data } = await supabase.from('nutrition_logs').select('*')
      .eq('athlete_id', athleteId)
      .gte('date', since.toISOString().slice(0,10))
      .order('date', { ascending: false })
    return data || []
  },
  saveLog: async (athleteId, date, adherence, comment) => {
    await supabase.from('nutrition_logs').upsert(
      { athlete_id: athleteId, date, adherence, comment },
      { onConflict: 'athlete_id,date' }
    )
  },
  getTodayLog: async (athleteId) => {
    const today = new Date().toISOString().slice(0,10)
    const { data } = await supabase.from('nutrition_logs').select('*').eq('athlete_id', athleteId).eq('date', today).single()
    return data || null
  }
}


// ---- WEIGHT LOGS ----
export const WeightLog = {
  add: async (athleteId, date, weight, notes = null) => {
    await supabase.from('weight_logs').upsert(
      { athlete_id: athleteId, date, weight, notes },
      { onConflict: 'athlete_id,date' }
    )
  },
  getByAthlete: async (athleteId, limit = 50) => {
    const { data } = await supabase.from('weight_logs').select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: true })
      .limit(limit)
    return data || []
  },
  getLast: async (athleteId) => {
    const { data } = await supabase.from('weight_logs').select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
      .limit(1)
    return data?.[0] || null
  }
}
