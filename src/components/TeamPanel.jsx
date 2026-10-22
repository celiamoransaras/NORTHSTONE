import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sessions } from '../lib/db'
import { athleteLoad, loadFlags, ratioLabel, ratioColor, fmtRatio } from '../lib/load'

// ─────────────────────────────────────────────
// VISTA DE EQUIPO: todas las deportistas en una pantalla.
// Cumplimiento de la semana, RPE, carga (RPE × minutos) y ratio aguda:crónica,
// con las que necesitan atención arriba del todo.
// ─────────────────────────────────────────────

const pill = (color) => ({ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 8, color, background: `color-mix(in srgb, ${color} 14%, transparent)`, whiteSpace: 'nowrap' })
const FLAG_COLOR = { 3: 'var(--error)', 2: 'var(--warning)', 1: 'var(--text-muted)' }

function Spark({ weeks }) {
  const max = Math.max(...weeks.map(w => w.load), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, width: 64 }} aria-hidden="true">
      {weeks.map(w => (
        <div key={w.start} style={{ flex: 1, height: Math.max(2, (w.load / max) * 22), borderRadius: 2, background: w.current ? 'var(--accent)' : 'var(--border)' }} />
      ))}
    </div>
  )
}

export default function TeamPanel({ athleteMap }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(null)
  const [onlyAlerts, setOnlyAlerts] = useState(false)

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
          const pct = l.weekAssigned ? Math.round(l.weekDone / l.weekAssigned * 100) : 0
          const barColor = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)'
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
                    {l.weekDone}/{l.weekAssigned} esta semana
                    {l.avgRpe != null && <> · RPE {l.avgRpe.toFixed(1).replace('.', ',')}</>}
                    {' · '}carga 7 d {l.acute.toLocaleString('es-ES')}
                  </div>
                </div>
                <Spark weeks={l.weeks} />
                <div style={{ textAlign: 'right', minWidth: 56 }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: ratioColor(l.ratio) }}>{fmtRatio(l.ratio)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{ratioLabel(l.ratio) || 'Sin datos'}</div>
                </div>
              </div>
              <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, marginTop: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
              </div>
              {flags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {flags.slice(0, 3).map(f => <span key={f.text} style={pill(FLAG_COLOR[f.level])}>{f.text}</span>)}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, padding: '0 4px 6px' }}>
        Carga = RPE × minutos. El número de la derecha es la carga de los últimos 7 días frente a la media de las 4 últimas semanas: entre 0,8 y 1,3 es lo habitual; por encima de 1,5, pico de carga. Aparece cuando las 3 semanas anteriores tienen RPE.
      </div>
    </>
  )
}
