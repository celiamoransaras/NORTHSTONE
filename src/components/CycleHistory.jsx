import { useState } from 'react'

// Historial de ciclos sin listas infinitas:
//  · se ven los 3 últimos y un resumen (duración media y regularidad)
//  · "Ver más" va mostrando de 6 en 6, dentro de una caja con scroll
const STEP = 6
const DAY = 86400000
const fmt = (d, withYear = true) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-ES', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' })

export default function CycleHistory({ cycles = [], color = 'var(--accent)' }) {
  const [visible, setVisible] = useState(3)
  if (!cycles.length) return null

  // Duración de cada ciclo = días hasta el inicio del siguiente (lista ordenada de más reciente a más antiguo)
  const lengths = cycles.map((c, i) => i === 0 ? null
    : Math.round((new Date(cycles[i - 1].date_start + 'T12:00:00') - new Date(c.date_start + 'T12:00:00')) / DAY))
  const recent = lengths.filter(Boolean).slice(0, 6)
  const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null
  const spread = recent.length >= 2 ? Math.max(...recent) - Math.min(...recent) : null

  const shown = cycles.slice(0, visible)
  const remaining = cycles.length - visible

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Historial · {cycles.length} registro{cycles.length !== 1 ? 's' : ''}
        </div>
        {avg && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
            Media <strong style={{ color: 'var(--text)' }}>{avg} días</strong>
            {spread !== null && <> · {spread <= 7 ? 'regular' : `varía ${spread} días`}</>}
          </div>
        )}
      </div>

      <div style={{ maxHeight: visible > 3 ? 260 : 'none', overflowY: visible > 3 ? 'auto' : 'visible' }}>
        {shown.map((c, i) => (
          <div key={c.id || c.date_start} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < shown.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {fmt(c.date_start)}
              {c.date_end && <span style={{ marginLeft: 4, color: '#059669' }}>→ {fmt(c.date_end, false)}</span>}
            </span>
            {i === 0
              ? <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}20`, padding: '2px 8px', borderRadius: 8 }}>Actual</span>
              : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ciclo de {lengths[i]} d</span>}
          </div>
        ))}
      </div>

      {(remaining > 0 || visible > 3) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {remaining > 0 && (
            <button type="button" onClick={() => setVisible(v => v + STEP)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Ver {Math.min(STEP, remaining)} más
            </button>
          )}
          {visible > 3 && (
            <button type="button" onClick={() => setVisible(3)}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Ver menos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
