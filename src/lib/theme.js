// Tema claro / oscuro / automático (según el móvil). Se guarda en este dispositivo.
const KEY = 'ns_theme'
const listeners = new Set()
let mq = null

export const getThemePref = () => { try { return localStorage.getItem(KEY) || 'light' } catch { return 'light' } }
const resolve = (pref) => pref === 'auto' ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref

export function applyTheme(pref = getThemePref()) {
  const t = resolve(pref)
  document.documentElement.setAttribute('data-theme', t)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0F1115' : '#0C4A6E')
  listeners.forEach(fn => fn(pref))
}
export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* sin almacenamiento */ }
  applyTheme(pref)
}
export const onThemeChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

export function initTheme() {
  applyTheme()
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', () => { if (getThemePref() === 'auto') applyTheme('auto') })
  } catch { /* navegador antiguo */ }
}
