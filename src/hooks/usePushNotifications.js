import { useState, useEffect } from 'react'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '../lib/pushNotifications'

export function usePushNotifications(athleteId) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (ok && athleteId) {
      isPushSubscribed().then(setSubscribed)
    }
  }, [athleteId])

  const enable = async () => {
    if (!athleteId) return
    setLoading(true)
    const sub = await subscribeToPush(athleteId)
    setSubscribed(!!sub)
    setLoading(false)
  }

  const disable = async () => {
    if (!athleteId) return
    setLoading(true)
    await unsubscribeFromPush(athleteId)
    setSubscribed(false)
    setLoading(false)
  }

  return { subscribed, loading, supported, enable, disable }
}
