import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdapter, resolveModel, getMaxTokens } from '@/lib/ai/router'
import { buildSystemPrompt, buildContextBlock } from '@/lib/ai/config'
import { loadSystemPromptTemplate } from '@/lib/ai/prompt-loader'
import { parseAIResponse } from '@/lib/ai/response'
import { executeTool } from '@/lib/ai/execute'
import { ChatAPIRequest, ChatAPIResponse } from '@/types/ai'
import { getActionType } from '@/lib/credits/config'
import { deductCreditsForAction, refundCreditsForAction } from '@/lib/credits/deduct'
import { buildTemporalContext } from '@/lib/ai/temporal'
import { performResearch } from '@/lib/ai/perplexity'
import { planSessionFromAI } from '@/lib/ai/session-planner'

export async function POST(request: NextRequest) {
  try {
    const body: ChatAPIRequest = await request.json()
    const { messages, files, complexity = 'complex' } = body

    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'unauthorized',
          message: 'You must be logged in to use the AI assistant',
        },
      } as ChatAPIResponse, { status: 200 })
    }

    // 2. Fetch user AI settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'no_settings',
          message: 'Please configure your AI provider in Settings to use the assistant',
        },
      } as ChatAPIResponse, { status: 200 })
    }

    // 3. Fetch user's projects with task counts
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (projectsError) {
      throw projectsError
    }

    // Get task counts for each project
    const projectSummaries = await Promise.all(
      (projects || []).map(async (project) => {
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
        
        return {
          id: project.id,
          name: project.name,
          status: project.status,
          taskCount: count || 0,
        }
      })
    )

    // 4. Build temporal context and system prompt
    const firstName = (user as any).first_name || 'there'
    const today = new Date().toISOString().split('T')[0]
    const timezone = settings.timezone || 'UTC'
    const firstDayOfWeek = settings.first_day_of_week || 'Monday'
    
    const temporalContext = buildTemporalContext(timezone, firstDayOfWeek)
    const promptTemplate = loadSystemPromptTemplate()
    const systemPrompt = buildSystemPrompt(firstName, today, projectSummaries, promptTemplate, temporalContext)

    // 5. Run AI loop (max 4 iterations)
    const conversationHistory = [...messages]
    const contextLoaded: Array<{ projectId: string; projectName: string }> = []
    let iterations = 0
    const maxIterations = 4
    let creditsDeducted = 0
    let creditDeductionResult: any = null

    while (iterations < maxIterations) {
      iterations++

      // Deduct credits before AI call (only on first iteration)
      if (iterations === 1) {
        const serviceSupabase = createServiceClient()
        
        // Check if renewal is due
        const { data: userCredits } = await serviceSupabase
          .from('user_credits')
          .select('free_renewal_at')
          .eq('user_id', user.id)
          .single()

        if (userCredits) {
          const renewalDate = new Date(userCredits.free_renewal_at)
          const now = new Date()
          
          if (renewalDate <= now) {
            await serviceSupabase.rpc('add_credits', {
              p_user_id: user.id,
              p_amount: 300,
              p_action_type: 'renewal',
              p_is_free_renewal: true,
              p_stripe_session_id: null,
              p_description: 'Monthly free credit renewal',
            })
          }
        }

        // Determine action type and deduct credits
        const actionType = getActionType({
          hasFiles: files && files.length > 0,
          isThinking: settings.thinking_mode,
          modelTier: complexity === 'simple' ? 'cheap' : 'standard',
        })

        try {
          creditDeductionResult = await deductCreditsForAction({
            userId: user.id,
            actionType,
            description: 'AI chat message',
            supabase: serviceSupabase,
          })

          if (!creditDeductionResult.success) {
            return NextResponse.json({
              success: false,
              error: {
                code: 'insufficient_credits',
                message: 'Not enough credits to complete this request',
                balance: creditDeductionResult.balance,
                required: creditDeductionResult.deducted?.total || 0,
              },
            } as ChatAPIResponse, { status: 200 })
          }

          creditsDeducted = creditDeductionResult.deducted?.total || 0
        } catch (error) {
          console.error('Credit deduction error:', error)
          return NextResponse.json({
            success: false,
            error: {
              code: 'credit_error',
              message: 'Failed to process credits',
            },
          } as ChatAPIResponse, { status: 200 })
        }
      }

      // Resolve model and get adapter
      const model = resolveModel(settings, complexity)
      const adapter = getAdapter(settings.provider)
      const maxTokens = getMaxTokens(complexity)

      let rawResponse: string
      try {
        // Call AI
        rawResponse = await adapter.completeMessage(
          model,
          systemPrompt,
          conversationHistory,
          settings.thinking_mode,
          maxTokens
        )
        
        // Log raw response for debugging
        console.log('[Chat API] AI raw response length:', rawResponse.length)
        console.log('[Chat API] AI raw response preview:', rawResponse.substring(0, 300))
        
      } catch (aiError) {
        // Refund credits on AI failure
        if (iterations === 1 && creditsDeducted > 0) {
          const serviceSupabase = createServiceClient()
          const actionType = getActionType({
            hasFiles: files && files.length > 0,
            isThinking: settings.thinking_mode,
            modelTier: complexity === 'simple' ? 'cheap' : 'standard',
          })
          await refundCreditsForAction({
            userId: user.id,
            actionType,
            supabase: serviceSupabase,
          })
        }
        throw aiError
      }

      // Parse response
      const aiResponse = parseAIResponse(rawResponse)
      console.log('[Chat API] Parsed AI action:', aiResponse.action)
      
      // Detect if AI violated response format
      if (aiResponse.action === 'respond' && aiResponse.message) {
        const msgPreview = aiResponse.message.substring(0, 100)
        if (msgPreview.includes('"action"') && msgPreview.includes('"execute_tools"')) {
          console.error('[Chat API] ⚠️ AI VIOLATED FORMAT: Returned execute_tools wrapped in respond action')
          console.error('[Chat API] Message preview:', msgPreview)
        }
      }

      // Handle based on action type
      if (aiResponse.action === 'need_context') {
        // Load project context
        const serviceSupabase = createServiceClient()
        
        for (const projectId of aiResponse.projectIds || []) {
          // Fetch project with tasks and memories
          const { data: project } = await serviceSupabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single()

          if (!project) continue

          const { data: tasks } = await serviceSupabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('order', { ascending: true })

          const { data: memories } = await serviceSupabase
            .from('ai_memory')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

          // Fetch dependencies for these tasks
          const taskIds = tasks?.map(t => t.id) || []
          const { data: dependencies } = await serviceSupabase
            .from('task_dependencies')
            .select('task_id, depends_on_id')
            .in('task_id', taskIds)

          // Build a map of task_id -> array of depends_on_ids
          const depsMap = new Map<string, string[]>()
          for (const dep of dependencies || []) {
            if (!depsMap.has(dep.task_id)) {
              depsMap.set(dep.task_id, [])
            }
            depsMap.get(dep.task_id)!.push(dep.depends_on_id)
          }

          // Attach dependencies to each task
          const tasksWithDeps = tasks?.map(task => ({
            ...task,
            dependencies: depsMap.get(task.id) || []
          })) || []

          const contextBlock = buildContextBlock({
            ...project,
            tasks: tasksWithDeps,
            memories: memories || [],
          })

          // Inject context into conversation
          conversationHistory.push({
            role: 'user',
            content: contextBlock,
          })

          contextLoaded.push({
            projectId,
            projectName: project.name,
          })
        }

        // Continue loop to call AI again with context
        continue
      }

      if (aiResponse.action === 'execute_tools') {
        if (aiResponse.requiresConfirmation) {
          // Return to UI for confirmation
          return NextResponse.json({
            success: true,
            response: aiResponse,
            contextLoaded,
            credits: creditDeductionResult ? {
              deducted: creditsDeducted,
              free_remaining: creditDeductionResult.balance?.free_credits || 0,
              purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
            } : undefined,
          } as ChatAPIResponse, { status: 200 })
        }

        // Execute tools without confirmation
        const serviceSupabase = createServiceClient()
        const toolsExecuted: Array<{ tool: string; success: boolean; summary: string }> = []

        for (const tool of aiResponse.tools || []) {
          const result = await executeTool(
            tool.name,
            tool.input,
            serviceSupabase,
            user.id
          )
          toolsExecuted.push({
            tool: tool.name,
            success: result.success,
            summary: result.summary,
          })
        }

        // Check if any tools failed
        const failedTools = toolsExecuted.filter(t => !t.success)
        if (failedTools.length > 0) {
          // Return error response if any tool failed
          return NextResponse.json({
            success: true,
            response: {
              action: 'respond',
              message: `I encountered an error: ${failedTools[0].summary}`,
              suggestions: ['Try again', 'Rephrase your request'],
            },
            contextLoaded,
            toolsExecuted,
            credits: creditDeductionResult ? {
              deducted: creditsDeducted,
              free_remaining: creditDeductionResult.balance?.free_credits || 0,
              purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
            } : undefined,
          } as ChatAPIResponse, { status: 200 })
        }

        return NextResponse.json({
          success: true,
          response: aiResponse,
          contextLoaded,
          toolsExecuted,
          credits: creditDeductionResult ? {
            deducted: creditsDeducted,
            free_remaining: creditDeductionResult.balance?.free_credits || 0,
            purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
          } : undefined,
        } as ChatAPIResponse, { status: 200 })
      }

      if (aiResponse.action === 'research_required') {
        // Check if user allows research
        if (!settings.allow_research) {
          conversationHistory.push({
            role: 'user',
            content: 'Research is disabled in your settings. Please answer without web research.',
          })
          continue
        }

        // Perform Perplexity research
        const serviceSupabase = createServiceClient()
        const researchQuery = aiResponse.research_query || aiResponse.message || ''
        
        // Deduct research credits
        const researchCreditResult = await deductCreditsForAction({
          userId: user.id,
          actionType: 'perplexity_research',
          description: 'Web research via Perplexity',
          supabase: serviceSupabase,
        })

        if (!researchCreditResult.success) {
          conversationHistory.push({
            role: 'user',
            content: 'Insufficient credits for research (requires 100 credits). Please answer without research.',
          })
          continue
        }

        creditsDeducted += 100

        const researchResult = await performResearch(researchQuery, {
          userContext: `User: ${firstName}, Projects: ${projectSummaries.map(p => p.name).join(', ')}`,
        })

        if (researchResult.creditsUsed === 0) {
          // Research failed, refund credits
          await refundCreditsForAction({
            userId: user.id,
            actionType: 'perplexity_research',
            supabase: serviceSupabase,
          })
          creditsDeducted -= 100
        }

        // Inject research results into conversation
        const researchContext = `
RESEARCH RESULTS:
Query: ${researchQuery}
Summary: ${researchResult.summary}
Key Findings:
${researchResult.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
${researchResult.sources.length > 0 ? `\nSources: ${researchResult.sources.join(', ')}` : ''}

Please use this research to answer the user's question.
`
        conversationHistory.push({
          role: 'user',
          content: researchContext,
        })

        // Update metadata
        if (aiResponse.metadata) {
          aiResponse.metadata.researchPerformed = true
        }

        continue
      }

      if (aiResponse.action === 'plan_session') {
        // Extract budget from AI response or use default
        const budgetMinutes = settings.preferred_session_minutes || 60
        
        try {
          const sessionPlan = await planSessionFromAI(
            user.id,
            { budgetMinutes },
            supabase
          )

          // Attach session plan to response
          aiResponse.session_plan = sessionPlan
          
          if (aiResponse.metadata) {
            aiResponse.metadata.plannerExecuted = true
          }

          return NextResponse.json({
            success: true,
            response: aiResponse,
            contextLoaded,
            credits: creditDeductionResult ? {
              deducted: creditsDeducted + 5, // Include session planning cost
              free_remaining: creditDeductionResult.balance?.free_credits || 0,
              purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
            } : undefined,
          } as ChatAPIResponse, { status: 200 })
        } catch (error: any) {
          console.error('Session planning error:', error)
          // Fall through to respond action
          aiResponse.action = 'respond'
          aiResponse.message = 'I encountered an issue planning your session. Please try again or specify your time budget.'
        }
      }

      if (aiResponse.action === 'preview_creation' || aiResponse.action === 'respond') {
        // Log AI interaction
        const serviceSupabase = createServiceClient()
        await serviceSupabase.from('ai_interactions').insert({
          user_id: user.id,
          action_type: messages[messages.length - 1]?.content?.substring(0, 50) || 'chat',
          thinking_mode: settings.thinking_mode ? settings.model : null,
          research_performed: aiResponse.metadata?.researchPerformed || false,
          credits_used: creditsDeducted,
          response_action: aiResponse.action,
        })

        // Log task estimations if present
        if (aiResponse.tools) {
          for (const tool of aiResponse.tools) {
            if (tool.name === 'createTask' && tool.input.estimatedMinutes) {
              // Will be logged after tool execution in execute_tools handler
            }
          }
        }

        // Final response with credit info
        return NextResponse.json({
          success: true,
          response: aiResponse,
          contextLoaded,
          credits: creditDeductionResult ? {
            deducted: creditsDeducted,
            free_remaining: creditDeductionResult.balance?.free_credits || 0,
            purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
          } : undefined,
        } as ChatAPIResponse, { status: 200 })
      }

      // Unknown action, break loop
      break
    }

    // Max iterations reached
    return NextResponse.json({
      success: true,
      response: {
        action: 'respond',
        message: 'I encountered an issue processing that request. Please try rephrasing or breaking it into smaller steps.',
      },
      contextLoaded,
    } as ChatAPIResponse, { status: 200 })

  } catch (error: any) {
    console.error('Chat API error:', error)

    // Map provider-specific errors
    let errorCode = 'server_error'
    let errorMessage = 'An unexpected error occurred. Please try again.'

    if (error.status === 401 || error.message?.includes('API key')) {
      errorCode = 'api_error'
      errorMessage = 'AI provider authentication failed. Please contact support.'
    } else if (error.status === 429) {
      errorCode = 'rate_limit'
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'
    }

    return NextResponse.json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    } as ChatAPIResponse, { status: 200 })
  }
}
