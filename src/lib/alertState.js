// Estado compartido de alertas descartadas (persiste entre navegaciones)
const KEY = `fatigue_dismissed_${new Date().toISOString().slice(0,10)}`

let _listeners = []
let _dismissed = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))

export function getDismissed() {
  return _dismissed
}

export function dismissFatigueAlert(athleteId) {
  _dismissed.add(athleteId)
  localStorage.setItem(KEY, JSON.stringify([..._dismissed]))
  _listeners.forEach(fn => fn())
}

export function subscribeAlerts(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }
}
