import { useState, useEffect } from 'react'
import { Documents as DB, Storage } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Documents() {
  const { isCoach } = useAuth()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = async () => {
    setLoading(true)
    setDocs(await DB.getAll())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSelectedFile(file)
    if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }))
    setSheet('form')
  }

  const save = async () => {
    if (!selectedFile && !sheet?.file_url) return
    setUploading(true)
    try {
      let file_url = sheet?.file_url
      let file_name = sheet?.file_name
      let file_size = sheet?.file_size

      if (selectedFile) {
        const uploaded = await Storage.uploadDocument(selectedFile)
        file_url = uploaded.url
        file_name = uploaded.name
        file_size = uploaded.size
      }

      await DB.create({ title: form.title || file_name, description: form.description, file_url, file_name, file_size })
      await load()
      setSheet(null)
      setSelectedFile(null)
      setForm({ title: '', description: '' })
    } catch (e) {
      alert('Error al subir el archivo. Asegúrate de que el bucket "documents" existe en Supabase Storage.')
    }
    setUploading(false)
  }

  const remove = async (id) => {
    await DB.delete(id)
    await load()
    setConfirmDelete(null)
  }

  const getIcon = (name) => {
    if (!name) return '📄'
    const ext = name.split('.').pop().toLowerCase()
    if (['pdf'].includes(ext)) return '📕'
    if (['doc','docx'].includes(ext)) return '📘'
    if (['xls','xlsx','csv'].includes(ext)) return '📗'
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️'
    if (['mp4','mov','avi'].includes(ext)) return '🎬'
    return '📄'
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h2>Documentos</h2>
        {isCoach && (
          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
            + Subir
            <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
          </label>
        )}
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>Cargando...</div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📂</div>
            <h3>Sin documentos</h3>
            <p>{isCoach ? 'Sube el primer documento con el botón de arriba' : 'Tu entrenadora aún no ha subido documentos'}</p>
          </div>
        ) : (
          <div className="card">
            {docs.map((doc, i) => (
              <div key={doc.id} className="list-item" style={{ borderBottom: i < docs.length - 1 ? undefined : 'none' }}
                onClick={() => window.open(doc.file_url, '_blank')}>
                <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{getIcon(doc.file_name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {formatDate(doc.created_at)}{doc.file_size ? ` · ${formatSize(doc.file_size)}` : ''}
                  </div>
                  {doc.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{doc.description}</div>}
                </div>
                {isCoach && (
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--error)', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); setConfirmDelete(doc.id) }}>🗑</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload form sheet */}
      {sheet === 'form' && (
        <>
          <div className="overlay" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <h3>Subir documento</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSheet(null)}>✕</button>
            </div>
            <div className="sheet-body">
              {selectedFile && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 24 }}>{getIcon(selectedFile.name)}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedFile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatSize(selectedFile.size)}</div>
                  </div>
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Título</label>
                <input className="input" placeholder="Nombre del documento" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción (opcional)</label>
                <textarea className="input" placeholder="Breve descripción..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <button className="btn btn-primary btn-full" onClick={save} disabled={uploading} style={{ marginTop: 8 }}>
                {uploading ? 'Subiendo...' : 'Guardar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <>
          <div className="overlay" onClick={() => setConfirmDelete(null)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-body" style={{ textAlign: 'center', paddingTop: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗑</div>
              <h3 style={{ marginBottom: 8 }}>¿Eliminar documento?</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>Esta acción no se puede deshacer.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary btn-full" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn btn-danger btn-full" onClick={() => remove(confirmDelete)}>Eliminar</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
