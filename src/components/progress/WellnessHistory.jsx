import { useState, useEffect } from 'react'
import { Wellness } from '../../lib/db'

const FIELDS = [
  { key: 'mood',    color: '#2563EB', label: 'Ánimo' },
  { key: 'fatigue', color: '#EF4444', label: 'Cansancio' },
]

export default function WellnessHistory({ athleteId }) {
  const [data, setData] = useState([])

  useEffect(() => {
    Wellness.getByAthlete(athleteId, 14).then(d => setData([...d].reverse()))
  }, [athleteId])

  if (!data.length) return null

  const W = 300, H = 80
  const toX = (i) => (i / (Math.max(data.length - 1, 1))) * W
  const toY = (v) => H - ((v - 1) / 4) * H
  const pathFor = (field) => {
    const pts = data.map((d, i) => d[field] ? `${toX(i)},${toY(d[field])}` : null).filter(Boolean)
    return pts.length ? 'M ' + pts.join(' L ') : ''
  }

  const latest = data[data.length - 1]
  const MOOD_LABELS    = ['😔 Bajo', '😐 Regular', '🙂 Bien', '😄 Muy bien', '🤩 Excelente']
  const FATIGUE_LABELS = ['😴 Agotada', '😬 Cansada', '😐 Normal', '🙂 Bien', '🔥 En forma']

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>Bienestar</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Últimos 14 días</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {FIELDS.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 3, borderRadius: 2, background: f.color }} />
              {f.label}
            </div>
          ))}
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map(v => (
          <line key={v} x1={0} x2={W} y1={toY(v)} y2={toY(v)} stroke="var(--border-light)" strokeWidth={0.8} />
        ))}
        {FIELDS.map(f => (
          <path key={f.key} d={pathFor(f.key)} fill="none" stroke={f.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {data.map((d, i) => FIELDS.map(f => d[f.key] ? (
          <circle key={f.key + i} cx={toX(i)} cy={toY(d[f.key])} r={i === data.length - 1 ? 5 : 3}
            fill={f.color} stroke="var(--surface)" strokeWidth={i === data.length - 1 ? 2 : 0} />
        ) : null))}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {data[0] && new Date(data[0].date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Hoy</span>
      </div>

      {latest && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
          {FIELDS.map(f => {
            const val = latest[f.key]
            const labels = { mood: MOOD_LABELS, fatigue: FATIGUE_LABELS }
            return val ? (
              <div key={f.key} style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: f.color, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels[f.key][val - 1]}</div>
              </div>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
