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
export const Sessions = {
  getAll: async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*, exercises(*), session_athletes(athlete_id, attended)')
      .order('date')
    return (data || []).map(s => ({
      ...s,
      athlete_ids: (s.session_athletes || []).map(sa => sa.athlete_id),
      attendance: (s.session_athletes || []).reduce((acc, sa) => ({ ...acc, [sa.athlete_id]: sa.attended }), {})
    }))
  },
  getByAthlete: async (athleteId) => {
    const { data } = await supabase
      .from('session_athletes')
      .select('sessions(*, exercises(*), session_athletes(athlete_id, attended))')
      .eq('athlete_id', athleteId)
    return (data || []).map(r => r.sessions).filter(Boolean).map(s => ({
      ...s,
      athlete_ids: (s.session_athletes || []).map(sa => sa.athlete_id),
      attendance: (s.session_athletes || []).reduce((acc, sa) => ({ ...acc, [sa.athlete_id]: sa.attended }), {})
    })).sort((a,b) => a.date.localeCompare(b.date))
  },
  getById: async (id) => {
    const { data } = await supabase
      .from('sessions')
      .select('*, exercises(*), session_athletes(athlete_id)')
      .eq('id', id)
      .single()
    if (!data) return null
    return { ...data, athlete_ids: (data.session_athletes || []).map(sa => sa.athlete_id) }
  },
  create: async ({ exercises = [], athlete_ids = [], ...session }) => {
    const { data: newSession } = await supabase.from('sessions').insert(session).select().single()
    if (!newSession) return null

    if (exercises.length) {
      await supabase.from('exercises').insert(exercises.map((e, i) => ({
        session_id: newSession.id,
        name: e.name || 'Ejercicio',
        sets: parseInt(e.sets) || 3,
        reps: String(e.reps || '10'),
        notes: e.notes || null,
        youtube_url: e.youtube_url || null,
        sort_order: i
      })))
    }
    if (athlete_ids.length) {
      await supabase.from('session_athletes').insert(athlete_ids.map(id => ({ session_id: newSession.id, athlete_id: id })))
    }
    return newSession
  },
  update: async (id, { exercises = [], athlete_ids = [], attendance, session_athletes, id: _id, ...session }) => {
    await supabase.from('sessions').update(session).eq('id', id)

    if (exercises) {
      await supabase.from('exercises').delete().eq('session_id', id)
      if (exercises.length) {
        await supabase.from('exercises').insert(exercises.map((e, i) => ({
          session_id: id,
          name: e.name || 'Ejercicio',
          sets: parseInt(e.sets) || 3,
          reps: String(e.reps || '10'),
          notes: e.notes || null,
          youtube_url: e.youtube_url || null,
          sort_order: i
        })))
      }
    }
    if (athlete_ids) {
      await supabase.from('session_athletes').delete().eq('session_id', id)
      if (athlete_ids.length) {
        await supabase.from('session_athletes').insert(athlete_ids.map(aid => ({ session_id: id, athlete_id: aid })))
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
    const { data } = await supabase.from('injuries').select('*').order('date_start', { ascending: false })
    return data || []
  },
  getByAthlete: async (athleteId) => {
    const { data } = await supabase.from('injuries').select('*').eq('athlete_id', athleteId).order('date_start', { ascending: false })
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
  ensureMonth: async (athletes, month, year, amount = 80) => {
    const existing = await Payments.getByMonth(month, year)
    const existingIds = existing.map(p => p.athlete_id)
    const missing = athletes.filter(a => !existingIds.includes(a.id))
    if (missing.length) {
      await supabase.from('payments').insert(missing.map(a => ({
        athlete_id: a.id, month, year, amount, status: 'pending'
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
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
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
    const path = `${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('chat').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('chat').getPublicUrl(path)
    return { url: data.publicUrl, type: file.type, name: file.name }
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
  upsert: async (entry) => {
    const { data } = await supabase.from('wellness').upsert(entry, { onConflict: 'athlete_id,date' }).select().single()
    return data
  }
}

// ---- RPE ----
export const RPE = {
  set: async (sessionId, athleteId, rpe, notes = '') => {
    await supabase.from('session_athletes').update({ rpe, rpe_notes: notes }).eq('session_id', sessionId).eq('athlete_id', athleteId)
  },
  get: async (sessionId, athleteId) => {
    const { data } = await supabase.from('session_athletes').select('rpe, rpe_notes').eq('session_id', sessionId).eq('athlete_id', athleteId).single()
    return data
  }
}
