import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'
import { blockLines, matchExercise, keyForLine, guessKind, parseScheme, cleanSets, summarize, bestOf, fmtBest, fmtClock } from '../lib/exercises'
import { LIFTS, latestRMs, roundLoad, fmtKg } from '../lib/zones'
import { notifyRecordsChanged } from './ZonesPanel'
import { ExerciseInfoSheet } from './Exercises'

// ─────────────────────────────────────────────
// REGISTRO DE SERIES, PESOS Y TIEMPOS
// La deportista apunta cada línea de su entreno; detecta récords y actualiza su RM estimado.
// ─────────────────────────────────────────────
export async function loadSessionLogs(sessionId, athleteId) {
  let q = supabase.from('workout_logs').select('*').eq('session_id', sessionId)
  if (athleteId) q = q.eq('athlete_id', athleteId)
  const { data, error } = await q
  return error ? null : (data || [])
}
const logKey = (b, l) => `${b}:${l}`
const Portal = ({ children }) => createPortal(children, document.body)

// Bloque de la sesión con sus líneas apuntables
export function LoggableBlock({ block, blockIdx, logs, library, canLog, onLog, mutedNote }) {
  const [info, setInfo] = useState(null)
  const lines = blockLines(block.notes)
  if (!lines.length) return block.notes ? <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>{block.notes}</div> : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map((line, li) => {
        const ex = matchExercise(line, library)
        const log = logs?.[logKey(blockIdx, li)]
        const summary = log ? summarize(log.sets, log.kind) : ''
        return (
          <div key={li} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderTop: li ? '1px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>{line}</div>
              {summary && <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>✓ {summary}{log.notes ? ` · ${log.notes}` : ''}</div>}
            </div>
            {ex && (
              <button type="button" onClick={() => setInfo(ex)} aria-label={`Técnica de ${ex.name}`} title="Ver técnica y vídeo"
                style={{ minWidth: 40, minHeight: 40, borderRadius: 20, border: 'none', background: 'none', color: 'var(--accent)', fontSize: 18, cursor: 'pointer' }}>ⓘ</button>
            )}
            {canLog && (
              <button type="button" onClick={() => onLog({ blockIdx, lineIdx: li, line, ex, log })}
                style={{ minHeight: 36, padding: '6px 12px', borderRadius: 18, border: `1.5px solid ${log ? 'var(--success)' : 'var(--accent)'}`, background: log ? 'var(--success-dim)' : 'var(--accent-dim)', color: log ? 'var(--success)' : 'var(--accent)', fontWeight: 800, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                {log ? 'Editar' : '+ Apuntar'}
              </button>
            )}
          </div>
        )
      })}
      {mutedNote && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{mutedNote}</div>}
      {info && <ExerciseInfoSheet ex={info} onClose={() => setInfo(null)} />}
    </div>
  )
}

// Hook para la deportista: carga sus registros de la sesión y abre el editor
export function useSessionLog(session, athleteId) {
  const [logs, setLogs] = useState(null)
  const [editing, setEditing] = useState(null)
  useEffect(() => {
    if (!session?.id || !athleteId) return
    let alive = true
    loadSessionLogs(session.id, athleteId).then(list => {
      if (!alive) return
      setLogs(list === null ? false : Object.fromEntries(list.map(l => [logKey(l.block_idx, l.line_idx), l])))
    })
    return () => { alive = false }
  }, [session?.id, athleteId])
  const onSaved = (row) => setLogs(prev => ({ ...(prev || {}), [logKey(row.block_idx, row.line_idx)]: row }))
  const onDeleted = (b, l) => setLogs(prev => { const n = { ...(prev || {}) }; delete n[logKey(b, l)]; return n })
  return { logs, available: logs !== false, editing, setEditing, onSaved, onDeleted }
}

// ─────────────────────────────────────────────
// REGISTRO RÁPIDO: "Hecho tal cual estaba planificado"
// Apunta de una vez cada línea con series × reps (y kilos si dice "% RM" y hay RM)
// o con distancia; luego la deportista edita solo lo que cambió.
// ─────────────────────────────────────────────
const distOf = (line) => {
  const m = String(line).toLowerCase().match(/(\d+(?:[.,]\d+)?)\s?(km|m|metros)\b/)
  if (!m) return null
  const v = Number(m[1].replace(',', '.'))
  return m[2] === 'km' ? Math.round(v * 1000) : Math.round(v)
}
const kgOf = (line) => { const m = String(line).toLowerCase().match(/(\d+(?:[.,]\d+)?)\s?kg\b/); return m ? Number(m[1].replace(',', '.')) : null }

export function plannedSets(line, ex, rms = {}) {
  const scheme = parseScheme(line)
  // "3x500 m", "4 x 1 km": series de distancia, se apuntan como tiempo + metros
  const distScheme = /[x×]\s?\d+(?:[.,]\d+)?\s?(km|m|metros)\b/i.test(line)
  const guessed = guessKind(line, ex)
  const kind = distScheme && guessed !== 'carry' ? 'time' : guessed
  const lift = LIFTS.find(l => l.re.test(line))
  const pct = String(line).match(/(\d{2,3})\s?%/)
  const rm = lift ? rms[lift.name.toLowerCase()] : null
  const kg = kgOf(line) ?? (pct && rm ? roundLoad(rm.value * Number(pct[1]) / 100) : null)
  const dist = distOf(line)
  if ((kind === 'strength' || kind === 'reps') && scheme) {
    return { kind, sets: Array.from({ length: scheme.sets }, () => ({ kg: kind === 'strength' ? kg : null, reps: scheme.reps, time: null, dist: null })) }
  }
  if ((kind === 'time' || kind === 'carry') && dist) {
    const n = scheme?.sets || 1
    return { kind, sets: Array.from({ length: Math.min(n, 12) }, () => ({ kg: kind === 'carry' ? kg : null, reps: null, time: null, dist })) }
  }
  return null
}

export function QuickLogButton({ session, athleteId, library, logs, onSaved, onMarkDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const pending = useMemo(() => {
    const out = []
    ;(session?.exercises || []).forEach((block, b) => blockLines(block.notes).forEach((line, l) => {
      if (logs?.[logKey(b, l)]) return
      out.push({ b, l, line, ex: matchExercise(line, library) })
    }))
    return out
  }, [session, logs, library])
  const plannable = pending.filter(p => plannedSets(p.line, p.ex))
  if (!session || !plannable.length) return null

  const run = async () => {
    setBusy(true)
    const { data: recs } = await supabase.from('personal_records').select('*').eq('athlete_id', athleteId)
    const rms = latestRMs(recs || [])
    const rows = []
    pending.forEach(({ b, l, line, ex }) => {
      const plan = plannedSets(line, ex, rms)
      if (!plan) return
      rows.push({
        session_id: session.id, athlete_id: athleteId, block_idx: b, line_idx: l, line_text: line,
        exercise_key: keyForLine(line, ex), exercise_name: ex?.name || line.slice(0, 80), kind: plan.kind, sets: plan.sets,
        notes: 'Como estaba planificado', date: session.date || ymd(new Date()), updated_at: new Date().toISOString(),
      })
    })
    const { data, error } = await supabase.from('workout_logs').upsert(rows, { onConflict: 'session_id,athlete_id,block_idx,line_idx' }).select()
    setBusy(false)
    if (error) { toast('No se pudo apuntar: ' + error.message, 'error'); return }
    ;(data || rows).forEach(r => onSaved(r))
    haptic('success')
    const left = pending.length - rows.length
    toast(`✓ ${rows.length} ejercicio${rows.length === 1 ? '' : 's'} apuntado${rows.length === 1 ? '' : 's'}${left ? ` · ${left} sin datos para apuntar a mano` : ''}. Cambia solo lo que hiciste distinto.`)
    onMarkDone?.()
  }

  return (
    <button type="button" className="btn btn-primary btn-full" onClick={run} disabled={busy}
      style={{ marginBottom: 12, minHeight: 48 }}>
      {busy ? 'Apuntando…' : `✓ Lo hice tal cual estaba (${plannable.length} ejercicio${plannable.length === 1 ? '' : 's'})`}
    </button>
  )
}

const blankSet = (kind) => ({ kg: '', reps: '', time: '', dist: '' })

export function LogSheet({ session, athleteId, target, onClose, onSaved, onDeleted }) {
  const toast = useToast()
  const { line, ex, log, blockIdx, lineIdx } = target
  const [kind, setKind] = useState(log?.kind || guessKind(line, ex))
  const scheme = parseScheme(line)
  const [rmHint, setRmHint] = useState(null)
  const [sets, setSets] = useState(() => {
    if (log?.sets?.length) return log.sets.map(s => ({ kg: s.kg ?? '', reps: s.reps ?? '', time: s.time ? fmtClock(s.time) : '', dist: s.dist ?? '' }))
    const n = scheme?.sets || 1
    return Array.from({ length: n }, () => ({ ...blankSet(), reps: scheme && kind !== 'time' ? String(scheme.reps) : '' }))
  })
  const [notes, setNotes] = useState(log?.notes || '')
  const [saving, setSaving] = useState(false)

  // Sugerencia de kilos si la línea dice "al 75%" y tiene RM de ese ejercicio
  useEffect(() => {
    const pct = String(line).match(/(\d{2,3})\s?%/)
    const lift = LIFTS.find(l => l.re.test(line))
    if (!pct || !lift || log) return
    supabase.from('personal_records').select('*').eq('athlete_id', athleteId).then(({ data }) => {
      const rm = latestRMs(data || [])[lift.name.toLowerCase()]
      if (rm) {
        const kg = roundLoad(rm.value * Number(pct[1]) / 100)
        setRmHint(`${pct[1]} % de tu RM = ${fmtKg(kg)}`)
        setSets(ss => ss.map(s => s.kg ? s : { ...s, kg: String(kg) }))
      }
    })
  }, []) // eslint-disable-line

  const upd = (i, k, v) => setSets(ss => ss.map((s, j) => j === i ? { ...s, [k]: v } : s))
  const addSet = () => setSets(ss => [...ss, { ...(ss[ss.length - 1] || blankSet()) }])
  const delSet = (i) => setSets(ss => ss.length > 1 ? ss.filter((_, j) => j !== i) : ss)

  const save = async () => {
    const clean = cleanSets(sets, kind)
    if (!clean.length) { toast('Apunta al menos una serie', 'error'); return }
    setSaving(true)
    const exKey = keyForLine(line, ex)
    const row = {
      session_id: session.id, athlete_id: athleteId, block_idx: blockIdx, line_idx: lineIdx,
      line_text: line, exercise_key: exKey, exercise_name: ex?.name || line.slice(0, 80), kind, sets: clean,
      notes: notes.trim() || null, date: session.date || ymd(new Date()), updated_at: new Date().toISOString(),
    }
    // Historial de este ejercicio (para detectar récord)
    const { data: prev } = await supabase.from('workout_logs').select('sets, kind, date, session_id, block_idx, line_idx')
      .eq('athlete_id', athleteId).eq('exercise_key', exKey)
    const { data: saved, error } = await supabase.from('workout_logs').upsert(row, { onConflict: 'session_id,athlete_id,block_idx,line_idx' }).select().single()
    if (error) { setSaving(false); toast('No se pudo guardar: ' + error.message, 'error'); return }

    const mine = bestOf(clean, kind)
    const others = (prev || []).filter(p => !(p.session_id === session.id && p.block_idx === blockIdx && p.line_idx === lineIdx) && p.kind === kind)
      .map(p => bestOf(p.sets, p.kind)).filter(Boolean)
    let msg = 'Apuntado'
    if (mine && others.length) {
      const prevBest = mine.higher ? Math.max(...others.map(o => o.value)) : Math.min(...others.map(o => o.value))
      if (mine.higher ? mine.value > prevBest : mine.value < prevBest) { msg = `🎉 ¡Nuevo récord en ${ex?.name || 'este ejercicio'}! ${fmtBest(mine)}`; haptic('success') }
    }
    // Si es un levantamiento con RM, actualizar el RM estimado cuando lo supera
    const lift = kind === 'strength' ? LIFTS.find(l => l.re.test(line)) : null
    if (lift && mine) {
      const { data: recs } = await supabase.from('personal_records').select('*').eq('athlete_id', athleteId)
      const rm = latestRMs(recs || [])[lift.name.toLowerCase()]
      if (!rm || mine.value > rm.value) {
        const top = clean.filter(s => s.kg && s.reps && s.reps <= 12).sort((a, b) => b.kg * (1 + b.reps / 30) - a.kg * (1 + a.reps / 30))[0]
        const { error: e2 } = await supabase.from('personal_records').insert({ athlete_id: athleteId, name: `RM ${lift.name}`, value: mine.value, unit: 'kg', date: row.date, notes: `Estimado con ${top.reps} × ${String(top.kg).replace('.', ',')} kg en tu entreno` })
        if (!e2) { notifyRecordsChanged(athleteId); msg = `💪 Tu RM de ${lift.name.toLowerCase()} sube a ${fmtKg(mine.value)}` + (msg.startsWith('🎉') ? ' · ¡récord!' : '') }
      }
    }
    setSaving(false)
    toast(msg)
    onSaved(saved || row)
    onClose()
  }

  const remove = async () => {
    if (!log?.id) return
    await supabase.from('workout_logs').delete().eq('id', log.id)
    onDeleted?.(blockIdx, lineIdx); onClose()
  }

  const showKg = kind === 'strength' || kind === 'carry'
  const showReps = kind === 'strength' || kind === 'reps'
  const showTime = kind === 'time' || kind === 'carry'
  const cell = { flex: 1, minWidth: 0 }

  return (
    <Portal>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2000 }} />
      <div className="sheet" style={{ zIndex: 2001 }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ex?.name || 'Apuntar'}</div>
            <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</h3>
          </div>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['strength', 'Kilos × reps'], ['reps', 'Solo reps'], ['time', 'Tiempo'], ['carry', 'Kilos + distancia']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                style={{ padding: '6px 12px', minHeight: 36, borderRadius: 18, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${kind === k ? 'var(--accent)' : 'var(--border)'}`, background: kind === k ? 'var(--accent-dim)' : 'var(--card)', color: kind === k ? 'var(--accent)' : 'var(--text-muted)' }}>{l}</button>
            ))}
          </div>
          {rmHint && <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 10, background: 'var(--accent-dim)', marginBottom: 10 }}>🎯 {rmHint}</div>}

          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 2px 4px' }}>
            <span style={{ width: 28 }}>#</span>
            {showKg && <span style={cell}>Kg</span>}
            {showReps && <span style={cell}>Reps</span>}
            {showTime && <span style={cell}>Tiempo</span>}
            {showTime && <span style={cell}>Metros</span>}
            <span style={{ width: 40 }} />
          </div>
          {sets.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ width: 28, fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</span>
              {showKg && <input className="input" style={cell} inputMode="decimal" placeholder="kg" value={s.kg} onChange={e => upd(i, 'kg', e.target.value)} />}
              {showReps && <input className="input" style={cell} inputMode="numeric" placeholder="reps" value={s.reps} onChange={e => upd(i, 'reps', e.target.value)} />}
              {showTime && <input className="input" style={cell} inputMode="text" placeholder="3:45" value={s.time} onChange={e => upd(i, 'time', e.target.value)} />}
              {showTime && <input className="input" style={cell} inputMode="numeric" placeholder="m" value={s.dist} onChange={e => upd(i, 'dist', e.target.value)} />}
              <button type="button" onClick={() => delSet(i)} disabled={sets.length === 1} aria-label={`Quitar serie ${i + 1}`}
                style={{ width: 40, height: 40, border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', opacity: sets.length === 1 ? 0.3 : 1 }}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addSet}>+ Otra serie (copia la anterior)</button>
          <div className="input-group" style={{ marginTop: 10 }}>
            <label className="input-label">Nota (opcional)</label>
            <input className="input" placeholder="Ej.: la última me costó, bajé peso..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          {log?.id && <button className="btn btn-ghost btn-full" style={{ marginTop: 8, color: 'var(--error)' }} onClick={remove}>Borrar lo apuntado</button>}
        </div>
      </div>
    </Portal>
  )
}

// ─────────────────────────────────────────────
// Entrenadora: resultados de una sesión por deportista
// ─────────────────────────────────────────────
export function SessionResults({ session, athletes = [] }) {
  const [logs, setLogs] = useState(null)
  useEffect(() => {
    if (!session?.id) return
    loadSessionLogs(session.id).then(setLogs)
  }, [session?.id])
  if (!logs || !logs.length) return null
  const byAthlete = {}
  logs.forEach(l => { (byAthlete[l.athlete_id] = byAthlete[l.athlete_id] || []).push(l) })
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-title" style={{ marginTop: 0 }}>📋 Lo que han apuntado</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(byAthlete).map(([id, list]) => {
          const a = athletes.find(x => x.id === id)
          return (
            <div key={id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a?.color || 'var(--accent)' }} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{a?.name || 'Deportista'}</span>
              </div>
              {list.sort((x, y) => x.block_idx - y.block_idx || x.line_idx - y.line_idx).map(l => (
                <div key={l.id} style={{ display: 'flex', gap: 10, padding: '5px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)' }}>{l.line_text}</span>
                  <span style={{ fontWeight: 800, textAlign: 'right' }}>{summarize(l.sets, l.kind)}{l.notes ? <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>{l.notes}</div> : null}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Evolución por ejercicio (ficha de la deportista y su Progreso)
// ─────────────────────────────────────────────
export function ExerciseProgress({ athleteId, title = '📈 Evolución por ejercicio' }) {
  const [logs, setLogs] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => {
    supabase.from('workout_logs').select('*').eq('athlete_id', athleteId).order('date', { ascending: true })
      .then(({ data, error }) => setLogs(error ? false : (data || [])))
  }, [athleteId])
  const groups = useMemo(() => {
    const g = {}
    ;(logs || []).forEach(l => {
      const b = bestOf(l.sets, l.kind)
      if (!b) return
      const k = l.exercise_key + '|' + l.kind
      ;(g[k] = g[k] || { name: l.exercise_name, kind: l.kind, points: [] }).points.push({ date: l.date, best: b })
    })
    return Object.values(g).sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name))
  }, [logs])
  if (!logs || !groups.length) return null

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Lo apuntado en los entrenos · toca para ver la evolución</div>
      {groups.slice(0, 20).map((g, i) => {
        const pts = g.points
        const higher = pts[0].best.higher
        const vals = pts.map(p => p.best.value)
        const best = higher ? Math.max(...vals) : Math.min(...vals)
        const last = pts[pts.length - 1]
        const first = pts[0]
        const improved = pts.length > 1 && (higher ? last.best.value > first.best.value : last.best.value < first.best.value)
        const isOpen = open === i
        return (
          <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', minHeight: 48, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pts.length} registro{pts.length > 1 ? 's' : ''} · mejor {fmtBest({ ...pts[0].best, value: best })}{improved ? ' · ↑ mejorando' : ''}</div>
              </div>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--accent)' }}>{fmtBest(last.best)}</span>
            </button>
            {isOpen && pts.length > 1 && <MiniChart points={pts} higher={higher} />}
            {isOpen && pts.length === 1 && <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 10 }}>Con un registro más verás la gráfica.</div>}
          </div>
        )
      })}
    </div>
  )
}

function MiniChart({ points, higher }) {
  const W = 300, H = 90, pad = 12
  const vals = points.map(p => p.best.value)
  const mn = Math.min(...vals), mx = Math.max(...vals), range = mx - mn || 1
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1)
  // En tiempos, más abajo es peor: se invierte para que "subir" sea mejorar
  const y = (v) => { const r = (v - mn) / range; return H - pad - (higher ? r : 1 - r) * (H - pad * 2) }
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.best.value).toFixed(1)}`).join(' ')
  return (
    <div style={{ paddingBottom: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Evolución">
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.best.value)} r="3.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="2" />)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{new Date(points[0].date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {fmtBest(points[0].best)}</span>
        <span>{new Date(points[points.length - 1].date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {fmtBest(points[points.length - 1].best)}</span>
      </div>
    </div>
  )
}
