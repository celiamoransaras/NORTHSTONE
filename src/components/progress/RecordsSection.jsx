import { useState, useEffect } from 'react'
import { Records } from '../../lib/db'
import ConfirmSheet from '../ConfirmSheet'
import { useToast } from '../../contexts/ToastContext'
import { haptic } from '../../lib/haptic'
import RecordChart from './RecordChart'

const UNITS = ['min', 'seg', 'kg', 'km', 'rep', 'cm', 'w', 'm']
const emptyForm = { name: '', value: '', unit: 'min', date: new Date().toISOString().slice(0, 10), notes: '' }

export default function RecordsSection({ athleteId, canEdit }) {
  const [records, setRecords] = useState([])
  const [sheet, setSheet] = useState(false)
  const [editing, setEditing] = useState(null)
  const [chartGroup, setChartGroup] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [nameError, setNameError] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => { Records.getByAthlete(athleteId).then(setRecords) }, [athleteId])

  const groupMap = {}
  records.forEach(r => {
    const key = r.name.trim().toLowerCase()
    if (!groupMap[key]) groupMap[key] = { displayName: r.name, recs: [] }
    groupMap[key].recs.push(r)
  })
  const grouped = Object.fromEntries(Object.values(groupMap).map(g => [g.displayName, g.recs]))

  const openNew  = () => { setEditing(null); setForm(emptyForm); setSheet(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ name: r.name, value: String(r.value), unit: r.unit, date: r.date, notes: r.notes || '' }); setSheet(true) }

  const save = async () => {
    if (!form.name.trim() || !form.value) {
      setNameError(true); haptic('error')
      setTimeout(() => setNameError(false), 600)
      return
    }
    setSaving(true)
    try {
      if (editing) await Records.update(editing, { ...form, value: parseFloat(form.value) })
      else await Records.create({ ...form, value: parseFloat(form.value), athlete_id: athleteId })
      setRecords(await Records.getByAthlete(athleteId))
      setSheet(false); setEditing(null)
      haptic('success'); toast(editing ? 'Marca actualizada' : 'Marca guardada')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id) => {
    try {
      await Records.delete(id)
      setRecords(r => r.filter(x => x.id !== id))
      setSheet(false); setConfirmDelete(null)
      haptic('medium'); toast('Marca eliminada')
    } catch { toast('Error al eliminar', 'error') }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Marcas personales</div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva</button>}
      </div>

      {records.length === 0 ? (
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.35 }}>🏆</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Sin marcas aún</div>
          {canEdit && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Empieza a registrar tus tiempos y récords</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(grouped).map(([name, recs]) => {
            const chronological = [...recs].sort((a, b) => a.date.localeCompare(b.date))
            const best = recs[0]
            const prev = recs[1]
            const improved = prev && parseFloat(best.value) !== parseFloat(prev.value)
            const better  = prev && parseFloat(best.value) < parseFloat(prev.value)
            return (
              <div key={name} className="card" style={{ padding: '16px 18px', cursor: 'pointer' }}
                onClick={() => setChartGroup({ name, recs: chronological, unit: best.unit })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(best.date + 'T12:00:00').toLocaleDateString('es-ES')}
                      {recs.length > 1 && ` · ${recs.length} registros`}
                    </div>
                    {improved && (
                      <div style={{ fontSize: 12, color: better ? 'var(--success)' : 'var(--error)', marginTop: 4, fontWeight: 600 }}>
                        {better ? '↑ Mejora' : '↓'} vs anterior: {prev.value} {prev.unit}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, color: 'var(--accent)', lineHeight: 1 }}>{best.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{best.unit}</div>
                  </div>
                  {canEdit && (
                    <button onClick={e => { e.stopPropagation(); openEdit(best) }}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>
                      ✏️
                    </button>
                  )}
                  <span style={{ color: 'var(--text-dim)', fontSize: 16, flexShrink: 0 }}>›</span>
                </div>
                {chronological.length > 1 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-end', height: 28 }}>
                    {chronological.map((r, i) => {
                      const vals = chronological.map(x => parseFloat(x.value))
                      const mn = Math.min(...vals), mx = Math.max(...vals)
                      const h = mn === mx ? 14 : 8 + ((parseFloat(r.value) - mn) / (mx - mn)) * 16
                      const isLast = i === chronological.length - 1
                      return <div key={r.id} style={{ flex: 1, height: h, borderRadius: 3, background: isLast ? 'var(--accent)' : 'var(--border)', transition: 'height 0.3s' }} />
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {chartGroup && (
        <>
          <div className="overlay" onClick={() => setChartGroup(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <h3>{chartGroup.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{chartGroup.recs.length} registros · en {chartGroup.unit}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setChartGroup(null)}>✕</button>
            </div>
            <div className="sheet-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { label: 'Mejor',     value: Math.min(...chartGroup.recs.map(r => parseFloat(r.value))), color: 'var(--success)' },
                  { label: 'Último',    value: parseFloat(chartGroup.recs[chartGroup.recs.length - 1].value), color: 'var(--accent)' },
                  { label: 'Registros', value: chartGroup.recs.length, color: 'var(--text-muted)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.5px' }}>{label}</div>
                  </div>
                ))}
              </div>
              <RecordChart recs={chartGroup.recs} unit={chartGroup.unit} />
              <div className="section-title" style={{ marginTop: 20 }}>Historial</div>
              <div className="card">
                {[...chartGroup.recs].reverse().map((r, i) => {
                  const isBest = parseFloat(r.value) === Math.min(...chartGroup.recs.map(x => parseFloat(x.value)))
                  return (
                    <div key={r.id} className="list-item" style={{ borderBottom: i < chartGroup.recs.length - 1 ? undefined : 'none', cursor: 'default' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{new Date(r.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        {r.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{r.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isBest && <span style={{ fontSize: 14 }}>⭐</span>}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: isBest ? 'var(--success)' : 'var(--text)' }}>{r.value}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{r.unit}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {canEdit && (
                <>
                  <div className="divider" />
                  <button className="btn btn-primary btn-full" onClick={() => { setChartGroup(null); openNew() }}>
                    + Añadir nuevo registro
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Eliminar marca"
          message="Se eliminará este registro permanentemente."
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
              <h3>{editing ? 'Editar marca' : 'Nueva marca'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(editing)}>🗑</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)}>✕</button>
              </div>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Ejercicio / Prueba *</label>
                <input className={`input${nameError ? ' input-error' : ''}`} placeholder="ej. 5k, Sentadilla, Peso muerto" value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (nameError) setNameError(false) }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Valor *</label>
                  <input className="input" type="number" step="0.01" placeholder="25.30" value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                </div>
                <div style={{ width: 100 }} className="input-group">
                  <label className="input-label">Unidad</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Notas</label>
                <input className="input" placeholder="Condiciones, observaciones..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
