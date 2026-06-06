import { useState, useEffect } from 'react'
import { Goals } from '../../lib/db'
import ConfirmSheet from '../ConfirmSheet'
import { useToast } from '../../contexts/ToastContext'
import { haptic } from '../../lib/haptic'

export default function GoalsSection({ athleteId, canCreate }) {
  const [goals, setGoals] = useState([])
  const [sheet, setSheet] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', target_value: '', current_value: '', unit: '', deadline: '' })
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const toast = useToast()

  useEffect(() => { Goals.getByAthlete(athleteId).then(setGoals) }, [athleteId])

  const save = async () => {
    if (!form.title.trim()) {
      setTitleError(true); haptic('error')
      setTimeout(() => setTitleError(false), 600)
      return
    }
    setSaving(true)
    try {
      await Goals.create({
        ...form, athlete_id: athleteId,
        target_value: parseFloat(form.target_value) || null,
        current_value: parseFloat(form.current_value) || null,
        deadline: form.deadline || null,
        description: form.description || null,
        unit: form.unit || null,
      })
      setGoals(await Goals.getByAthlete(athleteId))
      setSheet(false)
      setForm({ title: '', description: '', target_value: '', current_value: '', unit: '', deadline: '' })
      haptic('success'); toast('Objetivo creado')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (goal) => {
    await Goals.update(goal.id, { completed: !goal.completed })
    setGoals(g => g.map(x => x.id === goal.id ? { ...x, completed: !x.completed } : x))
  }

  const del = async (id) => {
    try {
      await Goals.delete(id)
      setGoals(g => g.filter(x => x.id !== id))
      setConfirmDelete(null)
      haptic('medium'); toast('Objetivo eliminado')
    } catch { toast('Error al eliminar', 'error') }
  }

  const pct = (g) => g.target_value && g.current_value
    ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Mis objetivos</div>
        {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setSheet(true)}>+ Nuevo</button>}
      </div>

      {goals.length === 0 ? (
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.35 }}>🎯</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Sin objetivos aún</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tu entrenadora irá añadiendo objetivos para ti</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goals.map(g => {
            const p = pct(g)
            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + 'T12:00:00') - new Date()) / (1000 * 60 * 60 * 24)) : null
            const isOverdue = daysLeft !== null && daysLeft < 0 && !g.completed
            return (
              <div key={g.id} className="card" style={{ padding: '16px 18px', opacity: g.completed ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div onClick={() => toggle(g)}
                    style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${g.completed ? 'var(--success)' : 'var(--border)'}`, background: g.completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                    {g.completed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, textDecoration: g.completed ? 'line-through' : 'none', marginBottom: g.description ? 3 : 0 }}>{g.title}</div>
                    {g.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{g.description}</div>}
                    {p !== null && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.current_value} {g.unit} de {g.target_value} {g.unit}</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, color: p >= 100 ? 'var(--success)' : 'var(--accent)' }}>{p}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? 'var(--success)' : 'var(--accent-gradient)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )}
                    {g.deadline && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: isOverdue ? 'var(--error)' : 'var(--text-muted)' }}>
                          📅 {new Date(g.deadline + 'T12:00:00').toLocaleDateString('es-ES')}
                          {!g.completed && daysLeft !== null && (
                            <span style={{ marginLeft: 6, fontWeight: 600, color: isOverdue ? 'var(--error)' : daysLeft <= 7 ? 'var(--warning)' : 'var(--text-muted)' }}>
                              {isOverdue ? `· Vencido hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? '· ¡Hoy!' : `· ${daysLeft} días`}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {canCreate && (
                    <button onClick={() => setConfirmDelete(g.id)} style={{ color: 'var(--text-dim)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Eliminar objetivo"
          message="Se eliminará este objetivo permanentemente."
          onConfirm={() => del(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

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
                <input className={`input${titleError ? ' input-error' : ''}`} placeholder="ej. Correr 10k en menos de 50 min" value={form.title}
                  onChange={e => { setForm(f => ({ ...f, title: e.target.value })); if (titleError) setTitleError(false) }} />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción</label>
                <textarea className="input" placeholder="Detalles del objetivo..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Valor actual</label>
                  <input className="input" type="number" step="0.01" placeholder="0" value={form.current_value}
                    onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Meta</label>
                  <input className="input" type="number" step="0.01" placeholder="10" value={form.target_value}
                    onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} />
                </div>
                <div style={{ width: 80 }} className="input-group">
                  <label className="input-label">Unidad</label>
                  <input className="input" placeholder="km" value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha límite</label>
                <input className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
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
