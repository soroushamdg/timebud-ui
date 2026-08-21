import { NextRequest, NextResponse } from 'next/server'
import webpush, { WebPushError } from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'
import { getValidAccessToken } from '@/lib/google-calendar/connection'
import { listEvents } from '@/lib/google-calendar/client'
import { buildTimeBlockStartingPayload, CalendarBlockContext, NotificationContext } from '@/lib/notifications/producers'
import { DbUserAISettings } from '@/types/database'

const SYNC_WINDOW_HOURS = 48

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  const pushConfigured = !!(vapidPublicKey && vapidPrivateKey && vapidSubject)
  if (pushConfigured) webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!)

  const supabase = createServiceClient()
  // Same testing aids as /api/cron/daily-reminder — only honored once past the
  // CRON_SECRET check, so the real pg_cron calls (which never send these) are unaffected.
  const debugNowParam = request.nextUrl.searchParams.get('debugNow')
  const debugNow = debugNowParam ? new Date(debugNowParam) : null
  const now = debugNow && !Number.isNaN(debugNow.getTime()) ? debugNow : new Date()
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'

  const { data: connections, error: connError } = await supabase
    .from('google_calendar_connections')
    .select('*')

  if (connError) {
    console.error('[cron/calendar-sync] Failed to load connections:', connError)
    return NextResponse.json({ error: 'Failed to load connections' }, { status: 500 })
  }
  if (!connections || connections.length === 0) {
    return NextResponse.json({ usersProcessed: 0, eventsSynced: 0, mappingsCreated: 0, notified: 0 })
  }

  let usersProcessed = 0
  let eventsSynced = 0
  let mappingsCreated = 0
  let notified = 0
  const dryRunPreview: Array<{ userId: string; payload: unknown }> = []

  for (const connection of connections) {
    usersProcessed++
    const userId = connection.user_id

    try {
      // Always pull fresh from Google — a single-calendar events.list call every 15
      // minutes is nowhere near any real quota concern, and a staleness gate here would
      // directly work against the point of the feature (a block the user just created
      // needs to be picked up on the very next tick, not up to N hours later).
      const tokenInfo = await getValidAccessToken(userId, supabase)
      if (tokenInfo) {
        const timeMin = now.toISOString()
        const timeMax = new Date(now.getTime() + SYNC_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
        const events = await listEvents(tokenInfo.accessToken, tokenInfo.calendarId, timeMin, timeMax)

        for (const event of events) {
          const startTime = event.start.dateTime || event.start.date
          const endTime = event.end.dateTime || event.end.date
          if (!startTime || !endTime || !event.summary) continue

          await supabase.from('google_calendar_events_cache').upsert(
            {
              user_id: userId,
              google_event_id: event.id,
              title: event.summary,
              start_time: new Date(startTime).toISOString(),
              end_time: new Date(endTime).toISOString(),
              synced_at: now.toISOString(),
            },
            { onConflict: 'user_id,google_event_id' }
          )
          eventsSynced++

          // First time this exact block title has been seen for this user — surface it
          // in Settings for a one-time "which mission(s)?" confirmation rather than
          // guessing silently.
          const { data: existingMapping } = await supabase
            .from('calendar_block_mappings')
            .select('id')
            .eq('user_id', userId)
            .eq('event_title', event.summary)
            .maybeSingle()

          if (!existingMapping) {
            await supabase
              .from('calendar_block_mappings')
              .insert({ user_id: userId, event_title: event.summary, confirmed: false })
            mappingsCreated++
          }
        }

        await supabase
          .from('google_calendar_connections')
          .update({ last_synced_at: now.toISOString() })
          .eq('user_id', userId)
      }

      const { data: activeEvents } = await supabase
        .from('google_calendar_events_cache')
        .select('*')
        .eq('user_id', userId)
        .is('notified_at', null)
        .lte('start_time', now.toISOString())
        .gte('end_time', now.toISOString())
        .order('start_time', { ascending: true })
        .limit(1)

      const activeEvent = activeEvents?.[0]
      if (!activeEvent) continue

      const { data: mapping } = await supabase
        .from('calendar_block_mappings')
        .select('id')
        .eq('user_id', userId)
        .eq('event_title', activeEvent.title)
        .eq('confirmed', true)
        .maybeSingle()
      if (!mapping) continue // block hasn't been mapped to a mission yet — no notification

      const { data: links } = await supabase
        .from('calendar_block_mission_links')
        .select('project_id')
        .eq('mapping_id', mapping.id)
      const projectIds = (links || []).map((l) => l.project_id)
      if (projectIds.length === 0) continue

      const { data: missionRows } = await supabase.from('projects').select('name').in('id', projectIds)
      const missionNames = (missionRows || []).map((p) => p.name as string)

      const { data: settingsRow } = await supabase
        .from('user_ai_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<DbUserAISettings>()
      if (!settingsRow) continue

      const calendarEvents: CalendarBlockContext[] = [
        { id: activeEvent.id, title: activeEvent.title, endTime: activeEvent.end_time, missionNames },
      ]

      const ctx: NotificationContext = {
        tasks: [],
        projects: [],
        sessions: [],
        settings: settingsRow,
        now,
        timezone: settingsRow.timezone || 'UTC',
        activityDates: new Set(),
        calendarEvents,
      }

      const result = buildTimeBlockStartingPayload(ctx)
      if (!result?.payload) continue

      if (dryRun) {
        dryRunPreview.push({ userId, payload: result.payload })
        notified++
        continue
      }

      if (pushConfigured) {
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userId)
        const payload = JSON.stringify(result.payload)
        for (const sub of subscriptions || []) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          } catch (err) {
            if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            } else {
              console.error('[cron/calendar-sync] Push send failed:', err)
            }
          }
        }
      }

      if (result.markEventId) {
        await supabase
          .from('google_calendar_events_cache')
          .update({ notified_at: now.toISOString() })
          .eq('id', result.markEventId)
      }
      notified++
    } catch (err) {
      console.error(`[cron/calendar-sync] Failed for user ${userId}:`, err)
    }
  }

  return NextResponse.json({
    usersProcessed,
    eventsSynced,
    mappingsCreated,
    notified,
    now: now.toISOString(),
    simulated: !!debugNow,
    dryRun,
    ...(dryRun ? { preview: dryRunPreview } : {}),
  })
}
