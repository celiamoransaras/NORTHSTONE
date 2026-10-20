import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─────────────────────────────────────────────
// Temporizador de entreno: cronómetro, cuenta atrás, intervalos y EMOM.
// Cuenta con la hora real (no se desfasa si el móvil se bloquea un momento),
// pita en cada cambio y en los 3 últimos segundos, vibra y mantiene la pantalla encendida.
// ─────────────────────────────────────────────

const MODES = [
  { id: 'stopwatch', label: 'Cronómetro' },
  { id: 'countdown', label: 'Cuenta atrás' },
  { id: 'intervals', label: 'Intervalos' },
  { id: 'emom', label: 'EMOM' },
]
const PRESETS = [
  { label: 'Tabata 20/10 × 8', mode: 'intervals', work: 20, rest: 10, rounds: 8 },
  { label: '30/30 × 10', mode: 'intervals', work: 30, rest: 30, rounds: 10 },
  { label: '40/20 × 6', mode: 'intervals', work: 40, rest: 20, rounds: 6 },
  { label: "EMOM 10'", mode: 'emom', every: 60, rounds: 10 },
  { label: "E2MOM 5 × 2'", mode: 'emom', every: 120, rounds: 5 },
]

const fmt = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(t / 60), s = t % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
const fmtUp = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function buildSegments(cfg) {
  if (cfg.mode === 'countdown') return [{ kind: 'work', label: 'Cuenta atrás', dur: cfg.countdown * 1000 }]
  if (cfg.mode === 'intervals') {
    const segs = []
    for (let r = 1; r <= cfg.rounds; r++) {
      segs.push({ kind: 'work', label: 'Trabajo', round: r, dur: cfg.work * 1000 })
      if (cfg.rest > 0 && r < cfg.rounds) segs.push({ kind: 'rest', label: 'Descanso', round: r, dur: cfg.rest * 1000 })
    }
    return segs
  }
  if (cfg.mode === 'emom') return Array.from({ length: cfg.rounds }, (_, i) => ({ kind: 'work', label: 'Minuto', round: i + 1, dur: cfg.every * 1000 }))
  return null
}

let audioCtx = null
const beep = (freq = 880, ms = 160) => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator(), g = audioCtx.createGain()
    o.frequency.value = freq; o.type = 'sine'
    g.gain.setValueAtTime(0.25, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000)
    o.connect(g); g.connect(audioCtx.destination)
    o.start(); o.stop(audioCtx.currentTime + ms / 1000)
  } catch { /* sin audio */ }
}
const buzz = (p) => { try { navigator.vibrate?.(p) } catch { /* sin vibración */ } }

const NumField = ({ label, value, onChange, min = 1, max = 3600, step = 5, suffix }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <div className="input-label" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(Math.max(min, value - step))} aria-label={`Menos ${label}`}>−</button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap' }}>{value}{suffix}</div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(Math.min(max, value + step))} aria-label={`Más ${label}`}>+</button>
    </div>
  </div>
)

export default function SessionTimer({ onClose, title }) {
  const [cfg, setCfg] = useState({ mode: 'intervals', countdown: 300, work: 40, rest: 20, rounds: 8, every: 60 })
  const [running, setRunning] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [before, setBefore] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [started, setStarted] = useState(false)
  const lastSeg = useRef(-1)
  const lastSecond = useRef(null)
  const wake = useRef(null)

  const segments = useMemo(() => buildSegments(cfg), [cfg])
  const total = segments ? segments.reduce((a, s) => a + s.dur, 0) : null
  const elapsed = before + (running ? now - startedAt : 0)
  const finished = total !== null && elapsed >= total

  // Segmento actual
  let segIdx = -1, segLeft = 0
  if (segments) {
    let acc = 0
    for (let i = 0; i < segments.length; i++) {
      if (elapsed < acc + segments[i].dur) { segIdx = i; segLeft = acc + segments[i].dur - elapsed; break }
      acc += segments[i].dur
    }
  }
  const seg = segIdx >= 0 ? segments[segIdx] : null

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [running])

  // Pitidos y vibración en cambios de fase y últimos 3 segundos
  useEffect(() => {
    if (!running || !segments) return
    if (segIdx !== lastSeg.current) {
      if (lastSeg.current !== -1 || segIdx === 0) { beep(seg?.kind === 'rest' ? 520 : 990, 350); buzz(seg?.kind === 'rest' ? [120] : [200, 80, 200]) }
      lastSeg.current = segIdx
    }
    const sec = Math.ceil(segLeft / 1000)
    if (sec !== lastSecond.current) {
      if (sec > 0 && sec <= 3) beep(660, 120)
      lastSecond.current = sec
    }
  }, [running, segIdx, segLeft, segments, seg])

  useEffect(() => {
    if (finished && running) {
      setBefore(total); setRunning(false)
      beep(1100, 700); buzz([300, 100, 300, 100, 500])
    }
  }, [finished, running, total])

  // Mantener la pantalla encendida mientras corre
  useEffect(() => {
    const release = () => { try { wake.current?.release() } catch { /* nada */ } wake.current = null }
    if (running && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => { wake.current = l }).catch(() => {})
    else release()
    return release
  }, [running])

  const start = () => { beep(0.0001, 1); setStartedAt(Date.now()); setNow(Date.now()); setRunning(true); setStarted(true); if (!started) { lastSeg.current = -1 } }
  const pause = () => { setBefore(elapsed); setRunning(false) }
  const reset = () => { setRunning(false); setBefore(0); setStarted(false); lastSeg.current = -1; lastSecond.current = null }
  const setMode = (mode) => { reset(); setCfg(c => ({ ...c, mode })) }
  const applyPreset = (p) => { reset(); setCfg(c => ({ ...c, ...p })) }

  const isRest = seg?.kind === 'rest'
  const bg = !started ? 'var(--bg)' : finished ? '#065F46' : isRest ? '#1E3A8A' : '#0C4A6E'
  const fg = started ? '#fff' : 'var(--text)'
  const big = cfg.mode === 'stopwatch' ? fmtUp(elapsed) : finished ? '00:00' : seg ? fmt(segLeft) : fmt(total)
  const phase = cfg.mode === 'stopwatch' ? 'Cronómetro'
    : finished ? '¡Terminado! 🎉'
      : !seg ? '' : cfg.mode === 'countdown' ? 'Cuenta atrás'
        : `${seg.label}${seg.round ? ` · ${cfg.mode === 'emom' ? 'Minuto' : 'Ronda'} ${seg.round}/${cfg.rounds}` : ''}`

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: bg, color: fg, display: 'flex', flexDirection: 'column', transition: 'background 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(16px, env(safe-area-inset-top)) 16px 8px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, textTransform: 'uppercase' }}>⏱ Temporizador</div>
          {title && <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>}
        </div>
        <button className={started ? 'btn-close btn-close--dark' : 'btn-close'} aria-label="Cerrar" onClick={onClose}>✕</button>
      </div>

      {!started && (
        <div style={{ padding: '0 16px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'var(--card)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 12 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{ padding: '9px 2px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12, background: cfg.mode === m.id ? 'var(--accent)' : 'transparent', color: cfg.mode === m.id ? '#fff' : 'var(--text-muted)' }}>
                {m.label}
              </button>
            ))}
          </div>
          {(cfg.mode === 'intervals' || cfg.mode === 'emom') && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESETS.filter(p => p.mode === cfg.mode).map(p => (
                <button key={p.label} className="btn btn-secondary btn-sm" onClick={() => applyPreset(p)}>{p.label}</button>
              ))}
            </div>
          )}
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cfg.mode === 'stopwatch' && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cuenta hacia arriba hasta que lo pares.</div>}
            {cfg.mode === 'countdown' && <NumField label="Duración" value={cfg.countdown / 60} step={1} min={1} max={180} suffix=" min" onChange={v => setCfg(c => ({ ...c, countdown: v * 60 }))} />}
            {cfg.mode === 'intervals' && (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <NumField label="Trabajo" value={cfg.work} min={5} max={1800} suffix=" s" onChange={v => setCfg(c => ({ ...c, work: v }))} />
                  <NumField label="Descanso" value={cfg.rest} min={0} max={1800} suffix=" s" onChange={v => setCfg(c => ({ ...c, rest: v }))} />
                </div>
                <NumField label="Rondas" value={cfg.rounds} step={1} min={1} max={99} onChange={v => setCfg(c => ({ ...c, rounds: v }))} />
              </>
            )}
            {cfg.mode === 'emom' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <NumField label="Cada" value={cfg.every} step={15} min={15} max={600} suffix=" s" onChange={v => setCfg(c => ({ ...c, every: v }))} />
                <NumField label="Rondas" value={cfg.rounds} step={1} min={1} max={99} onChange={v => setCfg(c => ({ ...c, rounds: v }))} />
              </div>
            )}
            {total !== null && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Total: {fmtUp(total)}</div>}
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, minHeight: 28, textAlign: 'center' }}>{phase}</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: started ? 'min(34vw, 180px)' : 72, lineHeight: 1, fontVariantNumeric: 'tabular-nums', margin: '6px 0' }}>{big}</div>
        {started && segments && !finished && seg && (
          <div style={{ width: 'min(80vw, 420px)', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.min(100, (elapsed / total) * 100)}%`, background: '#fff', borderRadius: 4 }} />
          </div>
        )}
        {started && segments && segments[segIdx + 1] && !finished && (
          <div style={{ fontSize: 14, opacity: 0.75, marginTop: 10 }}>Siguiente: {segments[segIdx + 1].label.toLowerCase()} {fmt(segments[segIdx + 1].dur)}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px 16px max(20px, env(safe-area-inset-bottom))' }}>
        {started && <button className="btn btn-full" onClick={reset} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', color: fg, border: 'none' }}>Reiniciar</button>}
        {!finished && (running
          ? <button className="btn btn-full" onClick={pause} style={{ flex: 2, background: '#fff', color: '#0C4A6E', border: 'none', fontWeight: 900 }}>Pausa</button>
          : <button className="btn btn-primary btn-full" onClick={start} style={{ flex: 2, ...(started ? { background: '#fff', color: '#0C4A6E' } : {}) }}>{started ? 'Seguir' : 'Empezar'}</button>)}
        {finished && <button className="btn btn-full" onClick={reset} style={{ flex: 2, background: '#fff', color: '#065F46', border: 'none', fontWeight: 900 }}>Otra vez</button>}
      </div>
    </div>,
    document.body
  )
}
