import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateNextDueDate, getLocalDateString, parseDateLocal } from '@/lib/dates'
import { DbTask } from '@/types/database'

// Implements "skip missed days" (recurrence_missed_behavior = 'skip') for real: without
// this job, a skip-mode recurring task only ever advances when the user completes it —
// identical to "show as overdue" in practice. This walks every skip-mode recurring task
// that's fallen behind and silently fast-forwards it to the next occurrence on/after the
// owning user's local today, with no completion recorded (no XP, no occurrence-count bump).
// "overdue"-mode tasks are left untouched; they only advance when the user completes them.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Testing aid, same pattern as /api/cron/daily-reminder: lets an authenticated caller
  // simulate a specific moment instead of waiting for real time to line up.
  const debugNowParam = request.nextUrl.searchParams.get('debugNow')
  const debugNow = debugNowParam ? new Date(debugNowParam) : null
  const now = debugNow && !Number.isNaN(debugNow.getTime()) ? debugNow : new Date()

  const supabase = createServiceClient()

  const { data: candidates, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('item_type', 'task')
    .eq('status', 'pending')
    .eq('recurrence_missed_behavior', 'skip')
    .not('recurrence_type', 'is', null)
    .not('due_date', 'is', null)

  if (tasksError) {
    console.error('[cron/recurring-rollover] Failed to load candidate tasks:', tasksError)
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 })
  }

  const tasks = (candidates ?? []) as DbTask[]
  if (tasks.length === 0) {
    return NextResponse.json({ checked: 0, rolled: 0, ended: 0 })
  }

  const userIds = [...new Set(tasks.map((t) => t.user_id))]
  const { data: settingsRows, error: settingsError } = await supabase
    .from('user_ai_settings')
    .select('user_id, timezone')
    .in('user_id', userIds)

  if (settingsError) {
    console.error('[cron/recurring-rollover] Failed to load settings:', settingsError)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }

  const timezoneByUser = new Map<string, string>()
  for (const row of settingsRows ?? []) {
    timezoneByUser.set(row.user_id, row.timezone || 'UTC')
  }

  let checked = 0
  let rolled = 0
  let ended = 0

  for (const task of tasks) {
    checked++
    const timezone = timezoneByUser.get(task.user_id) || 'UTC'
    const localToday = getLocalDateString(now, timezone)
    if (!task.due_date || task.due_date >= localToday) continue

    const todayOverride = parseDateLocal(localToday)
    const nextDueDate = calculateNextDueDate(
      task.due_date,
      {
        recurrence_type: task.recurrence_type,
        recurrence_days: task.recurrence_days,
        recurrence_interval: task.recurrence_interval,
        recurrence_end_date: task.recurrence_end_date,
        recurrence_end_after: task.recurrence_end_after,
        recurrence_missed_behavior: task.recurrence_missed_behavior,
        recurrence_completed_count: task.recurrence_completed_count,
      },
      todayOverride
    )

    if (nextDueDate) {
      const { error } = await supabase.from('tasks').update({ due_date: nextDueDate }).eq('id', task.id)
      if (error) {
        console.error('[cron/recurring-rollover] Failed to roll task forward:', task.id, error)
        continue
      }
      rolled++
    } else {
      // Recurrence ended while rolling forward — stop recurring, but this wasn't a
      // completion, so leave status/due_date exactly as they were.
      const { error } = await supabase
        .from('tasks')
        .update({
          recurrence_type: null,
          recurrence_days: null,
          recurrence_interval: null,
          recurrence_end_date: null,
          recurrence_end_after: null,
          recurrence_missed_behavior: null,
        })
        .eq('id', task.id)
      if (error) {
        console.error('[cron/recurring-rollover] Failed to end recurrence:', task.id, error)
        continue
      }
      ended++
    }
  }

  return NextResponse.json({ checked, rolled, ended })
}
