import { useState, useEffect } from 'react'
import { Injuries, Athletes } from '../lib/db'
import { supabase } from '../lib/supabase'
import ConfirmSheet from '../components/ConfirmSheet'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'

const BODY_PARTS = ['Tobillo','Rodilla','Cadera','Espalda baja','Espalda alta','Hombro','Codo','Muñeca','Cuello','Muslo','Gemelo','Pie','Mano','Cabeza']
const TYPES = ['Esguince','Contractura','Rotura fibrilar','Tendinitis','Fractura','Contusión','Sobrecarga','Luxación','Otro']
const SEVERITY = [
  { value: 'mild',     label: 'Leve',     color: 'var(--success)', bg: 'var(--success-dim)' },
  { value: 'moderate', label: 'Moderada', color: 'var(--warning)', bg: 'rgba(217,119,6,0.1)' },
  { value: 'severe',   label: 'Grave',    color: 'var(--error)',   bg: 'var(--error-dim)' },
]
const emptyForm = { athlete_id: '', date_start: new Date().toISOString().slice(0,10), date_end: '', type: 'Esguince', body_part: 'Tobillo', severity: 'mild', notes: '' }

const BODY_EMOJI = { Tobillo:'🦶', Rodilla:'🦵', Cadera:'🦿', 'Espalda baja':'🔻', 'Espalda alta':'🔺', Hombro:'💪', Codo:'🦾', Muñeca:'✋', Cuello:'🦒', Muslo:'🦵', Gemelo:'🦵', Pie:'🦶', Mano:'✋', Cabeza:'🧠' }

export default function Health() {
  const [injuries, setInjuries] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const toast = useToast()

  const load = async () => {
    const [inj, ath] = await Promise.all([Injuries.getAll(), Athletes.getAll()])
    setInjuries(inj)
    setAthletes(ath)
    setLoading(false)
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
    if (form.date_end && form.date_end < form.date_start) {
      toast('La fecha de alta no puede ser anterior a la fecha de inicio', 'error')
      return
    }
    setSaving(true)
    try {
      const clean = { ...form, date_end: form.date_end || null, notes: form.notes || null }
      if (editing) {
        await Injuries.update(editing, clean)
      } else {
        await Injuries.create(clean)
        const isActive = !clean.date_end || clean.date_end >= today
        if (isActive) await supabase.from('athletes').update({ status: 'injured' }).eq('id', form.athlete_id)
      }
      await load()
      setSheet(null)
      haptic('success')
      toast(editing ? 'Lesión actualizada' : 'Lesión registrada')
    } catch {
      toast('Error al guardar', 'error')
      haptic('error')
    } finally {
      setSaving(false)
    }
  }

  const discharge = async (id) => {
    const inj = injuries.find(i => i.id === id)
    await Injuries.update(id, { date_end: today })
    if (inj?.athlete_id) {
      const otherActive = injuries.filter(i => i.id !== id && i.athlete_id === inj.athlete_id && (!i.date_end || i.date_end >= today))
      if (!otherActive.length) await supabase.from('athletes').update({ status: 'active' }).eq('id', inj.athlete_id)
    }
    await load()
  }

  const remove = async (id) => {
    try {
      await Injuries.delete(id)
      await load()
      setSheet(null)
      setConfirmDelete(null)
      haptic('medium')
      toast('Lesión eliminada')
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  const getAthlete = (id) => athletes.find(a => a.id === id)
  const getSeverity = (v) => SEVERITY.find(s => s.value === v) || SEVERITY[0]

  const formatDate = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' })
  const getDuration = (start, end) => {
    const s = new Date(start+'T12:00:00')
    const e = end ? new Date(end+'T12:00:00') : new Date()
    const days = Math.round((e - s) / (1000*60*60*24))
    return days === 0 ? 'Hoy' : days === 1 ? '1 día' : `${days} días`
  }

  if (loading) return (
    <div className="page">
      <div className="page-header"><div className="skeleton" style={{ height: 28, width: 180 }} /></div>
      <div className="page-content">
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 18 }} />)}
      </div>
    </div>
  )

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Salud</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva</button>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="grid-2">
          <div className="stat-card" style={{ borderLeft: `3px solid var(--error)` }}>
            <div className="stat-value" style={{ color: 'var(--error)' }}>{active.length}</div>
            <div className="stat-label">Activas</div>
          </div>
          <div className="stat-card" style={{ borderLeft: `3px solid var(--success)` }}>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{resolved.length}</div>
            <div className="stat-label">Recuperadas</div>
          </div>
        </div>

        <div className="pill-tabs">
          <button className={`pill-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            Activas {active.length > 0 && `(${active.length})`}
          </button>
          <button className={`pill-tab ${tab === 'resolved' ? 'active' : ''}`} onClick={() => setTab('resolved')}>
            Historial {resolved.length > 0 && `(${resolved.length})`}
          </button>
        </div>

        {displayed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">{tab === 'active' ? '🏃' : '📋'}</div>
            <h3>{tab === 'active' ? '¡Todos sanos!' : 'Sin historial'}</h3>
            <p>{tab === 'active' ? 'No hay lesiones activas ahora mismo' : 'Las lesiones recuperadas aparecerán aquí'}</p>
          </div>
        ) : displayed.map(inj => {
          const athlete = getAthlete(inj.athlete_id)
          const sev = getSeverity(inj.severity)
          const isActive = !inj.date_end || inj.date_end >= today
          const emoji = BODY_EMOJI[inj.body_part] || '🩹'

          return (
            <div key={inj.id} className="card" onClick={() => openEdit(inj)} style={{ cursor: 'pointer', overflow: 'visible' }}>
              <div style={{ padding: '14px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  {athlete?.avatar_url
                    ? <img src={athlete.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div className="avatar" style={{ background: athlete?.color+'20', color: athlete?.color, width: 40, height: 40 }}>
                        {athlete?.name?.split(' ').map(w=>w[0]).join('').slice(0,2) || '?'}
                      </div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{athlete?.name || 'Desconocido'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(inj.date_start)} {inj.date_end ? `→ ${formatDate(inj.date_end)}` : '→ hoy'} · {getDuration(inj.date_start, inj.date_end)}</div>
                  </div>
                  <span className="badge" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
                </div>

                {/* Injury info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
                  <span style={{ fontSize: 24 }}>{emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{inj.type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inj.body_part}</div>
                  </div>
                  {isActive && (
                    <span className="badge badge-red" style={{ marginLeft: 'auto', fontSize: 10 }}>ACTIVA</span>
                  )}
                </div>

                {inj.notes && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic', padding: '0 4px' }}>
                    "{inj.notes}"
                  </div>
                )}

                {isActive && (
                  <button className="btn btn-secondary btn-full btn-sm" style={{ marginTop: 10 }}
                    onClick={e => { e.stopPropagation(); discharge(inj.id) }}>
                    ✅ Dar de alta
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {confirmDelete && (
        <ConfirmSheet
          title="Eliminar lesión"
          message="Se eliminará el registro de esta lesión permanentemente."
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Form sheet */}
      {sheet === 'form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar lesión' : 'Nueva lesión'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(editing)}>🗑</button>}
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
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Tipo</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Zona</label>
                  <select className="input" value={form.body_part} onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))}>
                    {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Gravedad</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {SEVERITY.map(s => (
                    <button key={s.value} onClick={() => setForm(f => ({ ...f, severity: s.value }))}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px',
                        border: `2px solid ${form.severity === s.value ? s.color : 'var(--border)'}`,
                        background: form.severity === s.value ? s.bg : 'var(--bg)',
                        color: form.severity === s.value ? s.color : 'var(--text-muted)' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Inicio</label>
                  <input className="input" type="date" value={form.date_start} onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Alta</label>
                  <input className="input" type="date" value={form.date_end} min={form.date_start} onChange={e => setForm(f => ({ ...f, date_end: e.target.value }))} />
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
