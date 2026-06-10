import { useState, useEffect, useMemo } from 'react'
import { Records, Goals, Wellness } from '../lib/db'
import { supabase } from '../lib/supabase'
import ConfirmSheet from '../components/ConfirmSheet'
import { useToast } from '../contexts/ToastContext'
import { haptic } from '../lib/haptic'
import { sendPushToCoach } from '../lib/pushNotifications'

// ─────────────────────────────────────────────
// INFORME MENSUAL
// ─────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function MonthlyReport({ athleteId, sessions, isFemale }) {
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0) // 0 = actual, -1 = anterior...
  const [nutritionLogs, setNutritionLogs] = useState([])
  const [wellnessData, setWellnessData] = useState([])
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)

  const targetDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return { year: d.getFullYear(), month: d.getMonth(), monthNum: d.getMonth() + 1 }
  }, [monthOffset])

  useEffect(() => {
    setLoading(true)
    const { year, monthNum } = targetDate
    const from = `${year}-${String(monthNum).padStart(2,'0')}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const to = `${year}-${String(monthNum).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

    Promise.all([
      supabase.from('nutrition_logs').select('date,adherence').eq('athlete_id', athleteId).gte('date', from).lte('date', to),
      supabase.from('wellness').select('date,mood,fatigue').eq('athlete_id', athleteId).gte('date', from).lte('date', to),
      isFemale ? supabase.from('injuries').select('date_start,date_end,notes').eq('athlete_id', athleteId).eq('type','cycle') : Promise.resolve({ data: [] }),
    ]).then(([nutr, well, cyc]) => {
      setNutritionLogs(nutr.data || [])
      setWellnessData(well.data || [])
      setCycles(cyc.data || [])
      setLoading(false)
    })
  }, [athleteId, targetDate, isFemale])

  const { year, month, monthNum } = targetDate
  const monthSessions = useMemo(() =>
    sessions.filter(s => {
      const d = new Date(s.date + 'T12:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    }), [sessions, year, month])

  // RPE promedio del mes
  const [monthRpe, setMonthRpe] = useState(null)
  useEffect(() => {
    if (!monthSessions.length) { setMonthRpe(null); return }
    const ids = monthSessions.map(s => s.id).filter(Boolean)
    if (!ids.length) { setMonthRpe(null); return }
    supabase.from('session_athletes').select('rpe').eq('athlete_id', athleteId).in('session_id', ids).not('rpe','is',null)
      .then(({ data }) => {
        if (data?.length) setMonthRpe((data.reduce((a,r) => a + r.rpe, 0) / data.length).toFixed(1))
        else setMonthRpe(null)
      })
  }, [monthSessions, athleteId])

  // Stats calculados
  const nutritionPct = useMemo(() => {
    if (!nutritionLogs.length) return null
    const yes = nutritionLogs.filter(l => l.adherence === 'yes' || l.adherence === 'partial').length
    return Math.round((yes / nutritionLogs.length) * 100)
  }, [nutritionLogs])

  const avgMood = useMemo(() => {
    const valid = wellnessData.filter(w => w.mood)
    if (!valid.length) return null
    return (valid.reduce((a, w) => a + w.mood, 0) / valid.length).toFixed(1)
  }, [wellnessData])

  // Fase predominante del ciclo ese mes
  const dominantPhase = useMemo(() => {
    if (!isFemale || !cycles.length) return null
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const phaseCounts = {}
    cycles.forEach(c => {
      const start = new Date(c.date_start)
      const end = c.date_end ? new Date(c.date_end) : new Date()
      if (end < monthStart || start > monthEnd) return
      const cycleLen = c.cycle_length || 28
      // Estimar fase por día del ciclo
      const dayNum = Math.floor((monthStart - start) / 86400000) + 1
      const phase = dayNum <= 5 ? 'Menstrual' : dayNum <= 13 ? 'Folicular' : dayNum <= 16 ? 'Ovulación' : 'Lútea'
      phaseCounts[phase] = (phaseCounts[phase] || 0) + 1
    })
    const entries = Object.entries(phaseCounts)
    if (!entries.length) return null
    return entries.sort((a,b) => b[1]-a[1])[0][0]
  }, [cycles, isFemale, year, month])

  // Puntuación global del mes (0-100)
  const score = useMemo(() => {
    let points = 0, factors = 0
    if (monthSessions.length > 0) { points += Math.min(monthSessions.length / 12 * 40, 40); factors++ }
    if (nutritionPct !== null) { points += nutritionPct * 0.35; factors++ }
    if (avgMood !== null) { points += ((parseFloat(avgMood) - 1) / 4) * 25; factors++ }
    return factors > 0 ? Math.round(points) : null
  }, [monthSessions, nutritionPct, avgMood])

  const scoreLabel = score === null ? null : score >= 80 ? { text: '🏆 Mes excelente', color: '#059669' }
    : score >= 60 ? { text: '💪 Buen mes', color: '#2563EB' }
    : score >= 40 ? { text: '📈 Mes de trabajo', color: '#D97706' }
    : { text: '🔄 Mes de recuperación', color: '#6B7280' }

  const isCurrentMonth = monthOffset === 0

  return (
    <div className="card" style={{ padding: '20px 18px', marginBottom: 10 }}>
      {/* Header con navegación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Informe mensual
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            {MONTHS_ES[month]} {year}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setMonthOffset(o => o - 1)}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={isCurrentMonth}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: isCurrentMonth ? 'default' : 'pointer', opacity: isCurrentMonth ? 0.3 : 1, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>
      ) : (
        <>
          {/* Puntuación global */}
          {scoreLabel && (
            <div style={{ background: `${scoreLabel.color}15`, border: `1.5px solid ${scoreLabel.color}30`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, color: scoreLabel.color }}>{scoreLabel.text}</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: scoreLabel.color }}>{score}<span style={{ fontSize: 12, fontWeight: 600 }}>/100</span></span>
            </div>
          )}

          {/* Grid de stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: isFemale && dominantPhase ? 12 : 0 }}>
            {[
              { icon: '📅', label: 'Sesiones', value: monthSessions.length, sub: 'este mes', color: '#2563EB' },
              { icon: '🥗', label: 'Nutrición', value: nutritionPct !== null ? `${nutritionPct}%` : '—', sub: 'adherencia', color: '#059669' },
              { icon: '💪', label: 'RPE medio', value: monthRpe ?? '—', sub: 'intensidad', color: '#EF4444' },
              { icon: '😊', label: 'Ánimo', value: avgMood ? `${avgMood}/5` : '—', sub: 'bienestar', color: '#8B5CF6' },
            ].map(({ icon, label, value, sub, color }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Fase del ciclo */}
          {isFemale && dominantPhase && (
            <div style={{ marginTop: 12, background: '#FDF2F8', border: '1px solid #FCE7F3', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🌸</span>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, color: '#9D174D' }}>Fase predominante: {dominantPhase}</div>
                <div style={{ fontSize: 11, color: '#BE185D', marginTop: 1 }}>
                  {dominantPhase === 'Menstrual' && 'Semana de descanso activo y recuperación'}
                  {dominantPhase === 'Folicular' && 'Semana ideal para intensidad alta'}
                  {dominantPhase === 'Ovulación' && 'Pico de rendimiento y fuerza'}
                  {dominantPhase === 'Lútea' && 'Semana de técnica y resistencia moderada'}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// TENDENCIAS: RPE + NUTRICIÓN
// ─────────────────────────────────────────────
function TrendsDashboard({ athleteId, sessions, isFemale }) {
  const [rpeData, setRpeData] = useState([])
  const [nutritionLogs, setNutritionLogs] = useState([])

  useEffect(() => {
    // RPE últimas 20 sesiones con fecha
    const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s.date]))
    supabase.from('session_athletes').select('session_id, rpe').eq('athlete_id', athleteId).not('rpe','is',null).order('session_id', { ascending: false }).limit(30)
      .then(({ data }) => {
        const withDate = (data || [])
          .map(r => ({ rpe: r.rpe, date: sessionMap[r.session_id] }))
          .filter(r => r.date)
          .sort((a,b) => a.date.localeCompare(b.date))
          .slice(-20)
        setRpeData(withDate)
      })
    // Nutrición últimos 60 días
    const from = new Date(); from.setDate(from.getDate() - 59)
    supabase.from('nutrition_logs').select('date,adherence').eq('athlete_id', athleteId).gte('date', from.toISOString().slice(0,10))
      .then(({ data }) => setNutritionLogs(data || []))
  }, [athleteId, sessions])

  // Calcular racha actual de nutrición
  const nutritionStreak = useMemo(() => {
    if (!nutritionLogs.length) return 0
    const logSet = new Set(nutritionLogs.filter(l => l.adherence !== 'no').map(l => l.date))
    let streak = 0
    const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0,10)
      if (logSet.has(key)) { streak++; d.setDate(d.getDate() - 1) }
      else break
      if (streak > 60) break
    }
    return streak
  }, [nutritionLogs])

  // Grid 30 días nutrición (como GitHub contributions)
  const last30Days = useMemo(() => {
    const days = []
    const logMap = Object.fromEntries(nutritionLogs.map(l => [l.date, l.adherence]))
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0,10)
      days.push({ key, adherence: logMap[key] || null, day: d.getDate(), isToday: i === 0 })
    }
    return days
  }, [nutritionLogs])

  // Tendencia RPE (últimos 5 vs anteriores)
  const rpeTrend = useMemo(() => {
    if (rpeData.length < 6) return null
    const recent = rpeData.slice(-5).reduce((a,r) => a + r.rpe, 0) / 5
    const prev = rpeData.slice(-10,-5).reduce((a,r) => a + r.rpe, 0) / 5
    const diff = recent - prev
    if (Math.abs(diff) < 0.3) return null
    return diff > 0 ? { dir: 'up', text: 'Subiendo intensidad', color: '#EF4444', icon: '↗' }
      : { dir: 'down', text: 'Bajando intensidad', color: '#059669', icon: '↘' }
  }, [rpeData])

  const adherenceColor = (a) => a === 'yes' ? '#059669' : a === 'partial' ? '#D97706' : a === 'no' ? '#EF444440' : 'var(--border)'

  return (
    <>
      {/* RPE Sparkline */}
      {rpeData.length >= 3 && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>Tendencia RPE</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Intensidad percibida · últimas {rpeData.length} sesiones</div>
            </div>
            {rpeTrend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${rpeTrend.color}15`, borderRadius: 20, padding: '4px 10px' }}>
                <span style={{ fontSize: 14, color: rpeTrend.color }}>{rpeTrend.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: rpeTrend.color }}>{rpeTrend.text}</span>
              </div>
            )}
          </div>
          <RpeSparkline data={rpeData} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{rpeData[0]?.date && new Date(rpeData[0].date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700 }}>Hoy</span>
          </div>
        </div>
      )}

      {/* Nutrición */}
      {nutritionLogs.length > 0 && (
        <div className="card" style={{ padding: '16px 18px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>Adherencia nutricional</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Últimos 30 días</div>
            </div>
            {nutritionStreak > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 20, padding: '5px 12px' }}>
                <span style={{ fontSize: 16 }}>🔥</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: '#EA580C', lineHeight: 1 }}>{nutritionStreak}</div>
                  <div style={{ fontSize: 9, color: '#C2410C', fontWeight: 700 }}>DÍAS</div>
                </div>
              </div>
            )}
          </div>

          {/* Grid 30 días */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {last30Days.map(d => (
              <div key={d.key} title={d.key}
                style={{ width: 'calc((100% - 87px) / 30)', aspectRatio: '1', minWidth: 8, borderRadius: 3, background: adherenceColor(d.adherence), border: d.isToday ? '2px solid var(--accent)' : 'none', transition: 'all 0.2s' }} />
            ))}
          </div>

          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
            {[['#059669','Cumplido'],['#D97706','Parcial'],['#EF444440','No cumplido'],['var(--border)','Sin datos']].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// SVG Sparkline para RPE
function RpeSparkline({ data }) {
  const W = 300, H = 70
  const minRpe = 1, maxRpe = 10
  const toX = i => (i / Math.max(data.length - 1, 1)) * W
  const toY = v => H - ((v - minRpe) / (maxRpe - minRpe)) * H

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.rpe), rpe: d.rpe }))
  const pathD = 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ')

  // Zona de referencia 5-7 (intensidad óptima)
  const y5 = toY(5), y7 = toY(7)

  const colorForRpe = v => v <= 4 ? '#3B82F6' : v <= 6 ? '#059669' : v <= 8 ? '#D97706' : '#EF4444'

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {/* Zona óptima */}
      <rect x={0} y={y7} width={W} height={y5 - y7} fill="#05966915" rx={2} />
      <text x={W + 4} y={y5 - 2} fontSize={8} fill="#059669" opacity={0.7}>5</text>
      <text x={W + 4} y={y7 + 8} fontSize={8} fill="#059669" opacity={0.7}>7</text>
      {/* Línea */}
      <path d={pathD} fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0" />
      {/* Puntos */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5 : 3.5}
          fill={colorForRpe(p.rpe)} stroke="var(--surface)" strokeWidth={i === points.length - 1 ? 2 : 1} />
      ))}
      {/* Valor último punto */}
      {points.length > 0 && (
        <text x={points[points.length-1].x} y={points[points.length-1].y - 8}
          fontSize={10} fontWeight={800} fill={colorForRpe(points[points.length-1].rpe)} textAnchor="middle">{points[points.length-1].rpe}</text>
      )}
    </svg>
  )
}

// ---- Check-in diario ----
function WellnessCheckin({ athleteId }) {
  const [today, setToday] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    Wellness.getToday(athleteId).then(d => {
      if (d) { setToday(d); setDone(true) }
    })
  }, [athleteId])

  const set = (key, val) => setToday(t => ({ ...(t || {}), [key]: val }))

  const save = async () => {
    if (!today?.fatigue || !today?.soreness || !today?.mood) return
    setSaving(true)
    await Wellness.upsert({ athlete_id: athleteId, date: new Date().toISOString().slice(0,10), ...today })
    setSaving(false)
    setDone(true)
    // Alertar al coach si el cansancio o dolor es alto (≥ 4)
    if (today.fatigue >= 4 || today.soreness >= 4) {
      const fatigueLabels = ['', 'A tope', 'Bien', 'Normal', 'Cansado/a', 'Agotado/a']
      const parts = []
      if (today.fatigue >= 4) parts.push(`Cansancio: ${fatigueLabels[today.fatigue]}`)
      if (today.soreness >= 4) parts.push(`Dolor: ${fatigueLabels[today.soreness]}`)
      sendPushToCoach({
        title: '⚠️ Deportista con señales de alerta',
        body: parts.join(' · '),
        url: '/',
      })
    }
  }

  const FIELD_LABELS = {
    fatigue:  ['A tope de energía', 'Bien', 'Normal', 'Cansado/a', 'Agotado/a'],
    soreness: ['Sin dolor', 'Leve molestia', 'Algo de dolor', 'Bastante dolor', 'Mucho dolor'],
    mood:     ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente'],
  }
  const EmojiRow = ({ label, field, emojis, colors }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map((v, i) => {
          const selected = today?.[field] === v
          const color = colors?.[i] || 'var(--accent)'
          return (
            <button key={v} onClick={() => !done && set(field, v)}
              style={{ flex: 1, padding: '8px 2px', borderRadius: 12, background: selected ? color + '20' : 'var(--bg)', border: `2px solid ${selected ? color : 'var(--border)'}`, cursor: done ? 'default' : 'pointer', transition: 'all 0.12s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 22 }}>{emojis[i]}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: selected ? color : 'var(--text-muted)', lineHeight: 1.2, textAlign: 'center' }}>{FIELD_LABELS[field][i]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (done) {
    return (
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>Estado de hoy</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Ya has registrado cómo estás</div>
          </div>
          <span className="badge badge-green">✓ Registrado</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Cansancio', value: today?.fatigue, emojis: ['🔥','💪','🙂','😐','😴'] },
            { label: 'Dolor', value: today?.soreness, emojis: ['✅','😊','😐','😬','🤕'] },
            { label: 'Ánimo', value: today?.mood, emojis: ['😔','😐','🙂','😄','🤩'] },
          ].map(({ label, value, emojis }) => (
            <div key={label} className="stat-card" style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{value ? emojis[value - 1] : '—'}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>¿Cómo estás hoy?</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Registra tu estado para que tu entrenadora lo vea</div>
      </div>
      <EmojiRow label="Cansancio" field="fatigue" emojis={['🔥','💪','🙂','😐','😴']}
        colors={['#059669','#059669','#059669','#D97706','#DC2626']} />
      <EmojiRow label="Dolor muscular" field="soreness" emojis={['✅','😊','😐','😬','🤕']}
        colors={['#059669','#059669','#D97706','#DC2626','#DC2626']} />
      <EmojiRow label="Ánimo" field="mood" emojis={['😔','😐','🙂','😄','🤩']}
        colors={['#DC2626','#D97706','#D97706','#059669','#059669']} />
      {(!today?.fatigue || !today?.soreness || !today?.mood) && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, marginBottom: 4 }}>
          Selecciona{!today?.fatigue ? ' cansancio' : ''}{!today?.soreness ? (!today?.fatigue ? ',' : '') + ' dolor' : ''}{!today?.mood ? ' y ánimo' : ''} para continuar
        </div>
      )}
      <button className="btn btn-primary btn-full" onClick={save}
        disabled={saving || !today?.fatigue || !today?.soreness || !today?.mood}
        style={{ marginTop: 4 }}>
        {saving ? 'Guardando...' : 'Guardar estado de hoy'}
      </button>
    </div>
  )
}

// ---- Stats en 2x2 ----
function StatsGrid({ athleteId, sessions }) {
  const [avgRpe, setAvgRpe] = useState(null)
  const [streak, setStreak] = useState(0)
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const sessionsThisMonth = sessions.filter(s => s.date.startsWith(monthStr)).length
  const totalHours = Math.round(sessions.reduce((a, s) => a + (s.duration || 0), 0) / 60)

  useEffect(() => {
    supabase.from('session_athletes').select('rpe').eq('athlete_id', athleteId).not('rpe', 'is', null)
      .then(({ data }) => {
        if (data?.length) setAvgRpe((data.reduce((a, r) => a + r.rpe, 0) / data.length).toFixed(1))
      })
    // Racha semanal
    const getWeekKey = (dateStr) => {
      const d = new Date(dateStr + 'T12:00:00')
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7)
      return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`
    }
    const weeksWithSessions = new Set(sessions.map(s => getWeekKey(s.date)))
    let s = 0
    let check = new Date()
    while (true) {
      const key = getWeekKey(check.toISOString().slice(0,10))
      if (weeksWithSessions.has(key)) { s++; check.setDate(check.getDate() - 7) }
      else break
    }
    setStreak(s)
  }, [athleteId, sessions])

  const cards = [
    { value: sessions.length, label: 'Sesiones totales', color: 'var(--accent)', icon: '📅' },
    { value: sessionsThisMonth, label: 'Este mes', color: '#8B5CF6', icon: '📆' },
    { value: `${totalHours}h`, label: 'Horas totales', color: 'var(--success)', icon: '⏱' },
    { value: avgRpe ?? '—', label: 'RPE medio', color: 'var(--error)', icon: '💪' },
  ]

  return (
    <div className="grid-2" style={{ gap: 10 }}>
      {cards.map(({ value, label, color, icon }) => (
        <div key={label} className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 20, opacity: 0.12 }}>{icon}</div>
          <div className="stat-value" style={{ color, fontSize: 36 }}>{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ---- Gráfica carga semanal con colores por tipo ----
const TYPE_COLORS = { run:'#10B981', fuerza:'#F59E0B', series:'#EF4444', endurance:'#3B82F6', especifico:'#8B5CF6', ergometros:'#14B8A6', cardio:'#EC4899', rest_day:'#9CA3AF', strength:'#F59E0B', flexibility:'#10B981', mixed:'#9CA3AF' }

function LoadChart({ sessions }) {
  const weeks = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const wSessions = sessions.filter(s => {
      const sd = new Date(s.date + 'T12:00:00')
      return sd >= weekStart && sd <= weekEnd
    })
    const count = wSessions.length
    const mainType = wSessions.length > 0
      ? Object.entries(wSessions.reduce((a, s) => { a[s.type] = (a[s.type]||0)+1; return a }, {})).sort((a,b)=>b[1]-a[1])[0][0]
      : null
    const label = `${weekStart.getDate()}/${weekStart.getMonth()+1}`
    const isThisWeek = i === 0
    weeks.push({ label, count, mainType, isThisWeek })
  }

  const max = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', marginBottom: 4 }}>Carga semanal</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Sesiones por semana — últimas 8 semanas</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 90 }}>
        {weeks.map((w, i) => {
          const h = max > 0 ? Math.max((w.count / max) * 72, w.count > 0 ? 8 : 2) : 2
          const color = w.count > 0 ? (TYPE_COLORS[w.mainType] || 'var(--accent)') : 'var(--border)'
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {w.count > 0 && (
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, color }}>{w.count}</div>
              )}
              <div style={{ width: '100%', height: h, borderRadius: 6, background: color, opacity: w.isThisWeek ? 1 : 0.7, transition: 'height 0.4s ease' }} />
              <div style={{ fontSize: 9, color: w.isThisWeek ? 'var(--accent)' : 'var(--text-dim)', fontWeight: w.isThisWeek ? 800 : 500, fontFamily: "'Barlow Condensed', sans-serif', whiteSpace: 'nowrap'" }}>{w.isThisWeek ? 'HOY' : w.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Historial bienestar con área ----
function WellnessHistory({ athleteId }) {
  const [data, setData] = useState([])

  useEffect(() => {
    Wellness.getByAthlete(athleteId, 14).then(d => setData([...d].reverse()))
  }, [athleteId])

  if (!data.length) return null

  const W = 300, H = 80
  const FIELDS = [
    { key: 'mood',    color: '#2563EB', label: 'Ánimo',      emoji: '😊' },
    { key: 'fatigue', color: '#EF4444', label: 'Cansancio',  emoji: '😴' },
  ]

  const toX = (i) => (i / (Math.max(data.length - 1, 1))) * W
  const toY = (v) => H - ((v - 1) / 4) * H

  const pathFor = (field) => {
    const pts = data.map((d, i) => d[field] ? `${toX(i)},${toY(d[field])}` : null).filter(Boolean)
    if (!pts.length) return ''
    return 'M ' + pts.join(' L ')
  }

  const latest = data[data.length - 1]

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
        {[1,2,3,4,5].map(v => (
          <line key={v} x1={0} x2={W} y1={toY(v)} y2={toY(v)} stroke="var(--border-light)" strokeWidth={0.8} />
        ))}
        {FIELDS.map(f => (
          <path key={f.key} d={pathFor(f.key)} fill="none" stroke={f.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {data.map((d, i) => FIELDS.map(f => d[f.key] ? (
          <circle key={f.key+i} cx={toX(i)} cy={toY(d[f.key])} r={i === data.length-1 ? 5 : 3} fill={f.color} stroke="var(--surface)" strokeWidth={i === data.length-1 ? 2 : 0} />
        ) : null))}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{data[0] && new Date(data[0].date+'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' })}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Hoy</span>
      </div>

      {/* Resumen último día */}
      {latest && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
          {FIELDS.map(f => {
            const val = latest[f.key]
            const labels = {
              mood:    ['😔 Bajo','😐 Regular','🙂 Bien','😄 Muy bien','🤩 Excelente'],
              fatigue: ['🔥 En forma','🙂 Bien','😐 Normal','😬 Cansada','😴 Agotada'],
            }
            return val ? (
              <div key={f.key} style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: f.color, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels[f.key][val-1]}</div>
              </div>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}

// ---- Objetivos ----
function GoalsSection({ athleteId, canCreate }) {
  const [goals, setGoals] = useState([])
  const [sheet, setSheet] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', target_value: '', current_value: '', unit: '', deadline: '' })
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const toast = useToast()

  useEffect(() => { Goals.getByAthlete(athleteId).then(setGoals) }, [athleteId])

  const save = async () => {
    if (!form.title.trim()) {
      setTitleError(true); haptic('error')
      setTimeout(() => setTitleError(false), 600)
      return
    }
    setSaving(true)
    try {
      await Goals.create({
        ...form, athlete_id: athleteId,
        target_value: parseFloat(form.target_value) || null,
        current_value: parseFloat(form.current_value) || null,
        deadline: form.deadline || null,
        description: form.description || null,
        unit: form.unit || null,
      })
      setGoals(await Goals.getByAthlete(athleteId))
      setSheet(false)
      setForm({ title: '', description: '', target_value: '', current_value: '', unit: '', deadline: '' })
      haptic('success')
      toast('Objetivo creado')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (goal) => {
    await Goals.update(goal.id, { completed: !goal.completed })
    setGoals(g => g.map(x => x.id === goal.id ? {...x, completed: !x.completed} : x))
  }

  const del = async (id) => {
    try {
      await Goals.delete(id)
      setGoals(g => g.filter(x => x.id !== id))
      setConfirmDelete(null)
      haptic('medium'); toast('Objetivo eliminado')
    } catch { toast('Error al eliminar', 'error') }
  }

  const pct = (g) => g.target_value && g.current_value ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Mis objetivos</div>
        {canCreate && <button className="btn btn-primary btn-sm" onClick={() => setSheet(true)}>+ Nuevo</button>}
      </div>

      {goals.length === 0 ? (
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.35 }}>🎯</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Sin objetivos aún</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{canCreate ? 'Añade el primer objetivo con el botón +' : 'Tu entrenadora irá añadiendo objetivos para ti'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goals.map(g => {
            const p = pct(g)
            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline+'T12:00:00') - new Date()) / (1000*60*60*24)) : null
            const isOverdue = daysLeft !== null && daysLeft < 0 && !g.completed
            return (
              <div key={g.id} className="card" style={{ padding: '16px 18px', opacity: g.completed ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Check */}
                  <div onClick={() => toggle(g)}
                    style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${g.completed ? 'var(--success)' : 'var(--border)'}`, background: g.completed ? 'var(--success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                    {g.completed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, textDecoration: g.completed ? 'line-through' : 'none', marginBottom: g.description ? 3 : 0 }}>{g.title}</div>
                    {g.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{g.description}</div>}

                    {/* Barra de progreso */}
                    {p !== null && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.current_value} {g.unit} de {g.target_value} {g.unit}</span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, color: p >= 100 ? 'var(--success)' : 'var(--accent)' }}>{p}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? 'var(--success)' : 'var(--accent-gradient)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )}

                    {/* Fecha límite */}
                    {g.deadline && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: isOverdue ? 'var(--error)' : 'var(--text-muted)' }}>
                          📅 {new Date(g.deadline+'T12:00:00').toLocaleDateString('es-ES')}
                          {!g.completed && daysLeft !== null && (
                            <span style={{ marginLeft: 6, fontWeight: 600, color: isOverdue ? 'var(--error)' : daysLeft <= 7 ? 'var(--warning)' : 'var(--text-muted)' }}>
                              {isOverdue ? `· Vencido hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? '· ¡Hoy!' : `· ${daysLeft} días`}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {canCreate && (
                    <button onClick={() => setConfirmDelete(g.id)} style={{ color: 'var(--text-dim)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Eliminar objetivo"
          message="Se eliminará este objetivo permanentemente."
          onConfirm={() => del(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {sheet && (
        <>
          <div className="overlay" onClick={() => setSheet(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>Nuevo objetivo</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)}>✕</button>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Objetivo *</label>
                <input className={`input${titleError ? ' input-error' : ''}`} placeholder="ej. Correr 10k en menos de 50 min" value={form.title} onChange={e => { setForm(f => ({...f, title: e.target.value})); if(titleError) setTitleError(false) }} />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción</label>
                <textarea className="input" placeholder="Detalles del objetivo..." value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Valor actual</label>
                  <input className="input" type="number" step="0.01" placeholder="0" value={form.current_value} onChange={e => setForm(f => ({...f, current_value: e.target.value}))} />
                </div>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Meta</label>
                  <input className="input" type="number" step="0.01" placeholder="10" value={form.target_value} onChange={e => setForm(f => ({...f, target_value: e.target.value}))} />
                </div>
                <div style={{ width: 80 }} className="input-group">
                  <label className="input-label">Unidad</label>
                  <input className="input" placeholder="km" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha límite</label>
                <input className="input" type="date" min={new Date().toISOString().slice(0,10)} value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Gráfica de evolución de una marca ----
function RecordChart({ recs, unit }) {
  // ordenadas de más antigua a más reciente
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

  // área bajo la curva
  const areaD = `M ${toX(0)},${H} L ${pts.split(' ').join(' L ')} L ${toX(data.length-1)},${H} Z`

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    return `${d.getDate()}/${d.getMonth()+1}`
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: 'visible', minWidth: 260 }}>
        {/* Grid lines */}
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
        {/* Área */}
        <path d={areaD} fill="var(--accent)" opacity={0.07} />
        {/* Línea */}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Puntos */}
        {data.map((d, i) => {
          const x = toX(i)
          const y = toY(parseFloat(d.value))
          const isLast = i === data.length - 1
          const isBest = parseFloat(d.value) === Math.min(...values)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isLast ? 6 : 4}
                fill={isBest ? 'var(--success)' : isLast ? 'var(--accent)' : 'var(--surface)'}
                stroke={isBest ? 'var(--success)' : 'var(--accent)'}
                strokeWidth={2} />
              {isLast && (
                <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fontWeight="800"
                  fill="var(--accent)" fontFamily="'Barlow Condensed', sans-serif">
                  {d.value} {unit}
                </text>
              )}
              {isBest && !isLast && (
                <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fontWeight="800"
                  fill="var(--success)" fontFamily="'Barlow Condensed', sans-serif">
                  ★
                </text>
              )}
            </g>
          )
        })}
        {/* Fechas eje X */}
        {data.map((d, i) => {
          const show = data.length <= 6 || i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 5) === 0
          return show ? (
            <text key={i} x={toX(i)} y={H + 16} textAnchor="middle" fontSize={9}
              fill="var(--text-dim)" fontFamily="'Barlow Condensed', sans-serif">
              {fmtDate(d.date)}
            </text>
          ) : null
        })}
      </svg>
    </div>
  )
}

// ---- Marcas personales ----
function RecordsSection({ athleteId, canEdit }) {
  const [records, setRecords] = useState([])
  const [sheet, setSheet] = useState(false)
  const [editing, setEditing] = useState(null)
  const [chartGroup, setChartGroup] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [nameError, setNameError] = useState(false)
  const toast = useToast() // {name, recs, unit}
  const emptyForm = { name: '', value: '', unit: 'min', date: new Date().toISOString().slice(0,10), notes: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const UNITS = ['min', 'seg', 'kg', 'km', 'rep', 'cm', 'w', 'm']

  useEffect(() => { Records.getByAthlete(athleteId).then(setRecords) }, [athleteId])

  // Agrupar por nombre normalizado (case-insensitive) preservando el nombre original del primer registro
  const groupMap = {}
  records.forEach(r => {
    const key = r.name.trim().toLowerCase()
    if (!groupMap[key]) groupMap[key] = { displayName: r.name, recs: [] }
    groupMap[key].recs.push(r)
  })
  const grouped = Object.fromEntries(Object.values(groupMap).map(g => [g.displayName, g.recs]))

  const openNew  = () => { setEditing(null); setForm(emptyForm); setSheet(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ name: r.name, value: String(r.value), unit: r.unit, date: r.date, notes: r.notes || '' }); setSheet(true) }

  const save = async () => {
    if (!form.name.trim() || !form.value) {
      setNameError(true); haptic('error')
      setTimeout(() => setNameError(false), 600)
      return
    }
    setSaving(true)
    try {
      if (editing) await Records.update(editing, { ...form, value: parseFloat(form.value) })
      else await Records.create({ ...form, value: parseFloat(form.value), athlete_id: athleteId })
      setRecords(await Records.getByAthlete(athleteId))
      setSheet(false)
      setEditing(null)
      haptic('success')
      toast(editing ? 'Marca actualizada' : 'Marca guardada')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id) => {
    try {
      await Records.delete(id)
      setRecords(r => r.filter(x => x.id !== id))
      setSheet(false)
      setConfirmDelete(null)
      haptic('medium'); toast('Marca eliminada')
    } catch { toast('Error al eliminar', 'error') }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Marcas personales</div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva</button>}
      </div>

      {records.length === 0 ? (
        <div className="card" style={{ padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.35 }}>🏆</div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Sin marcas aún</div>
          {canEdit && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Empieza a registrar tus tiempos y récords</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(grouped).map(([name, recs]) => {
            const chronological = [...recs].sort((a, b) => a.date.localeCompare(b.date))
            const best = recs[0]
            const prev = recs[1]
            const improved = prev && parseFloat(best.value) !== parseFloat(prev.value)
            const better = prev && parseFloat(best.value) < parseFloat(prev.value)
            return (
              <div key={name} className="card" style={{ padding: '16px 18px', cursor: 'pointer' }}
                onClick={() => setChartGroup({ name, recs: chronological, unit: best.unit })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(best.date+'T12:00:00').toLocaleDateString('es-ES')}
                      {recs.length > 1 && ` · ${recs.length} registros`}
                    </div>
                    {improved && (
                      <div style={{ fontSize: 12, color: better ? 'var(--success)' : 'var(--error)', marginTop: 4, fontWeight: 600 }}>
                        {better ? '↑ Mejora' : '↓'} vs anterior: {prev.value} {prev.unit}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, color: 'var(--accent)', lineHeight: 1 }}>{best.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{best.unit}</div>
                  </div>
                  {canEdit && (
                    <button onClick={e => { e.stopPropagation(); openEdit(best) }}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>
                      ✏️
                    </button>
                  )}
                  <span style={{ color: 'var(--text-dim)', fontSize: 16, flexShrink: 0 }}>›</span>
                </div>
                {/* Mini preview histórico */}
                {chronological.length > 1 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'flex-end', height: 28 }}>
                    {chronological.map((r, i) => {
                      const vals = chronological.map(x => parseFloat(x.value))
                      const mn = Math.min(...vals), mx = Math.max(...vals)
                      const h = mn === mx ? 14 : 8 + ((parseFloat(r.value) - mn) / (mx - mn)) * 16
                      const isLast = i === chronological.length - 1
                      return (
                        <div key={r.id} style={{ flex: 1, height: h, borderRadius: 3, background: isLast ? 'var(--accent)' : 'var(--border)', transition: 'height 0.3s' }} />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sheet gráfica evolución */}
      {chartGroup && (
        <>
          <div className="overlay" onClick={() => setChartGroup(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <h3>{chartGroup.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{chartGroup.recs.length} registros · en {chartGroup.unit}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setChartGroup(null)}>✕</button>
            </div>
            <div className="sheet-body">
              {/* Stats rápidas */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { label: 'Mejor', value: Math.min(...chartGroup.recs.map(r => parseFloat(r.value))), color: 'var(--success)' },
                  { label: 'Último', value: parseFloat(chartGroup.recs[chartGroup.recs.length-1].value), color: 'var(--accent)' },
                  { label: 'Registros', value: chartGroup.recs.length, color: 'var(--text-muted)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.5px' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Gráfica */}
              <RecordChart recs={chartGroup.recs} unit={chartGroup.unit} />

              {/* Historial completo */}
              <div className="section-title" style={{ marginTop: 20 }}>Historial</div>
              <div className="card">
                {[...chartGroup.recs].reverse().map((r, i) => {
                  const isBest = parseFloat(r.value) === Math.min(...chartGroup.recs.map(x => parseFloat(x.value)))
                  return (
                    <div key={r.id} className="list-item" style={{ borderBottom: i < chartGroup.recs.length-1 ? undefined : 'none', cursor: 'default' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{new Date(r.date+'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })}</div>
                        {r.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{r.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isBest && <span style={{ fontSize: 14 }}>⭐</span>}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: isBest ? 'var(--success)' : 'var(--text)' }}>{r.value}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{r.unit}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {canEdit && (
                <>
                  <div className="divider" />
                  <button className="btn btn-primary btn-full" onClick={() => { setChartGroup(null); openNew() }}>
                    + Añadir nuevo registro
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Eliminar marca"
          message="Se eliminará este registro permanentemente."
          onConfirm={() => del(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {sheet && (
        <>
          <div className="overlay" onClick={() => setSheet(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{editing ? 'Editar marca' : 'Nueva marca'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing && <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(editing)}>🗑</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => setSheet(false)}>✕</button>
              </div>
            </div>
            <div className="sheet-body">
              <div className="input-group">
                <label className="input-label">Ejercicio / Prueba *</label>
                <input className={`input${nameError ? ' input-error' : ''}`} placeholder="ej. 5k, Sentadilla, Peso muerto" value={form.name} onChange={e => { setForm(f => ({...f, name: e.target.value})); if(nameError) setNameError(false) }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }} className="input-group">
                  <label className="input-label">Valor *</label>
                  <input className="input" type="number" step="0.01" placeholder="25.30" value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))} />
                </div>
                <div style={{ width: 100 }} className="input-group">
                  <label className="input-label">Unidad</label>
                  <select className="input" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
              </div>
              <div className="input-group">
                <label className="input-label">Notas</label>
                <input className="input" placeholder="Condiciones, observaciones..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar marca'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Página principal ----
export default function Progress({ athleteId, sessions = [], isCoach = false, isFemale = false }) {
  return (
    <div className="page fade-in">
      {!isCoach && <div className="page-header"><h2>Mi Progreso</h2></div>}
      <div className="page-content">

        {/* Check-in diario — solo para el deportista */}
        {!isCoach && <WellnessCheckin athleteId={athleteId} />}

        {/* Informe mensual */}
        <MonthlyReport athleteId={athleteId} sessions={sessions} isFemale={isFemale} />

        {/* Tendencias RPE + Nutrición */}
        {!isCoach && <TrendsDashboard athleteId={athleteId} sessions={sessions} isFemale={isFemale} />}

        {/* Stats 2x2 */}
        {!isCoach && <StatsGrid athleteId={athleteId} sessions={sessions} />}

        {/* Carga semanal */}
        <LoadChart sessions={sessions} />

        {/* Historial bienestar */}
        {!isCoach && <WellnessHistory athleteId={athleteId} />}

        {/* Objetivos */}
        <GoalsSection athleteId={athleteId} canCreate={isCoach} />

        {/* Marcas */}
        <RecordsSection athleteId={athleteId} canEdit={!isCoach} />

      </div>
    </div>
  )
}

// ---- Bienestar de hoy en modo lectura (para la entrenadora) ----
export function WellnessTodayCoach({ athleteId, athleteName }) {
  const [entry, setEntry] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Wellness.getByAthlete(athleteId, 1).then(data => {
setEntry(data?.[0] || null)
      setLoaded(true)
    })
  }, [athleteId])

  if (!loaded) return null

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const dateLabel = !entry ? '' : entry.date === today ? 'Hoy'
    : entry.date === yesterday.toISOString().slice(0,10) ? 'Ayer'
    : new Date(entry.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  if (!entry) return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 4 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase', marginBottom: 6 }}>Bienestar</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{athleteName ? `${athleteName} aún no ha registrado su estado.` : 'Aún no hay registro de bienestar.'}</div>
    </div>
  )

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>Bienestar</div>
          <div style={{ fontSize: 12, color: entry.date === today ? 'var(--success)' : 'var(--text-muted)', marginTop: 2 }}>
            {dateLabel}
          </div>
        </div>
        <span className={`badge ${entry.date === today ? 'badge-green' : 'badge-gray'}`}>✓ Registrado</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'Cansancio', value: entry.fatigue, emojis: ['🔥','💪','🙂','😐','😴'], alert: entry.fatigue >= 4 },
          { label: 'Dolor', value: entry.soreness, emojis: ['✅','😊','😐','😬','🤕'], alert: entry.soreness >= 4 },
          { label: 'Ánimo', value: entry.mood, emojis: ['😔','😐','🙂','😄','🤩'], alert: false },
        ].map(({ label, value, emojis, alert }) => (
          <div key={label} className="stat-card" style={{ flex: 1, padding: '12px 8px', textAlign: 'center', border: alert ? '1.5px solid var(--error)' : undefined, background: alert ? 'var(--error-dim)' : undefined }}>
            <div style={{ fontSize: 24, marginBottom: 2 }}>{value ? emojis[value - 1] : '—'}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 900, color: alert ? 'var(--error)' : 'var(--text)', marginBottom: 2 }}>{value ? `${value}/5` : '—'}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: alert ? 'var(--error)' : 'var(--text-muted)', letterSpacing: '0.5px' }}>{label}{alert ? ' ⚠️' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { WellnessCheckin, WellnessHistory, GoalsSection, RecordsSection, LoadChart }
