import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = 'BA4F49yj4b4N5TyfBRCL33bGzAZ-NFYlJ9S8mTNtGWSn_I5VIr9tBllOfuEdHVtBlXvLnwj1uDfBTzCGbRHqnik'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

export async function subscribeToPush(athleteId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const reg = await navigator.serviceWorker.ready

  // Pedir permiso
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Crear suscripción
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  // Guardar en Supabase
  const subJson = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    athlete_id: athleteId,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth: subJson.keys.auth,
  }, { onConflict: 'athlete_id,endpoint' })

  return sub
}

export async function unsubscribeFromPush(athleteId) {
  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await sub.unsubscribe()
    await supabase.from('push_subscriptions')
      .delete()
      .eq('athlete_id', athleteId)
      .eq('endpoint', sub.endpoint)
  }
}

export async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

// Enviar notificación a uno o varios deportistas via Edge Function
export async function sendPushToAthletes(athleteIds, notification) {
  if (!athleteIds?.length) return
  try {
    await supabase.functions.invoke('send-push', {
      body: { athleteIds, notification },
    })
  } catch (err) {
    console.warn('Push send failed (non-critical):', err.message)
  }
}
