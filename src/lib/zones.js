// ─────────────────────────────────────────────
// ZONAS DE ENTRENAMIENTO Y RM
// Los tests y los RM se guardan como marcas personales con nombre fijo
// ("Test VAM 6'", "RM Peso muerto"...), así quedan con su historial y su gráfica.
// En la app los minutos se escriben como m.ss (4.30 = 4:30).
// ─────────────────────────────────────────────

export const TESTS = [
  { key: 'vam',   name: "Test VAM 6'",       unit: 'min', kind: 'pace', label: "VAM · test 6'",        hint: 'Ritmo medio /km', placeholder: '4:00' },
  { key: 'run30', name: "Test carrera 30'",  unit: 'min', kind: 'pace', label: "Carrera · test 30'",   hint: 'Ritmo medio /km (= ritmo umbral)', placeholder: '4:30' },
  { key: 'hr',    name: 'Test FC umbral',    unit: 'bpm', kind: 'num',  label: 'FC umbral',             hint: "FC media de los últimos 20' del test de 30'", placeholder: '175' },
  { key: 'ftp',   name: 'Test FTP Bike',     unit: 'w',   kind: 'num',  label: 'FTP · Bike Erg',        hint: 'Vatios', placeholder: '150' },
  { key: 'ski',   name: 'Test Ski 2k',       unit: 'min', kind: 'pace', label: 'Ski Erg · 2k',          hint: 'Ritmo medio /500 m', placeholder: '2:01' },
  { key: 'row',   name: 'Test Row 2k',       unit: 'min', kind: 'pace', label: 'Row Erg · 2k',          hint: 'Ritmo medio /500 m', placeholder: '1:52' },
]

export const LIFTS = [
  { key: 'rdl',       name: 'Peso muerto rumano', re: /rumano|\brdl\b|romanian/i },
  { key: 'deadlift',  name: 'Peso muerto',        re: /peso\s*muerto|dead\s*lift/i },
  { key: 'front',     name: 'Sentadilla frontal', re: /sentadilla\s*frontal|front\s*squat/i },
  { key: 'squat',     name: 'Sentadilla',         re: /sentadilla(?!\s*b[uú]lgara)|back\s*squat|\bsquat/i },
  { key: 'bench',     name: 'Press banca',        re: /press\s*(de\s*)?banca|bench/i },
  { key: 'pushpress', name: 'Push press',         re: /push\s*press/i },
  { key: 'ohp',       name: 'Press militar',      re: /press\s*militar|strict\s*press|\bohp\b|overhead\s*press/i },
  { key: 'hipthrust', name: 'Hip thrust',         re: /hip\s*thrust/i },
  { key: 'clean',     name: 'Cargada',            re: /cargada|power\s*clean|\bclean\b/i },
]

export const isTestOrRm = (name = '') => /^\s*(test|rm)\s/i.test(name)
export const rmRecordName = (lift) => `RM ${lift}`

// ---- tiempos ----
export const recordSeconds = (value, unit) => {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return null
  if (unit === 'seg') return v
  if (unit === 'min') {
    const m = Math.floor(v)
    const ss = Math.round((v - m) * 100)
    return ss < 60 ? m * 60 + ss : v * 60
  }
  return null
}
// "4:30", "4.30", "4'30" → segundos
export const parsePace = (txt) => {
  if (txt == null) return null
  const t = String(txt).trim().replace(/[’'.,]/g, ':')
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.some(n => !Number.isFinite(n))) return null
  if (parts.length === 1) return parts[0] > 0 && parts[0] < 20 ? parts[0] * 60 : null
  if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1]
  return null
}
// segundos → valor m.ss para guardar (270 → 4.30)
export const secondsToMss = (s) => {
  const m = Math.floor(s / 60)
  const ss = Math.round(s - m * 60)
  return Number(`${m}.${String(ss).padStart(2, '0')}`)
}
export const fmtPace = (s) => {
  if (!s || !Number.isFinite(s)) return '–'
  const r = Math.round(s)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`
}

// ---- últimos valores ----
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || '')

export function latestTests(records = []) {
  const out = {}
  const sorted = [...records].sort(byDateDesc)
  TESTS.forEach(t => {
    const r = sorted.find(x => (x.name || '').trim().toLowerCase() === t.name.toLowerCase())
    if (!r) return
    const value = t.kind === 'pace' ? recordSeconds(r.value, r.unit) : Number(r.value)
    if (value && value > 0) out[t.key] = { value, date: r.date, record: r }
  })
  return out
}

// 1RM estimado (Epley) a partir de peso × repeticiones
export const estimate1RM = (weight, reps) => {
  const w = Number(weight), n = Math.round(Number(reps) || 1)
  if (!(w > 0) || n < 1) return null
  if (n === 1) return w
  return Math.round(w * (1 + Math.min(n, 12) / 30) * 2) / 2
}
export const roundLoad = (kg) => Math.round(kg / 2.5) * 2.5
export const fmtKg = (kg) => `${String(Math.round(kg * 10) / 10).replace('.', ',')} kg`

export function latestRMs(records = []) {
  const out = {}
  ;[...records].sort(byDateDesc).forEach(r => {
    const m = (r.name || '').match(/^\s*rm\s+(.+)$/i)
    if (!m || r.unit !== 'kg') return
    const lift = m[1].trim()
    const key = lift.toLowerCase()
    if (!out[key] && Number(r.value) > 0) out[key] = { lift, value: Number(r.value), date: r.date, record: r }
  })
  return out
}

// ---- zonas ----
// Carrera: % de la velocidad umbral (ritmo del test de 30')
export const RUN_ZONES = [
  { code: 'Z1',  name: 'Recuperación',  lo: 0.75, hi: 0.85, desc: 'Muy suave: regenerar y soltar piernas' },
  { code: 'Z2b', name: 'Base aeróbica',       lo: 0.80, hi: 0.85, desc: 'Base aeróbica cómoda, puedes hablar' },
  { code: 'Z2',  name: 'Estado estable',lo: 0.85, hi: 0.92, desc: 'El ritmo de fondo: aguantable mucho tiempo' },
  { code: 'Z3',  name: 'Tempo',         lo: 0.92, hi: 0.98, desc: 'Exigente pero controlado' },
  { code: 'Z4',  name: 'Umbral',        lo: 0.98, hi: 1.02, desc: 'Duro: alrededor de tu ritmo de 30\'' },
]
export const VAM_LEVELS = [90, 95, 100, 105, 110]
export const BIKE_ZONES = [
  { code: 'Z1', name: 'Recuperación',   lo: 0.55, hi: 0.65 },
  { code: 'Z2', name: 'Estado estable', lo: 0.65, hi: 0.75 },
  { code: 'Z3', name: 'Tempo',          lo: 0.75, hi: 0.85 },
  { code: 'Z4', name: 'Umbral',         lo: 0.90, hi: 1.00 },
]
// Ski y Row: segundos que se suman al ritmo del 2k (/500 m)
export const ERG_ZONES = [
  { code: 'Z2', name: 'Estado estable', slow: 20, fast: 15 },
  { code: 'Z3', name: 'Tempo',          slow: 15, fast: 10 },
  { code: 'Z4', name: 'Umbral',         slow: 10, fast: 5 },
]

export const runZone = (vt2, z) => ({ slow: vt2 / z.lo, fast: vt2 / z.hi })
export const vamPace = (vam, pct) => vam / (pct / 100)
export const bikeZone = (ftp, z) => ({ min: Math.round(ftp * z.lo), max: Math.round(ftp * z.hi) })
export const ergZone = (pace2k, z) => ({ slow: pace2k + z.slow, fast: pace2k + z.fast })

// ─────────────────────────────────────────────
// Lee el texto de una sesión y devuelve los números de una deportista
// Entiende: "Z1".."Z4", "Z2 baja", "90% VAM", "80% FTP" y "75%" en un ejercicio de fuerza
// ─────────────────────────────────────────────
const modalityOf = (txt) => {
  if (/bike|bici|assault|echo|ciclo/i.test(txt)) return 'bike'
  if (/\bski/i.test(txt)) return 'ski'
  if (/\brow\b|\bremo\b|rowing/i.test(txt)) return 'row'
  return 'run'
}
const MODALITY_LABEL = { run: 'carrera', bike: 'bike', ski: 'ski', row: 'row' }

export function sessionChunks(session) {
  const chunks = []
  const push = (t) => { if (t && String(t).trim()) chunks.push(String(t)) }
  push(session?.title)
  String(session?.notes || '').split(/\n+/).forEach(push)
  ;(session?.exercises || []).forEach(ex => push([ex.name, ex.notes].filter(Boolean).join(' · ')))
  return chunks
}

// Devuelve una lista de "objetivos" detectados (independiente de la deportista)
export function detectTargets(session) {
  const found = new Map()
  const add = (key, t) => { if (!found.has(key)) found.set(key, t) }
  sessionChunks(session).forEach(txt => {
    const mod = modalityOf(txt)
    for (const m of txt.matchAll(/\bz\s?([1-4])(\s?(baja|b)\b)?/gi)) {
      let code = `Z${m[1]}`
      if (code === 'Z2' && m[3] && mod === 'run') code = 'Z2b'
      if ((mod === 'ski' || mod === 'row') && code === 'Z1') continue
      add(`zone:${mod}:${code}`, { type: 'zone', mod, code })
    }
    for (const m of txt.matchAll(/(\d{2,3})\s?%\s?(de\s+)?(la\s+)?vam/gi)) add(`vam:${m[1]}`, { type: 'vam', pct: Number(m[1]) })
    for (const m of txt.matchAll(/(\d{2,3})\s?%\s?(del?\s+)?ftp/gi)) add(`ftp:${m[1]}`, { type: 'ftp', pct: Number(m[1]) })
    const lift = LIFTS.find(l => l.re.test(txt))
    if (lift) {
      for (const m of txt.matchAll(/(\d{2,3})\s?%(?!\s?(de\s+)?(la\s+|del?\s+)?(vam|ftp))/gi)) {
        const pct = Number(m[1])
        if (pct >= 30 && pct <= 110) add(`rm:${lift.key}:${pct}`, { type: 'rm', lift, pct })
      }
    } else {
      // Ejercicio con "RM" personalizado: "Thruster al 70% RM"
      for (const m of txt.matchAll(/(\d{2,3})\s?%\s?(de\s+)?(1\s?)?rm/gi)) add(`rmtxt:${txt}:${m[1]}`, { type: 'rmtext', text: txt, pct: Number(m[1]) })
    }
  })
  return [...found.values()]
}

// Resuelve cada objetivo con los datos de una deportista
export function resolveTargets(targets, tests = {}, rms = {}) {
  return targets.map(t => {
    if (t.type === 'zone') {
      if (t.mod === 'run') {
        const z = RUN_ZONES.find(z => z.code === t.code)
        const label = `${z.code === 'Z2b' ? 'Z2 baja' : z.code} · carrera`
        if (!tests.run30) return { label, missing: "Falta el test de 30'" }
        const { slow, fast } = runZone(tests.run30.value, z)
        return { label, value: `${fmtPace(slow)}–${fmtPace(fast)} /km`, hint: z.name }
      }
      if (t.mod === 'bike') {
        const z = BIKE_ZONES.find(z => z.code === t.code)
        const label = `${z.code} · bike`
        if (!tests.ftp) return { label, missing: 'Falta el FTP' }
        const { min, max } = bikeZone(tests.ftp.value, z)
        return { label, value: `${min}–${max} W`, hint: z.name }
      }
      const z = ERG_ZONES.find(z => z.code === t.code)
      const label = `${z.code} · ${MODALITY_LABEL[t.mod]}`
      const base = tests[t.mod]
      if (!base) return { label, missing: `Falta el test ${t.mod === 'ski' ? 'Ski' : 'Row'} 2k` }
      const { slow, fast } = ergZone(base.value, z)
      return { label, value: `${fmtPace(slow)}–${fmtPace(fast)} /500 m`, hint: z.name }
    }
    if (t.type === 'vam') {
      const label = `${t.pct} % VAM`
      if (!tests.vam) return { label, missing: "Falta el test VAM 6'" }
      return { label, value: `${fmtPace(vamPace(tests.vam.value, t.pct))} /km` }
    }
    if (t.type === 'ftp') {
      const label = `${t.pct} % FTP`
      if (!tests.ftp) return { label, missing: 'Falta el FTP' }
      return { label, value: `${Math.round(tests.ftp.value * t.pct / 100)} W` }
    }
    if (t.type === 'rm') {
      const label = `${t.lift.name} · ${t.pct} %`
      const rm = rms[t.lift.name.toLowerCase()]
      if (!rm) return { label, missing: `Falta el RM de ${t.lift.name.toLowerCase()}` }
      return { label, value: fmtKg(roundLoad(rm.value * t.pct / 100)), hint: `RM ${fmtKg(rm.value)}` }
    }
    if (t.type === 'rmtext') {
      const hit = Object.values(rms).find(r => t.text.toLowerCase().includes(r.lift.toLowerCase()))
      if (!hit) return null
      return { label: `${hit.lift} · ${t.pct} %`, value: fmtKg(roundLoad(hit.value * t.pct / 100)), hint: `RM ${fmtKg(hit.value)}` }
    }
    return null
  }).filter(Boolean)
}
