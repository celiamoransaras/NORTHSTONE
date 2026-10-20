import { useEffect, useState } from 'react'
import Icon from './Icon'
import { getThemePref, setThemePref, onThemeChange } from '../lib/theme'

const OPTS = [
  { id: 'light', label: 'Claro', icon: 'sun' },
  { id: 'dark', label: 'Oscuro', icon: 'moon' },
  { id: 'auto', label: 'Auto', icon: 'auto' },
]

export default function ThemeToggle() {
  const [pref, setPref] = useState(getThemePref())
  useEffect(() => onThemeChange(setPref), [])
  return (
    <div>
      <div className="input-label" style={{ marginBottom: 8 }}>Apariencia</div>
      <div role="radiogroup" aria-label="Apariencia" style={{ display: 'flex', background: 'var(--bg)', borderRadius: 12, padding: 4, gap: 4 }}>
        {OPTS.map(o => (
          <button key={o.id} type="button" role="radio" aria-checked={pref === o.id} onClick={() => setThemePref(o.id)}
            style={{ flex: 1, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: pref === o.id ? 'var(--accent)' : 'transparent', color: pref === o.id ? '#fff' : 'var(--text-muted)' }}>
            <Icon name={o.icon} size={16} /> {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
