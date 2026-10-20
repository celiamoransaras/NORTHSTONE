import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { detectTargets, resolveTargets, latestTests, latestRMs, isTestOrRm } from '../lib/zones'

// Ritmos, vatios y kilos de cada deportista para lo que pide la sesión
// ("Z2", "90% VAM", "80% FTP", "Peso muerto 5x5 al 75%"...)
export default function SessionTargets({ session, athletes = [], mine = false }) {
  const targets = useMemo(() => detectTargets(session), [session])
  const ids = useMemo(() => athletes.map(a => a.id).filter(Boolean), [athletes])
  const [byAthlete, setByAthlete] = useState(null)

  useEffect(() => {
    if (!targets.length || !ids.length) return
    let alive = true
    supabase.from('personal_records').select('*').in('athlete_id', ids)
      .then(({ data }) => {
        if (!alive) return
        const map = {}
        ;(data || []).filter(r => isTestOrRm(r.name)).forEach(r => { (map[r.athlete_id] = map[r.athlete_id] || []).push(r) })
        setByAthlete(map)
      }, () => alive && setByAthlete({}))
    return () => { alive = false }
  }, [targets.length, ids.join(",")])

  if (!targets.length || !ids.length || !byAthlete) return null

  const rowsFor = (id) => {
    const recs = byAthlete[id] || []
    return resolveTargets(targets, latestTests(recs), latestRMs(recs))
  }

  const Rows = ({ rows }) => rows.map((r, i) => (
    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
        {r.hint && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.hint}</div>}
      </div>
      {r.value
        ? <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{r.value}</div>
        : <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{r.missing}</div>}
    </div>
  ))

  if (mine) {
    const rows = rowsFor(ids[0])
    if (!rows.length) return null
    const anyMissing = rows.some(r => !r.value)
    return (
      <div style={{ background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>🎯 Tus números para esta sesión</div>
        <Rows rows={rows} />
        {anyMissing && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Añade tus tests y RM en Más → Mis zonas para ver todos los números.</div>}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-title" style={{ marginTop: 0 }}>🎯 Números de cada deportista</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {athletes.map(a => {
          const rows = rowsFor(a.id)
          if (!rows.length) return null
          return (
            <div key={a.id} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color || 'var(--accent)' }} />
                <span style={{ fontWeight: 800, fontSize: 14 }}>{a.name}</span>
              </div>
              <Rows rows={rows} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
