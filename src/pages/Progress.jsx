import { useState, useEffect } from 'react'
import { Records, Goals, Wellness } from '../lib/db'
import { supabase } from '../lib/supabase'

// ---- Gráfica de carga semanal (SVG) ----
function LoadChart({ sessions }) {
  const weeks = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const count = sessions.filter(s => {
      const sd = new Date(s.date + 'T12:00:00')
      return sd >= weekStart && sd <= weekEnd
    }).length
    const label = `${weekStart.getDate()}/${weekStart.getMonth()+1}`
    weeks.push({ label, count })
  }

  const max = Math.max(...weeks.map(w => w.count), 1)
  const W = 280, H = 100, barW = 26, gap = 8
  const totalW = weeks.length * (barW + gap)
  const offsetX = (W - totalW) / 2

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Carga semanal</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible' }}>
        {weeks.map((w, i) => {
          const barH = max > 0 ? (w.count / max) * H : 0
          const x = offsetX + i * (barW + gap)
          const y = H - barH
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH || 2}
                rx={4} fill={w.count > 0 ? 'var(--accent)' : 'var(--border)'} opacity={w.count > 0 ? 1 : 0.5} />
              {w.count > 0 && (
                <text x={x + barW/2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent)">{w.count}</text>
              )}
              <text x={x + barW/2} y={H + 16} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{w.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---- Marcas personales ----
function RecordsSection({ athleteId, canEdit }) {
  const [records, setRecords] = useState([])
  const [sheet, setSheet] = useState(false)
  const [editing, setEditing] = useState(null)
  const emptyForm = { name: '', value: '', unit: 'min', date: new Date().toISOString().slice(0,10), notes: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const UNITS = ['min', 'seg', 'kg', 'km', 'rep', 'cm', 'w', 'm']

  useEffect(() => { Records.getByAthlete(athleteId).then(setRecords) }, [athleteId])

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.name]) acc[r.name] = []
    acc[r.name].push(r)
    return acc
  }, {})

  const openNew = () => { setEditing(null); setForm(emptyForm); setSheet(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ name: r.name, value: String(r.value), unit: r.unit, date: r.date, notes: r.notes || '' }); setSheet(true) }

  const save = async () => {
    if (!form.name || !form.value) return
    setSaving(true)
    if (editing) {
      await Records.update(editing, { ...form, value: parseFloat(form.value) })
    } else {
      await Records.create({ ...form, value: parseFloat(form.value), athlete_id: athleteId })
    }
    const updated = await Records.getByAthlete(athleteId)
    setRecords(updated)
    setSaving(false)
    setSheet(false)
    setForm(emptyForm)
    setEditing(null)
  }

  const del = async (id) => {
    await Records.delete(id)
    setRecords(r => r.filter(x => x.id !== id))
    setSheet(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>🏆 Marcas personales</div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva</button>}
      </div>

      {records.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 0' }}>Sin marcas registradas aún</div>
      ) : Object.entries(grouped).map(([name, recs]) => {
        const best = recs[0]
        return (
          <div key={name} className="card" style={{ padding: '14px 16px', marginBottom: 8, cursor: canEdit ? 'pointer' : 'default' }}
            onClick={() => canEdit && openEdit(best)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                  {recs.length} registro{recs.length > 1 ? 's' : ''} · {new Date(best.date+'T12:00:00').toLocaleDateString('es-ES')}
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, color: 'var(--accent)' }}>{best.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{best.unit}</div>
                </div>
                {canEdit && <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>✏️</span>}
              </div>
            </div>
            {recs.length > 1 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {recs.slice(1, 4).map(r => (
                  <span key={r.id} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 6 }}>
                    {r.value} {r.unit} · {new Date(r.date+'T12:00:00').toLocaleDateString('es-ES')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {sheet && (
        <>
          <div className="overlay" onClick={() => setSheet(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar marca' : 'Nueva marca'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <button className="btn btn-danger btn-sm" onClick={() => del(editing)}>🗑</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)}>✕</button>
              </div>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Ejercicio / Prueba *</label>
                <input className="input" placeholder="ej. 5k, Sentadilla, Peso corporal" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Valor *</label>
                  <input className="input" type="number" step="0.01" placeholder="25.30" value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))} />
                </div>
                <div style={{ width: 100 }} className="input-group">
                  <label className="input-label">Unidad</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
              </div>
              <div className="input-group">
                <label className="input-label">Notas</label>
                <input className="input" placeholder="Condiciones, observaciones..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar marca'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Objetivos ----
function GoalsSection({ athleteId, canCreate }) {
  const [goals, setGoals] = useState([])
  const [sheet, setSheet] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', target_value: '', current_value: '', unit: '', deadline: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { Goals.getByAthlete(athleteId).then(setGoals) }, [athleteId])

  const save = async () => {
    if (!form.title) return
    setSaving(true)
    await Goals.create({
      ...form,
      athlete_id: athleteId,
      target_value: parseFloat(form.target_value) || null,
      current_value: parseFloat(form.current_value) || null,
      deadline: form.deadline || null,
      description: form.description || null,
      unit: form.unit || null,
    })
    const updated = await Goals.getByAthlete(athleteId)
    setGoals(updated)
    setSaving(false)
    setSheet(false)
    setForm({ title: '', description: '', target_value: '', current_value: '', unit: '', deadline: '' })
  }

  const toggle = async (goal) => {
    await Goals.update(goal.id, { completed: !goal.completed })
    setGoals(g => g.map(x => x.id === goal.id ? {...x, completed: !x.completed} : x))
  }

  const del = async (id) => {
    await Goals.delete(id)
    setGoals(g => g.filter(x => x.id !== id))
  }

  const progress = (g) => {
    if (!g.target_value || !g.current_value) return null
    return Math.min(100, Math.round((g.current_value / g.target_value) * 100))
  }

  const CircleProgress = ({ pct, color, size = 56 }) => {
    const r = (size - 8) / 2
    const circ = 2 * Math.PI * r
    const dash = (pct / 100) * circ
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}
          fontSize="11" fontWeight="800" fill={color} fontFamily="'Barlow Condensed', sans-serif">
          {pct}%
        </text>
      </svg>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>🎯 Objetivos</div>
        {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setSheet(true)}>+ Nuevo</button>}
      </div>

      {goals.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 0' }}>Sin objetivos definidos aún</div>
      ) : goals.map(g => {
        const pct = progress(g)
        return (
          <div key={g.id} className="card" style={{ padding: '14px 16px', marginBottom: 8, opacity: g.completed ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div onClick={() => toggle(g)} style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${g.completed ? 'var(--success)' : 'var(--border)'}`, background: g.completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {g.completed && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, textDecoration: g.completed ? 'line-through' : 'none' }}>{g.title}</span>
                </div>
                {g.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginLeft: 30 }}>{g.description}</div>}
                {pct !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <CircleProgress pct={pct} color={pct >= 100 ? 'var(--success)' : 'var(--accent)'} />
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      <div>{g.current_value} <span style={{ color: 'var(--text-dim)' }}>/ {g.target_value} {g.unit}</span></div>
                      {g.deadline && <div style={{ fontSize: 12, marginTop: 2 }}>📅 {new Date(g.deadline+'T12:00:00').toLocaleDateString('es-ES')}</div>}
                    </div>
                  </div>
                )}
                {g.deadline && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>📅 Fecha límite: {new Date(g.deadline+'T12:00:00').toLocaleDateString('es-ES')}</div>}
              </div>
              {canCreate && <button onClick={() => del(g.id)} style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>}
            </div>
          </div>
        )
      })}

      {sheet && (
        <>
          <div className="overlay" onClick={() => setSheet(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>Nuevo objetivo</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)}>✕</button>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Objetivo *</label>
                <input className="input" placeholder="ej. Correr 10k en menos de 50 min" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción</label>
                <textarea className="input" placeholder="Detalles del objetivo..." value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Valor actual</label>
                  <input className="input" type="number" step="0.01" placeholder="0" value={form.current_value} onChange={e => setForm(f => ({...f, current_value: e.target.value}))} />
                </div>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Meta</label>
                  <input className="input" type="number" step="0.01" placeholder="10" value={form.target_value} onChange={e => setForm(f => ({...f, target_value: e.target.value}))} />
                </div>
                <div style={{ width: 80 }} className="input-group">
                  <label className="input-label">Unidad</label>
                  <input className="input" placeholder="km" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha límite</label>
                <input className="input" type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Wellness check-in ----
function WellnessCheckin({ athleteId }) {
  const [today, setToday] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    Wellness.getToday(athleteId).then(d => {
      if (d) { setToday(d); setDone(true) }
    })
  }, [athleteId])

  const set = (key, val) => setToday(t => ({ ...t, [key]: val }))

  const save = async () => {
    if (!today?.fatigue || !today?.soreness || !today?.mood) return
    setSaving(true)
    await Wellness.upsert({ athlete_id: athleteId, date: new Date().toISOString().slice(0,10), ...today })
    setSaving(false)
    setDone(true)
  }

  const OPTS = [1, 2, 3, 4, 5]
  const EmojiRow = ({ label, field, emojis }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPTS.map((v, i) => (
          <button key={v} onClick={() => !done && set(field, v)}
            style={{ flex: 1, padding: '10px 4px', borderRadius: 10, background: today?.[field] === v ? 'var(--accent)' : 'var(--bg)', border: `2px solid ${today?.[field] === v ? 'var(--accent)' : 'var(--border)'}`, fontSize: 20, cursor: done ? 'default' : 'pointer', transition: 'all 0.15s' }}>
            {emojis[i]}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="card" style={{ padding: 16, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>😴 Estado de hoy</div>
        {done && <span className="badge badge-green">✓ Registrado</span>}
      </div>
      <EmojiRow label="Cansancio" field="fatigue" emojis={['😴','😐','🙂','💪','🔥']} />
      <EmojiRow label="Dolor muscular" field="soreness" emojis={['✅','😊','😐','😬','🤕']} />
      <EmojiRow label="Ánimo" field="mood" emojis={['😔','😐','🙂','😄','🤩']} />
      {!done && (
        <button className="btn btn-primary btn-full" onClick={save} disabled={saving || !today?.fatigue}>
          {saving ? 'Guardando...' : 'Registrar estado'}
        </button>
      )}
      {done && today?.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{today.notes}</div>}
    </div>
  )
}

// ---- Stats rápidas ----
function StatsHeader({ athleteId, sessions }) {
  const [avgRpe, setAvgRpe] = useState(null)
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const sessionsThisMonth = sessions.filter(s => s.date.startsWith(monthStr))
  const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  useEffect(() => {
    supabase.from('session_athletes').select('rpe').eq('athlete_id', athleteId).not('rpe', 'is', null)
      .then(({ data }) => {
        if (data?.length) setAvgRpe((data.reduce((a, r) => a + r.rpe, 0) / data.length).toFixed(1))
      })
  }, [athleteId])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {[
        { value: sessionsThisMonth.length, label: 'Este mes', color: 'var(--accent)' },
        { value: hours > 0 ? `${hours}h` : `${mins}m`, label: 'Tiempo total', color: 'var(--success)' },
        { value: avgRpe ?? '—', label: 'RPE medio', color: 'var(--error)' },
      ].map(({ value, label, color }) => (
        <div key={label} className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, color, letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.5px' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ---- Historial bienestar (14 días) ----
function WellnessHistory({ athleteId }) {
  const [data, setData] = useState([])

  useEffect(() => {
    Wellness.getByAthlete(athleteId, 14).then(d => setData([...d].reverse()))
  }, [athleteId])

  if (!data.length) return null

  const W = 300, H = 60
  const FIELDS = [
    { key: 'mood', color: '#2563EB', label: 'Ánimo' },
    { key: 'fatigue', color: '#EF4444', label: 'Cansancio' },
  ]

  const toX = (i) => (i / (data.length - 1)) * W
  const toY = (v) => H - ((v - 1) / 4) * H

  const pathFor = (field) => data.map((d, i) => {
    const x = toX(i), y = d[field] ? toY(d[field]) : null
    if (y === null) return null
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).filter(Boolean).join(' ')

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>Historial de bienestar (14 días)</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        {FIELDS.map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: f.color }} />
            {f.label}
          </div>
        ))}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[1,2,3,4,5].map(v => (
          <line key={v} x1={0} x2={W} y1={toY(v)} y2={toY(v)} stroke="var(--border)" strokeWidth={0.5} />
        ))}
        {FIELDS.map(f => (
          <path key={f.key} d={pathFor(f.key)} fill="none" stroke={f.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* Dots */}
        {data.map((d, i) => FIELDS.map(f => d[f.key] ? (
          <circle key={f.key+i} cx={toX(i)} cy={toY(d[f.key])} r={3} fill={f.color} />
        ) : null))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{data[0] && new Date(data[0].date+'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' })}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Hoy</span>
      </div>
    </div>
  )
}

// ---- Página principal de Progreso ----
export default function Progress({ athleteId, sessions = [], isCoach = false }) {
  return (
    <div className="page fade-in">
      {!isCoach && <div className="page-header"><h2>Mi Progreso</h2></div>}
      <div className="page-content">
        {!isCoach && <StatsHeader athleteId={athleteId} sessions={sessions} />}
        {!isCoach && <WellnessHistory athleteId={athleteId} />}
        <LoadChart sessions={sessions} />
        <GoalsSection athleteId={athleteId} canCreate={isCoach} />
        <RecordsSection athleteId={athleteId} canEdit={!isCoach} />
      </div>
    </div>
  )
}

export { WellnessCheckin, GoalsSection, RecordsSection, LoadChart }
