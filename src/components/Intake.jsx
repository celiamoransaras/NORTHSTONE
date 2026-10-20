import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { sendPushToCoach } from '../lib/pushNotifications'
import { useToast } from '../contexts/ToastContext'

// ─────────────────────────────────────────────
// ALTA DE LA DEPORTISTA (v2)
//  1. Privacidad y consentimiento (RGPD)
//  2. Salud general (tipo PAR-Q)
//  3. Salud femenina: ciclo, anticoncepción, meses sin regla, suelo pélvico (solo mujeres)
//  4. Tu deporte: experiencia, competiciones, marcas y competición objetivo
//  5. Tu día a día: sueño, estrés, trabajo y tiempo por sesión
//  6. Entrenamiento y preferencias: objetivo, días, material, lesiones, gustos, contacto de emergencia
// Las preguntas de los pasos 3 a 6 son opcionales.
// ─────────────────────────────────────────────
export const CONSENT_VERSION = 'v1-2026-10'
export const INTAKE_VERSION = 2
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
const CONTRA = ['No', 'Píldora', 'DIU hormonal', 'Implante', 'Anillo o parche', 'Inyección', 'DIU de cobre', 'Otro']
const HORMONAL = ['Píldora', 'DIU hormonal', 'Implante', 'Anillo o parche', 'Inyección']
const YEARS = ['Menos de 1 año', '1-3 años', '3-5 años', 'Más de 5 años']
const COMPETED = ['Hyrox', 'DEKA', 'Carreras', 'Trail', 'CrossFit', 'Triatlón', 'Otra']
const SLEEP = ['Menos de 6 h', '6-7 h', '7-8 h', 'Más de 8 h']
const STRESS = ['Bajo', 'Normal', 'Alto', 'Muy alto']
const JOB = ['Sentada casi todo el día', 'De pie / en movimiento', 'Trabajo físico', 'A turnos o de noche', 'Estudio', 'Otro']
const SESSION_TIME = ['30 min', '45 min', '60 min', '75 min', '90 min o más']
const FEEDBACK = ['Directo y al grano', 'Con explicación del porqué', 'Con mucho ánimo']
const LEAKS = ['Nunca', 'A veces', 'A menudo']

export const parqFlag = (parq = {}) => Object.values(parq).some(v => v === true)

// Señales a revisar del cuestionario (para la ficha y Pendientes)
export function intakeFlags(i) {
  if (!i) return []
  const v = i.v2 || {}
  const out = []
  if (parqFlag(i.parq)) out.push('Respuestas de salud a revisar')
  if (v.amenorrhea === true) out.push('3 meses o más sin regla en el último año')
  if (v.cycle_regular === 'No') out.push('Ciclo irregular')
  if (v.urine_leaks === 'A menudo') out.push('Pérdidas de orina a menudo')
  if (v.sleep === 'Menos de 6 h') out.push('Duerme menos de 6 h')
  if (v.stress === 'Muy alto') out.push('Estrés muy alto')
  if ((v.current_injuries || '').trim()) out.push('Lesión o molestia actual')
  return out
}

export async function loadIntake(athleteId) {
  const { data, error } = await supabase.from('athlete_intake').select('*').eq('athlete_id', athleteId).maybeSingle()
  if (error) return { unavailable: true }
  return { intake: data }
}
export const intakeComplete = (i) => !!(i && i.consent_privacy && i.consent_health && i.consent_version)
// Ya lo rellenó, pero falta la versión nueva (solo si la base de datos ya tiene la columna)
export const intakeNeedsUpdate = (i) => !!(i && intakeComplete(i) && 'intake_version' in i && (i.intake_version || 1) < INTAKE_VERSION)

// "24:30", "24.30", "1:25:00" → segundos
const parseTime = (txt) => {
  const t = String(txt || '').trim().replace(/[’'.,]/g, ':')
  if (!t) return null
  const p = t.split(':').map(Number)
  if (p.some(n => !Number.isFinite(n))) return null
  if (p.length === 2) return p[0] * 60 + p[1]
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  return null
}
const toMss = (s) => { const m = Math.floor(s / 60), r = Math.round(s % 60); return Number(`${m}.${String(r).padStart(2, '0')}`) }

const Chip = ({ on, children, onClick }) => (
  <button type="button" onClick={onClick}
    style={{ padding: '8px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-dim)' : 'var(--card)', color: on ? 'var(--accent)' : 'var(--text)' }}>
    {children}
  </button>
)
const Chips = ({ options, value, onChange, multi }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
    {options.map(o => {
      const on = multi ? (value || []).includes(o) : value === o
      return <Chip key={o} on={on} onClick={() => onChange(multi ? (on ? value.filter(x => x !== o) : [...(value || []), o]) : (on ? '' : o))}>{o}</Chip>
    })}
  </div>
)
const Label = ({ children, optional }) => (
  <div className="input-label" style={{ marginBottom: 8 }}>{children}{optional && <span style={{ textTransform: 'none', fontWeight: 500 }}> · opcional</span>}</div>
)
const YesNo = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
    {[{ v: false, l: 'No' }, { v: true, l: 'Sí' }].map(o => (
      <button key={o.l} type="button" onClick={() => onChange(value === o.v ? undefined : o.v)}
        style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${value === o.v ? (o.v ? 'var(--warning)' : 'var(--success)') : 'var(--border)'}`, background: value === o.v ? (o.v ? 'var(--warning-dim, #FEF3C7)' : 'var(--success-dim)') : 'var(--bg)', color: 'var(--text)' }}>
        {o.l}
      </button>
    ))}
  </div>
)
const Check = ({ checked, onChange, children }) => (
  <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--card)', border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 10 }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0 }} />
    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{children}</span>
  </label>
)
const Note = ({ children, tone = 'info' }) => (
  <div style={{ padding: '12px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, marginBottom: 14, background: tone === 'warn' ? 'var(--warning-dim, #FEF3C7)' : 'var(--accent-dim)', color: tone === 'warn' ? '#92400E' : 'var(--text)' }}>{children}</div>
)

export function IntakeFlow({ athlete, athleteId, existing, onDone, onClose }) {
  const toast = useToast()
  const complete = intakeComplete(existing)
  const updating = complete && intakeNeedsUpdate(existing) && !onClose // le faltan solo las preguntas nuevas
  const v2Available = !existing || 'intake_version' in existing
  const female = athlete?.gender === 'female'
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
  const [v, setV] = useState(() => ({ cycle_length: athlete?.cycle_length || 28, competed: [], ...(existing?.v2 || {}) }))
  const set = (k, val) => setF(x => ({ ...x, [k]: val }))
  const sv = (k, val) => setV(x => ({ ...x, [k]: val }))
  const split = (str) => str ? str.split(' · ').filter(Boolean) : []
  const toggleText = (k, g) => setF(x => { const l = split(x[k]); return { ...x, [k]: (l.includes(g) ? l.filter(y => y !== g) : [...l, g]).join(' · ') } })
  const toggleDay = (d) => setF(x => ({ ...x, availability: x.availability.includes(d) ? x.availability.filter(y => y !== d) : [...x.availability, d] }))
  const answer = (key, val) => setF(x => ({ ...x, parq: { ...x.parq, [key]: val } }))

  // Pasos según la situación: alta completa, solo preguntas nuevas, o edición desde el perfil
  const all = [
    { id: 'privacy', title: 'Privacidad' },
    { id: 'health', title: 'Salud' },
    ...(female && v2Available ? [{ id: 'female', title: 'Salud femenina' }] : []),
    ...(v2Available ? [{ id: 'sport', title: 'Tu deporte' }, { id: 'life', title: 'Tu día a día' }] : []),
    { id: 'training', title: 'Entrenamiento' },
  ]
  const steps = updating ? all.filter(s => ['female', 'sport', 'life', 'training'].includes(s.id))
    : complete ? all.filter(s => s.id !== 'privacy')
      : all
  const [idx, setIdx] = useState(0)
  const step = steps[idx]?.id
  const questions = PARQ.filter(p => !p.femaleOnly || female)
  const parqDone = questions.every(p => typeof f.parq[p.key] === 'boolean')
  const canNext = step === 'privacy' ? (f.consent_privacy && f.consent_health) : step === 'health' ? parqDone : true

  const save = async () => {
    // Validar marcas (opcionales)
    const marks = [
      { k: 'mark_5k', name: '5 km', min: 600, max: 7200 },
      { k: 'mark_10k', name: '10 km', min: 1200, max: 14400 },
      { k: 'mark_hyrox', name: 'Hyrox (tiempo total)', min: 2400, max: 14400 },
    ]
    for (const m of marks) {
      if ((v[m.k] || '').trim()) {
        const s = parseTime(v[m.k])
        if (!s || s < m.min || s > m.max) { toast(`Revisa tu marca de ${m.name} (p. ej. 24:30 o 1:25:00)`, 'error'); return }
      }
    }
    setSaving(true)
    const now = new Date().toISOString()
    const row = {
      athlete_id: athleteId, ...f, parq_flag: parqFlag(f.parq),
      consent_version: existing?.consent_version || CONSENT_VERSION,
      consent_at: existing?.consent_at || now,
      updated_at: now, coach_seen_at: null,
      ...(v2Available ? { v2: v, intake_version: INTAKE_VERSION } : {}),
    }
    const { error } = await supabase.from('athlete_intake').upsert(row, { onConflict: 'athlete_id' })
    if (error) { setSaving(false); toast('No se pudo guardar: ' + error.message, 'error'); return }

    // Aprovechar lo que ha contado: ciclo y marcas pasan a su ficha (solo lo nuevo)
    const prev = existing?.v2 || {}
    try {
      if (female && v.last_period && v.last_period !== prev.last_period && v.last_period <= ymd(new Date())) {
        await supabase.from('injuries').insert({ athlete_id: athleteId, type: 'cycle', body_part: '', date_start: v.last_period, severity: 'mild', notes: '' })
      }
      if (female && Number(v.cycle_length) >= 20 && Number(v.cycle_length) <= 45 && Number(v.cycle_length) !== Number(athlete?.cycle_length || 28)) {
        await supabase.from('athletes').update({ cycle_length: Number(v.cycle_length) }).eq('id', athleteId)
      }
      const recs = marks.filter(m => (v[m.k] || '').trim() && v[m.k] !== prev[m.k])
        .map(m => ({ athlete_id: athleteId, name: m.name, value: toMss(parseTime(v[m.k])), unit: 'min', date: ymd(new Date()), notes: 'Marca indicada en el cuestionario de alta' }))
      if (recs.length) await supabase.from('personal_records').insert(recs)
    } catch { /* no bloquea el alta */ }

    setSaving(false)
    const flags = intakeFlags(row)
    sendPushToCoach({
      title: `📝 ${athlete?.name || 'Una deportista'} ${complete ? 'ha actualizado' : 'ha completado'} su cuestionario`,
      body: flags.length ? `⚠️ ${flags.join(' · ')}` : 'Ya puedes verlo en su ficha',
      url: '/',
    })
    toast(complete && onClose ? 'Datos actualizados' : '¡Listo! Gracias')
    onDone?.({ ...existing, ...row })
  }

  const isLast = idx === steps.length - 1

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'max(16px, env(safe-area-inset-top)) 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase' }}>{onClose ? 'Mis datos' : updating ? 'Unas preguntas más' : 'Antes de empezar'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paso {idx + 1} de {steps.length} · {steps[idx]?.title}</div>
        </div>
        {onClose && <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px' }}>
        {steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= idx ? 'var(--accent)' : 'var(--border)' }} />)}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {updating && idx === 0 && (
          <Note>Celia ha añadido unas preguntas para conocerte mejor y ajustar tus entrenos. Son 2 minutos y casi todo es tocar. Lo que ya contestaste se mantiene.</Note>
        )}

        {step === 'privacy' && (
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
            <Check checked={f.consent_privacy} onChange={val => set('consent_privacy', val)}>
              He leído la información de privacidad y acepto que se traten mis datos para mi entrenamiento.
            </Check>
            <Check checked={f.consent_health} onChange={val => set('consent_health', val)}>
              <strong>Doy mi consentimiento expreso</strong> para que se traten mis datos de salud (lesiones, ciclo, bienestar, medidas y cuestionario de salud) con este fin.
            </Check>
          </>
        )}

        {step === 'health' && (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              Unas preguntas rápidas de salud antes de hacer ejercicio. Responde con sinceridad: no es un examen, es para cuidarte.
            </div>
            {questions.map(p => (
              <div key={p.key} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 10 }}>{p.q}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: false, l: 'No' }, { v: true, l: 'Sí' }].map(o => (
                    <button key={o.l} type="button" onClick={() => answer(p.key, o.v)}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${f.parq[p.key] === o.v ? (o.v ? 'var(--warning)' : 'var(--success)') : 'var(--border)'}`, background: f.parq[p.key] === o.v ? (o.v ? 'var(--warning-dim, #FEF3C7)' : 'var(--success-dim)') : 'var(--bg)', color: 'var(--text)' }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {parqFlag(f.parq) && (
              <>
                <Note tone="warn">Has respondido «sí» a alguna pregunta. Te recomendamos consultarlo con tu médico antes de subir la intensidad. Celia lo tendrá en cuenta al planificar.</Note>
                <div className="input-group">
                  <label className="input-label">Cuéntale a Celia lo que quieras (opcional)</label>
                  <textarea className="input" rows={3} value={f.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="Por ejemplo: tomo medicación para el tiroides, me operaron de la rodilla en 2024..." />
                </div>
              </>
            )}
          </>
        )}

        {step === 'female' && (
          <>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
              Tu ciclo dice mucho de cómo responde tu cuerpo al entrenamiento y de si estás comiendo y descansando lo suficiente. Todo es opcional.
            </div>
            <Label optional>¿Tu regla suele ser regular?</Label>
            <Chips options={['Sí', 'No', 'No lo sé']} value={v.cycle_regular} onChange={x => sv('cycle_regular', x)} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Primer día de tu última regla</label>
                <input className="input" type="date" max={ymd(new Date())} value={v.last_period || ''} onChange={e => sv('last_period', e.target.value)} />
              </div>
              <div className="input-group" style={{ width: 120 }}>
                <label className="input-label">Duración ciclo</label>
                <select className="input" value={v.cycle_length || 28} onChange={e => sv('cycle_length', Number(e.target.value))}>
                  {Array.from({ length: 26 }, (_, i) => i + 20).map(n => <option key={n} value={n}>{n} días</option>)}
                </select>
              </div>
            </div>
            <Label optional>¿Usas anticonceptivos?</Label>
            <Chips options={CONTRA} value={v.contraception} onChange={x => sv('contraception', x)} />
            {HORMONAL.includes(v.contraception) && (
              <Note>Con anticonceptivos hormonales el «sangrado» no es una regla natural: Celia lo tendrá en cuenta al leer tu ciclo.</Note>
            )}
            <Label optional>En el último año, ¿has estado 3 meses o más sin regla (sin estar embarazada ni dando el pecho)?</Label>
            <YesNo value={v.amenorrhea} onChange={x => sv('amenorrhea', x)} />
            {v.amenorrhea === true && (
              <Note tone="warn">Gracias por contarlo. Perder la regla puede indicar que el cuerpo no tiene energía suficiente para todo lo que le pides. Celia lo tendrá en cuenta y te recomendamos comentarlo con tu ginecóloga o médico.</Note>
            )}
            <Label optional>¿Se te escapa algo de orina al saltar, correr o hacer esfuerzos?</Label>
            <Chips options={LEAKS} value={v.urine_leaks} onChange={x => sv('urine_leaks', x)} />
            {(v.urine_leaks === 'A veces' || v.urine_leaks === 'A menudo') && (
              <Note>Es muy común en deportistas y tiene solución. Celia adaptará saltos y burpees si hace falta; una fisio de suelo pélvico puede ayudarte mucho.</Note>
            )}
          </>
        )}

        {step === 'sport' && (
          <>
            <Label optional>¿Cuánto tiempo llevas entrenando de forma regular?</Label>
            <Chips options={YEARS} value={v.years_training} onChange={x => sv('years_training', x)} />
            <div className="input-group">
              <label className="input-label">¿Qué deportes has hecho o haces? <span style={{ textTransform: 'none', fontWeight: 500 }}>· opcional</span></label>
              <input className="input" value={v.sports || ''} onChange={e => sv('sports', e.target.value)} placeholder="Por ejemplo: running, gimnasio, pádel, natación..." />
            </div>
            <Label optional>¿Has competido alguna vez?</Label>
            <Chips multi options={COMPETED} value={v.competed || []} onChange={x => sv('competed', x)} />
            <Label optional>Tus marcas actuales (aproximadas)</Label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[{ k: 'mark_5k', l: '5 km', ph: '25:00' }, { k: 'mark_10k', l: '10 km', ph: '52:00' }, { k: 'mark_hyrox', l: 'Hyrox', ph: '1:25:00' }].map(m => (
                <div key={m.k} style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>{m.l}</div>
                  <input className="input" inputMode="text" placeholder={m.ph} value={v[m.k] || ''} onChange={e => sv(m.k, e.target.value)} />
                </div>
              ))}
            </div>
            <Label optional>¿Tienes alguna competición en mente?</Label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="p. ej. Hyrox Madrid" value={v.target_event || ''} onChange={e => sv('target_event', e.target.value)} />
              <input className="input" style={{ width: 150 }} type="date" min={ymd(new Date())} value={v.target_date || ''} onChange={e => sv('target_date', e.target.value)} />
            </div>
          </>
        )}

        {step === 'life' && (
          <>
            <Label optional>¿Cuánto duermes normalmente?</Label>
            <Chips options={SLEEP} value={v.sleep} onChange={x => sv('sleep', x)} />
            <Label optional>¿Cómo es tu nivel de estrés estos meses?</Label>
            <Chips options={STRESS} value={v.stress} onChange={x => sv('stress', x)} />
            <Label optional>Tu trabajo o día a día</Label>
            <Chips options={JOB} value={v.job} onChange={x => sv('job', x)} />
            <Label optional>¿Cuánto tiempo tienes para cada sesión?</Label>
            <Chips options={SESSION_TIME} value={v.session_time} onChange={x => sv('session_time', x)} />
          </>
        )}

        {step === 'training' && (
          <>
            <Label>¿Cuál es tu objetivo?</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {GOALS.map(g => <Chip key={g} on={split(f.goals).includes(g)} onClick={() => toggleText('goals', g)}>{g}</Chip>)}
            </div>
            <Label>¿Qué días puedes entrenar?</Label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
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
            <Label>¿Dónde y con qué entrenas?</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {EQUIP.map(g => <Chip key={g} on={split(f.equipment).includes(g)} onClick={() => toggleText('equipment', g)}>{g}</Chip>)}
            </div>
            {v2Available && (
              <div className="input-group">
                <label className="input-label">¿Tienes ahora alguna lesión o molestia? <span style={{ textTransform: 'none', fontWeight: 500 }}>· opcional</span></label>
                <textarea className="input" rows={2} value={v.current_injuries || ''} onChange={e => sv('current_injuries', e.target.value)} placeholder="Por ejemplo: me molesta la rodilla al bajar escaleras" />
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Lesiones u operaciones que hayas tenido <span style={{ textTransform: 'none', fontWeight: 500 }}>· opcional</span></label>
              <textarea className="input" rows={2} value={f.injuries_history} onChange={e => set('injuries_history', e.target.value)} placeholder="Por ejemplo: esguince de tobillo en 2023, operación de menisco en 2021..." />
            </div>
            {v2Available && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="input-group" style={{ flex: 1, minWidth: 0 }}>
                    <label className="input-label">Lo que más te gusta</label>
                    <input className="input" value={v.likes || ''} onChange={e => sv('likes', e.target.value)} placeholder="p. ej. correr, el trineo" />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: 0 }}>
                    <label className="input-label">Lo que menos</label>
                    <input className="input" value={v.dislikes || ''} onChange={e => sv('dislikes', e.target.value)} placeholder="p. ej. burpees" />
                  </div>
                </div>
                <Label optional>¿Cómo prefieres que te corrija Celia?</Label>
                <Chips options={FEEDBACK} value={v.feedback} onChange={x => sv('feedback', x)} />
                <Label optional>Contacto de emergencia</Label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Nombre" value={v.emergency_name || ''} onChange={e => sv('emergency_name', e.target.value)} />
                  <input className="input" style={{ flex: 1, minWidth: 0 }} type="tel" placeholder="Teléfono" value={v.emergency_phone || ''} onChange={e => sv('emergency_phone', e.target.value)} />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px 20px max(16px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {idx > 0 && <button className="btn btn-secondary" onClick={() => setIdx(i => i - 1)} style={{ flex: 1 }}>← Atrás</button>}
        {!isLast
          ? <button className="btn btn-primary" disabled={!canNext} onClick={() => setIdx(i => i + 1)} style={{ flex: 2, opacity: canNext ? 1 : 0.5 }}>
              {step === 'privacy' && !canNext ? 'Marca las dos casillas' : step === 'health' && !canNext ? 'Responde todas' : 'Siguiente →'}
            </button>
          : <button className="btn btn-primary" disabled={saving} onClick={save} style={{ flex: 2 }}>{saving ? 'Guardando...' : onClose ? 'Guardar cambios' : 'Terminar ✓'}</button>}
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
  const toast = useToast()
  const [state, setState] = useState(undefined)
  const [goalDone, setGoalDone] = useState(false)
  useEffect(() => {
    let alive = true
    loadIntake(athleteId).then(r => {
      if (!alive) return
      setState(r)
      if (r.intake && !r.intake.coach_seen_at) supabase.from('athlete_intake').update({ coach_seen_at: new Date().toISOString() }).eq('athlete_id', athleteId).then(() => {})
    })
    return () => { alive = false }
  }, [athleteId])

  if (state === undefined || state.unavailable) return null
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
  const v = i.v2 || {}
  const yes = PARQ.filter(p => (!p.femaleOnly || female) && i.parq?.[p.key] === true)
  const flags = intakeFlags(i).filter(x => x !== 'Respuestas de salud a revisar')
  const fmtDay = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
  const Section = ({ title, children }) => <div style={{ marginTop: 12 }}><div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{title}</div>{children}</div>
  const Line = ({ label, children }) => (children && String(children).trim()) ? (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 120, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-line', minWidth: 0 }}>{children}</div>
    </div>
  ) : null

  const createGoal = async () => {
    const { error } = await supabase.from('goals').insert({ athlete_id: athleteId, title: v.target_event, deadline: v.target_date, description: 'Competición indicada en el cuestionario de alta' })
    if (error) { toast('No se pudo crear: ' + error.message, 'error'); return }
    setGoalDone(true); toast('Objetivo creado: ya ve la cuenta atrás en su inicio')
  }

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>📝 Cuestionario de alta</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Consentimiento {new Date(i.consent_at).toLocaleDateString('es-ES')}</div>
      </div>
      {i.deletion_requested_at && <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--error-dim)', color: 'var(--error)', fontSize: 13, fontWeight: 700 }}>🗑 Pidió la baja y el borrado de sus datos el {new Date(i.deletion_requested_at).toLocaleDateString('es-ES')}</div>}
      {intakeNeedsUpdate(i) && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>⏳ Aún no ha contestado las preguntas nuevas: se le pedirán al entrar.</div>}

      <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: yes.length || flags.length ? 'var(--warning-dim, #FEF3C7)' : 'var(--success-dim)', fontSize: 13, lineHeight: 1.5 }}>
        {yes.length || flags.length ? (
          <>
            <strong>⚠️ A tener en cuenta</strong>
            <ul style={{ margin: '4px 0 0 18px' }}>
              {yes.map(p => <li key={p.key}>{p.q}</li>)}
              {flags.map(x => <li key={x}>{x}</li>)}
            </ul>
          </>
        ) : '✅ Sin señales de salud que revisar'}
      </div>

      {[i.medical_notes, v.current_injuries, i.injuries_history].some(x => (x || '').trim()) && <Section title="Salud">
        <Line label="Notas de salud">{i.medical_notes}</Line>
        <Line label="Lesión actual">{v.current_injuries}</Line>
        <Line label="Lesiones previas">{i.injuries_history}</Line>
      </Section>}
      {female && (v.cycle_regular || v.last_period || v.contraception || v.amenorrhea !== undefined || v.urine_leaks) && (
        <Section title="Salud femenina">
          <Line label="Ciclo regular">{v.cycle_regular}</Line>
          <Line label="Última regla">{v.last_period ? `${fmtDay(v.last_period)} · ciclo de ${v.cycle_length || 28} días` : ''}</Line>
          <Line label="Anticonceptivos">{v.contraception ? v.contraception + (HORMONAL.includes(v.contraception) ? ' (hormonal)' : '') : ''}</Line>
          <Line label="3+ meses sin regla">{v.amenorrhea === true ? 'Sí' : v.amenorrhea === false ? 'No' : ''}</Line>
          <Line label="Pérdidas de orina">{v.urine_leaks}</Line>
        </Section>
      )}
      {(v.years_training || v.sports || (v.competed || []).length || v.mark_5k || v.mark_10k || v.mark_hyrox || v.target_event) && <Section title="Deporte">
        <Line label="Experiencia">{v.years_training}</Line>
        <Line label="Deportes">{v.sports}</Line>
        <Line label="Ha competido en">{(v.competed || []).join(', ')}</Line>
        <Line label="Marcas">{[v.mark_5k && `5 km ${v.mark_5k}`, v.mark_10k && `10 km ${v.mark_10k}`, v.mark_hyrox && `Hyrox ${v.mark_hyrox}`].filter(Boolean).join(' · ')}</Line>
        <Line label="Competición">{v.target_event ? `${v.target_event}${v.target_date ? ' · ' + fmtDay(v.target_date) : ''}` : ''}</Line>
        {v.target_event && v.target_date && v.target_date >= ymd(new Date()) && !goalDone && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={createGoal}>🏁 Crear objetivo con cuenta atrás</button>
        )}
      </Section>}
      {(v.sleep || v.stress || v.job || v.session_time) && <Section title="Día a día">
        <Line label="Sueño">{v.sleep}</Line>
        <Line label="Estrés">{v.stress}</Line>
        <Line label="Trabajo">{v.job}</Line>
        <Line label="Tiempo por sesión">{v.session_time}</Line>
      </Section>}
      <Section title="Entrenamiento">
        <Line label="Objetivo">{i.goals}</Line>
        <Line label="Disponibilidad">{[(i.availability || []).join(' · '), i.sessions_per_week && `${i.sessions_per_week} sesiones/semana`].filter(Boolean).join(' · ')}</Line>
        <Line label="Material">{i.equipment}</Line>
        <Line label="Le gusta">{v.likes}</Line>
        <Line label="No le gusta">{v.dislikes}</Line>
        <Line label="Correcciones">{v.feedback}</Line>
      </Section>
      {(v.emergency_name || v.emergency_phone) && (
        <Section title="Emergencia">
          <Line label="Contacto">{[v.emergency_name, v.emergency_phone].filter(Boolean).join(' · ')}</Line>
        </Section>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Actualizado el {new Date(i.updated_at || i.consent_at).toLocaleDateString('es-ES')}</div>
    </div>
  )
}
