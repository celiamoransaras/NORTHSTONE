/**
 * NORTHSTONE — Capa de datos
 *
 * Funciona con localStorage ahora mismo.
 * Cuando configures Supabase, cambia USE_SUPABASE a true
 * y añade tus claves en el archivo .env
 */

// Supabase se carga dinámicamente cuando tienes las variables de entorno
// Por ahora la app funciona perfectamente con localStorage
export const supabase = null

// ---- localStorage helpers ----
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem('ns_' + key) || '[]') } catch { return [] }
}
function lsSet(key, data) {
  localStorage.setItem('ns_' + key, JSON.stringify(data))
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ---- Seed data ----
function seed() {
  if (lsGet('seeded').length) return

  const athletes = [
    { id: newId(), name: 'Alejandro García', email: 'alex@gmail.com', phone: '600111222', dob: '1998-03-15', sport: 'Híbrido', color: '#F59E0B', status: 'active', notes: '' },
    { id: newId(), name: 'Laura Martínez', email: 'laura@gmail.com', phone: '600333444', dob: '2000-07-22', sport: 'Híbrido', color: '#10B981', status: 'active', notes: '' },
    { id: newId(), name: 'Carlos Ruiz', email: 'carlos@gmail.com', phone: '600555666', dob: '1995-11-08', sport: 'Híbrido', color: '#3B82F6', status: 'injured', notes: '' },
    { id: newId(), name: 'María López', email: 'maria@gmail.com', phone: '600777888', dob: '2002-01-30', sport: 'Híbrido', color: '#EC4899', status: 'active', notes: '' },
    { id: newId(), name: 'Pablo Sánchez', email: 'pablo@gmail.com', phone: '600999000', dob: '1999-05-14', sport: 'Híbrido', color: '#8B5CF6', status: 'active', notes: '' },
  ]
  lsSet('athletes', athletes)

  const sessions = [
    {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      title: 'Fuerza + Cardio',
      type: 'strength',
      duration: 60,
      notes: 'Sesión de bienvenida del mes',
      exercises: [
        { id: newId(), name: 'Sentadilla', sets: 4, reps: '8', notes: 'Con barra', youtube_url: '' },
        { id: newId(), name: 'Press banca', sets: 3, reps: '10', notes: '', youtube_url: '' },
      ],
      athlete_ids: athletes.slice(0, 4).map(a => a.id)
    },
    {
      id: newId(),
      date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      title: 'Trabajo de carrera',
      type: 'cardio',
      duration: 45,
      notes: '5km a ritmo moderado',
      exercises: [
        { id: newId(), name: 'Calentamiento dinámico', sets: 1, reps: '10 min', notes: '', youtube_url: '' },
        { id: newId(), name: 'Carrera continua 5km', sets: 1, reps: '1', notes: 'Ritmo 5:30/km', youtube_url: '' },
      ],
      athlete_ids: athletes.map(a => a.id)
    }
  ]
  lsSet('sessions', sessions)

  const injuries = [
    {
      id: newId(),
      athlete_id: athletes[2].id,
      date_start: '2024-05-20',
      date_end: '',
      type: 'Esguince',
      body_part: 'Tobillo derecho',
      severity: 'moderate',
      notes: 'Reposo 2 semanas, fisio 3x semana'
    }
  ]
  lsSet('injuries', injuries)

  const now = new Date()
  const payments = athletes.flatMap(a =>
    [0, 1, 2].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return {
        id: newId(),
        athlete_id: a.id,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        amount: 80,
        status: i === 0 ? (Math.random() > 0.3 ? 'paid' : 'pending') : 'paid',
        paid_at: i === 0 ? null : d.toISOString()
      }
    })
  )
  lsSet('payments', payments)

  const messages = [
    { id: newId(), group: 'general', sender: 'me', text: '¡Buenas a todos! Entrenamiento mañana a las 8h 💪', ts: new Date(Date.now() - 3600000).toISOString() },
    { id: newId(), group: 'general', sender: athletes[0].id, senderName: athletes[0].name, text: '¡Ahí estaremos!', ts: new Date(Date.now() - 3200000).toISOString() },
    { id: newId(), group: 'general', sender: athletes[1].id, senderName: athletes[1].name, text: 'Confirmado 🔥', ts: new Date(Date.now() - 3000000).toISOString() },
  ]
  lsSet('messages', messages)
  lsSet('seeded', [true])
}

seed()

// ============================================
// API
// ============================================

// ---- ATHLETES ----
export const Athletes = {
  getAll: () => lsGet('athletes'),
  getById: (id) => lsGet('athletes').find(a => a.id === id),
  create: (data) => {
    const list = lsGet('athletes')
    const item = { id: newId(), ...data, status: data.status || 'active' }
    lsSet('athletes', [...list, item])
    return item
  },
  update: (id, data) => {
    const list = lsGet('athletes').map(a => a.id === id ? { ...a, ...data } : a)
    lsSet('athletes', list)
    return list.find(a => a.id === id)
  },
  delete: (id) => {
    lsSet('athletes', lsGet('athletes').filter(a => a.id !== id))
  }
}

// ---- SESSIONS ----
export const Sessions = {
  getAll: () => lsGet('sessions').sort((a, b) => a.date.localeCompare(b.date)),
  getById: (id) => lsGet('sessions').find(s => s.id === id),
  create: (data) => {
    const list = lsGet('sessions')
    const item = { id: newId(), exercises: [], athlete_ids: [], ...data }
    lsSet('sessions', [...list, item])
    return item
  },
  update: (id, data) => {
    const list = lsGet('sessions').map(s => s.id === id ? { ...s, ...data } : s)
    lsSet('sessions', list)
    return list.find(s => s.id === id)
  },
  delete: (id) => {
    lsSet('sessions', lsGet('sessions').filter(s => s.id !== id))
  }
}

// ---- INJURIES ----
export const Injuries = {
  getAll: () => lsGet('injuries'),
  getByAthlete: (athleteId) => lsGet('injuries').filter(i => i.athlete_id === athleteId),
  create: (data) => {
    const list = lsGet('injuries')
    const item = { id: newId(), ...data }
    lsSet('injuries', [...list, item])
    return item
  },
  update: (id, data) => {
    const list = lsGet('injuries').map(i => i.id === id ? { ...i, ...data } : i)
    lsSet('injuries', list)
    return list.find(i => i.id === id)
  },
  delete: (id) => {
    lsSet('injuries', lsGet('injuries').filter(i => i.id !== id))
  }
}

// ---- PAYMENTS ----
export const Payments = {
  getAll: () => lsGet('payments'),
  getByAthlete: (athleteId) => lsGet('payments').filter(p => p.athlete_id === athleteId),
  getByMonth: (month, year) => lsGet('payments').filter(p => p.month === month && p.year === year),
  create: (data) => {
    const list = lsGet('payments')
    const item = { id: newId(), status: 'pending', ...data }
    lsSet('payments', [...list, item])
    return item
  },
  update: (id, data) => {
    const list = lsGet('payments').map(p => p.id === id ? { ...p, ...data } : p)
    lsSet('payments', list)
  },
  toggle: (id) => {
    const list = lsGet('payments').map(p => {
      if (p.id !== id) return p
      const paid = p.status === 'paid'
      return { ...p, status: paid ? 'pending' : 'paid', paid_at: paid ? null : new Date().toISOString() }
    })
    lsSet('payments', list)
  }
}

// ---- MESSAGES ----
export const Messages = {
  getGroup: (group) => lsGet('messages').filter(m => m.group === group).sort((a, b) => a.ts.localeCompare(b.ts)),
  send: (group, text, senderName = null) => {
    const list = lsGet('messages')
    const item = { id: newId(), group, sender: 'me', senderName, text, ts: new Date().toISOString() }
    lsSet('messages', [...list, item])
    return item
  }
}
