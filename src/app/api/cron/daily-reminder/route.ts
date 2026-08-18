import { NextRequest, NextResponse } from 'next/server'
import webpush, { WebPushError } from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'
import { getLocalDateString } from '@/lib/dates'
import {
  buildDeadlineAlertPayload,
  buildInactivityPayload,
  buildMorningPayload,
  buildStreakPayload,
  buildUnfinishedSessionPayload,
  NotificationContext,
  ProducerResult,
} from '@/lib/notifications/producers'
import { DbProject, DbTask, DbUserAISettings } from '@/types/database'

// Wide enough to cover the streak walk-back (up to 120 days); reused for the "touched
// today" signal too, which only needs the last day or so.
const LOOKBACK_MS = 121 * 24 * 60 * 60 * 1000

const PRODUCERS = [
  buildMorningPayload,
  buildDeadlineAlertPayload,
  buildInactivityPayload,
  buildUnfinishedSessionPayload,
  buildStreakPayload,
]

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
  // Testing aid: lets an authenticated caller simulate a specific moment (a given hour,
  // day-of-week, etc.) instead of waiting for the real time to line up. Only honored
  // because we're already past the CRON_SECRET check above — the real scheduled pg_cron
  // calls never pass this, so production behavior is unaffected.
  const debugNowParam = request.nextUrl.searchParams.get('debugNow')
  const debugNow = debugNowParam ? new Date(debugNowParam) : null
  const now = debugNow && !Number.isNaN(debugNow.getTime()) ? debugNow : new Date()
  const lookbackSince = new Date(now.getTime() - LOOKBACK_MS).toISOString()
  // Also a testing aid, same gating as debugNow: computes and reports what would be
  // sent without actually calling webpush or persisting any dedupe state (marking a
  // session reminded / bumping a streak milestone), so a dry run can't suppress the
  // real notification later.
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'

  const { data: allSubs, error: subsError } = await supabase.from('push_subscriptions').select('*')
  if (subsError) {
    console.error('[cron/daily-reminder] Failed to load subscriptions:', subsError)
    return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 })
  }

  const subsByUser = new Map<string, NonNullable<typeof allSubs>>()
  for (const sub of allSubs ?? []) {
    if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, [])
    subsByUser.get(sub.user_id)!.push(sub)
  }
  const userIds = [...subsByUser.keys()]
  if (userIds.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0, skipped: 0 })
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('user_ai_settings')
    .select('*')
    .in('user_id', userIds)

  if (settingsError) {
    console.error('[cron/daily-reminder] Failed to load settings:', settingsError)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }

  let checked = 0
  let sent = 0
  let skipped = 0
  const dryRunPreview: Array<{ userId: string; payloads: unknown[] }> = []

  for (const settings of (settingsRows ?? []) as DbUserAISettings[]) {
    const subscriptions = subsByUser.get(settings.user_id) ?? []
    if (subscriptions.length === 0) continue
    checked++

    const timezone = settings.timezone || 'UTC'

    const [tasksResult, sessionsResult, projectsResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', settings.user_id),
      supabase
        .from('sessions')
        .select('id, start_time, end_time, unfinished_reminder_sent_at')
        .eq('user_id', settings.user_id),
      supabase.from('projects').select('*').eq('user_id', settings.user_id),
    ])

    const tasks = (tasksResult.data ?? []) as DbTask[]
    const projects = (projectsResult.data ?? []) as DbProject[]
    const sessions = sessionsResult.data ?? []

    const activityDates = new Set<string>()
    for (const t of tasks) {
      if (t.created_at && new Date(t.created_at).getTime() >= new Date(lookbackSince).getTime()) {
        activityDates.add(getLocalDateString(new Date(t.created_at), timezone))
      }
    }
    for (const s of sessions) {
      if (s.start_time && new Date(s.start_time).getTime() >= new Date(lookbackSince).getTime()) {
        activityDates.add(getLocalDateString(new Date(s.start_time), timezone))
      }
    }

    const ctx: NotificationContext = { tasks, projects, sessions, settings, now, timezone, activityDates }

    const results: ProducerResult[] = PRODUCERS.map((build) => build(ctx)).filter(
      (r): r is ProducerResult => r !== null
    )
    if (results.length === 0) {
      skipped++
      continue
    }

    if (dryRun) {
      dryRunPreview.push({
        userId: settings.user_id,
        payloads: results.map((r) => ({ payload: r.payload, markSessionId: r.markSessionId, newStreakMilestone: r.newStreakMilestone })),
      })
      if (results.some((r) => r.payload)) sent += results.filter((r) => r.payload).length * subscriptions.length
      else skipped++
      continue
    }

    let anySent = false
    for (const result of results) {
      if (result.payload) {
        const payload = JSON.stringify(result.payload)
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
            sent++
            anySent = true
          } catch (err) {
            if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            } else {
              console.error('[cron/daily-reminder] Push send failed:', err)
            }
          }
        }
      }

      if (result.markSessionId) {
        await supabase
          .from('sessions')
          .update({ unfinished_reminder_sent_at: now.toISOString() })
          .eq('id', result.markSessionId)
      }
      if (result.newStreakMilestone !== undefined) {
        await supabase
          .from('user_ai_settings')
          .update({ last_streak_milestone: result.newStreakMilestone })
          .eq('user_id', settings.user_id)
      }
    }

    if (!anySent) skipped++
  }

  return NextResponse.json({
    checked,
    sent,
    skipped,
    now: now.toISOString(),
    simulated: !!debugNow,
    dryRun,
    ...(dryRun ? { preview: dryRunPreview } : {}),
  })
}
