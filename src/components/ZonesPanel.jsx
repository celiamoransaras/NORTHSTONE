import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { useToast } from '../contexts/ToastContext'
import { sendPushToAthletes, sendPushToCoach } from '../lib/pushNotifications'
import {
  TESTS, LIFTS, latestTests, latestRMs, parsePace, secondsToMss, fmtPace, fmtKg, estimate1RM, roundLoad,
  RUN_ZONES, VAM_LEVELS, BIKE_ZONES, ERG_ZONES, runZone, vamPace, bikeZone, ergZone, rmRecordName, isTestOrRm,
} from '../lib/zones'

// Aviso para que otras secciones (Marcas personales) se recarguen
export const RECORDS_CHANGED = 'ns-records-changed'
export const notifyRecordsChanged = (athleteId) => {
  try { window.dispatchEvent(new CustomEvent(RECORDS_CHANGED, { detail: { athleteId } })) } catch { /* sin eventos */ }
}

const LIMITS = {
  vam: [120, 600], run30: [150, 720], ski: [80, 210], row: [80, 210], // segundos
  hr: [100, 220], ftp: [30, 600],
}
const testUnitLabel = (t) => t.key === 'hr' ? 'bpm' : t.key === 'ftp' ? 'W' : (t.key === 'ski' || t.key === 'row') ? '/500 m' : '/km'
const fmtTest = (t, v) => t.kind === 'pace' ? `${fmtPace(v)} ${testUnitLabel(t)}` : `${Math.round(v)} ${testUnitLabel(t)}`
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

const Card = ({ title, subtitle, children, right }) => (
  <div className="card" style={{ padding: '14px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
      <div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
)
const Row = ({ code, name, value, desc, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
    {code && <span style={{ minWidth: 40, textAlign: 'center', fontSize: 11, fontWeight: 800, padding: '3px 6px', borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{code}</span>}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
      {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</div>}
    </div>
    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap' }}>{value}</div>
  </div>
)
const Missing = ({ text }) => (
  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px dashed var(--border)' }}>{text}</div>
)

export default function ZonesPanel({ athleteId, athleteName = '', isCoach = false, embedded = false }) {
  const toast = useToast()
  const [records, setRecords] = useState(null)
  const [tab, setTab] = useState('zones')
  const [testSheet, setTestSheet] = useState(false)
  const [rmSheet, setRmSheet] = useState(false)
  const [openLift, setOpenLift] = useState(null)

  const load = useCallback(async () => {
    if (!athleteId) return
    const { data, error } = await supabase.from('personal_records').select('*').eq('athlete_id', athleteId)
    if (error) { setRecords([]); return }
    setRecords((data || []).filter(r => isTestOrRm(r.name)))
  }, [athleteId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = (e) => { if (!e.detail?.athleteId || e.detail.athleteId === athleteId) load() }
    window.addEventListener(RECORDS_CHANGED, h)
    return () => window.removeEventListener(RECORDS_CHANGED, h)
  }, [athleteId, load])

  const tests = useMemo(() => latestTests(records || []), [records])
  const rms = useMemo(() => Object.values(latestRMs(records || [])).sort((a, b) => a.lift.localeCompare(b.lift)), [records])

  const insertRows = async (rows) => {
    const { error } = await supabase.from('personal_records').insert(rows)
    if (error) throw error
    notifyRecordsChanged(athleteId)
    await load()
  }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', background: 'var(--card)', borderRadius: 12, padding: 4, gap: 4, border: embedded ? '1px solid var(--border)' : 'none' }}>
        {[{ id: 'zones', label: '🫀 Ritmos y zonas' }, { id: 'rm', label: '🏋️ Fuerza · RM' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.4px', background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {records === null ? (
        <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
      ) : tab === 'zones' ? (
        <>
          <Card title="📋 Tests" subtitle={isCoach ? 'Último resultado de cada test' : 'Tu último resultado de cada test'}
            right={<button className="btn btn-primary btn-sm" onClick={() => setTestSheet(true)}>＋ Test</button>}>
            {TESTS.map((t, i) => (
              <Row key={t.key} name={t.label} desc={tests[t.key] ? fmtDate(tests[t.key].date) : 'Sin hacer'}
                value={tests[t.key] ? fmtTest(t, tests[t.key].value) : '–'} last={i === TESTS.length - 1} />
            ))}
          </Card>

          <Card title="🏃 Zonas de carrera" subtitle={tests.run30 ? `Umbral ${fmtPace(tests.run30.value)} /km (test de 30')` : "Se calculan con el test de 30'"}>
            {tests.run30 ? RUN_ZONES.map((z, i) => {
              const { slow, fast } = runZone(tests.run30.value, z)
              return <Row key={z.code} code={z.code === 'Z2b' ? 'Z2 b' : z.code} name={z.name} desc={z.desc} value={`${fmtPace(slow)}–${fmtPace(fast)}`} last={i === RUN_ZONES.length - 1} />
            }) : <Missing text="Corre 30' lo más rápido que puedas mantener y apunta tu ritmo medio." />}
          </Card>

          <Card title="⚡ Ritmos VAM" subtitle={tests.vam ? `VAM ${fmtPace(tests.vam.value)} /km (test de 6')` : "Se calculan con el test de 6'"}>
            {tests.vam ? VAM_LEVELS.map((p, i) => (
              <Row key={p} code={`${p}%`} name={p < 100 ? 'Aeróbico intenso' : p === 100 ? 'Tu VAM' : 'Por encima de VAM'} value={`${fmtPace(vamPace(tests.vam.value, p))} /km`} last={i === VAM_LEVELS.length - 1} />
            )) : <Missing text="Corre 6' a tope y apunta tu ritmo medio por km." />}
          </Card>

          <Card title="🚴 Bike Erg" subtitle={tests.ftp ? `FTP ${Math.round(tests.ftp.value)} W` : 'Se calcula con tu FTP'}>
            {tests.ftp ? BIKE_ZONES.map((z, i) => {
              const { min, max } = bikeZone(tests.ftp.value, z)
              return <Row key={z.code} code={z.code} name={z.name} value={`${min}–${max} W`} last={i === BIKE_ZONES.length - 1} />
            }) : <Missing text="Haz el test de FTP en la bike y apunta los vatios." />}
          </Card>

          <Card title="🚣 Ski y Row" subtitle="Ritmo por 500 m a partir de tu 2k">
            {(tests.ski || tests.row) ? ERG_ZONES.map((z, i) => (
              <Row key={z.code} code={z.code} name={z.name}
                desc={[tests.ski && `Ski ${fmtPace(ergZone(tests.ski.value, z).slow)}–${fmtPace(ergZone(tests.ski.value, z).fast)}`, tests.row && `Row ${fmtPace(ergZone(tests.row.value, z).slow)}–${fmtPace(ergZone(tests.row.value, z).fast)}`].filter(Boolean).join(' · ')}
                value={`+${z.fast}–${z.slow}"`} last={i === ERG_ZONES.length - 1} />
            )) : <Missing text="Haz un 2k en ski y/o en remo y apunta el ritmo medio por 500 m." />}
          </Card>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, padding: '0 8px' }}>
            {isCoach
              ? 'Escribe en la sesión "Z2", "90% VAM", "80% FTP" o "5x5 al 75%" en un ejercicio de fuerza y cada deportista verá sus números.'
              : 'Cuando tu entreno diga "Z2", "90% VAM" o "al 75%", verás tus ritmos y kilos calculados dentro de la sesión.'}
          </div>
        </>
      ) : (
        <>
          <Card title="🏋️ Tus RM" subtitle={rms.length ? 'Toca un ejercicio para ver sus porcentajes' : 'Peso máximo a 1 repetición (real o estimado)'}
            right={<button className="btn btn-primary btn-sm" onClick={() => setRmSheet(true)}>＋ RM</button>}>
            {rms.length === 0 && <Missing text="Añade tu RM de peso muerto, sentadilla, press banca... Si no has hecho un 1RM, pon el peso y las repeticiones y lo estimamos." />}
            {rms.map((r, i) => (
              <div key={r.lift} style={{ borderBottom: i === rms.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <button onClick={() => setOpenLift(openLift === r.lift ? null : r.lift)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{r.lift}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fmtDate(r.date)}{r.record?.notes ? ` · ${r.record.notes}` : ''}</div>
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: 'var(--accent)' }}>{fmtKg(r.value)}</div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14, transform: openLift === r.lift ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                </button>
                {openLift === r.lift && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, paddingBottom: 12 }}>
                    {[50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map(p => (
                      <div key={p} style={{ textAlign: 'center', padding: '7px 2px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>{p} %</div>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{fmtKg(roundLoad(r.value * p / 100))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, padding: '0 8px' }}>
            Los kilos se redondean a 2,5 kg. Para corregir o borrar un valor, edítalo en Marcas personales.
          </div>
        </>
      )}

      {testSheet && (
        <TestSheet onClose={() => setTestSheet(false)} tests={tests}
          onSave={async (rows, summary) => {
            await insertRows(rows.map(r => ({ ...r, athlete_id: athleteId })))
            try {
              if (isCoach) sendPushToAthletes([athleteId], { title: '🎯 Tus zonas se han actualizado', body: `Nuevos tests: ${summary}`, url: '/?tab=zones' })
              else sendPushToCoach({ title: `📈 ${athleteName || 'Una deportista'} ha registrado un test`, body: summary, url: '/athletes' })
            } catch { /* aviso opcional */ }
            toast('Test guardado')
            setTestSheet(false)
          }} toast={toast} />
      )}
      {rmSheet && (
        <RmSheet onClose={() => setRmSheet(false)} toast={toast}
          onSave={async (row, summary) => {
            await insertRows([{ ...row, athlete_id: athleteId }])
            try {
              if (isCoach) sendPushToAthletes([athleteId], { title: '🏋️ RM actualizado', body: summary, url: '/?tab=zones' })
              else sendPushToCoach({ title: `🏋️ ${athleteName || 'Una deportista'} ha registrado un RM`, body: summary, url: '/athletes' })
            } catch { /* aviso opcional */ }
            toast('RM guardado')
            setRmSheet(false)
            setTab('rm')
          }} />
      )}
    </div>
  )

  if (embedded) return content
  return (
    <div className="page fade-in">
      <div className="page-header"><h2>🎯 Mis zonas</h2></div>
      <div className="page-content">{content}</div>
    </div>
  )
}

function TestSheet({ onClose, onSave, toast, tests }) {
  const [date, setDate] = useState(ymd(new Date()))
  const [vals, setVals] = useState(() => Object.fromEntries(TESTS.map(t => [t.key, ''])))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const rows = [], parts = []
    for (const t of TESTS) {
      const raw = String(vals[t.key] || '').trim()
      if (!raw) continue
      const [lo, hi] = LIMITS[t.key]
      if (t.kind === 'pace') {
        const s = parsePace(raw)
        if (!s || s < lo || s > hi) { toast(`Revisa ${t.label}: escribe el ritmo como 4:30`, 'error'); return }
        rows.push({ name: t.name, value: secondsToMss(s), unit: t.unit, date })
        parts.push(`${t.label.split(' · ')[0]} ${fmtTest(t, s)}`)
      } else {
        const n = Number(raw.replace(',', '.'))
        if (!Number.isFinite(n) || n < lo || n > hi) { toast(`Revisa ${t.label}`, 'error'); return }
        rows.push({ name: t.name, value: Math.round(n), unit: t.unit, date })
        parts.push(`${t.label.split(' · ')[0]} ${fmtTest(t, n)}`)
      }
    }
    if (!rows.length) { toast('Rellena al menos un test', 'error'); return }
    setSaving(true)
    try { await onSave(rows, parts.join(' · ')) }
    catch (e) { toast('No se pudo guardar: ' + (e?.message || e), 'error'); setSaving(false) }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>Registrar test</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Rellena solo los que hayas hecho. Las zonas usan el último resultado de cada test.</div>
          <div className="input-group">
            <label className="input-label">Fecha</label>
            <input className="input" type="date" max={ymd(new Date())} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {TESTS.map(t => (
            <div className="input-group" key={t.key}>
              <label className="input-label">{t.label} <span style={{ textTransform: 'none', fontWeight: 500 }}>· {t.hint}</span></label>
              <input className="input" inputMode={t.kind === 'pace' ? 'text' : 'numeric'} value={vals[t.key]}
                placeholder={tests[t.key] ? `Último: ${fmtTest(t, tests[t.key].value)}` : `p. ej. ${t.placeholder}`}
                onChange={e => setVals(v => ({ ...v, [t.key]: e.target.value }))} />
            </div>
          ))}
          <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar test'}</button>
        </div>
      </div>
    </>
  )
}

function RmSheet({ onClose, onSave, toast }) {
  const [lift, setLift] = useState(LIFTS[1].name)
  const [custom, setCustom] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('1')
  const [date, setDate] = useState(ymd(new Date()))
  const [saving, setSaving] = useState(false)
  const name = lift === '__other' ? custom.trim() : lift
  const est = estimate1RM(String(weight).replace(',', '.'), reps)

  const save = async () => {
    if (!name) { toast('Escribe el nombre del ejercicio', 'error'); return }
    if (!est || est > 400) { toast('Revisa el peso', 'error'); return }
    const n = Math.round(Number(reps) || 1)
    const notes = n > 1 ? `Estimado con ${n} × ${String(weight).replace('.', ',')} kg` : null
    setSaving(true)
    try { await onSave({ name: rmRecordName(name), value: est, unit: 'kg', date, notes }, `${name}: ${fmtKg(est)}${n > 1 ? ' (estimado)' : ''}`) }
    catch (e) { toast('No se pudo guardar: ' + (e?.message || e), 'error'); setSaving(false) }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>Registrar RM</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <div className="input-group">
            <label className="input-label">Ejercicio</label>
            <select className="input" value={lift} onChange={e => setLift(e.target.value)}>
              {[...LIFTS].sort((a, b) => a.name.localeCompare(b.name)).map(l => <option key={l.key} value={l.name}>{l.name}</option>)}
              <option value="__other">Otro…</option>
            </select>
          </div>
          {lift === '__other' && (
            <div className="input-group">
              <label className="input-label">Nombre</label>
              <input className="input" placeholder="p. ej. Thruster" value={custom} onChange={e => setCustom(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label">Peso (kg)</label>
              <input className="input" inputMode="decimal" placeholder="80" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div className="input-group" style={{ width: 110 }}>
              <label className="input-label">Repeticiones</label>
              <select className="input" value={reps} onChange={e => setReps(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Fecha</label>
            <input className="input" type="date" max={ymd(new Date())} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ textAlign: 'center', padding: '12px', borderRadius: 12, background: 'var(--accent-dim)', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{Number(reps) > 1 ? '1RM estimado' : '1RM'}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, color: 'var(--accent)' }}>{est ? fmtKg(est) : '–'}</div>
            {Number(reps) > 1 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimación orientativa (fórmula de Epley); es más fiable con 2-6 repeticiones</div>}
          </div>
          <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar RM'}</button>
        </div>
      </div>
    </>
  )
}
