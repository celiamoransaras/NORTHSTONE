import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────
// ANILLO NORTHSTONE: sesiones hechas frente a planificadas en la semana.
// Es la firma visual de la app: aparece en la deportista, en el equipo y en la ficha.
// ─────────────────────────────────────────────
export default function WeekRing({ done = 0, total = 0, size = 96, stroke, label = true, color = 'var(--accent)' }) {
  const sw = stroke || Math.max(4, Math.round(size / 9))
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const target = total > 0 ? Math.min(done / total, 1) : 0
  const [p, setP] = useState(0)
  useEffect(() => { const t = setTimeout(() => setP(target), 60); return () => clearTimeout(t) }, [target])
  const complete = total > 0 && done >= total
  const ringColor = complete ? 'var(--success)' : color
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role="img" aria-label={`${done} de ${total} sesiones esta semana`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringColor} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.32, 0.72, 0, 1), stroke 0.3s' }} />
      </svg>
      {label && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: size * 0.3, color: 'var(--text)' }}>
            {done}<span style={{ fontSize: size * 0.17, color: 'var(--text-muted)', fontWeight: 700 }}>/{total}</span>
          </div>
          {size >= 80 && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 3 }}>sesiones</div>}
        </div>
      )}
    </div>
  )
}
