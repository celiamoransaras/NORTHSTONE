import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES, mergeLibrary, youtubeSearch } from '../lib/exercises'
import { useToast } from '../contexts/ToastContext'

// ─────────────────────────────────────────────
// Biblioteca de ejercicios: carga, ficha de técnica, selector y gestión (entrenadora)
// ─────────────────────────────────────────────
let cache = null
export async function loadLibrary(force = false) {
  if (cache && !force) return cache
  const { data, error } = await supabase.from('coach_exercises').select('*')
  cache = { library: mergeLibrary(error ? [] : (data || [])), editable: !error }
  return cache
}
export function useLibrary() {
  const [state, setState] = useState(cache)
  const reload = async () => setState(await loadLibrary(true))
  useEffect(() => { loadLibrary().then(setState) }, [])
  return { library: state?.library || mergeLibrary([]), editable: !!state?.editable, ready: !!state, reload }
}

const KIND_LABEL = { strength: 'Kilos × repeticiones', reps: 'Repeticiones', time: 'Tiempo / distancia', carry: 'Kilos + distancia' }
const ytId = (url = '') => url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)?.[1]
const Portal = ({ children }) => createPortal(children, document.body)

export function ExerciseInfoSheet({ ex, onClose }) {
  if (!ex) return null
  const yt = ytId(ex.video_url)
  return (
    <Portal>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2100 }} />
      <div className="sheet" style={{ zIndex: 2101 }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ex.cat}</div>
            <h3>{ex.name}</h3>
          </div>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {ex.cues && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--accent-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Técnica</div>
              {ex.cues}
            </div>
          )}
          {yt ? (
            <a href={`https://www.youtube.com/watch?v=${yt}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 10 }}>
              <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt={`Vídeo de ${ex.name}`} style={{ width: '100%', display: 'block' }} />
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>▶</span>
            </a>
          ) : ex.video_url ? (
            <a className="btn btn-primary btn-full" href={ex.video_url} target="_blank" rel="noopener noreferrer">▶ Ver vídeo de Celia</a>
          ) : (
            <a className="btn btn-secondary btn-full" href={youtubeSearch(ex.name)} target="_blank" rel="noopener noreferrer">▶ Buscar vídeos en YouTube</a>
          )}
        </div>
      </div>
    </Portal>
  )
}

function useFiltered(library, q, cat) {
  return useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return library.filter(e => !e.hidden)
      .filter(e => !cat || e.cat === cat)
      .filter(e => !t || [e.name, ...(e.aliases || [])].some(n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t)))
  }, [library, q, cat])
}
const CatChips = ({ cat, setCat }) => (
  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 8, scrollbarWidth: 'none' }}>
    {[null, ...CATEGORIES].map(c => (
      <button key={c || 'all'} type="button" onClick={() => setCat(c)}
        style={{ flexShrink: 0, padding: '7px 12px', minHeight: 36, borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: `1.5px solid ${cat === c ? 'var(--accent)' : 'var(--border)'}`, background: cat === c ? 'var(--accent)' : 'var(--card)', color: cat === c ? '#fff' : 'var(--text-muted)' }}>
        {c || 'Todos'}
      </button>
    ))}
  </div>
)

// Selector para añadir ejercicios a un bloque de la sesión
export function ExercisePicker({ library, onPick, onClose }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)
  const [scheme, setScheme] = useState('')
  const list = useFiltered(library, q, cat)
  return (
    <Portal>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2000 }} />
      <div className="sheet" style={{ zIndex: 2001 }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>📚 Añadir ejercicio</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <input className="input" autoFocus placeholder="Buscar (sentadilla, wall ball, ski...)" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 8 }} />
          <CatChips cat={cat} setCat={setCat} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>Series / indicación</span>
            <input className="input" placeholder="p. ej. 4x10 al 70%  ·  500 m  ·  3x45 s" value={scheme} onChange={e => setScheme(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map(e => (
              <button key={e.key} type="button" onClick={() => onPick(e, scheme.trim())}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', minHeight: 48, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}{e.video_url ? ' 🎬' : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.cat} · {KIND_LABEL[e.kind]}</div>
                </div>
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 13 }}>+ Añadir</span>
              </button>
            ))}
            {list.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>No hay ninguno con ese nombre. Puedes escribirlo a mano en el bloque o añadirlo a tu biblioteca.</div>}
          </div>
        </div>
      </div>
    </Portal>
  )
}

// Página de la biblioteca (entrenadora): consultar, poner tu vídeo e indicaciones, añadir u ocultar
export default function ExerciseLibraryPage() {
  const toast = useToast()
  const { library, editable, reload } = useLibrary()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState(null)
  const [edit, setEdit] = useState(null)
  const [showHidden, setShowHidden] = useState(false)
  const visible = useFiltered(showHidden ? library.map(e => ({ ...e, hidden: false })) : library, q, cat)

  const save = async () => {
    const row = { name: edit.name.trim(), category: edit.cat, kind: edit.kind, cues: edit.cues || null, video_url: (edit.video_url || '').trim() || null, hidden: !!edit.hidden }
    if (!row.name) { toast('Ponle nombre', 'error'); return }
    if (row.video_url && !/^https?:\/\//.test(row.video_url)) { toast('El vídeo tiene que ser un enlace (https://...)', 'error'); return }
    const payload = edit.own || !edit.key ? row : { ...row, base_key: edit.key }
    const { error } = edit.customId
      ? await supabase.from('coach_exercises').update(payload).eq('id', edit.customId)
      : await supabase.from('coach_exercises').insert(payload)
    if (error) { toast('No se pudo guardar: ' + error.message, 'error'); return }
    toast('Guardado'); setEdit(null); reload()
  }
  const remove = async () => {
    if (!window.confirm(edit.own ? `¿Borrar «${edit.name}» de tu biblioteca?` : `¿Volver a la versión original de «${edit.name}»? Se quitan tu vídeo y tus indicaciones.`)) return
    await supabase.from('coach_exercises').delete().eq('id', edit.customId)
    setEdit(null); reload()
  }

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 'clamp(20px, 6.2vw, 32px)' }}>Biblioteca</h2>
        {editable && <button className="btn btn-primary btn-sm" onClick={() => setEdit({ name: '', cat: cat || 'Fuerza', kind: 'strength', cues: '', video_url: '', own: true })}>+ Ejercicio</button>}
      </div>
      <div className="page-content">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {library.filter(e => !e.hidden).length} ejercicios de Hyrox, carrera y fuerza. Toca uno para poner <strong>tu vídeo</strong> y tus indicaciones: tus deportistas los verán al tocar ⓘ en su sesión.
        </div>
        {!editable && <div style={{ fontSize: 12, color: 'var(--warning)' }}>Para personalizarla falta ejecutar el SQL de la biblioteca en Supabase.</div>}
        <input className="input" placeholder="🔍 Buscar ejercicio..." value={q} onChange={e => setQ(e.target.value)} />
        <CatChips cat={cat} setCat={setCat} />
        <div className="card" style={{ padding: '4px 14px' }}>
          {visible.map((e, i) => (
            <button key={e.key} type="button" onClick={() => editable && setEdit({ ...e })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', minHeight: 52, background: 'none', border: 'none', borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--border)', cursor: editable ? 'pointer' : 'default', textAlign: 'left', color: 'var(--text)', opacity: library.find(x => x.key === e.key)?.hidden ? 0.5 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.cat} · {KIND_LABEL[e.kind]}{e.own ? ' · tuyo' : ''}</div>
              </div>
              {e.video_url && <span title="Con tu vídeo" style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)' }}>🎬 Tu vídeo</span>}
              {e.customId && !e.own && !e.video_url && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>Editado</span>}
              <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>›</span>
            </button>
          ))}
          {visible.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>Nada coincide.</div>}
        </div>
        {library.some(e => e.hidden) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHidden(s => !s)}>{showHidden ? 'Ocultar los ocultos' : 'Ver también los ocultos'}</button>
        )}
      </div>

      {edit && (
        <Portal>
          <div className="overlay" onClick={() => setEdit(null)} style={{ zIndex: 2000 }} />
          <div className="sheet" style={{ zIndex: 2001 }}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>{edit.own && !edit.customId ? 'Nuevo ejercicio' : edit.name}</h3>
              <button className="btn-close" aria-label="Cerrar" onClick={() => setEdit(null)}>✕</button>
            </div>
            <div className="sheet-body">
              {edit.own && (
                <>
                  <div className="input-group">
                    <label className="input-label">Nombre</label>
                    <input className="input" value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} placeholder="p. ej. Sled push pesado" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Categoría</label>
                      <select className="input" value={edit.cat} onChange={e => setEdit(x => ({ ...x, cat: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Se apunta con</label>
                      <select className="input" value={edit.kind} onChange={e => setEdit(x => ({ ...x, kind: e.target.value }))}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    </div>
                  </div>
                </>
              )}
              <div className="input-group">
                <label className="input-label">Indicaciones de técnica</label>
                <textarea className="input" rows={4} value={edit.cues || ''} onChange={e => setEdit(x => ({ ...x, cues: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Tu vídeo (YouTube, Instagram, Drive...)</label>
                <input className="input" placeholder="https://..." value={edit.video_url || ''} onChange={e => setEdit(x => ({ ...x, video_url: e.target.value }))} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginBottom: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!edit.hidden} onChange={e => setEdit(x => ({ ...x, hidden: e.target.checked }))} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
                Ocultar de la biblioteca (no lo uso)
              </label>
              <button className="btn btn-primary btn-full" onClick={save}>Guardar</button>
              {edit.customId && <button className="btn btn-ghost btn-full" style={{ marginTop: 8, color: 'var(--error)' }} onClick={remove}>{edit.own ? 'Borrar ejercicio' : 'Volver a la versión original'}</button>}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
