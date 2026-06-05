import { useState, useEffect } from 'react'
import { Injuries, Athletes } from '../lib/db'

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

  const load = () => { setInjuries(Injuries.getAll()); setAthletes(Athletes.getAll()) }
  useEffect(() => { load() }, [])

  const active = injuries.filter(i => !i.date_end)
  const resolved = injuries.filter(i => !!i.date_end)
  const displayed = tab === 'active' ? active : resolved

  const openNew = () => { setForm({ ...emptyForm, athlete_id: athletes[0]?.id || '' }); setEditing(null); setSheet('form') }
  const openEdit = (inj) => { setForm({ ...inj }); setEditing(inj.id); setSheet('form') }

  const save = () => {
    if (!form.athlete_id) return
    if (editing) Injuries.update(editing, form)
    else Injuries.create(form)
    load(); setSheet(null)
  }
  const discharge = (id) => {
    Injuries.update(id, { date_end: new Date().toISOString().slice(0,10) })
    load()
  }
  const remove = (id) => { Injuries.delete(id); load(); setSheet(null) }

  const getAthlete = (id) => athletes.find(a => a.id === id)
  const getSeverity = (v) => SEVERITY.find(s => s.value === v) || SEVERITY[0]

  return (
    <div className="page fade-in" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="page-header">
        <h2>Salud y Lesiones</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva</button>
      </div>

      <div className="page-content">
        {/* Stats */}
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

        {/* Tabs */}
        <div className="pill-tabs">
          <button className={`pill-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            Activas ({active.length})
          </button>
          <button className={`pill-tab ${tab === 'resolved' ? 'active' : ''}`} onClick={() => setTab('resolved')}>
            Historial ({resolved.length})
          </button>
        </div>

        {displayed.length === 0 ? (
          <div className="empty-state">
            <div className="icon">{tab === 'active' ? '🏃' : '📋'}</div>
            <h3>{tab === 'active' ? '¡Todos sanos!' : 'Sin historial'}</h3>
            <p>{tab === 'active' ? 'No hay lesiones activas actualmente' : 'Las lesiones recuperadas aparecerán aquí'}</p>
          </div>
        ) : (
          displayed.map(inj => {
            const athlete = getAthlete(inj.athlete_id)
            const sev = getSeverity(inj.severity)
            const isActive = !inj.date_end
            return (
              <div key={inj.id} className="card" style={{ padding: 16 }} onClick={() => openEdit(inj)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div className="avatar" style={{ background: athlete?.color + '30' || 'var(--card-hover)', color: athlete?.color || 'var(--text)' }}>
                    {athlete ? athlete.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{athlete?.name || 'Desconocido'}</span>
                      <span className="badge" style={{ background: sev.color + '20', color: sev.color, marginLeft: 8 }}>
                        {sev.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, marginTop: 2 }}>{inj.type} · <span style={{ color: 'var(--text-muted)' }}>{inj.body_part}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Desde: {new Date(inj.date_start+'T12:00:00').toLocaleDateString('es-ES')}
                      {inj.date_end && ` · Alta: ${new Date(inj.date_end+'T12:00:00').toLocaleDateString('es-ES')}`}
                    </div>
                    {inj.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{inj.notes}</div>}
                  </div>
                </div>
                {isActive && (
                  <button className="btn btn-secondary btn-full btn-sm"
                    style={{ marginTop: 12 }}
                    onClick={e => { e.stopPropagation(); discharge(inj.id) }}>
                    ✅ Dar de alta
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Form sheet */}
      {sheet === 'form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar lesión' : 'Nueva lesión'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && (
                  <button className="btn btn-danger btn-sm" onClick={() => remove(editing)}>🗑</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setSheet(null)}>✕</button>
              </div>
            </div>
            <div className="sheet-body">
              <F label="Deportista *">
                <select className="input" value={form.athlete_id} onChange={e => setForm(f => ({ ...f, athlete_id: e.target.value }))}>
                  <option value="">Selecciona deportista</option>
                  {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </F>
              <F label="Tipo de lesión">
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </F>
              <F label="Zona corporal">
                <select className="input" value={form.body_part} onChange={e => setForm(f => ({ ...f, body_part: e.target.value }))}>
                  {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
                </select>
              </F>
              <F label="Gravedad">
                <div style={{ display: 'flex', gap: 8 }}>
                  {SEVERITY.map(s => (
                    <button key={s.value} onClick={() => setForm(f => ({ ...f, severity: s.value }))}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                        border: `2px solid ${form.severity === s.value ? s.color : 'var(--border)'}`,
                        background: form.severity === s.value ? s.color + '20' : 'var(--card)',
                        color: form.severity === s.value ? s.color : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </F>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <F label="Fecha inicio">
                    <input className="input" type="date" value={form.date_start}
                      onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))} />
                  </F>
                </div>
                <div style={{ flex: 1 }}>
                  <F label="Fecha alta">
                    <input className="input" type="date" value={form.date_end}
                      onChange={e => setForm(f => ({ ...f, date_end: e.target.value }))} />
                  </F>
                </div>
              </div>
              <F label="Notas / Tratamiento">
                <textarea className="input" placeholder="Observaciones, fisioterapia, reposo..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </F>
              <button className="btn btn-primary btn-full" onClick={save} style={{ marginTop: 8 }}>
                {editing ? 'Guardar cambios' : 'Registrar lesión'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function F({ label, children }) {
  return (
    <div className="input-group">
      <label className="input-label">{label}</label>
      {children}
    </div>
  )
}
