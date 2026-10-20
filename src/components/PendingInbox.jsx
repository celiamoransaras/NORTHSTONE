import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { Sessions, isPendingPayment } from '../lib/db'
import { sendPushToAthletes } from '../lib/pushNotifications'
import { isTestOrRm } from '../lib/zones'
import { intakeComplete, intakeFlags } from './Intake'
import { useToast } from '../contexts/ToastContext'

const fmtDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }
const mondayKey = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d) }

// Avisos que ya has visto: se guardan en la base de datos (así valen en el móvil y en el ordenador)
const LS_KEY = 'ns_dismissed'
async function loadDismissed() {
  const { data, error } = await supabase.from('coach_dismissed').select('key')
  if (!error) {
    const keys = new Set((data || []).map(d => d.key))
    // Si alguna vez no se pudo guardar en la base de datos (sin conexión, lentitud...), se sube ahora
    try {
      const local = JSON.parse(localStorage.getItem(LS_KEY) || '[]').filter(k => !keys.has(k))
      if (local.length) {
        const { error: e2 } = await supabase.from('coach_dismissed').upsert(local.map(key => ({ key })), { onConflict: 'key' })
        if (!e2) localStorage.removeItem(LS_KEY)
      }
      local.forEach(k => keys.add(k))
    } catch { /* sin almacenamiento */ }
    return { keys, db: true }
  }
  try { return { keys: new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')), db: false } } catch { return { keys: new Set(), db: false } }
}
async function saveDismissed(keys, db) {
  if (!keys.length) return
  if (db) {
    const { error } = await supabase.from('coach_dismissed').upsert(keys.map(key => ({ key })), { onConflict: 'key' })
    if (!error) return
  }
  try {
    const cur = new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'))
    keys.forEach(k => cur.add(k))
    localStorage.setItem(LS_KEY, JSON.stringify([...cur].slice(-500)))
  } catch { /* sin almacenamiento */ }
}

// Acepta una petición de cambio: si la sesión es solo suya se mueve; si es de grupo,
// se le crea una copia en el nuevo día y se la quita de la original.
async function acceptChange(req) {
  const { data: s, error } = await supabase.from('sessions').select('*, exercises(*), session_athletes(athlete_id)').eq('id', req.session_id).single()
  if (error) throw error
  const others = (s.session_athletes || []).filter(x => x.athlete_id !== req.athlete_id)
  if (!others.length) {
    const { error: e2 } = await supabase.from('sessions').update({ date: req.to_date }).eq('id', s.id)
    if (e2) throw e2
  } else {
    const exercises = [...(s.exercises || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(e => ({ name: e.name, notes: e.notes, videos: e.videos || [] }))
    await Sessions.create({ title: s.title, date: req.to_date, type: s.type, duration: s.duration, notes: s.notes, exercises, athlete_ids: [req.athlete_id] })
    const { error: e3 } = await supabase.from('session_athletes').delete().eq('session_id', s.id).eq('athlete_id', req.athlete_id)
    if (e3) throw e3
  }
  const { error: e4 } = await supabase.from('session_change_requests').update({ status: 'accepted', resolved_at: new Date().toISOString() }).eq('id', req.id)
  if (e4) throw e4
}

export default function PendingInbox({ athleteMap = {} }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [busy, setBusy] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [dismissDb, setDismissDb] = useState(true)

  const load = useCallback(async () => {
    const athletes = Object.values(athleteMap)
    if (!athletes.length) return
    const active = athletes.filter(a => a.status !== 'inactive')
    const name = (id) => athleteMap[id]?.name || 'Deportista'
    const now = new Date()
    const [dismissed, reqs, intakes, comments, recs, recent, wellness, pays] = await Promise.all([
      loadDismissed(),
      supabase.from('session_change_requests').select('*, sessions(title)').eq('status', 'pending').order('created_at'),
      supabase.from('athlete_intake').select('*'),
      supabase.from('session_athletes').select('athlete_id, session_id, rpe_notes, coach_reply, sessions!inner(title, date)').not('rpe_notes', 'is', null).is('coach_reply', null).gte('sessions.date', daysAgo(14)),
      supabase.from('personal_records').select('athlete_id, name, date').gte('date', daysAgo(3)),
      supabase.from('session_athletes').select('athlete_id, attended, sessions!inner(date)').gte('sessions.date', daysAgo(7)).lte('sessions.date', ymd(now)),
      supabase.from('wellness').select('athlete_id').gte('date', daysAgo(7)),
      supabase.from('payments').select('athlete_id, amount, status').eq('month', now.getMonth() + 1).eq('year', now.getFullYear()),
    ])
    const out = []

    ;(reqs.data || []).filter(r => athleteMap[r.athlete_id]).forEach(r => out.push({
      key: 'req' + r.id, icon: '🔄', prio: 0, req: r,
      title: `${name(r.athlete_id)} pide mover «${r.sessions?.title || 'una sesión'}»`,
      sub: `${fmtDay(r.from_date)} → ${fmtDay(r.to_date)}${r.reason ? ` · ${r.reason}` : ''}`,
    }))

    if (!intakes.error) {
      const byId = Object.fromEntries((intakes.data || []).map(i => [i.athlete_id, i]))
      ;(intakes.data || []).filter(i => i.deletion_requested_at && athleteMap[i.athlete_id]).forEach(i => out.push({
        key: 'del' + i.athlete_id, icon: '🗑', prio: 0, go: () => navigate('/athletes', { state: { openAthlete: i.athlete_id } }),
        title: `${name(i.athlete_id)} pide la baja y el borrado de sus datos`, sub: `Desde el ${new Date(i.deletion_requested_at).toLocaleDateString('es-ES')}`,
      }))
      ;(intakes.data || []).filter(i => intakeComplete(i) && !i.coach_seen_at && athleteMap[i.athlete_id]).forEach(i => out.push({
        key: 'int:' + i.athlete_id + ':' + (i.updated_at || ''), seen: i.athlete_id, flags: intakeFlags(i), icon: intakeFlags(i).length ? '⚠️' : '📝', prio: intakeFlags(i).length ? 0 : 2, go: () => navigate('/athletes', { state: { openAthlete: i.athlete_id } }),
        title: `${name(i.athlete_id)} ha rellenado su cuestionario de alta`, sub: intakeFlags(i).length ? '⚠️ ' + intakeFlags(i).join(' · ') : 'Toca para verlo',
      }))
      const missing = active.filter(a => !intakeComplete(byId[a.id]))
      if (missing.length) out.push({
        key: 'missing:' + missing.map(a => a.id).sort().join(','), icon: '📋', prio: 4, go: () => navigate('/athletes'),
        title: `${missing.length} sin cuestionario de alta`, sub: missing.slice(0, 4).map(a => a.name.split(' ')[0]).join(', ') + (missing.length > 4 ? '…' : '') + ' · se les pedirá al entrar',
      })
    }

    ;(comments.data || []).filter(c => (c.rpe_notes || '').trim() && athleteMap[c.athlete_id]).forEach(c => out.push({
      key: 'com:' + c.session_id + ':' + c.athlete_id, icon: '💬', prio: 1, go: () => navigate('/training', { state: { openSessionId: c.session_id } }),
      title: `${name(c.athlete_id)} comentó «${c.sessions?.title}»`, sub: `“${c.rpe_notes.trim().slice(0, 80)}${c.rpe_notes.length > 80 ? '…' : ''}” · sin responder`,
    }))

    const newTests = {}, lastTest = {}
    ;(recs.data || []).filter(r => isTestOrRm(r.name) && athleteMap[r.athlete_id]).forEach(r => {
      (newTests[r.athlete_id] = newTests[r.athlete_id] || []).push(r.name.replace(/^test\s+|^rm\s+/i, ''))
      if (!lastTest[r.athlete_id] || r.date > lastTest[r.athlete_id]) lastTest[r.athlete_id] = r.date
    })
    Object.entries(newTests).forEach(([id, names]) => out.push({
      key: 'test:' + id + ':' + lastTest[id] + ':' + names.length, icon: '📈', prio: 3, go: () => navigate('/athletes', { state: { openAthlete: id } }),
      title: `${name(id)} ha registrado tests o RM`, sub: [...new Set(names)].join(', '),
    }))

    if (!recent.error) {
      const assigned = new Set((recent.data || []).map(r => r.athlete_id))
      const trained = new Set((recent.data || []).filter(r => r.attended).map(r => r.athlete_id))
      const checked = new Set((wellness.data || []).map(w => w.athlete_id))
      active.filter(a => assigned.has(a.id) && !trained.has(a.id) && !checked.has(a.id)).forEach(a => out.push({
        key: 'idle:' + a.id + ':' + mondayKey(), icon: '😶', prio: 2, go: () => navigate('/messages', { state: { chatId: a.id } }),
        title: `${a.name} lleva 7 días sin actividad`, sub: 'Ni entrenos marcados ni check-ins · escríbele',
      }))
    }

    const pending = (pays.data || []).filter(p => isPendingPayment(p) && athleteMap[p.athlete_id])
    if (pending.length) out.push({
      key: 'pay:' + (now.getMonth() + 1) + '-' + now.getFullYear() + ':' + pending.map(p => p.athlete_id).sort().join(','), icon: '💳', prio: 5, go: () => navigate('/payments'),
      title: `${pending.length} pago${pending.length > 1 ? 's' : ''} pendiente${pending.length > 1 ? 's' : ''} este mes`, sub: pending.slice(0, 4).map(p => name(p.athlete_id).split(' ')[0]).join(', '),
    })

    setDismissDb(dismissed.db)
    // Las peticiones de cambio y de baja necesitan una decisión: no se pueden descartar
    out.forEach(it => { it.closable = !it.key.startsWith('req') && !it.key.startsWith('del') })
    setItems(out.filter(it => !it.closable || !dismissed.keys.has(it.key)).sort((a, b) => a.prio - b.prio))
  }, [athleteMap, navigate])

  useEffect(() => { load() }, [load])

  const resolve = async (item, accept) => {
    setBusy(item.key)
    try {
      const r = item.req
      if (accept) await acceptChange(r)
      else {
        const { error } = await supabase.from('session_change_requests').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', r.id)
        if (error) throw error
      }
      sendPushToAthletes([r.athlete_id], accept
        ? { title: '✅ Entreno movido', body: `«${r.sessions?.title || 'Tu sesión'}» pasa al ${fmtDay(r.to_date)}`, url: '/?tab=training' }
        : { title: '📅 Tu entreno se queda como estaba', body: `«${r.sessions?.title || 'Tu sesión'}» sigue el ${fmtDay(r.from_date)}. Escríbele a Celia si lo necesitas`, url: '/?tab=messages' })
      toast(accept ? 'Sesión movida' : 'Petición rechazada')
      await load()
    } catch (e) {
      toast('No se pudo: ' + (e?.message || e), 'error')
    }
    setBusy(null)
  }

  const dismiss = async (list) => {
    const keys = list.filter(it => it.closable).map(it => it.key)
    if (!keys.length) return
    setItems(cur => cur.filter(it => !keys.includes(it.key)))
    await saveDismissed(keys, dismissDb)
    const seen = list.filter(it => it.seen).map(it => it.seen)
    if (seen.length) await supabase.from('athlete_intake').update({ coach_seen_at: new Date().toISOString() }).in('athlete_id', seen)
  }

  if (!items) return null
  const visible = showAll ? items : items.slice(0, 5)
  const closable = items.filter(it => it.closable)

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: items.length ? 8 : 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>📥 Pendientes</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {closable.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => { dismiss(closable); toast(`${closable.length} aviso${closable.length > 1 ? 's' : ''} marcado${closable.length > 1 ? 's' : ''} como visto${closable.length > 1 ? 's' : ''}`) }}
              style={{ fontSize: 12, padding: '4px 8px' }}>✓ Marcar todo como visto</button>
          )}
          {items.length > 0 && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 20 }}>{items.length}</span>}
        </div>
      </div>
      {items.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>✅ Todo al día</div>}
      {items.length > 0 && closable.length < items.length && closable.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Las peticiones de cambio de día y de baja se cierran al decidir.</div>
      )}
      {visible.map((it, i) => (
        <div key={it.key} onClick={it.go} role={it.go ? 'button' : undefined}
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none', cursor: it.go ? 'pointer' : 'default' }}>
          <span style={{ fontSize: 18, lineHeight: 1.2 }}>{it.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{it.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{it.sub}</div>
            {it.req && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === it.key} onClick={(e) => { e.stopPropagation(); resolve(it, true) }}>✓ Mover</button>
                <button className="btn btn-secondary btn-sm" disabled={busy === it.key} onClick={(e) => { e.stopPropagation(); resolve(it, false) }}>Dejar como está</button>
              </div>
            )}
          </div>
          {it.closable && (
            <button aria-label="Marcar como visto" title="Marcar como visto" onClick={(e) => { e.stopPropagation(); dismiss([it]) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 15, cursor: 'pointer', padding: '0 4px', lineHeight: 1.4 }}>✕</button>
          )}
          {it.go && <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</span>}
        </div>
      ))}
      {items.length > 5 && (
        <button className="btn btn-ghost btn-sm btn-full" onClick={() => setShowAll(s => !s)}>{showAll ? 'Ver menos' : `Ver los ${items.length}`}</button>
      )}
    </div>
  )
}
