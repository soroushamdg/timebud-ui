import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { executeTool } from '@/lib/ai/execute'
import { toUtcString } from '@/lib/dates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { buttonId, action, context } = body

    if (!action || !context) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'invalid_request',
          message: 'action and context are required',
        },
      }, { status: 400 })
    }

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in',
        },
      }, { status: 401 })
    }

    const serviceSupabase = createServiceClient()

    // Handle different action types
    switch (action) {
      case 'start_focus_session': {
        // Create a focus session from the session plan
        const { sessionPlan } = context
        if (!sessionPlan) {
          throw new Error('Session plan not provided')
        }

        const taskIds = sessionPlan.tasks.map((t: any) => t.taskId)
        
        const { data: session, error } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            budget_minutes: sessionPlan.budgetMinutes,
            tasks_list: taskIds,
            start_time: toUtcString(new Date()),
            end_time: null,
          })
          .select()
          .single()

        if (error) throw error

        return NextResponse.json({
          success: true,
          action: 'navigate',
          url: '/session/focus',
          message: 'Focus session started',
        })
      }

      case 'defer_task': {
        const { taskId, suggestedDate } = context
        if (!taskId || !suggestedDate) {
          throw new Error('taskId and suggestedDate required')
        }

        const { error } = await supabase
          .from('tasks')
          .update({ due_date: suggestedDate })
          .eq('id', taskId)
          .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: 'Task deferred',
        })
      }

      case 'mark_complete': {
        const { taskId } = context
        if (!taskId) {
          throw new Error('taskId required')
        }

        const { error } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', taskId)
          .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: 'Task marked complete',
        })
      }

      case 'delete_task': {
        const { taskId, confirmed } = context
        if (!taskId) {
          throw new Error('taskId required')
        }
        if (!confirmed) {
          throw new Error('Confirmation required for delete action')
        }

        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: 'Task deleted',
        })
      }

      case 'change_priority': {
        const { taskId, priority } = context
        if (!taskId) {
          throw new Error('taskId required')
        }

        // Toggle priority if not specified
        const { data: task } = await supabase
          .from('tasks')
          .select('priority')
          .eq('id', taskId)
          .eq('user_id', user.id)
          .single()

        const newPriority = priority !== undefined ? priority : !task?.priority

        const { error } = await supabase
          .from('tasks')
          .update({ priority: newPriority })
          .eq('id', taskId)
          .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: `Priority ${newPriority ? 'enabled' : 'disabled'}`,
        })
      }

      case 'reschedule_deadline': {
        const { taskId, newDate } = context
        if (!taskId || !newDate) {
          throw new Error('taskId and newDate required')
        }

        const { error } = await supabase
          .from('tasks')
          .update({ due_date: newDate })
          .eq('id', taskId)
          .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({
          success: true,
          message: 'Deadline updated',
        })
      }

      case 'adjust_session_time': {
        // This action doesn't execute anything, just returns a prompt
        const { newBudgetMinutes } = context
        return NextResponse.json({
          success: true,
          action: 'send_prompt',
          prompt: `Plan a session for ${newBudgetMinutes || 'different'} minutes`,
        })
      }

      case 'confirm_bulk_creation': {
        const { tools, confirmed } = context
        if (!tools || !Array.isArray(tools)) {
          throw new Error('tools array required')
        }
        if (!confirmed) {
          throw new Error('Confirmation required for bulk creation')
        }

        // Execute all tools
        const results = []
        for (const tool of tools) {
          const result = await executeTool(
            tool.name,
            tool.input,
            serviceSupabase,
            user.id
          )
          results.push(result)
        }

        const allSucceeded = results.every(r => r.success)

        return NextResponse.json({
          success: allSucceeded,
          message: allSucceeded 
            ? `Created ${results.length} items successfully`
            : 'Some items failed to create',
          results,
        })
      }

      case 'approve_research': {
        // This returns a prompt to trigger research
        const { query, projectId } = context
        return NextResponse.json({
          success: true,
          action: 'send_prompt',
          prompt: query || 'Research and help me with this project',
          metadata: { projectId },
        })
      }

      case 'generate_without_research': {
        const { projectId } = context
        return NextResponse.json({
          success: true,
          action: 'send_prompt',
          prompt: 'Generate tasks for this project without research',
          metadata: { projectId },
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'unknown_action',
            message: `Unknown action type: ${action}`,
          },
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Action button error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'server_error',
        message: error.message || 'Failed to execute action',
      },
    }, { status: 500 })
  }
}
