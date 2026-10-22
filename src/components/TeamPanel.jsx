import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sessions } from '../lib/db'
import { athleteLoad, loadFlags, loadStatus } from '../lib/load'
import WeekRing from './WeekRing'

// ─────────────────────────────────────────────
// VISTA DE EQUIPO: todas las deportistas en una pantalla.
// Cumplimiento de la semana, RPE, carga (RPE × minutos) y ratio aguda:crónica,
// con las que necesitan atención arriba del todo.
// ─────────────────────────────────────────────

const pill = (color) => ({ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8, color, background: `color-mix(in srgb, ${color} 14%, transparent)`, whiteSpace: 'nowrap' })
const FLAG_COLOR = { 3: 'var(--error)', 2: 'var(--warning)', 1: 'var(--text-muted)' }

export default function TeamPanel({ athleteMap }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(null)
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => { Sessions.getAll().then(setSessions).catch(() => setSessions([])) }, [])

  const rows = useMemo(() => {
    if (!sessions) return null
    return Object.values(athleteMap || {})
      .map(a => { const l = athleteLoad(sessions, a.id); return { a, l, flags: loadFlags(l) } })
      .filter(r => r.l.assignedTotal > 0)
      .sort((x, y) => (y.flags[0]?.level || 0) - (x.flags[0]?.level || 0) || y.flags.length - x.flags.length || x.a.name.localeCompare(y.a.name))
  }, [sessions, athleteMap])

  if (!rows) return <div className="card" style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Cargando equipo…</div>
  if (!rows.length) return null

  const alerts = rows.filter(r => r.flags.some(f => f.level >= 2)).length
  const assigned = rows.reduce((s, r) => s + r.l.weekAssigned, 0)
  const done = rows.reduce((s, r) => s + r.l.weekDone, 0)
  const shown = onlyAlerts ? rows.filter(r => r.flags.some(f => f.level >= 2)) : rows

  return (
    <>
      <div className="section-title" style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>Equipo esta semana</span>
        {alerts > 0 && (
          <button type="button" onClick={() => setOnlyAlerts(v => !v)}
            style={{ ...pill(onlyAlerts ? 'var(--accent)' : 'var(--error)'), border: 'none', cursor: 'pointer', fontSize: 12, padding: '5px 10px', fontFamily: 'inherit', textTransform: 'none' }}>
            {onlyAlerts ? 'Ver todas' : `${alerts} necesita${alerts === 1 ? '' : 'n'} atención`}
          </button>
        )}
      </div>
      <div className="card" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
        {[
          { v: `${done}/${assigned}`, l: 'Sesiones hechas' },
          { v: assigned ? `${Math.round(done / assigned * 100)} %` : '–', l: 'Cumplimiento' },
          { v: alerts, l: 'Alertas', c: alerts ? 'var(--error)' : 'var(--success)' },
        ].map(k => (
          <div key={k.l}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: k.c || 'var(--text)' }}>{k.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{k.l}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {shown.map(({ a, l, flags }, i) => {
          return (
            <button key={a.id} type="button" onClick={() => navigate('/athletes', { state: { openAthlete: a.id } })}
              aria-label={`Abrir ficha de ${a.name}`}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: i < shown.length - 1 ? '1px solid var(--border)' : 'none', background: 'none', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {a.avatar_url
                  ? <img src={a.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', background: (a.color || '#888') + '22', color: a.color || 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      {a.name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {l.weekDone}/{l.weekAssigned} hechas
                    {l.avgRpe != null && <> · esfuerzo {l.avgRpe.toFixed(1).replace('.', ',')}/10</>}
                  </div>
                </div>
                <WeekRing done={l.weekDone} total={l.weekAssigned} size={36} label={false} />
                {(() => { const st = loadStatus(l); return (
                  <div style={{ textAlign: 'right', width: 110, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Carga</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: l.ratio == null ? 600 : 900, fontSize: l.ratio == null ? 13 : 17, color: st.color, lineHeight: 1.15 }}>{l.ratio == null ? 'Sin comparar aún' : st.word}</div>
                    {l.ratio != null && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{st.detail}</div>}
                  </div>) })()}
              </div>
              {flags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingLeft: 42 }}>
                  {flags.slice(0, 3).map(f => <span key={f.text} style={pill(FLAG_COLOR[f.level])}>{f.text}</span>)}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <button type="button" onClick={() => setHelp(h => !h)}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '0 4px 6px', textAlign: 'left', fontFamily: 'inherit' }}>
        {help ? '▴ Cerrar' : 'ⓘ ¿Qué es la carga?'}
      </button>
      {help && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>La carga mide cuánto ha entrenado: tiempo × esfuerzo</div>
          <div>Cada sesión suma sus minutos por el esfuerzo que marcó la deportista (RPE del 1 al 10). Ejemplo: 60 min a esfuerzo 6 = 360.</div>
          <div style={{ marginTop: 8 }}>La app compara sus últimos 7 días con su media de las 4 últimas semanas:</div>
          <div style={{ marginTop: 4 }}><b style={{ color: 'var(--success)' }}>Normal</b>: entrena como siempre.</div>
          <div><b style={{ color: 'var(--warning)' }}>Alta</b>: un 30–50 % más de lo habitual. Vigila el cansancio.</div>
          <div><b style={{ color: 'var(--error)' }}>Muy alta</b>: más de un 50 % por encima. Es cuando más lesiones aparecen; plantéate bajar.</div>
          <div><b>Baja</b>: menos de lo habitual (descarga, viaje o lesión).</div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>Se activa cuando la deportista lleva 3 semanas valorando el RPE de sus sesiones.</div>
        </div>
      )}
    </>
  )
}
