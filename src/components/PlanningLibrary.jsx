import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
// Grupos de deportistas y bloques de entreno guardados (solo la entrenadora)
// Si las tablas aún no existen en Supabase, devuelven null y la app oculta estas opciones.
// ─────────────────────────────────────────────
export async function loadGroups() {
  const { data, error } = await supabase.from('athlete_groups').select('*').order('name')
  return error ? null : (data || [])
}
export async function loadBlocks() {
  const { data, error } = await supabase.from('coach_blocks').select('*').order('name')
  return error ? null : (data || [])
}
export async function saveBlock(ex) {
  const name = (ex.name || '').trim()
  if (!name) throw new Error('Ponle nombre al entrenamiento antes de guardarlo')
  const { data: existing } = await supabase.from('coach_blocks').select('id').ilike('name', name).limit(1)
  const row = { name, notes: ex.notes || '', videos: (ex.videos || []).filter(v => v.url).map(({ label, url }) => ({ label, url })) }
  if (existing?.length) {
    if (!window.confirm(`Ya tienes un bloque llamado «${name}». ¿Quieres sustituirlo por este?`)) return 'cancel'
    const { error } = await supabase.from('coach_blocks').update(row).eq('id', existing[0].id)
    if (error) throw error
    return 'updated'
  }
  const { error } = await supabase.from('coach_blocks').insert(row)
  if (error) throw error
  return 'created'
}

const Portal = ({ children }) => createPortal(children, document.body)

export function BlockPicker({ blocks, onPick, onClose, onDeleted }) {
  const [q, setQ] = useState('')
  const list = blocks.filter(b => !q.trim() || `${b.name} ${b.notes || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const del = async (b) => {
    if (!window.confirm(`¿Borrar el bloque «${b.name}»? Las sesiones que ya lo usan no cambian.`)) return
    await supabase.from('coach_blocks').delete().eq('id', b.id)
    onDeleted?.(b.id)
  }
  return (
    <Portal>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2000 }} />
      <div className="sheet" style={{ zIndex: 2001 }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>📦 Bloques guardados</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {blocks.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Aún no tienes bloques. En cualquier entrenamiento de una sesión toca <strong>💾</strong> para guardarlo (tu calentamiento, un finisher, la vuelta a la calma...) y aquí podrás añadirlo a cualquier sesión con un toque.
            </div>
          ) : (
            <>
              {blocks.length > 4 && <input className="input" placeholder="Buscar bloque..." value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 10 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {list.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <button onClick={() => onPick(b)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name}</div>
                      {b.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'pre-line', maxHeight: 54, overflow: 'hidden' }}>{b.notes}</div>}
                      {b.videos?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>🎬 {b.videos.length} vídeo{b.videos.length > 1 ? 's' : ''}</div>}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => onPick(b)}>+ Añadir</button>
                    <button onClick={() => del(b)} aria-label={`Borrar ${b.name}`} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15, padding: 4 }}>🗑</button>
                  </div>
                ))}
                {list.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ningún bloque coincide.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}

export function GroupsSheet({ athletes, groups, onClose, onChange, toast }) {
  const [editing, setEditing] = useState(null) // { id?, name, athlete_ids }
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!editing.name.trim()) { toast('Ponle nombre al grupo', 'error'); return }
    setSaving(true)
    const row = { name: editing.name.trim(), athlete_ids: editing.athlete_ids }
    const { error } = editing.id
      ? await supabase.from('athlete_groups').update(row).eq('id', editing.id)
      : await supabase.from('athlete_groups').insert(row)
    setSaving(false)
    if (error) { toast('No se pudo guardar: ' + error.message, 'error'); return }
    setEditing(null); onChange()
  }
  const del = async (g) => {
    if (!window.confirm(`¿Borrar el grupo «${g.name}»? Las deportistas no se borran.`)) return
    await supabase.from('athlete_groups').delete().eq('id', g.id); onChange()
  }
  const toggle = (id) => setEditing(e => ({ ...e, athlete_ids: e.athlete_ids.includes(id) ? e.athlete_ids.filter(x => x !== id) : [...e.athlete_ids, id] }))
  const name = (id) => athletes.find(a => a.id === id)?.name?.split(' ')[0]

  return (
    <Portal>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2000 }} />
      <div className="sheet" style={{ zIndex: 2001 }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>{editing ? (editing.id ? 'Editar grupo' : 'Nuevo grupo') : '👥 Grupos'}</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={editing ? () => setEditing(null) : onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {!editing ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>Crea grupos (p. ej. «Hyrox», «Fuerza», «Martes y jueves») para convocar a varias deportistas de un toque.</div>
              {groups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(g.athlete_ids || []).map(name).filter(Boolean).join(', ') || 'Sin deportistas'}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: g.id, name: g.name, athlete_ids: [...(g.athlete_ids || [])] })}>✏️</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => del(g)} aria-label={`Borrar ${g.name}`}>🗑</button>
                </div>
              ))}
              <button className="btn btn-primary btn-full" style={{ marginTop: 8 }} onClick={() => setEditing({ name: '', athlete_ids: [] })}>+ Nuevo grupo</button>
            </>
          ) : (
            <>
              <div className="input-group">
                <label className="input-label">Nombre</label>
                <input className="input" placeholder="p. ej. Grupo Hyrox" value={editing.name} onChange={e => setEditing(x => ({ ...x, name: e.target.value }))} />
              </div>
              <div className="input-label" style={{ marginBottom: 8 }}>Deportistas</div>
              {athletes.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--card)', borderRadius: 'var(--radius-sm)', border: editing.athlete_ids.includes(a.id) ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', marginBottom: 6 }}>
                  <input type="checkbox" checked={editing.athlete_ids.includes(a.id)} onChange={() => toggle(a.id)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                  <span style={{ fontSize: 14 }}>{a.name}</span>
                </label>
              ))}
              <button className="btn btn-primary btn-full" style={{ marginTop: 10 }} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar grupo'}</button>
            </>
          )}
        </div>
      </div>
    </Portal>
  )
}
