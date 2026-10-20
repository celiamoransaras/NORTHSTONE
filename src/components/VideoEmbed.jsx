import { useState } from 'react'

// Vídeos de YouTube dentro de la app (sin salir), con la versión sin cookies de YouTube.
// Se carga solo al tocar, para no gastar datos ni ralentizar la sesión.
export const youtubeId = (url = '') => url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/)?.[1] || null

export function YouTubeEmbed({ id, title = 'Vídeo', autoplay = true }) {
  const [playing, setPlaying] = useState(false)
  if (!id) return null
  return (
    <div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}`}
            title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Reproducir ${title}`}
            style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', cursor: 'pointer', background: `#000 url(https://img.youtube.com/vi/${id}/hqdefault.jpg) center / cover no-repeat` }}>
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: '20px solid #fff', marginLeft: 5 }} />
            </span>
          </button>
        )}
      </div>
      <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>¿No se reproduce? Ábrelo en YouTube ↗</a>
    </div>
  )
}

// Lista de vídeos de un bloque: cada uno se despliega dentro de la sesión
export function VideoList({ videos = [] }) {
  const [open, setOpen] = useState(null)
  const list = videos.filter(v => v?.url)
  if (!list.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      {list.map((v, i) => {
        const id = youtubeId(v.url)
        const isOpen = open === i
        if (!id) return (
          <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 12px', minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            ▶ {v.label || 'Ver vídeo'} ↗
          </a>
        )
        return (
          <div key={i}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: isOpen ? 'var(--card)' : '#E11D2A', border: isOpen ? '1px solid var(--border)' : 'none', color: isOpen ? 'var(--text)' : '#fff', padding: '10px 12px', minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
              <span>{isOpen ? '▾' : '▶'}</span><span style={{ flex: 1 }}>{v.label || 'Ver vídeo'}</span>{isOpen && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cerrar</span>}
            </button>
            {isOpen && <div style={{ marginTop: 8 }}><YouTubeEmbed id={id} title={v.label || 'Vídeo'} /></div>}
          </div>
        )
      })}
    </div>
  )
}
