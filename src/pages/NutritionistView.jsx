import { ymd } from '../lib/dates'
import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Nutrition, Storage, Documents } from '../lib/db'
import { useToast } from '../contexts/ToastContext'
import { ProgressPhotos, WeightMonthly, MeasurementsMonthly } from './Progress'
import { initials } from '../lib/utils'
import { sendPushToAthletes } from '../lib/pushNotifications'

const Training = lazy(() => import('./Training'))

const MEAL_PRESETS = ['Desayuno', 'Media mañana', 'Almuerzo', 'Merienda', 'Cena', 'Post-entreno', 'Suplemento']

const DOC_CATEGORIES = [
  { value: 'athlete', label: 'General' },
  { value: 'medical', label: 'Médico' },
  { value: 'nutrition', label: 'Nutrición' },
  { value: 'training', label: 'Entrenamiento' },
]

function emptyDays() {
  return Object.fromEntries(Nutrition.DAYS.map(d => [d, []]))
}

// ---- NUTRITION EDITOR ----
function NutritionPlanEditor({ athlete, onDirtyChange }) {
  const toast = useToast()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [days, setDays] = useState(emptyDays)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(Nutrition.getTodayKey())
  const [isDirty, setIsDirty] = useState(false)

  const markDirty = () => {
    setIsDirty(true)
    onDirtyChange?.(true)
  }

  useEffect(() => {
    setLoading(true)
    setIsDirty(false)
    onDirtyChange?.(false)
    Nutrition.getPlan(athlete.id, month, year).then(plan => {
      if (plan?.days && !Array.isArray(plan.days)) setDays(plan.days)
      else setDays(emptyDays())
      setNotes(plan?.notes || '')
      setLoading(false)
    })
  }, [athlete.id, month, year])

  const save = async () => {
    setSaving(true)
    try {
      await Nutrition.savePlan(athlete.id, month, year, days, notes)
      toast('Plan guardado ✓')
      setIsDirty(false)
      onDirtyChange?.(false)
      sendPushToAthletes([athlete.id], {
        title: 'Plan de nutrición actualizado',
        body: 'Tu nutricionista ha actualizado tu plan. Entra a ver los cambios.',
        url: '/'
      })
    } catch { toast('Error al guardar', 'error') }
    finally { setSaving(false) }
  }

  const copyPrevMonth = async () => {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const plan = await Nutrition.getPlan(athlete.id, prevMonth, prevYear)
    if (plan?.days && !Array.isArray(plan.days)) {
      setDays(plan.days)
      markDirty()
      toast('Plan del mes anterior cargado. Guarda para confirmar.')
    } else {
      toast('No hay plan en el mes anterior', 'error')
    }
  }

  const activeMeals = days[activeDay] || []
  const addMeal = (name = '') => { setDays(d => ({ ...d, [activeDay]: [...(d[activeDay] || []), { name, content: '' }] })); markDirty() }
  const updateMeal = (idx, field, val) => { setDays(d => ({ ...d, [activeDay]: d[activeDay].map((m, i) => i === idx ? { ...m, [field]: val } : m) })); markDirty() }
  const removeMeal = (idx) => { setDays(d => ({ ...d, [activeDay]: d[activeDay].filter((_, i) => i !== idx) })); markDirty() }
  const copyDay = (fromDay) => { setDays(d => ({ ...d, [activeDay]: JSON.parse(JSON.stringify(d[fromDay] || [])) })); markDirty(); toast(`Copiado desde ${Nutrition.DAY_LABELS[fromDay]}`) }
  const unusedPresets = MEAL_PRESETS.filter(p => !activeMeals.find(m => m.name === p))

  // Mejora 1: totales del día
  const dayTotals = activeMeals.reduce((acc, m) => ({
    kcal: acc.kcal + (parseFloat(m.kcal) || 0),
    protein: acc.protein + (parseFloat(m.protein) || 0),
    carbs: acc.carbs + (parseFloat(m.carbs) || 0),
    fat: acc.fat + (parseFloat(m.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const hasTotals = dayTotals.kcal > 0 || dayTotals.protein > 0 || dayTotals.carbs > 0 || dayTotals.fat > 0

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="input" style={{ flex: 1 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="input" style={{ width: 90 }} value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={copyPrevMonth}
          style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Copiar mes anterior
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Cargando...</div> : (
        <>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {Nutrition.DAYS.map(d => {
              const hasMeals = (days[d] || []).filter(m => m.content).length > 0
              const isActive = activeDay === d
              return (
                <button key={d} onClick={() => setActiveDay(d)} style={{
                  flexShrink: 0, minWidth: 36, height: 36, borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontWeight: 800, fontSize: 12,
                  background: isActive ? 'var(--accent)' : 'var(--card)',
                  color: isActive ? '#fff' : hasMeals ? 'var(--accent)' : 'var(--text-muted)',
                  position: 'relative', padding: '0 6px'
                }}>
                  {Nutrition.DAY_SHORT[d]}
                  {hasMeals && !isActive && <span style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />}
                </button>
              )
            })}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{Nutrition.DAY_LABELS[activeDay]}</div>
              {Nutrition.DAYS.filter(d => d !== activeDay && (days[d] || []).length > 0).length > 0 && (
                <select onChange={e => e.target.value && copyDay(e.target.value)} value=""
                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <option value="">Copiar de...</option>
                  {Nutrition.DAYS.filter(d => d !== activeDay && (days[d] || []).length > 0).map(d => (
                    <option key={d} value={d}>{Nutrition.DAY_LABELS[d]}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Mejora 1: chips de totales */}
            {hasTotals && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { emoji: '🔥', value: Math.round(dayTotals.kcal), label: 'kcal' },
                  { emoji: '💪', value: Math.round(dayTotals.protein), label: 'g prot' },
                  { emoji: '🍚', value: Math.round(dayTotals.carbs), label: 'g HC' },
                  { emoji: '🫒', value: Math.round(dayTotals.fat), label: 'g grasa' },
                ].map(({ emoji, value, label }) => (
                  <span key={label} style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    {emoji} {value.toLocaleString('es-ES')} {label}
                  </span>
                ))}
              </div>
            )}

            {activeMeals.length === 0 && <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>Añade las comidas de este día</div>}

            {activeMeals.map((meal, idx) => (
              <div key={idx} style={{ marginBottom: 8, padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input" placeholder="Nombre (ej: Desayuno...)" value={meal.name}
                    onChange={e => updateMeal(idx, 'name', e.target.value)} style={{ flex: 1, fontSize: 13, fontWeight: 600 }} />
                  <button onClick={() => removeMeal(idx)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
                </div>
                <textarea className="input" rows={2} placeholder="Alimentos, cantidades, preparación..."
                  value={meal.content || ''} onChange={e => updateMeal(idx, 'content', e.target.value)} style={{ fontSize: 13, resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {[['kcal','Kcal'],['protein','Prot(g)'],['carbs','HC(g)'],['fat','Grasa(g)']].map(([field, label]) => (
                    <input key={field} className="input" type="number" placeholder={label}
                      value={meal[field] || ''} onChange={e => updateMeal(idx, field, e.target.value)}
                      style={{ flex: 1, fontSize: 11, padding: '4px 6px', textAlign: 'center' }} />
                  ))}
                </div>
                {/* Mejora 5: nota por comida */}
                <input className="input" placeholder="Sustituciones o indicaciones..."
                  value={meal.note || ''} onChange={e => updateMeal(idx, 'note', e.target.value)}
                  style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', padding: '4px 8px' }} />
                {meal.note && (
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 3, paddingLeft: 2 }}>{meal.note}</div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {unusedPresets.map(p => (
                  <button key={p} onClick={() => addMeal(p)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    + {p}
                  </button>
                ))}
              </div>
              <button onClick={() => addMeal('')}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>
                + Otra comida
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Notas generales del plan</label>
            <textarea className="input" rows={3} placeholder="Observaciones, suplementación, restricciones..."
              value={notes} onChange={e => { setNotes(e.target.value); markDirty() }} />
          </div>

          {/* Mejora 6: botón guardar con indicador dirty */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar plan'}
            </button>
            {isDirty && (
              <span style={{ fontSize: 12, color: '#f97316', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>● Sin guardar</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---- DOCS ----
function AthleteDocs({ athleteId }) {
  const toast = useToast()
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('nutrition')
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    supabase.from('documents').select('*')
      .eq('athlete_id', athleteId)
      .neq('category', 'progress')
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data || []))
  }

  useEffect(() => { load() }, [athleteId])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !title.trim()) { toast('Añade un título antes de subir', 'error'); return }
    setUploading(true)
    try {
      const { url, name } = await Storage.uploadDocument(file)
      await Documents.create({ title: title.trim(), file_url: url, file_name: name, category, athlete_id: athleteId })
      toast('Documento subido ✓')
      setTitle('')
      setShowForm(false)
      load()
    } catch { toast('Error al subir', 'error') }
    finally { setUploading(false) }
  }

  const catLabel = (v) => DOC_CATEGORIES.find(c => c.value === v)?.label || v
  const catIcon = (v) => ({ athlete: '📄', medical: '🩺', nutrition: '🥗', training: '🏋️' })[v] || '📄'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Documentos</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(f => !f)}>
          {showForm ? 'Cancelar' : '+ Subir'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" placeholder="Título del documento" value={title} onChange={e => setTitle(e.target.value)} />
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <label className="btn btn-outline btn-full" style={{ textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Subiendo...' : '📎 Seleccionar archivo'}
            <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {docs.length === 0 && !showForm
        ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Sin documentos aún</div>
        : docs.map(doc => (
          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card)', borderRadius: 10 }}>
            <span style={{ fontSize: 20 }}>{catIcon(doc.category)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.title}
              </a>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{catLabel(doc.category)} · {new Date(doc.created_at).toLocaleDateString('es-ES')}</div>
            </div>
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>Ver →</a>
          </div>
        ))
      }
    </div>
  )
}

// ---- ADHERENCE ----
function AdherenceSection({ athlete }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('nutrition_logs')
      .select('date, adherence, notes')
      .eq('athlete_id', athlete.id)
      .order('date', { ascending: false })
      .limit(14)
      .then(({ data }) => {
        setLogs(data || [])
        setLoading(false)
      })
  }, [athlete.id])

  const adherenceEmoji = (value) => {
    if (value === 'yes' || value === true || value === 1) return '✅'
    if (value === 'partial') return '🔶'
    return '❌'
  }

  const adherenceLabel = (value) => {
    if (value === 'yes' || value === true || value === 1) return 'Sí'
    if (value === 'partial') return 'Parcial'
    return 'No'
  }

  if (loading) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Cargando...</div>

  if (logs.length === 0) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
      <div style={{ fontSize: 13 }}>Sin registros de adherencia aún</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
        Últimos {logs.length} días
      </div>
      {logs.map((log, idx) => (
        <div key={idx} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
          <span style={{ fontSize: 20 }}>{adherenceEmoji(log.adherence)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {new Date(log.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
            {log.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{log.notes}</div>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{adherenceLabel(log.adherence)}</div>
        </div>
      ))}
    </div>
  )
}

// ---- WELLNESS SECTION (Mejora 4) ----
function WellnessSection({ athleteId }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('wellness')
      .select('date, fatigue, soreness, mood, sleep')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
      .limit(7)
      .then(({ data }) => {
        setData(data || [])
        setLoading(false)
      })
  }, [athleteId])

  if (loading) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>Cargando bienestar...</div>

  return (
    <div className="card" style={{ padding: 14, marginBottom: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
        Bienestar últimos 7 días
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>Sin registros de bienestar</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 72, flexShrink: 0 }}>
                {new Date(row.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span title="Fatiga">😴 {row.fatigue ?? '–'}</span>
              <span title="Agujetas">🤕 {row.soreness ?? '–'}</span>
              <span title="Ánimo">😄 {row.mood ?? '–'}</span>
              <span title="Sueño">🌙 {row.sleep ?? '–'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- ATHLETE DETAIL ----
function AthleteDetail({ athlete, onBack }) {
  const [tab, setTab] = useState('nutrition')
  const [nutritionDirty, setNutritionDirty] = useState(false)

  const handleTabChange = (newTab) => {
    if (nutritionDirty && tab === 'nutrition') {
      const ok = window.confirm('Tienes cambios sin guardar en el plan. ¿Salir sin guardar?')
      if (!ok) return
    }
    setTab(newTab)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Volver</button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{athlete.name}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', flexShrink: 0 }}>
        <button className={`pill-tab ${tab === 'nutrition' ? 'active' : ''}`} onClick={() => handleTabChange('nutrition')}>Nutrición</button>
        <button className={`pill-tab ${tab === 'adherence' ? 'active' : ''}`} onClick={() => handleTabChange('adherence')}>Adherencia</button>
        <button className={`pill-tab ${tab === 'training' ? 'active' : ''}`} onClick={() => handleTabChange('training')}>Entrenos</button>
        <button className={`pill-tab ${tab === 'docs' ? 'active' : ''}`} onClick={() => handleTabChange('docs')}>Docs</button>
        <button className={`pill-tab ${tab === 'progress' ? 'active' : ''}`} onClick={() => handleTabChange('progress')}>Progreso</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'nutrition' && <NutritionPlanEditor athlete={athlete} onDirtyChange={setNutritionDirty} />}
        {tab === 'adherence' && <AdherenceSection athlete={athlete} />}
        {tab === 'training' && (
          <Suspense fallback={<div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Cargando...</div>}>
            <Training athleteId={athlete.id} embedded />
          </Suspense>
        )}
        {tab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AthleteDocs athleteId={athlete.id} />
          </div>
        )}
        {tab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Mejora 4: bienestar encima del resto */}
            <WellnessSection athleteId={athlete.id} />
            <WeightMonthly athleteId={athlete.id} />
            <MeasurementsMonthly athleteId={athlete.id} />
            <ProgressPhotos athleteId={athlete.id} canUpload={false} canDelete={false} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---- MAIN VIEW ----
export default function NutritionistView() {
  const { user, profile, signOut } = useAuth()
  const [athletes, setAthletes] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  // Mejora 3: badges de adherencia
  const [adherenceBadges, setAdherenceBadges] = useState({}) // { athleteId: 'green' | 'orange' | 'red' | null }

  useEffect(() => {
    if (!user) return
    supabase
      .from('nutritionist_athletes')
      .select('athlete_id, athletes(*)')
      .eq('nutritionist_id', user.id)
      .then(({ data }) => {
        const list = (data || []).map(r => r.athletes).filter(Boolean)
        setAthletes(list)
        setLoading(false)

        if (list.length === 0) return
        // Carga todos los logs de los últimos 3 días de una vez
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
        const dateStr = ymd(threeDaysAgo)
        const athleteIds = list.map(a => a.id)
        supabase
          .from('nutrition_logs')
          .select('athlete_id, date, adherence')
          .in('athlete_id', athleteIds)
          .gte('date', dateStr)
          .then(({ data: logs }) => {
            const badges = {}
            for (const athlete of list) {
              const aLogs = (logs || []).filter(l => l.athlete_id === athlete.id)
              if (aLogs.length === 0) {
                badges[athlete.id] = null
              } else {
                const hasNo = aLogs.some(l => l.adherence === 'no' || l.adherence === false || l.adherence === 0)
                const hasPartial = aLogs.some(l => l.adherence === 'partial')
                const allYes = aLogs.every(l => l.adherence === 'yes' || l.adherence === true || l.adherence === 1)
                if (allYes) badges[athlete.id] = 'green'
                else if (hasNo) badges[athlete.id] = 'red'
                else if (hasPartial) badges[athlete.id] = 'orange'
                else badges[athlete.id] = 'orange'
              }
            }
            setAdherenceBadges(badges)
          })
      })
  }, [user])

  const badgeColor = { green: '#22c55e', orange: '#f97316', red: '#ef4444' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--bg)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 'var(--header-height)', background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 }}>
            <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
          </div>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.3px', marginTop: 1 }}>
            Nutricionista{profile?.athletes?.name ? ` · ${profile.athletes.name}` : user?.email ? ` · ${user.email}` : ''}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Salir</button>
      </header>

      <main style={{ flex: 1, overflow: 'auto', padding: '16px 16px 32px', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <AthleteDetail athlete={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Mis deportistas</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selecciona una deportista para ver su información</p>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>Cargando...</div>
            ) : athletes.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin deportistas asignadas</div>
                <div style={{ fontSize: 13 }}>La entrenadora te asignará deportistas próximamente</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {athletes.map(a => {
                  const badge = adherenceBadges[a.id]
                  return (
                    <div key={a.id} className="card" onClick={() => setSelected(a)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}>
                      {a.avatar_url
                        ? <img src={a.avatar_url} alt={a.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, background: (a.color || '#f97316') + '30', color: a.color || '#f97316', flexShrink: 0 }}>{initials(a.name)}</div>
                      }
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.name}
                          {badge && (
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: badgeColor[badge], display: 'inline-block', flexShrink: 0 }} title={badge === 'green' ? 'Buena adherencia' : badge === 'orange' ? 'Adherencia parcial' : 'Baja adherencia'} />
                          )}
                        </div>
                        {a.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.email}</div>}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
