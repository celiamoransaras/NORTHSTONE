import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = 'BA4F49yj4b4N5TyfBRCL33bGzAZ-NFYlJ9S8mTNtGWSn_I5VIr9tBllOfuEdHVtBlXvLnwj1uDfBTzCGbRHqnik'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

async function getOrCreateSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
}

export async function subscribeToPush(athleteId) {
  const sub = await getOrCreateSubscription()
  if (!sub) return null
  const subJson = sub.toJSON()
  await supabase.from('push_subscriptions').delete().eq('endpoint', subJson.endpoint)
  await supabase.from('push_subscriptions').insert({
    athlete_id: athleteId,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth: subJson.keys.auth,
  })
  return sub
}

export async function subscribeCoachToPush(userId) {
  const sub = await getOrCreateSubscription()
  if (!sub) return null
  const subJson = sub.toJSON()
  await supabase.from('push_subscriptions').delete().eq('endpoint', subJson.endpoint)
  await supabase.from('push_subscriptions').insert({
    user_id: userId,
    athlete_id: null,
    endpoint: subJson.endpoint,
    p256dh: subJson.keys.p256dh,
    auth: subJson.keys.auth,
  })
  return sub
}

export async function unsubscribeFromPush(athleteId) {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await sub.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  }
}

export async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

// Enviar notificación a deportistas
export async function sendPushToAthletes(athleteIds, notification) {
  if (!athleteIds?.length) return
  try {
    await supabase.functions.invoke('send-push', { body: { athleteIds, notification } })
  } catch (err) {
    console.warn('Push send failed:', err.message)
  }
}

// Enviar notificación al coach (suscripciones sin athlete_id)
export async function sendPushToCoach(notification) {
  try {
    await supabase.functions.invoke('send-push', { body: { toCoach: true, notification } })
  } catch (err) {
    console.warn('Push to coach failed:', err.message)
  }
}
