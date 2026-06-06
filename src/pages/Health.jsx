import { useState, useEffect } from 'react'
import { Injuries, Athletes } from '../lib/db'
import { supabase } from '../lib/supabase'

const BODY_PARTS = ['Tobillo','Rodilla','Cadera','Espalda baja','Espalda alta','Hombro','Codo','Muñeca','Cuello','Muslo','Gemelo','Pie','Mano','Cabeza']
const TYPES = ['Esguince','Contractura','Rotura fibrilar','Tendinitis','Fractura','Contusión','Sobrecarga','Luxación','Otro']
const SEVERITY = [
  { value: 'mild', label: 'Leve', color: 'var(--success)' },
  { value: 'moderate', label: 'Moderada', color: 'var(--warning)' },
  { value: 'severe', label: 'Grave', color: 'var(--error)' },
]
const emptyForm = { athlete_id: '', date_start: new Date().toISOString().slice(0,10), date_end: '', type: 'Esguince', body_part: 'Tobillo', severity: 'mild', notes: '' }

export default function Health() {
  const [injuries, setInjuries] = useState([])
  const [athletes, setAthletes] = useState([])
  const [tab, setTab] = useState('active')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [inj, ath] = await Promise.all([Injuries.getAll(), Athletes.getAll()])
    setInjuries(inj)
    setAthletes(ath)
  }
  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0,10)
  const active = injuries.filter(i => !i.date_end || i.date_end >= today)
  const resolved = injuries.filter(i => i.date_end && i.date_end < today)
  const displayed = tab === 'active' ? active : resolved

  const openNew = () => { setForm({ ...emptyForm, athlete_id: athletes[0]?.id || '' }); setEditing(null); setSheet('form') }
  const openEdit = (inj) => { setForm({ ...inj }); setEditing(inj.id); setSheet('form') }

  const save = async () => {
    if (!form.athlete_id) return
    setSaving(true)
    // Limpiar campos vacíos → null
    const clean = { ...form, date_end: form.date_end || null, notes: form.notes || null }
    if (editing) {
      await Injuries.update(editing, clean)
    } else {
      await Injuries.create(clean)
      // Marcar atleta como lesionado si la lesión está activa
      const today = new Date().toISOString().slice(0,10)
      const isActive = !clean.date_end || clean.date_end >= today
      if (isActive) await supabase.from('athletes').update({ status: 'injured' }).eq('id', form.athlete_id)
    }
    await load(); setSaving(false); setSheet(null)
  }

  const discharge = async (id) => {
    const inj = injuries.find(i => i.id === id)
    await Injuries.update(id, { date_end: new Date().toISOString().slice(0,10) })
    // Volver a 'active' si no tiene otras lesiones activas
    if (inj?.athlete_id) {
      const today = new Date().toISOString().slice(0,10)
      const otherActive = injuries.filter(i => i.id !== id && i.athlete_id === inj.athlete_id && (!i.date_end || i.date_end >= today))
      if (!otherActive.length) await supabase.from('athletes').update({ status: 'active' }).eq('id', inj.athlete_id)
    }
    await load()
  }

  const remove = async (id) => {
    await Injuries.delete(id); await load(); setSheet(null)
  }

  const getAthlete = (id) => athletes.find(a => a.id === id)
  const getSeverity = (v) => SEVERITY.find(s => s.value === v) || SEVERITY[0]

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Salud y Lesiones</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva</button>
      </div>

      <div className="page-content">
        <div className="grid-2">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--error)' }}>{active.length}</div>
            <div className="stat-label">Lesiones activas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{resolved.length}</div>
            <div className="stat-label">Recuperadas</div>
          </div>
        </div>

        <div className="pill-tabs">
          <button className={`pill-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Activas ({active.length})</button>
          <button className={`pill-tab ${tab === 'resolved' ? 'active' : ''}`} onClick={() => setTab('resolved')}>Historial ({resolved.length})</button>
        </div>

        {displayed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">{tab === 'active' ? '🏃' : '📋'}</div>
            <h3>{tab === 'active' ? '¡Todos sanos!' : 'Sin historial'}</h3>
          </div>
        ) : displayed.map(inj => {
          const athlete = getAthlete(inj.athlete_id)
          const sev = getSeverity(inj.severity)
          return (
            <div key={inj.id} className="card" style={{ padding: 16 }} onClick={() => openEdit(inj)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div className="avatar" style={{ background: athlete?.color + '30' || 'var(--card-hover)', color: athlete?.color }}>
                  {athlete?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{athlete?.name || 'Desconocido'}</span>
                    <span className="badge" style={{ background: sev.color + '20', color: sev.color }}>{sev.label}</span>
                  </div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{inj.type} · <span style={{ color: 'var(--text-muted)' }}>{inj.body_part}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Desde: {new Date(inj.date_start+'T12:00:00').toLocaleDateString('es-ES')}
                    {inj.date_end && ` · Alta: ${new Date(inj.date_end+'T12:00:00').toLocaleDateString('es-ES')}`}
                  </div>
                  {inj.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{inj.notes}</div>}
                </div>
              </div>
              {!inj.date_end && (
                <button className="btn btn-secondary btn-full btn-sm" style={{ marginTop: 12 }}
                  onClick={e => { e.stopPropagation(); discharge(inj.id) }}>
                  ✅ Dar de alta
                </button>
              )}
            </div>
          )
        })}
      </div>

      {sheet === 'form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar lesión' : 'Nueva lesión'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <button className="btn btn-danger btn-sm" onClick={() => remove(editing)}>🗑</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => setSheet(null)}>✕</button>
              </div>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Deportista *</label>
                <select className="input" value={form.athlete_id} onChange={e => setForm(f => ({ ...f, athlete_id: e.target.value }))}>
                  <option value="">Selecciona deportista</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Tipo de lesión</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Zona corporal</label>
                <select className="input" value={form.body_part} onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))}>
                  {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Gravedad</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {SEVERITY.map(s => (
                    <button key={s.value} onClick={() => setForm(f => ({ ...f, severity: s.value }))}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `2px solid ${form.severity === s.value ? s.color : 'var(--border)'}`,
                        background: form.severity === s.value ? s.color + '20' : 'var(--card)',
                        color: form.severity === s.value ? s.color : 'var(--text-muted)' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Fecha inicio</label>
                  <input className="input" type="date" value={form.date_start} onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Fecha alta</label>
                  <input className="input" type="date" value={form.date_end} onChange={e => setForm(f => ({ ...f, date_end: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Notas / Tratamiento</label>
                <textarea className="input" placeholder="Observaciones, fisioterapia..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar lesión'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
