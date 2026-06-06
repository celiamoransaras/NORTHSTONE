export const initials = (name) =>
  name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

export const fmtDate = (dateStr, opts) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', opts || { day: 'numeric', month: 'short', year: 'numeric' })

export const today = () => new Date().toISOString().slice(0, 10)

export const fmtShortDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export const TYPE_COLORS = {
  run: '#10B981', fuerza: '#F59E0B', series: '#EF4444', endurance: '#3B82F6',
  especifico: '#8B5CF6', ergometros: '#14B8A6', cardio: '#EC4899', rest_day: '#9CA3AF',
  strength: '#F59E0B', flexibility: '#10B981', mixed: '#9CA3AF',
}

export const TYPE_ICONS = {
  run: '🏃', fuerza: '💪', series: '⚡', endurance: '🫁', especifico: '🎯',
  ergometros: '🚣', cardio: '❤️', rest_day: '😴', strength: '💪', flexibility: '🧘', mixed: '⚡',
}

export const TYPE_LABELS = {
  run: 'Run', fuerza: 'Fuerza', series: 'Series', endurance: 'Endurance',
  especifico: 'Específico', ergometros: 'Ergómetros', cardio: 'Cardio',
  rest_day: 'Rest Day', strength: 'Fuerza', flexibility: 'Flexibilidad', mixed: 'Mixta',
}
