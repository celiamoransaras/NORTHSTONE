// Instalación como app (PWA): detección de plataforma y del aviso de instalación de Android/Chrome
let deferredPrompt = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    listeners.forEach(fn => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    try { localStorage.setItem('ns_installed', '1') } catch { /* sin almacenamiento */ }
    listeners.forEach(fn => fn())
  })
}

export const onInstallChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const canPromptInstall = () => !!deferredPrompt
export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }))
  deferredPrompt = null
  listeners.forEach(fn => fn())
  return outcome === 'accepted'
}

export const isStandalone = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  } catch { return false }
}

export function getPlatform() {
  const ua = navigator.userAgent || ''
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/i.test(ua)
  // Navegadores dentro de otras apps (Instagram, WhatsApp, Facebook, Gmail...) no permiten instalar
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|GSA\/|Snapchat|TikTok|musical_ly/i.test(ua)
  const iosSafari = iOS && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) && !inApp
  return { iOS, android, inApp, iosSafari, mobile: iOS || android }
}

export const INSTALL_URL = 'https://northstone-nine.vercel.app/?instalar'
