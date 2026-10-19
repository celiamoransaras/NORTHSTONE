// Fecha local en formato YYYY-MM-DD.
// No usar toISOString().slice(0,10): devuelve la fecha en UTC y en España,
// entre las 00:00 y las 02:00, da el día anterior.
export const ymd = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d)
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}
