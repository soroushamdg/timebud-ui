import { NextRequest, NextResponse } from 'next/server'
import webpush, { WebPushError } from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'

const LOOKBACK_MS = 48 * 60 * 60 * 1000

function localDateString(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(date)
  }
}

function localHour(date: Date, timeZone: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit' }).format(date),
      10
    )
  } catch {
    return date.getUTCHours()
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const supabase = createServiceClient()
  const now = new Date()
  const lookbackSince = new Date(now.getTime() - LOOKBACK_MS).toISOString()

  const { data: settingsRows, error: settingsError } = await supabase
    .from('user_ai_settings')
    .select('user_id, timezone, reminder_time')
    .eq('reminder_enabled', true)
    .not('reminder_time', 'is', null)

  if (settingsError) {
    console.error('[cron/daily-reminder] Failed to load settings:', settingsError)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }

  const dueUsers = (settingsRows ?? []).filter((row) => {
    const tz = row.timezone || 'UTC'
    const reminderHour = parseInt((row.reminder_time ?? '').split(':')[0] ?? '', 10)
    return !Number.isNaN(reminderHour) && localHour(now, tz) === reminderHour
  })

  let sent = 0
  let skipped = 0

  for (const row of dueUsers) {
    const tz = row.timezone || 'UTC'
    const todayLocal = localDateString(now, tz)

    const [subsResult, tasksResult, sessionsResult] = await Promise.all([
      supabase.from('push_subscriptions').select('*').eq('user_id', row.user_id),
      supabase.from('tasks').select('created_at').eq('user_id', row.user_id).gte('created_at', lookbackSince),
      supabase.from('sessions').select('start_time').eq('user_id', row.user_id).gte('start_time', lookbackSince),
    ])

    const subscriptions = subsResult.data ?? []
    if (subscriptions.length === 0) continue

    const touchedToday =
      (tasksResult.data ?? []).some((t) => t.created_at && localDateString(new Date(t.created_at), tz) === todayLocal) ||
      (sessionsResult.data ?? []).some(
        (s) => s.start_time && localDateString(new Date(s.start_time), tz) === todayLocal
      )

    if (touchedToday) {
      skipped++
      continue
    }

    const payload = JSON.stringify({
      title: 'Got a minute for TimeBud?',
      body: "You haven't added anything today — jot down a task before you forget.",
      url: '/?capture=1',
    })

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[cron/daily-reminder] Push send failed:', err)
        }
      }
    }
  }

  return NextResponse.json({ checked: dueUsers.length, sent, skipped })
}
