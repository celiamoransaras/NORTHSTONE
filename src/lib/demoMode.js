// ─────────────────────────────────────────────
// MODO DEMO: para enseñar la app sin mostrar datos de clientas reales.
// Al activarlo (en este dispositivo), todas las lecturas se filtran para dejar solo
// las deportistas de ejemplo «(demo)» y Laura Demo. El chat de grupo se oculta.
// No borra ni cambia nada en la base de datos: al desactivarlo todo vuelve a verse.
// ─────────────────────────────────────────────
const FLAG = 'ns_demo', IDS = 'ns_demo_ids'

export const isDemoMode = () => { try { return localStorage.getItem(FLAG) === '1' } catch { return false } }
const allowedIds = () => { try { return new Set(JSON.parse(localStorage.getItem(IDS) || '[]')) } catch { return new Set() } }

export async function enableDemoMode(rawClient) {
  const { data, error } = await rawClient.from('athletes').select('id,name')
  if (error) throw error
  const ids = (data || []).filter(a => /\(demo\)\s*$/i.test(a.name || '') || /^laura demo/i.test(a.name || '')).map(a => a.id)
  if (!ids.length) throw new Error('No hay deportistas de demo')
  localStorage.setItem(IDS, JSON.stringify(ids))
  localStorage.setItem(FLAG, '1')
}
export function disableDemoMode() {
  try { localStorage.removeItem(FLAG); localStorage.removeItem(IDS) } catch { /* nada */ }
}

function filterRow(table, row, ok) {
  if (!row || typeof row !== 'object') return row
  if (table === 'athletes' && 'id' in row) return ok.has(row.id) ? row : null
  if (table === 'messages' || table === 'message_reactions') return ok.has(row.group_id) ? row : null
  if ('athlete_id' in row && row.athlete_id && !ok.has(row.athlete_id)) return null
  if (Array.isArray(row.session_athletes)) {
    const had = row.session_athletes.length
    const sa = row.session_athletes.filter(x => !x?.athlete_id || ok.has(x.athlete_id))
    if ((had || table === 'sessions') && !sa.length) return null
    row = { ...row, session_athletes: sa }
  }
  if (Array.isArray(row.athlete_ids)) row = { ...row, athlete_ids: row.athlete_ids.filter(id => ok.has(id)) }
  return row
}
function filterResult(table, res) {
  if (!res || res.error || res.data == null) return res
  const ok = allowedIds()
  if (Array.isArray(res.data)) return { ...res, data: res.data.map(r => filterRow(table, r, ok)).filter(Boolean) }
  return { ...res, data: filterRow(table, res.data, ok) }
}

function wrap(builder, table) {
  const proxy = new Proxy(builder, {
    get(target, prop) {
      if (prop === 'then') return (onOk, onErr) => target.then(r => { const f = filterResult(table, r); return onOk ? onOk(f) : f }, onErr)
      const v = target[prop]
      if (typeof v !== 'function') return v
      return (...args) => {
        const out = v.apply(target, args)
        if (out === target) return proxy
        if (out && typeof out === 'object' && typeof out.then === 'function') return wrap(out, table)
        return out
      }
    },
  })
  return proxy
}

// Envuelve el cliente: solo actúa si el modo demo está activo en este dispositivo
export function applyDemoMode(client) {
  if (!isDemoMode()) return client
  const from = client.from.bind(client)
  client.from = (table) => wrap(from(table), table)
  client.__rawFrom = from
  return client
}
