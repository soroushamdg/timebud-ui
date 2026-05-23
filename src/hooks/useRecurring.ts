import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export const useOccurrenceManager = () => {
  const queryClient = useQueryClient()
  const hasRun = useRef(false)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const run = async () => {
      setIsRunning(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const today = new Date().toISOString().split('T')[0]

        // Fetch all templates for the user
        const { data: templates, error: tErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_recurring_template', true)

        if (tErr || !templates || templates.length === 0) return

        // Fetch all occurrences for the user
        const { data: occurrences, error: oErr } = await supabase
          .from('tasks')
          .select('id, recurrence_parent_id, recurrence_occurrence_date, status')
          .eq('user_id', user.id)
          .not('recurrence_parent_id', 'is', null)

        if (oErr) return

        const occurrencesByTemplate = new Map<string, typeof occurrences>()
        for (const occ of occurrences ?? []) {
          const pid = occ.recurrence_parent_id as string
          if (!occurrencesByTemplate.has(pid)) occurrencesByTemplate.set(pid, [])
          occurrencesByTemplate.get(pid)!.push(occ)
        }

        let didChange = false

        for (const template of templates) {
          // Skip templates that have ended
          if (template.recurrence_end_date && template.recurrence_end_date < today) continue

          const occs = occurrencesByTemplate.get(template.id) ?? []

          // Step A — handle missed occurrences
          const missed = occs.filter(
            o =>
              o.recurrence_occurrence_date != null &&
              o.recurrence_occurrence_date < today &&
              o.status === 'pending',
          )

          if (missed.length > 0 && template.recurrence_missed_behavior === 'skip') {
            const missedIds = missed.map(o => o.id)
            await supabase
              .from('tasks')
              .update({ status: 'skipped' })
              .in('id', missedIds)
            didChange = true
          }
          // 'overdue' behavior: leave as pending — they show as overdue naturally

          // Step B — ensure a future occurrence exists
          const hasFuture = occs.some(
            o =>
              o.recurrence_occurrence_date != null &&
              o.recurrence_occurrence_date >= today &&
              (o.status === 'pending' || o.status === 'in_progress'),
          )

          if (!hasFuture) {
            await supabase.rpc('generate_next_occurrence', { p_template_id: template.id })
            didChange = true
          }
        }

        if (didChange) {
          queryClient.invalidateQueries({ queryKey: ['tasks'] })
        }
      } catch (err) {
        console.error('[useOccurrenceManager] error:', err)
      } finally {
        setIsRunning(false)
      }
    }

    run()
  }, [queryClient])

  return { isRunning }
}
