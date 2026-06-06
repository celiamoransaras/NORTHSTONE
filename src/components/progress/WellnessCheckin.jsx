import { useState, useEffect } from 'react'
import { Wellness } from '../../lib/db'
import { sendPushToCoach } from '../../lib/pushNotifications'

export default function WellnessCheckin({ athleteId }) {
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
    await Wellness.upsert({ athlete_id: athleteId, date: new Date().toISOString().slice(0, 10), ...today })
    setSaving(false)
    setDone(true)
    if (today.fatigue >= 4 || today.soreness >= 4) {
      const labels = ['', 'Muy baja', 'Baja', 'Normal', 'Alta', 'Muy alta']
      const parts = []
      if (today.fatigue >= 4) parts.push(`Cansancio: ${labels[today.fatigue]}`)
      if (today.soreness >= 4) parts.push(`Dolor: ${labels[today.soreness]}`)
      sendPushToCoach({ title: '⚠️ Deportista con señales de alerta', body: parts.join(' · '), url: '/' })
    }
  }

  const EmojiRow = ({ label, field, emojis, colors }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((v, i) => (
          <button key={v} onClick={() => !done && set(field, v)}
            style={{ flex: 1, padding: '10px 4px', borderRadius: 12, background: today?.[field] === v ? (colors?.[i] || 'var(--accent)') + '20' : 'var(--bg)', border: `2px solid ${today?.[field] === v ? (colors?.[i] || 'var(--accent)') : 'var(--border)'}`, fontSize: 22, cursor: done ? 'default' : 'pointer', transition: 'all 0.12s' }}>
            {emojis[i]}
          </button>
        ))}
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
            { label: 'Cansancio', value: today?.fatigue, emojis: ['😴', '😐', '🙂', '💪', '🔥'] },
            { label: 'Dolor', value: today?.soreness, emojis: ['✅', '😊', '😐', '😬', '🤕'] },
            { label: 'Ánimo', value: today?.mood, emojis: ['😔', '😐', '🙂', '😄', '🤩'] },
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
      <EmojiRow label="Cansancio" field="fatigue" emojis={['😴', '😐', '🙂', '💪', '🔥']}
        colors={['#DC2626', '#D97706', '#059669', '#059669', '#059669']} />
      <EmojiRow label="Dolor muscular" field="soreness" emojis={['✅', '😊', '😐', '😬', '🤕']}
        colors={['#059669', '#059669', '#D97706', '#DC2626', '#DC2626']} />
      <EmojiRow label="Ánimo" field="mood" emojis={['😔', '😐', '🙂', '😄', '🤩']}
        colors={['#DC2626', '#D97706', '#D97706', '#059669', '#059669']} />
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
