import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { sendPushToCoach } from '../lib/pushNotifications'
import { useToast } from '../contexts/ToastContext'

// ─────────────────────────────────────────────
// ALTA DE LA DEPORTISTA: consentimiento (RGPD) + cuestionario de salud + datos de entrenamiento
// ─────────────────────────────────────────────
export const CONSENT_VERSION = 'v1-2026-10'
const COACH_NAME = 'Celia Morán Saras'
const COACH_EMAIL = 'celia.moransaras@gmail.com'
const PRIVACY_URL = 'https://celiamoransaras.com/privacidad.html'

export const PARQ = [
  { key: 'heart',     q: '¿Algún médico te ha dicho que tienes un problema de corazón o tensión alta?' },
  { key: 'chest',     q: '¿Sientes dolor en el pecho en reposo, en tu día a día o al hacer ejercicio?' },
  { key: 'dizzy',     q: '¿En los últimos 12 meses has perdido el equilibrio por mareo o has perdido el conocimiento?' },
  { key: 'chronic',   q: '¿Te han diagnosticado alguna otra enfermedad crónica?' },
  { key: 'meds',      q: '¿Tomas medicación con receta para alguna enfermedad crónica?' },
  { key: 'joints',    q: '¿Tienes (o has tenido en los últimos 12 meses) algún problema de huesos, articulaciones o músculos que pueda empeorar con el ejercicio?' },
  { key: 'supervised',q: '¿Algún médico te ha dicho que solo debes hacer ejercicio con supervisión médica?' },
  { key: 'pregnancy', q: '¿Estás embarazada o has dado a luz en los últimos 12 meses?', femaleOnly: true },
]
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const GOALS = ['Hyrox', 'Ganar fuerza', 'Correr mejor', 'Salud y bienestar', 'Volver tras una lesión', 'Competir']
const EQUIP = ['Gimnasio completo', 'Box de Hyrox / CrossFit', 'Material en casa', 'Sin material', 'Ergómetros (ski, remo, bike)']

export const parqFlag = (parq = {}) => Object.values(parq).some(v => v === true)

export async function loadIntake(athleteId) {
  const { data, error } = await supabase.from('athlete_intake').select('*').eq('athlete_id', athleteId).maybeSingle()
  if (error) return { unavailable: true }
  return { intake: data }
}
export const intakeComplete = (i) => !!(i && i.consent_privacy && i.consent_health && i.consent_version)

const Chip = ({ on, children, onClick }) => (
  <button type="button" onClick={onClick}
    style={{ padding: '8px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-dim)' : 'var(--card)', color: on ? 'var(--accent)' : 'var(--text)' }}>
    {children}
  </button>
)
const Check = ({ checked, onChange, children }) => (
  <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 10 }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }} />
    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</span>
  </label>
)

export function IntakeFlow({ athlete, athleteId, existing, onDone, onClose }) {
  const toast = useToast()
  const editing = intakeComplete(existing)
  const female = athlete?.gender === 'female'
  const [step, setStep] = useState(editing ? 1 : 0)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState(() => ({
    consent_privacy: !!existing?.consent_privacy,
    consent_health: !!existing?.consent_health,
    parq: existing?.parq || {},
    medical_notes: existing?.medical_notes || '',
    goals: existing?.goals || '',
    availability: existing?.availability || [],
    sessions_per_week: existing?.sessions_per_week || 3,
    equipment: existing?.equipment || '',
    injuries_history: existing?.injuries_history || '',
  }))
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const questions = PARQ.filter(p => !p.femaleOnly || female)
  const parqDone = questions.every(p => typeof f.parq[p.key] === 'boolean')
  const flag = parqFlag(f.parq)
  const toggleList = (k, v) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v])
  const goalsList = f.goals ? f.goals.split(' · ').filter(Boolean) : []
  const toggleGoal = (g) => set('goals', (goalsList.includes(g) ? goalsList.filter(x => x !== g) : [...goalsList, g]).join(' · '))
  const equipList = f.equipment ? f.equipment.split(' · ').filter(Boolean) : []
  const toggleEquip = (g) => set('equipment', (equipList.includes(g) ? equipList.filter(x => x !== g) : [...equipList, g]).join(' · '))

  const save = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const row = {
      athlete_id: athleteId, ...f, parq_flag: flag,
      consent_version: existing?.consent_version || CONSENT_VERSION,
      consent_at: existing?.consent_at || now,
      updated_at: now, coach_seen_at: null,
    }
    const { error } = await supabase.from('athlete_intake').upsert(row, { onConflict: 'athlete_id' })
    setSaving(false)
    if (error) { toast('No se pudo guardar: ' + error.message, 'error'); return }
    sendPushToCoach({
      title: `📝 ${athlete?.name || 'Una deportista'} ${editing ? 'ha actualizado' : 'ha completado'} su cuestionario`,
      body: flag ? '⚠️ Tiene respuestas de salud que conviene revisar' : 'Ya puedes verlo en su ficha',
      url: '/',
    })
    toast(editing ? 'Datos actualizados' : '¡Listo! Gracias')
    onDone?.({ ...existing, ...row })
  }

  const steps = ['Privacidad', 'Salud', 'Entrenamiento']
  const canNext = step === 0 ? (f.consent_privacy && f.consent_health) : step === 1 ? parqDone : true

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'max(16px, env(safe-area-inset-top)) 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase' }}>{editing ? 'Mis datos' : 'Antes de empezar'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paso {step + 1} de 3 · {steps[step]}</div>
        </div>
        {onClose && <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px' }}>
        {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--border)' }} />)}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {step === 0 && (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 14 }}>
              ¡Hola{athlete?.name ? `, ${athlete.name.split(' ')[0]}` : ''}! Para entrenarte bien, Celia necesita algunos datos tuyos, también de salud. Esto es lo que pasa con ellos:
            </div>
            <div className="card" style={{ padding: '14px 16px', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              <div><strong>Quién los trata:</strong> {COACH_NAME}, tu entrenadora.</div>
              <div><strong>Qué datos:</strong> tus datos de contacto, tus entrenos y valoraciones, y datos de salud que tú registres (lesiones, ciclo menstrual, bienestar, peso, medidas, fotos y este cuestionario).</div>
              <div><strong>Para qué:</strong> solo para planificar, ajustar y seguir tu entrenamiento.</div>
              <div><strong>Quién los ve:</strong> tú y Celia. No se venden ni se ceden a nadie; se guardan en los servicios que alojan la app.</div>
              <div><strong>Cuánto tiempo:</strong> mientras entrenes con Celia; cuando lo dejes, se borran si lo pides.</div>
              <div><strong>Tus derechos:</strong> ver, corregir, descargar o borrar tus datos y retirar este consentimiento cuando quieras, desde tu perfil o escribiendo a {COACH_EMAIL}.</div>
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 700 }}>Leer la política de privacidad completa →</a>
            </div>
            <Check checked={f.consent_privacy} onChange={v => set('consent_privacy', v)}>
              He leído la información de privacidad y acepto que se traten mis datos para mi entrenamiento.
            </Check>
            <Check checked={f.consent_health} onChange={v => set('consent_health', v)}>
              <strong>Doy mi consentimiento expreso</strong> para que se traten mis datos de salud (lesiones, ciclo, bienestar, medidas y cuestionario de salud) con este fin.
            </Check>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              Unas preguntas rápidas de salud antes de hacer ejercicio. Responde con sinceridad: no es un examen, es para cuidarte.
            </div>
            {questions.map(p => (
              <div key={p.key} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 10 }}>{p.q}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: false, l: 'No' }, { v: true, l: 'Sí' }].map(o => (
                    <button key={o.l} type="button" onClick={() => set('parq', { ...f.parq, [p.key]: o.v })}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${f.parq[p.key] === o.v ? (o.v ? 'var(--warning)' : 'var(--success)') : 'var(--border)'}`, background: f.parq[p.key] === o.v ? (o.v ? 'var(--warning-dim, #FEF3C7)' : 'var(--success-dim)') : 'var(--bg)', color: 'var(--text)' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {flag && (
              <>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--warning-dim, #FEF3C7)', fontSize: 13, lineHeight: 1.5, margin: '6px 0 10px', color: '#92400E' }}>
                  Has respondido «sí» a alguna pregunta. Te recomendamos consultarlo con tu médico antes de subir la intensidad. Celia lo tendrá en cuenta al planificar.
                </div>
                <div className="input-group">
                  <label className="input-label">Cuéntale a Celia lo que quieras (opcional)</label>
                  <textarea className="input" rows={3} value={f.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="Por ejemplo: tomo medicación para el tiroides, me operaron de la rodilla en 2024..." />
                </div>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="input-label" style={{ marginBottom: 8 }}>¿Cuál es tu objetivo?</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {GOALS.map(g => <Chip key={g} on={goalsList.includes(g)} onClick={() => toggleGoal(g)}>{g}</Chip>)}
            </div>
            <div className="input-label" style={{ marginBottom: 8 }}>¿Qué días puedes entrenar?</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggleList('availability', d)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${f.availability.includes(d) ? 'var(--accent)' : 'var(--border)'}`, background: f.availability.includes(d) ? 'var(--accent)' : 'var(--card)', color: f.availability.includes(d) ? '#fff' : 'var(--text)' }}>
                  {d}
                </button>
              ))}
            </div>
            <div className="input-group">
              <label className="input-label">Sesiones por semana que te gustaría hacer</label>
              <select className="input" value={f.sessions_per_week} onChange={e => set('sessions_per_week', Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="input-label" style={{ marginBottom: 8 }}>¿Dónde y con qué entrenas?</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {EQUIP.map(g => <Chip key={g} on={equipList.includes(g)} onClick={() => toggleEquip(g)}>{g}</Chip>)}
            </div>
            <div className="input-group">
              <label className="input-label">Lesiones o molestias que hayas tenido</label>
              <textarea className="input" rows={3} value={f.injuries_history} onChange={e => set('injuries_history', e.target.value)} placeholder="Por ejemplo: esguince de tobillo derecho en 2023, a veces me molesta la lumbar..." />
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px 20px max(16px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {step > (editing ? 1 : 0) && <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} style={{ flex: 1 }}>← Atrás</button>}
        {step < 2
          ? <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(s => s + 1)} style={{ flex: 2, opacity: canNext ? 1 : 0.5 }}>
              {step === 0 && !canNext ? 'Marca las dos casillas' : step === 1 && !canNext ? 'Responde todas' : 'Siguiente →'}
            </button>
          : <button className="btn btn-primary" disabled={saving} onClick={save} style={{ flex: 2 }}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Terminar ✓'}</button>}
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────
// Privacidad en el perfil de la deportista: revisar datos, descargarlos, pedir la baja
// ─────────────────────────────────────────────
const EXPORT_TABLES = ['athletes', 'athlete_intake', 'wellness', 'injuries', 'personal_records', 'goals', 'payments', 'weight_logs', 'achievements', 'session_athletes', 'session_change_requests']

export function PrivacyActions({ athlete, athleteId, intake, onEdit, onChange }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const download = async () => {
    setBusy(true)
    const out = { generado: new Date().toISOString(), deportista: athlete?.name }
    for (const t of EXPORT_TABLES) {
      const col = t === 'athletes' ? 'id' : 'athlete_id'
      const { data } = await supabase.from(t).select('*').eq(col, athleteId)
      out[t] = data || []
    }
    const { data: msgs } = await supabase.from('messages').select('*').eq('group_id', athleteId)
    out.mensajes_privados = msgs || []
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'mis-datos-northstone.json'
    document.body.appendChild(a); a.click(); a.remove()
    setBusy(false)
    toast('Datos descargados')
  }

  const requestDeletion = async () => {
    setBusy(true)
    const { error } = await supabase.from('athlete_intake').upsert({ athlete_id: athleteId, deletion_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'athlete_id' })
    setBusy(false); setConfirm(false)
    if (error) { toast('No se pudo enviar: ' + error.message, 'error'); return }
    sendPushToCoach({ title: `🗑 ${athlete?.name || 'Una deportista'} pide darse de baja`, body: 'Quiere que se borren su cuenta y sus datos', url: '/' })
    toast('Petición enviada a Celia')
    onChange?.()
  }

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>🔐 Mis datos y privacidad</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-secondary btn-full" onClick={onEdit}>📝 Ver o cambiar mi cuestionario</button>
        <button className="btn btn-secondary btn-full" onClick={download} disabled={busy}>⬇️ Descargar mis datos</button>
        {intake?.deletion_requested_at
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Has pedido la baja el {new Date(intake.deletion_requested_at).toLocaleDateString('es-ES')}. Celia se pondrá en contacto contigo.</div>
          : confirm
            ? <div style={{ padding: 10, borderRadius: 10, background: 'var(--error-dim)', fontSize: 13, lineHeight: 1.5 }}>
                Se avisará a Celia para borrar tu cuenta y todos tus datos (también retira tu consentimiento). ¿Seguro?
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setConfirm(false)}>No</button>
                  <button className="btn btn-sm" style={{ flex: 1, background: 'var(--error)', color: '#fff' }} disabled={busy} onClick={requestDeletion}>Sí, pedir la baja</button>
                </div>
              </div>
            : <button className="btn btn-ghost btn-full" style={{ color: 'var(--error)' }} onClick={() => setConfirm(true)}>Pedir la baja y el borrado de mis datos</button>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Vista de la entrenadora en la ficha de la deportista
// ─────────────────────────────────────────────
export function IntakeSummary({ athleteId, athlete }) {
  const [state, setState] = useState(undefined)
  useEffect(() => {
    let alive = true
    loadIntake(athleteId).then(r => {
      if (!alive) return
      setState(r)
      if (r.intake && !r.intake.coach_seen_at) supabase.from('athlete_intake').update({ coach_seen_at: new Date().toISOString() }).eq('athlete_id', athleteId).then(() => {})
    })
    return () => { alive = false }
  }, [athleteId])

  if (state === undefined) return null
  if (state.unavailable) return null
  const i = state.intake
  const female = athlete?.gender === 'female'
  if (!intakeComplete(i)) {
    return (
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>📝 Cuestionario de alta</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Pendiente: se le pedirá la próxima vez que entre en la app.</div>
        {i?.deletion_requested_at && <div style={{ fontSize: 13, color: 'var(--error)', marginTop: 6, fontWeight: 700 }}>🗑 Pidió la baja el {new Date(i.deletion_requested_at).toLocaleDateString('es-ES')}</div>}
      </div>
    )
  }
  const yes = PARQ.filter(p => (!p.femaleOnly || female) && i.parq?.[p.key] === true)
  const Line = ({ label, children }) => children ? (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 2, whiteSpace: 'pre-line' }}>{children}</div>
    </div>
  ) : null
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>📝 Cuestionario de alta</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Consentimiento {new Date(i.consent_at).toLocaleDateString('es-ES')}</div>
      </div>
      {i.deletion_requested_at && <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--error-dim)', color: 'var(--error)', fontSize: 13, fontWeight: 700 }}>🗑 Pidió la baja y el borrado de sus datos el {new Date(i.deletion_requested_at).toLocaleDateString('es-ES')}</div>}
      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: yes.length ? 'var(--warning-dim, #FEF3C7)' : 'var(--success-dim)', fontSize: 13, lineHeight: 1.5 }}>
        {yes.length ? <><strong>⚠️ Salud: respondió «sí» a:</strong><ul style={{ margin: '4px 0 0 18px' }}>{yes.map(p => <li key={p.key}>{p.q}</li>)}</ul></> : '✅ Cuestionario de salud sin respuestas de riesgo'}
      </div>
      <Line label="Notas de salud">{i.medical_notes}</Line>
      <Line label="Objetivo">{i.goals}</Line>
      <Line label="Disponibilidad">{(i.availability || []).length ? `${(i.availability || []).join(' · ')}${i.sessions_per_week ? ` · ${i.sessions_per_week} sesiones/semana` : ''}` : (i.sessions_per_week ? `${i.sessions_per_week} sesiones/semana` : '')}</Line>
      <Line label="Material">{i.equipment}</Line>
      <Line label="Lesiones previas">{i.injuries_history}</Line>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Actualizado el {new Date(i.updated_at || i.consent_at).toLocaleDateString('es-ES')}</div>
    </div>
  )
}
