// ─────────────────────────────────────────────
// BIBLIOTECA DE EJERCICIOS (base) + utilidades para el registro de series
//  kind: strength = kilos × repeticiones · reps = repeticiones (peso corporal)
//        time = tiempo y/o distancia · carry = kilos + distancia (trineo, farmers)
// La entrenadora puede añadir su vídeo e indicaciones propias (tabla coach_exercises).
// ─────────────────────────────────────────────
export const CATEGORIES = ['Hyrox', 'Carrera', 'Ergómetros', 'Fuerza', 'Accesorios', 'Core', 'Pliometría', 'Movilidad']

const E = (key, name, cat, kind, cues, aliases = []) => ({ key, name, cat, kind, cues, aliases })

export const BASE_EXERCISES = [
  // Hyrox
  E('skierg', 'SkiErg', 'Hyrox', 'time', 'Tira con dorsales y abdomen, no solo con brazos. Cadera atrás en cada tirón y vuelve alta. Ritmo constante, no a tirones.', ['ski erg', 'ski']),
  E('sled_push', 'Sled push (empuje de trineo)', 'Hyrox', 'carry', 'Brazos estirados o casi, cuerpo inclinado a unos 45°. Pasos cortos y rápidos empujando con toda la planta. No pares: arrancar cuesta más que seguir.', ['sled push', 'empuje de trineo', 'trineo empuje']),
  E('sled_pull', 'Sled pull (arrastre de trineo)', 'Hyrox', 'carry', 'Cuerda corta, tira con piernas y cadera retrocediendo, mano sobre mano. Mantén la espalda neutra y el trineo siempre en movimiento.', ['sled pull', 'arrastre de trineo', 'trineo arrastre']),
  E('bbj', 'Burpee broad jump', 'Hyrox', 'reps', 'Pecho al suelo, levántate sin saltar de más y salta hacia delante aterrizando suave con pies a la anchura de caderas. Respira en cada repetición.', ['burpee broad', 'burpees broad', 'broad jump burpee', 'bbj']),
  E('row', 'Remo (RowErg)', 'Hyrox', 'time', 'Orden: piernas, cadera, brazos; al volver, brazos, cadera, piernas. Empuja fuerte con las piernas y no encojas los hombros.', ['row erg', 'rowerg', 'remo ergómetro', 'remo ergometro', 'remo']),
  E('farmers', 'Farmers carry', 'Hyrox', 'carry', 'Pesas a los lados, hombros abajo y atrás, abdomen firme. Pasos cortos y rápidos; si hay que parar, deja las pesas con control.', ['farmer carry', 'farmers', 'paseo del granjero', 'farmer']),
  E('lunges', 'Sandbag lunges', 'Hyrox', 'carry', 'Saco sobre los hombros, tronco erguido. La rodilla de atrás roza el suelo en cada zancada y empujas con el talón de delante.', ['sandbag lunge', 'zancadas con saco', 'lunges con saco', 'sandbag']),
  E('wall_balls', 'Wall balls', 'Hyrox', 'reps', 'Sentadilla profunda con el balón pegado al pecho y sube de forma explosiva lanzando al objetivo. Recibe el balón ya bajando a la siguiente.', ['wall ball', 'wallballs', 'wall-ball']),
  E('roxzone', 'Roxzone / transiciones', 'Hyrox', 'time', 'Entra y sal de las estaciones trotando. Usa la transición para respirar y prepararte para la siguiente.', ['roxzone', 'transición', 'transiciones']),
  // Carrera
  E('run', 'Carrera', 'Carrera', 'time', 'Postura alta, mirada al frente y brazos relajados. Apunta el tiempo y, si puedes, la distancia de cada tramo.', ['carrera', 'correr', 'running', 'run']),
  E('easy_run', 'Rodaje suave', 'Carrera', 'time', 'Ritmo en el que puedes hablar. Zancada relajada y cadencia ágil. Es la base de todo: no lo conviertas en un entreno duro.', ['rodaje', 'carrera suave', 'trote']),
  E('intervals', 'Series', 'Carrera', 'time', 'Calienta bien antes. Mantén el ritmo marcado en todas las series: mejor la última igual que la primera que empezar demasiado fuerte.', ['series', 'intervalos', 'repeticiones de']),
  E('tempo', 'Tempo / umbral', 'Carrera', 'time', 'Ritmo exigente pero sostenible, "cómodamente duro". Respiración controlada, sin llegar a ahogarte.', ['tempo', 'umbral']),
  E('hills', 'Cuestas', 'Carrera', 'time', 'Pasos cortos, brazos activos y mirada al frente. Baja trotando suave para recuperar.', ['cuestas', 'cuesta', 'hill']),
  E('compromised', 'Carrera tras estación', 'Carrera', 'time', 'Sal de la estación con pasos cortos y ve alargando. El objetivo es recuperar tu ritmo de carrera cuanto antes.', ['compromised', 'carrera comprometida']),
  // Ergómetros
  E('bike', 'Bike Erg', 'Ergómetros', 'time', 'Sillín a la altura de la cadera, rodilla casi estirada abajo. Cadencia fluida y tronco quieto.', ['bike erg', 'bikeerg', 'bici', 'bike']),
  E('assault', 'Assault / air bike', 'Ergómetros', 'time', 'Empuja y tira con brazos a la vez que pedaleas. Arranca controlado: sube muy rápido de pulsaciones.', ['assault bike', 'air bike', 'echo bike', 'assault']),
  // Fuerza
  E('back_squat', 'Sentadilla trasera', 'Fuerza', 'strength', 'Barra sobre trapecios, pies a la anchura de hombros. Baja con el pecho alto y las rodillas en la línea de los pies; sube empujando el suelo.', ['sentadilla trasera', 'back squat', 'sentadilla con barra', 'sentadilla']),
  E('front_squat', 'Sentadilla frontal', 'Fuerza', 'strength', 'Barra sobre los hombros con codos altos. Tronco muy vertical y profundidad completa.', ['sentadilla frontal', 'front squat']),
  E('goblet', 'Goblet squat', 'Fuerza', 'strength', 'Pesa pegada al pecho, codos entre las rodillas al bajar. Ideal para aprender la sentadilla.', ['goblet', 'sentadilla goblet']),
  E('deadlift', 'Peso muerto', 'Fuerza', 'strength', 'Barra pegada a las piernas, espalda neutra y dorsales activos. Empuja el suelo con las piernas y termina con la cadera, sin hiperextender.', ['peso muerto', 'deadlift']),
  E('rdl', 'Peso muerto rumano', 'Fuerza', 'strength', 'Rodillas ligeramente flexionadas, lleva la cadera atrás hasta notar los isquios. Barra pegada a los muslos y espalda neutra.', ['peso muerto rumano', 'rdl', 'romanian']),
  E('hip_thrust', 'Hip thrust', 'Fuerza', 'strength', 'Espalda alta en el banco, barbilla al pecho. Sube con glúteo hasta alinear rodilla, cadera y hombro; aguanta 1 segundo arriba.', ['hip thrust', 'hip trust', 'empuje de cadera']),
  E('bench', 'Press banca', 'Fuerza', 'strength', 'Escápulas juntas y abajo, pies firmes. Baja controlado al pecho y empuja en línea recta.', ['press banca', 'press de banca', 'bench']),
  E('ohp', 'Press militar', 'Fuerza', 'strength', 'De pie, glúteo y abdomen apretados. Empuja la barra por encima de la cabeza y mete la cabeza "en la ventana" al final.', ['press militar', 'strict press', 'ohp', 'overhead press']),
  E('push_press', 'Push press', 'Fuerza', 'strength', 'Pequeña flexión de rodillas y empuje explosivo con piernas para ayudar a subir la barra.', ['push press']),
  E('pullup', 'Dominadas', 'Fuerza', 'reps', 'Desde brazos estirados, tira con la espalda hasta pasar la barbilla. Controla la bajada. Con banda si hace falta.', ['dominada', 'dominadas', 'pull up', 'pull-up']),
  E('barbell_row', 'Remo con barra', 'Fuerza', 'strength', 'Tronco inclinado y espalda neutra. Lleva la barra al ombligo juntando escápulas.', ['remo con barra', 'barbell row']),
  E('db_row', 'Remo con mancuerna', 'Fuerza', 'strength', 'Apoyo en banco, espalda plana. Tira del codo hacia la cadera sin girar el tronco.', ['remo con mancuerna', 'remo unilateral', 'db row']),
  E('lunge', 'Zancadas', 'Fuerza', 'strength', 'Paso largo, tronco erguido, rodilla de atrás cerca del suelo. Empuja con el talón de delante.', ['zancada', 'zancadas', 'lunge', 'lunges']),
  E('bulgarian', 'Sentadilla búlgara', 'Fuerza', 'strength', 'Pie de atrás en el banco. Baja en vertical cargando la pierna de delante; tronco algo inclinado para más glúteo.', ['sentadilla búlgara', 'búlgara', 'bulgara', 'bulgarian']),
  E('step_up', 'Subida al cajón (step-up)', 'Fuerza', 'strength', 'Todo el pie sobre el cajón y sube empujando con esa pierna, sin impulsarte con la de abajo.', ['step up', 'step-up', 'subida al cajón', 'subida al cajon', 'subidas al cajón']),
  E('clean', 'Cargada (power clean)', 'Fuerza', 'strength', 'Barra cerca del cuerpo, extensión explosiva de cadera y recibe en los hombros con codos altos.', ['cargada', 'power clean', 'clean']),
  E('thruster', 'Thruster', 'Fuerza', 'strength', 'Sentadilla frontal y, al subir, empuja la barra por encima de la cabeza en un solo movimiento.', ['thruster', 'thrusters']),
  E('kb_swing', 'Kettlebell swing', 'Fuerza', 'strength', 'Movimiento de cadera, no de sentadilla. La pesa sube por el empuje de la cadera; brazos relajados.', ['swing', 'kettlebell swing', 'kb swing']),
  E('dips', 'Fondos', 'Fuerza', 'reps', 'Hombros abajo, baja hasta 90° de codo y sube sin bloquear del todo. En banco o paralelas.', ['fondos', 'dips']),
  E('pushup', 'Flexiones', 'Fuerza', 'reps', 'Cuerpo en bloque, manos bajo los hombros. Pecho cerca del suelo en cada repetición. Con rodillas apoyadas si hace falta.', ['flexiones', 'flexión', 'push up', 'push-up']),
  // Accesorios
  E('glute_bridge', 'Puente de glúteo', 'Accesorios', 'reps', 'Pies cerca del glúteo, sube la cadera apretando glúteo sin arquear la zona lumbar.', ['puente de glúteo', 'puente de gluteo', 'glute bridge', 'puente']),
  E('calf', 'Elevaciones de gemelo', 'Accesorios', 'strength', 'Sube lo más alto posible, pausa arriba y baja lento. Clave para correr y prevenir lesiones.', ['gemelo', 'gemelos', 'calf raise']),
  E('ham_curl', 'Curl femoral', 'Accesorios', 'strength', 'Controla la bajada (2-3 segundos). Puedes hacerlo en máquina, con fitball o deslizadores.', ['curl femoral', 'femoral', 'nordic', 'nórdico']),
  E('face_pull', 'Face pull', 'Accesorios', 'strength', 'Polea a la altura de la cara, tira separando las manos y llevando los codos altos. Hombros sanos.', ['face pull']),
  E('band_abd', 'Abducciones con banda', 'Accesorios', 'reps', 'Banda en rodillas o tobillos, separa sin mover el tronco. Activa el glúteo medio antes de correr.', ['abducción', 'abducciones', 'monster walk', 'banda']),
  // Core
  E('plank', 'Plancha', 'Core', 'time', 'Codos bajo hombros, glúteo y abdomen apretados, cuerpo en línea. Mejor menos tiempo y bien hecha.', ['plancha frontal', 'plank', 'plancha']),
  E('side_plank', 'Plancha lateral', 'Core', 'time', 'Codo bajo el hombro, cadera alta y cuerpo en línea. Ambos lados.', ['plancha lateral', 'side plank']),
  E('dead_bug', 'Dead bug', 'Core', 'reps', 'Zona lumbar pegada al suelo todo el rato. Estira brazo y pierna contrarios despacio.', ['dead bug', 'deadbug']),
  E('bird_dog', 'Bird dog', 'Core', 'reps', 'A cuatro patas, estira brazo y pierna contrarios sin mover la cadera.', ['bird dog', 'birddog']),
  E('pallof', 'Pallof press', 'Core', 'reps', 'Polea o banda a un lado; estira los brazos al frente sin dejar que te gire.', ['pallof']),
  E('hollow', 'Hollow hold', 'Core', 'time', 'Lumbar pegada al suelo, piernas y brazos estirados y elevados. Sube las piernas si se despega la espalda.', ['hollow']),
  E('copenhagen', 'Copenhague', 'Core', 'time', 'Plancha lateral con la pierna de arriba apoyada en el banco. Gran ejercicio para aductores.', ['copenhague', 'copenhagen']),
  // Pliometría
  E('box_jump', 'Saltos al cajón', 'Pliometría', 'reps', 'Salta con brazos y aterriza suave con todo el pie en el cajón. Baja andando, no saltando.', ['salto al cajón', 'saltos al cajón', 'box jump', 'saltos al cajon']),
  E('jump_rope', 'Comba', 'Pliometría', 'time', 'Saltos pequeños sobre la parte delantera del pie, giro con las muñecas.', ['comba', 'cuerda', 'jump rope', 'double under', 'dobles']),
  E('pogo', 'Pogo jumps', 'Pliometría', 'reps', 'Saltos cortos y rápidos con rodillas casi estiradas. Tobillo reactivo, poco tiempo de contacto.', ['pogo']),
  // Movilidad
  E('hip_9090', 'Movilidad de cadera 90/90', 'Movilidad', 'time', 'Sentada con ambas piernas a 90°, gira de un lado a otro con el tronco erguido.', ['90/90', 'movilidad de cadera']),
  E('ankle_mob', 'Movilidad de tobillo', 'Movilidad', 'time', 'Rodilla hacia delante sobre los dedos sin levantar el talón. Clave para la sentadilla y la carrera.', ['movilidad de tobillo', 'tobillo']),
  E('thoracic', 'Movilidad torácica', 'Movilidad', 'time', 'Rotaciones y aperturas de la parte alta de la espalda, de lado o a cuatro patas.', ['torácica', 'toracica', 'thoracic', 'apertura']),
  E('cat_cow', 'Gato-camello', 'Movilidad', 'time', 'A cuatro patas, alterna redondear y arquear la espalda despacio y con la respiración.', ['gato', 'camello', 'cat cow']),
]

const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Une la biblioteca base con lo que ha personalizado o añadido la entrenadora
export function mergeLibrary(custom = []) {
  const byBase = Object.fromEntries(custom.filter(c => c.base_key).map(c => [c.base_key, c]))
  const base = BASE_EXERCISES.map(e => {
    const c = byBase[e.key]
    return c ? { ...e, cues: c.cues || e.cues, video_url: c.video_url || '', customId: c.id, hidden: !!c.hidden } : { ...e, video_url: '' }
  })
  const own = custom.filter(c => !c.base_key).map(c => ({ key: 'c_' + c.id, name: c.name, cat: c.category || 'Fuerza', kind: c.kind || 'strength', cues: c.cues || '', video_url: c.video_url || '', aliases: [], customId: c.id, own: true, hidden: !!c.hidden }))
  return [...base, ...own]
}

// Busca el ejercicio de la biblioteca que aparece en una línea de texto (el nombre más largo gana)
export function matchExercise(line, library) {
  const t = norm(line)
  if (!t) return null
  let best = null, bestLen = 0
  for (const e of library) {
    if (e.hidden) continue
    for (const n of [e.name, ...(e.aliases || [])]) {
      const k = norm(n)
      if (k.length < 3) continue
      const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`)
      if (re.test(t) && k.length > bestLen) { best = e; bestLen = k.length }
    }
  }
  return best
}

// Clave para agrupar el historial de un ejercicio (biblioteca o texto limpio)
export const keyForLine = (line, ex) => ex ? ex.key : norm(line).replace(/[0-9x×@%'"’.,:/()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

// Tipo de registro según la línea ("4x10" → series de kilos × reps; "1 km" → tiempo)
export function guessKind(line, ex) {
  if (ex) return ex.kind
  const t = norm(line)
  if (/\b\d+(\.\d+)?\s?(km|m|metros)\b|\bmin\b|['’]|\btiempo\b|\bsegundos\b|\b\d+\s?s\b/.test(t) && !/\d+\s?x\s?\d+/.test(t)) return 'time'
  return 'strength'
}

// Series y repeticiones escritas en la línea: "4x10", "5 x 5", "3×12"
export function parseScheme(line) {
  const m = norm(line).match(/(\d{1,2})\s?[x×]\s?(\d{1,3})/)
  return m ? { sets: Math.min(Number(m[1]), 12), reps: Number(m[2]) } : null
}

// Líneas de un bloque (una por ejercicio, como escribe la entrenadora)
export const blockLines = (notes = '') => String(notes || '').split(/\n+/).map(l => l.trim()).filter(Boolean)

// ---- tiempos ----
export const parseClock = (txt) => {
  const t = String(txt ?? '').trim().replace(/[’'.,]/g, ':')
  if (!t) return null
  const p = t.split(':').map(Number)
  if (p.some(n => !Number.isFinite(n))) return null
  if (p.length === 1) return p[0] > 0 ? p[0] : null // segundos
  if (p.length === 2) return p[0] * 60 + p[1]
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
  return null
}
export const fmtClock = (s) => {
  if (!s && s !== 0) return ''
  const r = Math.round(s), h = Math.floor(r / 3600), m = Math.floor((r % 3600) / 60), x = r % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null }
const fmtNum = (n) => String(Math.round(n * 10) / 10).replace('.', ',')

// Limpia las series antes de guardar
export function cleanSets(sets = [], kind) {
  return sets.map(s => ({
    kg: kind === 'strength' || kind === 'carry' ? num(s.kg) : null,
    reps: kind === 'strength' || kind === 'reps' ? num(s.reps) : null,
    time: kind === 'time' || kind === 'carry' ? parseClock(s.time) : null,
    dist: kind === 'time' || kind === 'carry' ? num(s.dist) : null,
  })).filter(s => s.kg || s.reps || s.time || s.dist)
}

// Resumen corto: "3 × 10 · 40 kg" o "4 series · mejor 3:45"
export function summarize(sets = [], kind) {
  if (!sets.length) return ''
  if (kind === 'strength') {
    const kgs = sets.map(s => s.kg).filter(Boolean), reps = sets.map(s => s.reps).filter(Boolean)
    const sameReps = reps.length && reps.every(r => r === reps[0])
    const maxKg = kgs.length ? Math.max(...kgs) : null
    return `${sets.length} × ${sameReps ? reps[0] : reps.join('/')}${maxKg ? ` · ${fmtNum(maxKg)} kg` : ''}`
  }
  if (kind === 'reps') {
    const reps = sets.map(s => s.reps).filter(Boolean)
    return `${sets.length} serie${sets.length > 1 ? 's' : ''} · ${reps.join('/')} reps`
  }
  const times = sets.map(s => s.time).filter(Boolean)
  const dists = sets.map(s => s.dist).filter(Boolean)
  const kgs = sets.map(s => s.kg).filter(Boolean)
  const parts = []
  if (kind === 'carry' && kgs.length) parts.push(`${fmtNum(Math.max(...kgs))} kg`)
  if (dists.length) parts.push(`${fmtNum(dists.reduce((a, b) => a + b, 0))} m`)
  if (times.length === 1) parts.push(fmtClock(times[0]))
  else if (times.length > 1) parts.push(`${times.length} series · mejor ${fmtClock(Math.min(...times))}`)
  return parts.join(' · ')
}

// Mejor marca de un registro para comparar con el historial
export function bestOf(sets = [], kind) {
  if (kind === 'strength') {
    const e = sets.filter(s => s.kg && s.reps && s.reps <= 12).map(s => s.kg * (1 + (s.reps > 1 ? s.reps / 30 : 0)))
    const kg = sets.map(s => s.kg).filter(Boolean)
    return e.length ? { value: Math.round(Math.max(...e) * 2) / 2, label: '1RM est.', higher: true, maxKg: kg.length ? Math.max(...kg) : null } : null
  }
  if (kind === 'reps') { const r = sets.map(s => s.reps).filter(Boolean); return r.length ? { value: Math.max(...r), label: 'reps', higher: true } : null }
  if (kind === 'carry') { const k = sets.map(s => s.kg).filter(Boolean); return k.length ? { value: Math.max(...k), label: 'kg', higher: true } : null }
  const t = sets.map(s => s.time).filter(Boolean)
  return t.length ? { value: Math.min(...t), label: 'tiempo', higher: false } : null
}
export const fmtBest = (b) => !b ? '' : b.label === 'tiempo' ? fmtClock(b.value) : b.label === 'reps' ? `${b.value} reps` : `${fmtNum(b.value)} kg`

export const youtubeSearch = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' técnica ejercicio')}`
