// Alertas de cansancio descartadas — persiste por session+athlete (no se resetea cada día)
const KEY = 'fatigue_dismissed_v2'

let _listeners = []
let _dismissed = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))

export function getDismissed() {
  return _dismissed
}

// id = `${athleteId}_${sessionId}` o simplemente athleteId si no hay sessionId
export function dismissFatigueAlert(athleteId, sessionId) {
  const id = sessionId ? `${athleteId}_${sessionId}` : athleteId
  _dismissed.add(id)
  // Limpiar entradas antiguas (más de 7 días) para no acumular indefinidamente
  localStorage.setItem(KEY, JSON.stringify([..._dismissed]))
  _listeners.forEach(fn => fn())
}

export function isFatigueDismissed(athleteId, sessionId) {
  const id = sessionId ? `${athleteId}_${sessionId}` : athleteId
  return _dismissed.has(id) || _dismissed.has(athleteId)
}

export function subscribeAlerts(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}
