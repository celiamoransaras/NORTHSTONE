import { fmtShortDate } from '../../lib/utils'

export default function RecordChart({ recs, unit }) {
  const data = [...recs].sort((a, b) => a.date.localeCompare(b.date))
  if (data.length < 2) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
      Necesitas al menos 2 registros para ver la evolución
    </div>
  )

  const W = 300, H = 110
  const values = data.map(d => parseFloat(d.value))
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1
  const padV = range * 0.15

  const toX = (i) => 16 + (i / (data.length - 1)) * (W - 32)
  const toY = (v) => H - 8 - ((v - (minV - padV)) / (range + padV * 2)) * (H - 20)

  const pts = data.map((d, i) => `${toX(i)},${toY(parseFloat(d.value))}`).join(' ')
  const pathD = 'M ' + pts.split(' ').join(' L ')
  const areaD = `M ${toX(0)},${H} L ${pts.split(' ').join(' L ')} L ${toX(data.length - 1)},${H} Z`

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible', minWidth: 260 }}>
        {[0, 0.5, 1].map(f => {
          const y = toY(minV - padV + f * (range + padV * 2))
          const v = (minV - padV + f * (range + padV * 2)).toFixed(1)
          return (
            <g key={f}>
              <line x1={0} x2={W} y1={y} y2={y} stroke="var(--border-light)" strokeWidth={0.8} strokeDasharray="4 4" />
              <text x={2} y={y - 3} fontSize={9} fill="var(--text-dim)" fontFamily="'Barlow Condensed', sans-serif">{v}</text>
            </g>
          )
        })}
        <path d={areaD} fill="var(--accent)" opacity={0.07} />
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = toX(i), y = toY(parseFloat(d.value))
          const isLast = i === data.length - 1
          const isBest = parseFloat(d.value) === Math.min(...values)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isLast ? 6 : 4}
                fill={isBest ? 'var(--success)' : isLast ? 'var(--accent)' : 'var(--surface)'}
                stroke={isBest ? 'var(--success)' : 'var(--accent)'} strokeWidth={2} />
              {isLast && (
                <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fontWeight="800"
                  fill="var(--accent)" fontFamily="'Barlow Condensed', sans-serif">{d.value} {unit}</text>
              )}
              {isBest && !isLast && (
                <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fontWeight="800"
                  fill="var(--success)" fontFamily="'Barlow Condensed', sans-serif">★</text>
              )}
            </g>
          )
        })}
        {data.map((d, i) => {
          const show = data.length <= 6 || i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0
          return show ? (
            <text key={i} x={toX(i)} y={H + 16} textAnchor="middle" fontSize={9}
              fill="var(--text-dim)" fontFamily="'Barlow Condensed', sans-serif">
              {fmtShortDate(d.date)}
            </text>
          ) : null
        })}
      </svg>
    </div>
  )
}
