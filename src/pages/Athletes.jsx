import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Athletes as DB, Sessions, Storage, Cycle } from '../lib/db'
import { supabase } from '../lib/supabase'
import Training from './Training'
import { GoalsSection, RecordsSection, LoadChart, WellnessTodayCoach, WellnessHistory } from './Progress'
import { useToast } from '../contexts/ToastContext'

function getWeekRange() {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return [mon.toISOString().slice(0,10), sun.toISOString().slice(0,10)]
}

function useWeeklyStats(athletes) {
  const [stats, setStats] = useState({})
  useEffect(() => {
    if (!athletes.length) return
    Sessions.getAll().then(sessions => {
      const [weekStart, weekEnd] = getWeekRange()
      const weekSessions = sessions.filter(s => s.date >= weekStart && s.date <= weekEnd)
      const map = {}
      athletes.forEach(a => {
        const assigned = weekSessions.filter(s => s.athlete_ids?.includes(a.id))
        const done = assigned.filter(s => s.attendance?.[a.id] === true)
        map[a.id] = { assigned: assigned.length, done: done.length }
      })
      setStats(map)
    })
  }, [athletes])
  return stats
}

const COLORS = ['#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#EF4444','#14B8A6','#F97316']
const STATUS_OPTS = [{ value: 'active', label: 'Activo' }, { value: 'injured', label: 'Lesionado' }, { value: 'inactive', label: 'Baja' }]
const emptyForm = { name: '', email: '', phone: '', dob: '', sport: 'Híbrido', color: COLORS[0], status: 'active', notes: '', gender: '' }

export default function Athletes() {
  const toast = useToast()
  const location = useLocation()
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [detailTab, setDetailTab] = useState('profile')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await DB.getAll()
    setAthletes(data)
    setLoading(false)
    // Auto-abrir perfil si venimos del Dashboard con un athleteId
    if (location.state?.openAthlete) {
      const target = data.find(a => a.id === location.state.openAthlete)
      if (target) { setSheet({ ...target }); setDetailTab('profile') }
    }
  }
  useEffect(() => { load() }, [])
  const weeklyStats = useWeeklyStats(athletes)

  const activeAthletes = athletes.filter(a => a.status !== 'inactive')
  const inactiveAthletes = athletes.filter(a => a.status === 'inactive')
  const filtered = activeAthletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  )
  const filteredInactive = inactiveAthletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  )

  const openNew = () => { setForm(emptyForm); setEditing(null); setSheet('form') }
  const openEdit = (a) => { setForm({ ...a, gender: a.gender || '' }); setEditing(a.id); setSheet('form') }
  const openDetail = (a) => { setSheet({ ...a }); setDetailTab('profile') }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      let savedId = editing
      if (editing) await DB.update(editing, form)
      else { const created = await DB.create(form); savedId = created?.id }
      await load()
      setSheet(null)
      toast(editing ? 'Deportista actualizada' : 'Deportista añadida')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (file, athleteId) => {
    if (!file) return
    setUploadingPhoto(true)
    try {
      const url = await Storage.uploadAvatar(athleteId || 'new_' + Date.now(), file)
      setForm(f => ({ ...f, avatar_url: url }))
    } catch { toast('Error al subir la foto', 'error') }
    setUploadingPhoto(false)
  }

  const deactivate = async (id) => {
    try {
      await DB.update(id, { status: 'inactive' })
      await load()
      setConfirmDelete(null)
      setSheet(null)
      toast('Deportista dado/a de baja')
    } catch {
      toast('Error al dar de baja', 'error')
    }
  }

  const reactivate = async (id) => {
    try {
      await DB.update(id, { status: 'active' })
      await load()
      setSheet(null)
      toast('Deportista reactivado/a ✓')
    } catch {
      toast('Error al reactivar', 'error')
    }
  }

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const statusBadge = (s) => s === 'active' ? 'badge-green' : s === 'injured' ? 'badge-red' : 'badge-gray'
  const statusLabel = (s) => s === 'active' ? 'Activo' : s === 'injured' ? 'Lesionado' : 'Baja'

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Equipo</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Añadir</button>
      </div>

      <div className="page-content">
        <input className="input" placeholder="🔍  Buscar deportista..." value={search}
          onChange={e => setSearch(e.target.value)} />

        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Total', val: activeAthletes.length },
            { label: 'Activos', val: athletes.filter(a=>a.status==='active').length },
            { label: 'Lesionados', val: athletes.filter(a=>a.status==='injured').length },
          ].map(({ label, val }) => (
            <div key={label} style={{
              flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>Cargando...</div>
        ) : filtered.length === 0 && inactiveAthletes.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👥</div>
            <h3>Sin deportistas</h3>
            <p>Añade tu primer deportista con el botón de arriba</p>
          </div>
        ) : (
          <>
            {filtered.length > 0 && (
              <div className="card">
                {filtered.map((a, i) => (
                  <div key={a.id} className="list-item" onClick={() => openDetail(a)}
                    style={{ borderBottom: i < filtered.length - 1 ? undefined : 'none', borderLeft: `3px solid ${a.color}`, paddingLeft: 14 }}>
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt={a.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: `0 0 0 2px ${a.color}40` }} />
                      : <div className="avatar" style={{ width: 44, height: 44, fontSize: 17, background: `linear-gradient(135deg, ${a.color}CC, ${a.color}88)`, color: '#fff', boxShadow: `0 4px 12px ${a.color}40` }}>{initials(a.name)}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>{a.sport || 'Sin deporte'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className={`badge ${statusBadge(a.status)}`}>{statusLabel(a.status)}</span>
                      {weeklyStats[a.id]?.assigned > 0 && (
                        <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                          color: weeklyStats[a.id].done === weeklyStats[a.id].assigned ? 'var(--success)' : weeklyStats[a.id].done > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                          📅 {weeklyStats[a.id].done}/{weeklyStats[a.id].assigned} esta semana
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dados de baja */}
            {filteredInactive.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowInactive(s => !s)}
                  style={{ width: '100%', background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    ⛔ Dados de baja ({filteredInactive.length})
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>{showInactive ? '▲' : '▼'}</span>
                </button>
                {showInactive && (
                  <div className="card" style={{ marginTop: 8, opacity: 0.7 }}>
                    {filteredInactive.map((a, i) => (
                      <div key={a.id} className="list-item" onClick={() => openDetail(a)}
                        style={{ borderBottom: i < filteredInactive.length - 1 ? undefined : 'none', borderLeft: '3px solid var(--border)', paddingLeft: 14 }}>
                        {a.avatar_url
                          ? <img src={a.avatar_url} alt={a.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, filter: 'grayscale(100%)' }} />
                          : <div className="avatar" style={{ width: 44, height: 44, fontSize: 17, background: 'var(--border)', color: 'var(--text-muted)' }}>{initials(a.name)}</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-muted)' }}>{a.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 1 }}>{a.sport || 'Sin deporte'}</div>
                        </div>
                        <span className="badge badge-gray">Baja</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail sheet */}
      {sheet && sheet !== 'form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{sheet.name}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(sheet)}>✏️ Editar</button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', overflowX: 'auto' }}>
              <button className={`pill-tab ${detailTab==='profile'?'active':''}`} onClick={() => setDetailTab('profile')}>Perfil</button>
              <button className={`pill-tab ${detailTab==='training'?'active':''}`} onClick={() => setDetailTab('training')}>Entrenos</button>
              <button className={`pill-tab ${detailTab==='progress'?'active':''}`} onClick={() => setDetailTab('progress')}>Progreso</button>
            </div>
            <div className="sheet-body" style={{ paddingTop: 0 }}>
              {detailTab === 'profile' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    {sheet.avatar_url
                      ? <img src={sheet.avatar_url} alt={sheet.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div className="avatar" style={{ width: 64, height: 64, fontSize: 24, background: sheet.color + '30', color: sheet.color }}>{initials(sheet.name)}</div>
                    }
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{sheet.name}</div>
                      <span className={`badge ${statusBadge(sheet.status)}`}>{statusLabel(sheet.status)}</span>
                    </div>
                  </div>
                  {sheet.gender === 'female' && <CyclePhaseCoach athleteId={sheet.id} />}
                  <WeeklyAdherence athleteId={sheet.id} color={sheet.color} />
                  <div style={{ marginBottom: 16 }}>
                    <WellnessTodayCoach athleteId={sheet.id} athleteName={sheet.name} />
                  </div>
                  <InfoRow icon="✉️" label="Email" val={sheet.email || '—'} />
                  <InfoRow icon="📱" label="Teléfono" val={sheet.phone || '—'} />
                  <InfoRow icon="🎂" label="Fecha de nacimiento" val={(() => { if (!sheet.dob) return '—'; const d = new Date(sheet.dob+'T12:00:00'); if (d.getFullYear() < 100) d.setFullYear(d.getFullYear() + 1900); return d.toLocaleDateString('es-ES'); })()} />
                  <InfoRow icon="🏋️" label="Deporte" val={sheet.sport || '—'} />
                  {sheet.notes && <><div className="divider" /><div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{sheet.notes}</div></>}
                  <div className="divider" />
                  {sheet.status === 'inactive'
                    ? <button className="btn btn-primary btn-full" onClick={() => reactivate(sheet.id)}>✅ Reactivar deportista</button>
                    : <button className="btn btn-danger btn-full" onClick={() => setConfirmDelete(sheet.id)}>⛔ Dar de baja</button>
                  }
                </>
              )}
              {detailTab === 'training' && (
                <Training athleteId={sheet.id} coachView embedded />
              )}
              {detailTab === 'progress' && (
                <AthleteProgress athleteId={sheet.id} />
              )}
            </div>
          </div>
        </>
      )}

      {/* Form sheet */}
      {sheet === 'form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar deportista' : 'Nuevo deportista'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet(null)}>✕</button>
            </div>
            <div className="sheet-body">
              {/* Foto de perfil */}
              <div className="input-group">
                <label className="input-label">Foto de perfil</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {form.avatar_url
                    ? <img src={form.avatar_url} alt="foto" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div className="avatar" style={{ width: 56, height: 56, background: (form.color||COLORS[0])+'30', color: form.color||COLORS[0], fontSize: 18 }}>
                        {form.name ? initials(form.name) : '?'}
                      </div>
                  }
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                    {uploadingPhoto ? 'Subiendo...' : 'Cambiar foto'}
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handlePhotoUpload(e.target.files[0], editing)} />
                  </label>
                </div>
              </div>
              {[
                { label: 'Nombre *', key: 'name', placeholder: 'Nombre completo' },
                { label: 'Email', key: 'email', placeholder: 'email@ejemplo.com', type: 'email' },
                { label: 'Teléfono', key: 'phone', placeholder: '600 000 000', type: 'tel' },
              ].map(({ label, key, placeholder, type = 'text' }) => (
                <div key={key} className="input-group">
                  <label className="input-label">{label}</label>
                  <input className="input" type={type} placeholder={placeholder} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="input-group">
                <label className="input-label">Fecha de nacimiento</label>
                <input className="input" type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Género</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ value: 'female', label: '♀ Mujer' }, { value: 'male', label: '♂ Hombre' }].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, gender: opt.value }))}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 'var(--radius)',
                        border: `2px solid ${form.gender === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.gender === opt.value ? 'var(--accent-dim)' : 'var(--card)',
                        color: form.gender === opt.value ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: form.gender === opt.value ? 800 : 500,
                        fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Deporte</label>
                <input className="input" placeholder="Híbrido, Fuerza, Cardio..." value={form.sport}
                  onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Estado</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Color identificador</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '3px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Notas</label>
                <textarea className="input" placeholder="Observaciones, objetivos..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Añadir deportista'}
              </button>
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <>
          <div className="overlay" onClick={() => setConfirmDelete(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-body" style={{ textAlign: 'center', paddingTop: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
              <h3 style={{ marginBottom: 8 }}>¿Dar de baja?</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>El deportista dejará de aparecer en las listas. Sus datos se conservan y puedes reactivarle cuando quieras.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary btn-full" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn btn-danger btn-full" onClick={() => deactivate(confirmDelete)}>Dar de baja</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function CyclePhaseCoach({ athleteId }) {
  const [phase, setPhase] = useState(null)
  const [currentCycle, setCurrentCycle] = useState(null)

  useEffect(() => {
    Promise.all([
      Cycle.getByAthlete(athleteId),
      supabase.from('athletes').select('cycle_length').eq('id', athleteId).single()
    ]).then(([cycles, { data: ath }]) => {
      if (cycles.length > 0) {
        setCurrentCycle(cycles[0])
        const len = ath?.cycle_length || 28
        setPhase(Cycle.getPhase(cycles[0], len))
      }
    })
  }, [athleteId])

  if (!phase) return (
    <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20 }}>🩸</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ciclo menstrual</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin datos registrados aún</div>
      </div>
    </div>
  )

  const symptoms = currentCycle ? Cycle.getSymptoms(currentCycle) : []

  return (
    <div style={{ marginBottom: 16, padding: '12px 14px', background: phase.color + '12', border: `1.5px solid ${phase.color}30`, borderRadius: 12 }}>
      {/* Fase actual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: symptoms.length > 0 ? 10 : 0 }}>
        <span style={{ fontSize: 24 }}>{phase.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
            Ciclo menstrual · Día {phase.day}
            {currentCycle?.date_end && phase.phase === 'menstrual' && (
              <span style={{ marginLeft: 6, color: '#059669' }}>· Regla finalizada</span>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, color: phase.color }}>{phase.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{phase.desc}</div>
        </div>
      </div>
      {/* Síntomas registrados */}
      {symptoms.length > 0 && (
        <div style={{ borderTop: `1px solid ${phase.color}30`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>
            💬 Síntomas reportados
          </div>
          {symptoms.slice(0, 3).map((s, i) => (
            <div key={i} style={{ fontSize: 12, padding: '5px 8px', background: 'var(--bg)', borderRadius: 6, marginBottom: 4, borderLeft: `2px solid ${phase.color}` }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>
                {new Date(s.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ·
              </span>
              {s.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, val }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        <div style={{ fontSize: 15, marginTop: 2 }}>{val}</div>
      </div>
    </div>
  )
}

function WeeklyAdherence({ athleteId, color }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    const [weekStart, weekEnd] = getWeekRange()
    Sessions.getAll().then(sessions => {
      const week = sessions.filter(s => s.date >= weekStart && s.date <= weekEnd && s.athlete_ids?.includes(athleteId))
      const done = week.filter(s => s.attendance?.[athleteId] === true)
      setData({ week, done })
    })
  }, [athleteId])

  if (!data || data.week.length === 0) return null

  const pct = data.week.length ? Math.round((data.done.length / data.week.length) * 100) : 0
  const barColor = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)'

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📅 Adherencia esta semana
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: barColor }}>
          {data.done.length}/{data.week.length}
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.week.map(s => {
          const done = s.attendance?.[athleteId] === true
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? 'var(--success)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {done && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
              </div>
              <div style={{ fontSize: 13, flex: 1 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.date+'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AthleteProgress({ athleteId }) {
  const [sessions, setSessions] = useState([])
  useEffect(() => { Sessions.getByAthlete(athleteId).then(setSessions) }, [athleteId])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WellnessTodayCoach athleteId={athleteId} />
      <WellnessHistory athleteId={athleteId} />
      <LoadChart sessions={sessions} />
      <GoalsSection athleteId={athleteId} canCreate={true} />
      <RecordsSection athleteId={athleteId} canEdit={true} />
    </div>
  )
}
