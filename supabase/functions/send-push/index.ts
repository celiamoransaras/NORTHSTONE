import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const VAPID_PUBLIC_KEY  = 'BA4F49yj4b4N5TyfBRCL33bGzAZ-NFYlJ9S8mTNtGWSn_I5VIr9tBllOfuEdHVtBlXvLnwj1uDfBTzCGbRHqnik'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = 'mailto:celia.moransaras@gmail.com'

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { athleteIds, toCoach, notification } = await req.json()

    if (!notification) return new Response(JSON.stringify({ error: 'Missing notification' }), { status: 400 })

    // Obtener suscripciones según el destinatario
    let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth')

    if (toCoach) {
      // Suscripciones del coach: athlete_id es null
      query = query.is('athlete_id', null)
    } else if (athleteIds?.length) {
      query = query.in('athlete_id', athleteIds)
    } else {
      return new Response(JSON.stringify({ error: 'Missing athleteIds or toCoach' }), { status: 400 })
    }

    const { data: subs, error } = await query
    if (error) throw error
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 })

    const payload = JSON.stringify({
      title: notification.title || 'Northstone',
      body:  notification.body  || '',
      url:   notification.url   || '/',
      icon:  '/icon-192.png',
    })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    return new Response(
      JSON.stringify({ sent: results.filter(r => r.status === 'fulfilled').length }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
