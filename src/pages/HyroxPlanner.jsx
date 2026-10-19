import { useEffect, useMemo, useState } from 'react'
import { Records } from '../lib/db'

// ─────────────────────────────────────────────
// MI HYROX
//  · "Mis ritmos": la deportista pone su ritmo de carrera en Hyrox y sus tiempos
//    por estación (se rellenan con sus marcas si las tiene) → tiempo final estimado
//    y dónde puede ganar más tiempo.
//  · "Objetivo": elige un tiempo final y la app reparte los parciales.
// Los valores de referencia son orientativos (categoría Open); Celia los ajusta.
// ─────────────────────────────────────────────

const STATIONS = [
  { key: 'ski',     name: 'SkiErg',             detail: '1.000 m',  ref: 285, match: /ski/i },
  { key: 'push',    name: 'Sled Push',          detail: '50 m',     ref: 210, match: /sled\s*push|empuje/i },
  { key: 'pull',    name: 'Sled Pull',          detail: '50 m',     ref: 300, match: /sled\s*pull|arrastre/i },
  { key: 'bbj',     name: 'Burpee Broad Jumps', detail: '80 m',     ref: 300, match: /burpee/i },
  { key: 'row',     name: 'Remo',               detail: '1.000 m',  ref: 300, match: /remo|row/i },
  { key: 'farmers', name: 'Farmers Carry',      detail: '200 m',    ref: 120, match: /farmer/i },
  { key: 'lunges',  name: 'Sandbag Lunges',     detail: '100 m',    ref: 300, match: /lunge|zancada/i },
  { key: 'wall',    name: 'Wall Balls',         detail: '100 reps', ref: 390, match: /wall\s*ball/i },
]
const REF_PACE = 340        // 5:40 /km en carrera Hyrox
const REF_ROXZONE = 420     // 7:00 en total (16 transiciones)

// Reparto para el modo "Objetivo"
const SHARE = { run: 0.52, stations: 0.40, roxzone: 0.08 }
const REF_STATION_TOTAL = STATIONS.reduce((a, s) => a + s.ref, 0)

// ---- utilidades de tiempo ----
const fmt = (sec) => {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}
// "5:40", "5.40", "5'40", "340" (segundos) → segundos
const parseTime = (txt) => {
  if (txt == null) return null
  const t = String(txt).trim().replace(/[’'.,]/g, ':')
  if (!t) return null
  if (/^\d+$/.test(t)) { const n = Number(t); return n > 0 ? (n < 20 ? n * 60 : n) : null }
  const parts = t.split(':').map(Number)
  if (parts.some(n => !Number.isFinite(n))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}
// Marca personal guardada → segundos. En la app los minutos se escriben como m.ss (4.18 = 4:18)
const recordToSeconds = (r) => {
  const v = Number(r?.value)
  if (!Number.isFinite(v) || v <= 0) return null
  if (r.unit === 'seg') return v
  if (r.unit === 'min') {
    const m = Math.floor(v)
    const ss = Math.round((v - m) * 100)
    return ss < 60 ? m * 60 + ss : v * 60
  }
  return null
}

const Tabs = ({ value, onChange }) => (
  <div style={{ display: 'flex', background: 'var(--card)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 12 }}>
    {[{ id: 'mine', label: 'Mis ritmos' }, { id: 'goal', label: 'Objetivo' }].map(t => (
      <button key={t.id} onClick={() => onChange(t.id)}
        style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.5px', background: value === t.id ? 'var(--accent)' : 'transparent', color: value === t.id ? '#fff' : 'var(--text-muted)' }}>
        {t.label}
      </button>
    ))}
  </div>
)

const Kpis = ({ items }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 8 }}>
    {items.map(k => (
      <div key={k.label} className="card" style={{ padding: '12px 8px', margin: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 4 }}>{k.label}</div>
      </div>
    ))}
  </div>
)

const Splits = ({ rows }) => (
  <div className="card" style={{ padding: '4px 0' }}>
    {rows.map((r, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.kind === 'run' ? '#10B981' : '#F59E0B', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{r.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.detail}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16 }}>{fmt(r.split)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {fmt(r.clock)}</div>
        </div>
      </div>
    ))}
  </div>
)

// Construye la tabla de parciales (carrera → estación, con Roxzone repartida)
const buildRows = (pace, stationTimes, roxTotal) => {
  const roxEach = roxTotal / 16
  let clock = 0
  const rows = []
  STATIONS.forEach((st, i) => {
    clock += pace
    rows.push({ kind: 'run', label: `Carrera ${i + 1}`, detail: '1 km', split: pace, clock })
    clock += roxEach + stationTimes[i]
    rows.push({ kind: 'station', label: st.name, detail: st.detail, split: stationTimes[i], clock })
    clock += roxEach
  })
  return { rows, total: clock }
}

const timeInput = { width: 74, textAlign: 'center', padding: '8px 6px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }

export default function HyroxPlanner({ athleteId }) {
  const [mode, setMode] = useState('mine')

  // ---- Modo "Mis ritmos" ----
  const [paceTxt, setPaceTxt] = useState(fmt(REF_PACE))
  const [roxTxt, setRoxTxt] = useState(fmt(REF_ROXZONE))
  const [stTxt, setStTxt] = useState(() => Object.fromEntries(STATIONS.map(s => [s.key, ''])))
  const [fromRecords, setFromRecords] = useState({})

  // Rellenar estaciones con sus marcas personales (la más reciente de cada una)
  useEffect(() => {
    if (!athleteId) return
    Records.getByAthlete(athleteId).then(recs => {
      const found = {}
      STATIONS.forEach(st => {
        const r = recs.find(x => st.match.test(x.name || ''))
        const sec = recordToSeconds(r)
        if (sec) found[st.key] = sec
      })
      if (Object.keys(found).length) {
        setFromRecords(found)
        setStTxt(prev => {
          const next = { ...prev }
          Object.entries(found).forEach(([k, sec]) => { if (!prev[k]) next[k] = fmt(sec) })
          return next
        })
      }
    }).catch(() => {})
  }, [athleteId])

  const mine = useMemo(() => {
    const pace = parseTime(paceTxt) || REF_PACE
    const rox = parseTime(roxTxt) ?? REF_ROXZONE
    const times = STATIONS.map(st => parseTime(stTxt[st.key]) || st.ref)
    const { rows, total } = buildRows(pace, times, rox)
    // Dónde se gana más tiempo
    const tips = [{ text: 'Correr 10 s/km más rápido', gain: 80 }]
    STATIONS.forEach((st, i) => {
      const extra = times[i] - st.ref
      if (extra > 10) tips.push({ text: `${st.name} al tiempo de referencia (${fmt(st.ref)})`, gain: extra })
    })
    if (rox > REF_ROXZONE) tips.push({ text: `Transiciones en ${fmt(REF_ROXZONE)}`, gain: rox - REF_ROXZONE })
    tips.sort((a, b) => b.gain - a.gain)
    return { rows, total, pace, rox, runTotal: pace * 8, stationTotal: times.reduce((a, b) => a + b, 0), tips: tips.slice(0, 3) }
  }, [paceTxt, roxTxt, stTxt])

  // ---- Modo "Objetivo" ----
  const [minutes, setMinutes] = useState(85)
  const goal = useMemo(() => {
    const total = minutes * 60
    const pace = (total * SHARE.run) / 8
    const stationTotal = total * SHARE.stations
    const times = STATIONS.map(st => stationTotal * (st.ref / REF_STATION_TOTAL))
    const { rows } = buildRows(pace, times, total * SHARE.roxzone)
    return { rows, pace, stationTotal, rox: total * SHARE.roxzone }
  }, [minutes])

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>🏁 Mi Hyrox</h2></div>
      <div className="page-content">
        <Tabs value={mode} onChange={setMode} />

        {mode === 'mine' ? (
          <>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Ritmo de carrera en Hyrox</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>El de competición, cansada entre estaciones (min/km)</div>
                </div>
                <input style={timeInput} inputMode="numeric" value={paceTxt} onChange={e => setPaceTxt(e.target.value)} aria-label="Ritmo por kilómetro" placeholder="5:40" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Transiciones (Roxzone)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Tiempo total entrando y saliendo de estaciones</div>
                </div>
                <input style={timeInput} inputMode="numeric" value={roxTxt} onChange={e => setRoxTxt(e.target.value)} aria-label="Tiempo total de transiciones" placeholder="7:00" />
              </div>
            </div>

            <div className="section-title">Tus estaciones</div>
            <div className="card" style={{ padding: '4px 0' }}>
              {STATIONS.map((st, i) => (
                <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < STATIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{st.name} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 12 }}>· {st.detail}</span></div>
                    <div style={{ fontSize: 11, color: fromRecords[st.key] && stTxt[st.key] === fmt(fromRecords[st.key]) ? 'var(--success)' : 'var(--text-muted)' }}>
                      {fromRecords[st.key] && stTxt[st.key] === fmt(fromRecords[st.key]) ? '✓ De tus marcas' : `Referencia ${fmt(st.ref)}`}
                    </div>
                  </div>
                  <input style={timeInput} inputMode="numeric" value={stTxt[st.key]} placeholder={fmt(st.ref)}
                    onChange={e => setStTxt(p => ({ ...p, [st.key]: e.target.value }))} aria-label={`Tiempo en ${st.name}`} />
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '18px 16px', textAlign: 'center', background: 'var(--accent-dim)', border: '1.5px solid var(--accent)' }}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tu tiempo estimado</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 48, color: 'var(--accent)', lineHeight: 1.05 }}>{fmt(mine.total)}</div>
            </div>
            <Kpis items={[
              { label: 'Carrera', value: fmt(mine.runTotal), color: '#10B981' },
              { label: 'Estaciones', value: fmt(mine.stationTotal), color: '#F59E0B' },
              { label: 'Roxzone', value: fmt(mine.rox), color: '#8B5CF6' },
            ]} />

            <div className="section-title">Dónde puedes ganar más tiempo</div>
            <div className="card" style={{ padding: '4px 0' }}>
              {mine.tips.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: i < mine.tips.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 16 }}>{['🥇', '🥈', '🥉'][i]}</span>
                  <div style={{ flex: 1, fontSize: 14 }}>{t.text}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--success)' }}>−{fmt(t.gain)}</div>
                </div>
              ))}
            </div>

            <div className="section-title">Parciales</div>
            <Splits rows={mine.rows} />
          </>
        ) : (
          <>
            <div className="card" style={{ padding: '18px 16px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>¿En cuánto tiempo quieres terminar?</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, lineHeight: 1, color: 'var(--accent)', marginBottom: 12 }}>{fmt(minutes * 60)}</div>
              <input type="range" min={55} max={130} step={1} value={minutes} onChange={e => setMinutes(Number(e.target.value))}
                aria-label="Tiempo objetivo en minutos" style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[60, 70, 80, 90, 100].map(p => (
                  <button key={p} onClick={() => setMinutes(p)}
                    style={{ padding: '6px 12px', borderRadius: 99, border: `1px solid ${minutes === p ? 'var(--accent)' : 'var(--border)'}`, background: minutes === p ? 'var(--accent-dim)' : 'var(--bg)', color: minutes === p ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {fmt(p * 60)}
                  </button>
                ))}
              </div>
            </div>
            <Kpis items={[
              { label: 'Ritmo carrera', value: `${fmt(goal.pace)}/km`, color: '#10B981' },
              { label: 'Estaciones', value: fmt(goal.stationTotal), color: '#F59E0B' },
              { label: 'Roxzone', value: fmt(goal.rox), color: '#8B5CF6' },
            ]} />
            <div className="section-title">Parciales para tu objetivo</div>
            <Splits rows={goal.rows} />
          </>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, padding: '4px 4px 24px' }}>
          Guía orientativa. Los tiempos de referencia son aproximados para la categoría Open y cada cuerpo es distinto:
          comparte tu plan con Celia para ajustarlo a tus datos reales. Consejo clave: no salgas más rápido de lo planeado en el primer kilómetro.
        </div>
      </div>
    </div>
  )
}
