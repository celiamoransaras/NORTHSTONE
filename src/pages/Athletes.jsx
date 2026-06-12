import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Athletes as DB, Sessions, Storage, Cycle, Nutrition, Documents } from '../lib/db'
import { supabase } from '../lib/supabase'
import Training from './Training'
import { GoalsSection, RecordsSection, LoadChart, WellnessTodayCoach, WellnessHistory, MonthlyReport } from './Progress'
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

function useCoachAlerts(athletes, weeklyStats) {
  const [rpeAlerts, setRpeAlerts] = useState([])
  const [noActivity, setNoActivity] = useState([])
  useEffect(() => {
    if (!athletes.length) return
    const active = athletes.filter(a => a.status === 'active')
    // Sin actividad esta semana: tienen sesiones asignadas pero ninguna confirmada
    const noAct = active.filter(a => weeklyStats[a.id]?.assigned > 0 && weeklyStats[a.id]?.done === 0)
    setNoActivity(noAct)
    // RPE alto (>= 8) en los últimos 3 días
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const cutoff = threeDaysAgo.toISOString().slice(0, 10)
    supabase.from('session_athletes')
      .select('athlete_id, rpe, session_id')
      .gte('updated_at', cutoff + 'T00:00:00')
      .gte('rpe', 8)
      .then(({ data }) => {
        if (!data) return
        const ids = [...new Set(data.map(r => r.athlete_id))]
        const alerts = active.filter(a => ids.includes(a.id)).map(a => {
          const maxRpe = Math.max(...data.filter(r => r.athlete_id === a.id).map(r => r.rpe))
          return { ...a, rpe: maxRpe }
        })
        setRpeAlerts(alerts)
      })
  }, [athletes, weeklyStats])
  return { rpeAlerts, noActivity }
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
  const { rpeAlerts, noActivity } = useCoachAlerts(athletes, weeklyStats)

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
              flex: 1, background: 'var(--card)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Alertas del coach */}
        {(rpeAlerts.length > 0 || noActivity.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rpeAlerts.length > 0 && (
              <div className="card" style={{ padding: '12px 14px', borderLeft: '3px solid var(--error)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🔥</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--error)', marginBottom: 2 }}>RPE alto estos días</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {rpeAlerts.map(a => `${a.name.split(' ')[0]} (${a.rpe}/10)`).join(' · ')}
                  </div>
                </div>
              </div>
            )}
            {noActivity.length > 0 && (
              <div className="card" style={{ padding: '12px 14px', borderLeft: '3px solid var(--warning)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--warning)', marginBottom: 2 }}>Sin confirmar esta semana</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {noActivity.map(a => a.name.split(' ')[0]).join(' · ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
                  style={{ width: '100%', background: 'none', borderRadius: 'var(--radius)', padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <button className={`pill-tab ${detailTab==='nutrition'?'active':''}`} onClick={() => setDetailTab('nutrition')}>Nutrición</button>
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
              {detailTab === 'nutrition' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <NutritionCoach athleteId={sheet.id} />
                  <MedicalDocsCoach athleteId={sheet.id} />
                </div>
              )}
              {detailTab === 'training' && (
                <Training athleteId={sheet.id} coachView embedded />
              )}
              {detailTab === 'progress' && (
                <AthleteProgress athleteId={sheet.id} isFemale={sheet.gender === 'female'} />
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
  const [cycles, setCycles] = useState([])
  const [cycleLength, setCycleLength] = useState(28)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      Cycle.getByAthlete(athleteId),
      supabase.from('athletes').select('cycle_length').eq('id', athleteId).single()
    ]).then(([c, { data: ath }]) => {
      setCycles(c)
      setCycleLength(ath?.cycle_length || 28)
      setLoading(false)
    })
  }, [athleteId])

  if (loading) return null

  const currentCycle = cycles[0] || null
  const phase = currentCycle ? Cycle.getPhase(currentCycle, cycleLength) : null
  const symptoms = currentCycle ? Cycle.getSymptoms(currentCycle) : []

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>🩸 Ciclo menstrual</div>

      <div style={{ padding: 16, background: phase ? phase.color + '12' : 'var(--bg)', border: `1.5px solid ${phase ? phase.color + '40' : 'var(--border)'}`, borderRadius: 16, marginBottom: 8 }}>
        {/* Fase actual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>{phase ? phase.emoji : '🩸'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>
              {phase ? `Ciclo menstrual · Día ${phase.day}` : 'Ciclo menstrual'}
            </div>
            {phase ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 15, color: phase.color }}>{phase.label}
                  {phase.periodEnded === true && phase.phase === 'menstrual' && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>· {phase.periodDays}d</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{phase.desc}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin datos registrados aún</div>
            )}
          </div>
        </div>

        {/* Síntomas del ciclo actual */}
        {symptoms.length > 0 && (
          <div style={{ borderTop: `1px solid ${phase?.color || 'var(--border)'}30`, paddingTop: 8, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>💬 Síntomas reportados</div>
            {symptoms.map((s, i) => (
              <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, marginBottom: 4, borderLeft: `3px solid ${phase?.color || 'var(--accent)'}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {new Date(s.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {s.phase}
                </div>
                <div style={{ fontSize: 13 }}>{s.text}</div>
              </div>
            ))}
          </div>
        )}

        {/* Historial ciclos */}
        {cycles.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Historial</div>
            {cycles.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < cycles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {new Date(c.date_start + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {c.date_end && <span style={{ marginLeft: 4, color: '#059669' }}>→ {new Date(c.date_end + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>}
                </span>
                {i === 0
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: phase?.color || 'var(--accent)', background: (phase?.color || 'var(--accent)') + '20', padding: '2px 8px', borderRadius: 8 }}>Actual</span>
                  : cycles[i-1] && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round((new Date(cycles[i-1].date_start) - new Date(c.date_start)) / (1000*60*60*24))}d antes</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Duración configurada — solo lectura */}
      <div style={{ padding: '8px 14px', background: 'var(--card)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>⚙️ Ciclo configurado</div>
        <span style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 8, padding: '3px 12px', fontWeight: 700, fontSize: 14 }}>{cycleLength} días</span>
      </div>
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

function MedicalDocsCoach({ athleteId }) {
  const [docs, setDocs] = useState([])
  useEffect(() => { Documents.getMedical(athleteId).then(setDocs) }, [athleteId])
  if (docs.length === 0) return null
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>📄 Documentos médicos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map(doc => (
          <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(doc.created_at).toLocaleDateString('es-ES')}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>Ver →</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function NutritionCoach({ athleteId }) {
  const toast = useToast()
  const now = new Date()
  const [plan, setPlan] = useState(null)
  const [logs, setLogs] = useState([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeDay, setActiveDay] = useState(Nutrition.getTodayKey())
  const [days, setDays] = useState(() => Object.fromEntries(Nutrition.DAYS.map(d => [d, []])))
  const [notes, setNotes] = useState('')
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const MONTHS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const load = async () => {
    const [p, l] = await Promise.all([Nutrition.getPlan(athleteId, month, year), Nutrition.getLogs(athleteId)])
    setPlan(p)
    setLogs(l)
    if (p?.days) setDays(p.days)
    if (p?.notes) setNotes(p.notes)
  }

  useEffect(() => { load() }, [athleteId])

  const startEdit = () => {
    if (plan?.days) setDays(plan.days)
    if (plan?.notes) setNotes(plan.notes || '')
    setEditing(true)
  }

  const addMeal = () => setDays(d => ({ ...d, [activeDay]: [...(d[activeDay]||[]), { name: '', content: '' }] }))
  const removeMeal = (idx) => setDays(d => ({ ...d, [activeDay]: d[activeDay].filter((_,i) => i !== idx) }))
  const updateMeal = (idx, field, val) => setDays(d => ({ ...d, [activeDay]: d[activeDay].map((m,i) => i===idx ? {...m,[field]:val} : m) }))

  const copyDay = (fromDay) => {
    setDays(d => ({ ...d, [activeDay]: JSON.parse(JSON.stringify(d[fromDay]||[])) }))
    toast(`Copiado desde ${Nutrition.DAY_LABELS[fromDay]}`)
  }

  const save = async () => {
    setSaving(true)
    try {
      await Nutrition.savePlan(athleteId, month, year, days, notes)
      await load()
      setEditing(false)
      toast('Plan guardado')
    } catch { toast('Error al guardar', 'error') }
    finally { setSaving(false) }
  }

  const adherenceIcon = (a) => a === 'yes' ? '✅' : a === 'partial' ? '🟡' : '❌'
  const adherenceLabel = (a) => a === 'yes' ? 'Sí' : a === 'partial' ? 'Parcial' : 'No'
  const activeMeals = days[activeDay] || []
  const planDays = plan?.days || {}

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>🥗 Nutrición · {MONTHS[month]} {year}</div>
        {!editing
          ? <button onClick={startEdit} style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none', borderRadius: 8, padding: '4px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {plan ? '✏️ Editar' : '+ Crear plan'}
            </button>
          : <button onClick={() => setEditing(false)} style={{ background: 'var(--bg)', color: 'var(--text-muted)', borderRadius: 8, padding: '4px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
        }
      </div>

      {/* Tabs días */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto' }}>
        {Nutrition.DAYS.map(d => {
          const hasMeals = (editing ? days[d] : planDays[d])?.filter(m => m.content).length > 0
          const isActive = activeDay === d
          return (
            <button key={d} onClick={() => setActiveDay(d)} style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12,
              background: isActive ? 'var(--accent)' : 'var(--card)',
              color: isActive ? '#fff' : hasMeals ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: isActive ? '0 2px 8px var(--accent-dim)' : 'none',
              position: 'relative'
            }}>
              {Nutrition.DAY_SHORT[d]}
              {hasMeals && !isActive && <span style={{ position:'absolute', top:3, right:3, width:5, height:5, borderRadius:'50%', background:'var(--accent)' }} />}
            </button>
          )
        })}
      </div>

      {editing ? (
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{Nutrition.DAY_LABELS[activeDay]}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Copiar de otro día */}
              <select onChange={e => e.target.value && copyDay(e.target.value)} value=""
                style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <option value="">Copiar de...</option>
                {Nutrition.DAYS.filter(d => d !== activeDay && (days[d]||[]).length > 0).map(d => (
                  <option key={d} value={d}>{Nutrition.DAY_LABELS[d]}</option>
                ))}
              </select>
              <button onClick={addMeal} style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none', borderRadius: 8, padding: '4px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Comida</button>
            </div>
          </div>

          {activeMeals.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>Sin comidas — pulsa "+ Comida" para añadir</div>
          )}

          {activeMeals.map((meal, idx) => (
            <div key={idx} style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="input" placeholder="Nombre (ej: Desayuno, Comida...)" value={meal.name}
                  onChange={e => updateMeal(idx,'name',e.target.value)}
                  style={{ flex: 1, fontSize: 13, fontWeight: 600 }} />
                <button onClick={() => removeMeal(idx)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
              </div>
              <textarea className="input" rows={2} placeholder="Qué comer..." value={meal.content}
                onChange={e => updateMeal(idx,'content',e.target.value)}
                style={{ resize: 'vertical', fontSize: 13, marginBottom: 6 }} />
              {/* Macros opcionales */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'kcal', label: 'kcal', color: '#F97316' },
                  { key: 'protein', label: 'P', color: '#3B82F6' },
                  { key: 'carbs', label: 'HC', color: '#EAB308' },
                  { key: 'fat', label: 'G', color: '#8B5CF6' },
                ].map(({ key, label, color }) => (
                  <div key={key} style={{ flex: key === 'kcal' ? 2 : 1 }}>
                    <div style={{ fontSize: 9, color, fontWeight: 700, marginBottom: 2, textTransform: 'uppercase' }}>{label}{key !== 'kcal' ? ' (g)' : ''}</div>
                    <input type="number" min="0" className="input"
                      placeholder="—"
                      value={meal[key] || ''}
                      onChange={e => updateMeal(idx, key, e.target.value ? Number(e.target.value) : '')}
                      style={{ fontSize: 12, padding: '4px 6px', textAlign: 'center', width: '100%' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notas generales (solo en lunes) */}
          {activeDay === 'monday' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>📝 Notas generales del plan</div>
              <textarea className="input" rows={2} placeholder="Hidratación, observaciones..." value={notes}
                onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical', fontSize: 13 }} />
            </div>
          )}

          <button className="btn btn-primary btn-full" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Guardando...' : 'Guardar plan'}
          </button>
        </div>
      ) : plan ? (
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{Nutrition.DAY_LABELS[activeDay]}</div>
          {(planDays[activeDay]||[]).filter(m => m.content).length === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Sin comidas para este día</div>
            : (() => {
                const meals = (planDays[activeDay]||[]).filter(m => m.content)
                const totals = meals.reduce((acc, m) => ({
                  kcal: acc.kcal + (Number(m.kcal)||0),
                  protein: acc.protein + (Number(m.protein)||0),
                  carbs: acc.carbs + (Number(m.carbs)||0),
                  fat: acc.fat + (Number(m.fat)||0),
                }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
                const hasMacros = !!(totals.kcal || totals.protein || totals.carbs || totals.fat)
                return <>
                  {meals.map((meal,i) => (
                    <div key={i} style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 10 }}>
                      {meal.name && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>{meal.name}</div>}
                      <div style={{ fontSize: 13, marginBottom: (meal.kcal||meal.protein||meal.carbs||meal.fat) ? 6 : 0, whiteSpace: 'pre-wrap' }}>{meal.content}</div>
                      {(meal.kcal||meal.protein||meal.carbs||meal.fat) && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {meal.kcal ? <span style={{ fontSize: 10, fontWeight: 700, color: '#F97316', background: '#FFF7ED', borderRadius: 4, padding: '1px 5px' }}>{meal.kcal} kcal</span> : null}
                          {meal.protein ? <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: '#EFF6FF', borderRadius: 4, padding: '1px 5px' }}>{meal.protein}g prot</span> : null}
                          {meal.carbs ? <span style={{ fontSize: 10, fontWeight: 700, color: '#EAB308', background: '#FEFCE8', borderRadius: 4, padding: '1px 5px' }}>{meal.carbs}g HC</span> : null}
                          {meal.fat ? <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', background: '#F5F3FF', borderRadius: 4, padding: '1px 5px' }}>{meal.fat}g grasa</span> : null}
                        </div>
                      )}
                    </div>
                  ))}
                  {hasMacros && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Total día:</span>
                      {totals.kcal ? <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316' }}>{totals.kcal} kcal</span> : null}
                      {totals.protein ? <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>{totals.protein}g prot</span> : null}
                      {totals.carbs ? <span style={{ fontSize: 11, fontWeight: 700, color: '#EAB308' }}>{totals.carbs}g HC</span> : null}
                      {totals.fat ? <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6' }}>{totals.fat}g grasa</span> : null}
                    </div>
                  )}
                </>
              })()
          }
          {plan.notes && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 10, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>📝 Notas</div>
              <div style={{ fontSize: 13 }}>{plan.notes}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', background: 'var(--card)', borderRadius: 16, border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>🥗</div>
          <div style={{ fontSize: 13 }}>Sin plan para {MONTHS[month]}</div>
        </div>
      )}

      {/* Historial adherencia */}
      {logs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Adherencia últimos 30 días</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {logs.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--card)', borderRadius: 8 }}>
                <span style={{ fontSize: 16 }}>{adherenceIcon(l.adherence)}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{new Date(l.date+'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: l.adherence === 'yes' ? 'var(--success)' : l.adherence === 'partial' ? '#D97706' : 'var(--error)' }}>{adherenceLabel(l.adherence)}</span>
                {l.comment && <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {l.comment}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
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

function AthleteProgress({ athleteId, isFemale }) {
  const [sessions, setSessions] = useState([])
  useEffect(() => { Sessions.getByAthlete(athleteId).then(setSessions) }, [athleteId])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <MonthlyReport athleteId={athleteId} sessions={sessions} isFemale={isFemale} />
      <WellnessTodayCoach athleteId={athleteId} />
      <WellnessHistory athleteId={athleteId} />
      <LoadChart sessions={sessions} />
      <GoalsSection athleteId={athleteId} canCreate={true} />
      <RecordsSection athleteId={athleteId} canEdit={true} />
    </div>
  )
}
