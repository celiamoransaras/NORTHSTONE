import { useMemo, useState } from 'react'

// ─────────────────────────────────────────────
// PLANIFICADOR DE CARRERA HYROX
// A partir de un tiempo objetivo reparte los parciales de los 8 km de carrera,
// las 8 estaciones y las transiciones (Roxzone). Es una guía orientativa:
// el reparto se basa en tiempos típicos de categoría Open y Celia lo ajusta
// con los datos reales de cada deportista.
// ─────────────────────────────────────────────

const STATIONS = [
  { name: 'SkiErg', detail: '1.000 m', w: 4.75 },
  { name: 'Sled Push', detail: '50 m', w: 3.5 },
  { name: 'Sled Pull', detail: '50 m', w: 5 },
  { name: 'Burpee Broad Jumps', detail: '80 m', w: 5 },
  { name: 'Remo', detail: '1.000 m', w: 5 },
  { name: 'Farmers Carry', detail: '200 m', w: 2 },
  { name: 'Sandbag Lunges', detail: '100 m', w: 5 },
  { name: 'Wall Balls', detail: '100 reps', w: 6.5 },
]
const STATION_W = STATIONS.reduce((a, s) => a + s.w, 0)

// Reparto aproximado del tiempo total
const SHARE = { run: 0.52, stations: 0.40, roxzone: 0.08 }

const fmt = (sec) => {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

const PRESETS = [60, 70, 80, 90, 100]

export default function HyroxPlanner() {
  const [minutes, setMinutes] = useState(85)

  const plan = useMemo(() => {
    const total = minutes * 60
    const runEach = (total * SHARE.run) / 8
    const stationTotal = total * SHARE.stations
    const roxEach = (total * SHARE.roxzone) / 16
    let clock = 0
    const rows = []
    STATIONS.forEach((st, i) => {
      clock += runEach
      rows.push({ kind: 'run', label: `Carrera ${i + 1}`, detail: '1 km', split: runEach, clock })
      clock += roxEach
      const stTime = stationTotal * (st.w / STATION_W)
      clock += stTime
      rows.push({ kind: 'station', label: st.name, detail: st.detail, split: stTime, clock })
      clock += roxEach
    })
    return { rows, runEach, roxTotal: total * SHARE.roxzone, stationTotal, runTotal: total * SHARE.run }
  }, [minutes])

  return (
    <div className="page fade-in">
      <div className="page-header"><h2>🏁 Tu carrera Hyrox</h2></div>
      <div className="page-content">

        <div className="card" style={{ padding: '18px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>¿En cuánto tiempo quieres terminar?</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, lineHeight: 1, color: 'var(--accent)' }}>{fmt(minutes * 60)}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>tiempo objetivo</span>
          </div>
          <input type="range" min={55} max={130} step={1} value={minutes}
            onChange={e => setMinutes(Number(e.target.value))}
            aria-label="Tiempo objetivo en minutos"
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => setMinutes(p)}
                style={{ padding: '6px 12px', borderRadius: 99, border: `1px solid ${minutes === p ? 'var(--accent)' : 'var(--border)'}`, background: minutes === p ? 'var(--accent-dim)' : 'var(--bg)', color: minutes === p ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {fmt(p * 60)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Ritmo carrera', value: `${fmt(plan.runEach)}/km`, color: '#10B981' },
            { label: 'Estaciones', value: fmt(plan.stationTotal), color: '#F59E0B' },
            { label: 'Roxzone', value: fmt(plan.roxTotal), color: '#8B5CF6' },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '12px 10px', margin: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div className="section-title">Parciales</div>
        <div className="card" style={{ padding: '4px 0' }}>
          {plan.rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < plan.rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
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

        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, padding: '4px 4px 24px' }}>
          Es una guía orientativa basada en tiempos habituales de la categoría Open. Tus puntos fuertes son únicos:
          comparte tu objetivo con Celia y ajustaréis el reparto con tus marcas reales. Consejo clave: no salgas
          más rápido de lo planeado en el primer kilómetro.
        </div>
      </div>
    </div>
  )
}
