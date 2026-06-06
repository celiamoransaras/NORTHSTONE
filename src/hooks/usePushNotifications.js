import { useState, useEffect } from 'react'
import { subscribeToPush, subscribeCoachToPush, unsubscribeFromPush, isPushSubscribed } from '../lib/pushNotifications'

export function usePushNotifications({ athleteId, userId, isCoach } = {}) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (ok) isPushSubscribed().then(setSubscribed)
  }, [athleteId, userId])

  const enable = async () => {
    setLoading(true)
    const sub = isCoach
      ? await subscribeCoachToPush(userId)
      : await subscribeToPush(athleteId)
    setSubscribed(!!sub)
    setLoading(false)
  }

  const disable = async () => {
    setLoading(true)
    await unsubscribeFromPush(athleteId)
    setSubscribed(false)
    setLoading(false)
  }

  return { subscribed, loading, supported, enable, disable }
}
