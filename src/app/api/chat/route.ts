import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdapter, resolveModel, getMaxTokens } from '@/lib/ai/router'
import { buildSystemPrompt, buildContextBlock } from '@/lib/ai/config'
import { loadSystemPromptTemplate } from '@/lib/ai/prompt-loader'
import { executeTool } from '@/lib/ai/execute'
import { AIContentBlock, AIMessage, textOf, toolUsesOf } from '@/lib/ai/adapter'
import { TOOL_LIST, DATA_TOOL_NAMES } from '@/lib/ai/tools'
import { turnRequiresConfirmation, PendingToolCall } from '@/lib/ai/confirmation-policy'
import { getOrCreateConversation, loadHistory, toPromptMessages, appendTurn } from '@/lib/ai/chat-history'
import { AIResponse, ChatAPIRequest, ChatAPIResponse, ProjectPreview, ToolCall } from '@/types/ai'
import { getActionType } from '@/lib/credits/config'
import { deductCreditsForAction, refundCreditsForAction } from '@/lib/credits/deduct'
import { buildTemporalContext } from '@/lib/ai/temporal'
import { performResearch } from '@/lib/ai/perplexity'
import { planSessionFromAI } from '@/lib/ai/session-planner'

const MAX_ITERATIONS = 8

interface ProjectSummary {
  id: string
  name: string
  status: string
  taskCount: number
}

// Deterministic, code-authored check for the exact bug that motivated this rewrite:
// a request naming several missions (e.g. "set the deadline for A, B, C and D") where
// the model only generated tool calls for some of them. Matching is a plain substring
// check against the user's own (small, known, distinctive) mission names — not fuzzy
// NLP — so it stays precise and only fires when 2+ missions are plausibly named.
function findMentionedProjectIds(text: string, projects: ProjectSummary[]): string[] {
  const lower = text.toLowerCase()
  return projects.filter((p) => p.name.trim().length >= 3 && lower.includes(p.name.toLowerCase())).map((p) => p.id)
}

function describePendingTools(calls: PendingToolCall[], projects: ProjectSummary[]): string {
  if (calls.length === 1) {
    const c = calls[0]
    if (c.name === 'delete_task') return 'Delete this job?'
    if (c.name === 'delete_milestone') return 'Delete this objective?'
    if (c.name === 'remove_memory') return 'Delete this memory?'
    if (c.name === 'create_project') return `Create mission "${c.input?.name}"?`
    if (c.name === 'bulk_create_tasks') return `Create ${c.input?.tasks?.length ?? 0} jobs?`
  }

  const editProjectCalls = calls.filter((c) => c.name === 'edit_project')
  if (editProjectCalls.length === calls.length && editProjectCalls.length > 1) {
    // The exact shape of the reported bug: a single-line summary naming every mission,
    // so a partial/missed one is visible in the confirm card itself, not just implied.
    const names = editProjectCalls.map((c) => projects.find((p) => p.id === c.input?.projectId)?.name || 'a mission')
    const deadlines = editProjectCalls.map((c) => c.input?.updates?.deadline).filter(Boolean)
    if (deadlines.length === editProjectCalls.length) {
      return `Set the deadline for ${names.join(', ')}?`
    }
    return `Update ${names.join(', ')}?`
  }

  const editCalls = calls.filter((c) => c.name === 'edit_task' || c.name === 'edit_project' || c.name === 'edit_milestone')
  if (editCalls.length === calls.length && editCalls.length > 1) {
    return `Update ${editCalls.length} items?`
  }
  return `Confirm ${calls.length} ${calls.length === 1 ? 'action' : 'actions'}?`
}

// Providers that support native tool-calling require every tool_use in a turn to get
// a matching tool_result before the next request — otherwise the API call 400s. Our
// loop only actively handles ONE class of tool per iteration (context vs research vs
// plan vs reply), by design — but a model can still bundle e.g. reply_to_user alongside
// load_project_context in one response even though the prompt says not to. Whenever we
// continue the loop, this pads in a filler result for anything left uncovered so a
// single model slip can't break the whole request.
function padMissingToolResults(
  blocks: AIContentBlock[],
  allCalls: Array<{ id: string; name: string }>
): AIContentBlock[] {
  const covered = new Set(
    blocks
      .filter((b): b is Extract<AIContentBlock, { type: 'tool_result' }> => b.type === 'tool_result')
      .map((b) => b.toolUseId)
  )
  const missing = allCalls.filter((c) => !covered.has(c.id))
  if (missing.length === 0) return blocks
  return [
    ...blocks,
    ...missing.map(
      (c): AIContentBlock => ({
        type: 'tool_result',
        toolUseId: c.id,
        name: c.name,
        content: 'Not handled this turn — call it again next turn if still needed.',
      })
    ),
  ]
}

function buildProjectPreview(calls: PendingToolCall[]): ProjectPreview | undefined {
  const createCall = calls.find((c) => c.name === 'create_project')
  if (!createCall) return undefined
  const bulkCall = calls.find((c) => c.name === 'bulk_create_tasks')
  return {
    name: createCall.input?.name,
    description: createCall.input?.description,
    deadline: createCall.input?.deadline,
    color: createCall.input?.color,
    tasks: (bulkCall?.input?.tasks ?? []).map((t: any) => ({
      title: t.title,
      description: t.description,
      estimatedMinutes: t.estimatedMinutes,
      dueDate: t.dueDate,
      priority: t.priority,
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatAPIRequest = await request.json()
    const { messages, files, complexity = 'complex' } = body

    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'unauthorized', message: 'You must be logged in to use the AI assistant' },
        } as ChatAPIResponse,
        { status: 200 }
      )
    }

    // 2. Fetch user AI settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'no_settings', message: 'Please configure your AI provider in Settings to use the assistant' },
        } as ChatAPIResponse,
        { status: 200 }
      )
    }

    // 3. Fetch user's projects with task counts
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (projectsError) throw projectsError

    const projectSummaries: ProjectSummary[] = await Promise.all(
      (projects || []).map(async (project) => {
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)

        return { id: project.id, name: project.name, status: project.status, taskCount: count || 0 }
      })
    )

    // 4. Build temporal context and system prompt
    const firstName = (user as any).first_name || 'there'
    const timezone = settings.timezone || 'UTC'
    const firstDayOfWeek = settings.first_day_of_week || 'Monday'

    const temporalContext = buildTemporalContext(timezone, firstDayOfWeek)
    const promptTemplate = loadSystemPromptTemplate()
    const systemPrompt = buildSystemPrompt(firstName, temporalContext.todayDate, projectSummaries, promptTemplate, temporalContext)

    const userId = user.id
    const serviceSupabase = createServiceClient()
    const adapter = getAdapter(settings.provider)
    const model = resolveModel(settings, complexity)
    const maxTokens = getMaxTokens(complexity)

    // 5. Server-persisted history is now the source of truth for what the model sees —
    // only the LAST entry of the client-sent array (the new message) is authoritative;
    // everything before it is superseded by chat_messages + the rolling summary. This
    // is what actually fixes "forgets what I said a few messages ago": previously the
    // only memory was a client-side localStorage cap with no summarization.
    const newUserMessageText = messages[messages.length - 1]?.content ?? ''

    const conversation = await getOrCreateConversation(serviceSupabase, user.id)
    const history = await loadHistory(serviceSupabase, adapter, model, conversation)

    const workingMessages: AIMessage[] = [...toPromptMessages(history), { role: 'user', content: newUserMessageText }]

    await appendTurn(serviceSupabase, conversation.id, { role: 'user', content: newUserMessageText })

    // 6. Credits — deducted once per user message (research adds its own on top below)
    const { data: userCredits } = await serviceSupabase
      .from('user_credits')
      .select('free_renewal_at')
      .eq('user_id', user.id)
      .single()

    if (userCredits) {
      const renewalDate = new Date(userCredits.free_renewal_at)
      if (renewalDate <= new Date()) {
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

    const actionType = getActionType({
      hasFiles: !!files?.length,
      isThinking: settings.thinking_mode,
      modelTier: complexity === 'simple' ? 'cheap' : 'standard',
    })

    let creditDeductionResult: any
    try {
      creditDeductionResult = await deductCreditsForAction({
        userId: user.id,
        actionType,
        description: 'AI chat message',
        supabase: serviceSupabase,
      })

      if (!creditDeductionResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'insufficient_credits',
              message: 'Not enough credits to complete this request',
              balance: creditDeductionResult.balance,
              required: creditDeductionResult.deducted?.total || 0,
            },
          } as ChatAPIResponse,
          { status: 200 }
        )
      }
    } catch (error) {
      console.error('Credit deduction error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'credit_error', message: 'Failed to process credits' } } as ChatAPIResponse,
        { status: 200 }
      )
    }

    let creditsDeducted: number = creditDeductionResult.deducted?.total || 0
    let researchPerformed = false

    const creditsInfo = () =>
      creditDeductionResult
        ? {
            deducted: creditsDeducted,
            free_remaining: creditDeductionResult.balance?.free_credits || 0,
            purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
          }
        : undefined

    // 7. Agentic loop
    const contextLoaded: Array<{ projectId: string; projectName: string }> = []
    const toolsExecuted: Array<{ tool: string; success: boolean; summary: string }> = []
    const touchedProjectIds = new Set<string>()
    let batchIntegrityChecked = false

    async function runDataCalls(calls: PendingToolCall[]): Promise<{ blocks: AIContentBlock[]; failedSummary?: string }> {
      const blocks: AIContentBlock[] = []
      let failedSummary: string | undefined
      for (const call of calls) {
        const result = await executeTool(call.name, call.input, serviceSupabase, userId)
        toolsExecuted.push({ tool: call.name, success: result.success, summary: result.summary })
        if (call.input?.projectId) touchedProjectIds.add(call.input.projectId)
        if (!result.success && !failedSummary) failedSummary = result.summary
        blocks.push({
          type: 'tool_result',
          toolUseId: call.id,
          name: call.name,
          content: JSON.stringify({ success: result.success, summary: result.summary, data: result.data }),
          isError: !result.success,
        })
      }
      return { blocks, failedSummary }
    }

    async function persistAndReturn(payload: ChatAPIResponse): Promise<NextResponse> {
      await appendTurn(serviceSupabase, conversation.id, {
        role: 'assistant',
        content: payload.response?.message || '',
        toolCalls: toolsExecuted.length > 0 ? toolsExecuted : null,
      })
      await serviceSupabase.from('ai_interactions').insert({
        user_id: userId,
        action_type: newUserMessageText.substring(0, 50) || 'chat',
        thinking_mode: settings.thinking_mode ? settings.model : null,
        research_performed: researchPerformed,
        credits_used: creditsDeducted,
        response_action: payload.response?.action || 'respond',
      })
      return NextResponse.json(payload, { status: 200 })
    }

    let iterations = 0
    while (iterations < MAX_ITERATIONS) {
      iterations++

      let completion
      try {
        completion = await adapter.completeMessage(model, systemPrompt, workingMessages, TOOL_LIST, settings.thinking_mode, maxTokens)
      } catch (aiError) {
        if (creditsDeducted > 0) {
          await refundCreditsForAction({ userId: user.id, actionType, supabase: serviceSupabase })
        }
        throw aiError
      }

      const toolUses = toolUsesOf(completion)
      workingMessages.push({ role: 'assistant', content: completion.content })

      const contextCalls = toolUses.filter((t) => t.name === 'load_project_context')
      const dataCalls: PendingToolCall[] = toolUses
        .filter((t) => DATA_TOOL_NAMES.has(t.name))
        .map((t) => ({ id: t.id, name: t.name, input: t.input }))
      const researchCall = toolUses.find((t) => t.name === 'request_research')
      const planCall = toolUses.find((t) => t.name === 'plan_focus_session')
      const replyCall = toolUses.find((t) => t.name === 'reply_to_user')

      // Confirmation is checked FIRST, before executing anything else this round —
      // never trust the model's own judgment on this, and never let a load_project_context
      // call in the same response sneak a confirmation-tier mutation through.
      if (dataCalls.length > 0 && turnRequiresConfirmation(dataCalls)) {
        const pendingTools: ToolCall[] = dataCalls.map((c) => ({ name: c.name, input: c.input }))
        const isProjectCreation = dataCalls.some((c) => c.name === 'create_project')
        // For a multi-mission edit batch specifically, always use the deterministic
        // summary (never the model's own phrasing) — this is the exact confirmation
        // card meant to make a partial/missed mission visible before anything runs,
        // so it can't be undermined by the model choosing vaguer wording like "these
        // missions" instead of naming all of them.
        const editProjectCalls = dataCalls.filter((c) => c.name === 'edit_project')
        const isMultiProjectEdit = editProjectCalls.length === dataCalls.length && editProjectCalls.length > 1
        const confirmationSummary = isMultiProjectEdit
          ? describePendingTools(dataCalls, projectSummaries)
          : (replyCall?.input?.message as string | undefined) || describePendingTools(dataCalls, projectSummaries)

        const response: AIResponse = isProjectCreation
          ? {
              action: 'preview_creation',
              message: confirmationSummary,
              tools: pendingTools,
              requiresConfirmation: true,
              confirmationSummary,
              preview: buildProjectPreview(dataCalls),
            }
          : {
              action: 'execute_tools',
              message: confirmationSummary,
              tools: pendingTools,
              requiresConfirmation: true,
              confirmationSummary,
            }

        return persistAndReturn({ success: true, response, contextLoaded, credits: creditsInfo() })
      }

      // load_project_context always wins over everything else this round: fetch it,
      // feed it back, and go again — never finish a turn on stale/missing context.
      if (contextCalls.length > 0) {
        const blocks: AIContentBlock[] = []

        for (const call of contextCalls) {
          const { data: project } = await serviceSupabase
            .from('projects')
            .select('*')
            .eq('id', call.input.projectId)
            .eq('user_id', user.id)
            .single()

          if (!project) {
            blocks.push({ type: 'tool_result', toolUseId: call.id, name: call.name, content: 'Mission not found.', isError: true })
            continue
          }

          const { data: tasks } = await serviceSupabase
            .from('tasks')
            .select('*')
            .eq('project_id', call.input.projectId)
            .order('order', { ascending: true })

          const { data: memories } = await serviceSupabase
            .from('ai_memory')
            .select('*')
            .eq('project_id', call.input.projectId)
            .order('created_at', { ascending: false })

          const taskIds = (tasks || []).map((t) => t.id)
          const { data: dependencies } = await serviceSupabase
            .from('task_dependencies')
            .select('task_id, depends_on_id')
            .in('task_id', taskIds)

          const depsMap = new Map<string, string[]>()
          for (const dep of dependencies || []) {
            if (!depsMap.has(dep.task_id)) depsMap.set(dep.task_id, [])
            depsMap.get(dep.task_id)!.push(dep.depends_on_id)
          }
          const tasksWithDeps = (tasks || []).map((task) => ({ ...task, dependencies: depsMap.get(task.id) || [] }))

          const contextBlock = buildContextBlock({ ...project, tasks: tasksWithDeps, memories: memories || [] })
          contextLoaded.push({ projectId: call.input.projectId, projectName: project.name })
          blocks.push({ type: 'tool_result', toolUseId: call.id, name: call.name, content: contextBlock })
        }

        if (dataCalls.length > 0) {
          const { blocks: dataBlocks, failedSummary } = await runDataCalls(dataCalls)
          blocks.push(...dataBlocks)
          if (failedSummary) {
            return persistAndReturn({
              success: true,
              response: { action: 'respond', message: `I encountered an error: ${failedSummary}`, suggestions: ['Try again', 'Rephrase your request'] },
              contextLoaded,
              toolsExecuted,
              credits: creditsInfo(),
            })
          }
        }

        workingMessages.push({ role: 'user', content: padMissingToolResults(blocks, toolUses) })
        continue
      }

      // Execute this turn's auto-tier data tool calls (confirmation already ruled out above).
      let dataResultBlocks: AIContentBlock[] = []
      if (dataCalls.length > 0) {
        const { blocks, failedSummary } = await runDataCalls(dataCalls)
        dataResultBlocks = blocks
        if (failedSummary) {
          return persistAndReturn({
            success: true,
            response: { action: 'respond', message: `I encountered an error: ${failedSummary}`, suggestions: ['Try again', 'Rephrase your request'] },
            contextLoaded,
            toolsExecuted,
            credits: creditsInfo(),
          })
        }
      }

      if (researchCall) {
        const query = researchCall.input?.query || researchCall.input?.message || ''

        if (!settings.allow_research) {
          workingMessages.push({
            role: 'user',
            content: padMissingToolResults(
              [
                ...dataResultBlocks,
                {
                  type: 'tool_result',
                  toolUseId: researchCall.id,
                  name: researchCall.name,
                  content: "Research is disabled in this user's settings. Answer without web research.",
                },
              ],
              toolUses
            ),
          })
          continue
        }

        const researchCreditResult = await deductCreditsForAction({
          userId: user.id,
          actionType: 'perplexity_research',
          description: 'Web research via Perplexity',
          supabase: serviceSupabase,
        })

        let researchResultBlock: AIContentBlock
        if (!researchCreditResult.success) {
          researchResultBlock = {
            type: 'tool_result',
            toolUseId: researchCall.id,
            name: researchCall.name,
            content: 'Insufficient credits for research (requires 100 credits). Answer without research.',
            isError: true,
          }
        } else {
          const researchResult = await performResearch(query, {
            userContext: `User: ${firstName}, Projects: ${projectSummaries.map((p) => p.name).join(', ')}`,
          })

          if (researchResult.creditsUsed === 0) {
            await refundCreditsForAction({ userId: user.id, actionType: 'perplexity_research', supabase: serviceSupabase })
          } else {
            creditsDeducted += 100
            researchPerformed = true
          }

          const researchContext = `RESEARCH RESULTS:\nQuery: ${query}\nSummary: ${researchResult.summary}\nKey Findings:\n${researchResult.keyFindings
            .map((f, i) => `${i + 1}. ${f}`)
            .join('\n')}${researchResult.sources.length > 0 ? `\nSources: ${researchResult.sources.join(', ')}` : ''}`

          researchResultBlock = { type: 'tool_result', toolUseId: researchCall.id, name: researchCall.name, content: researchContext }
        }

        workingMessages.push({
          role: 'user',
          content: padMissingToolResults([...dataResultBlocks, researchResultBlock], toolUses),
        })
        continue
      }

      if (planCall) {
        try {
          const budgetMinutes = planCall.input?.budgetMinutes || settings.preferred_session_minutes || 60
          const sessionPlan = await planSessionFromAI(user.id, { budgetMinutes }, supabase)

          const response: AIResponse = {
            action: 'plan_session',
            message: replyCall?.input?.message || "Here's your planned run.",
            session_plan: sessionPlan,
            metadata: { plannerExecuted: true },
          }

          return persistAndReturn({
            success: true,
            response,
            contextLoaded,
            toolsExecuted,
            credits: creditDeductionResult
              ? {
                  deducted: creditsDeducted + 5, // planSessionFromAI deducts its own 5 credits internally
                  free_remaining: creditDeductionResult.balance?.free_credits || 0,
                  purchased_remaining: creditDeductionResult.balance?.purchased_credits || 0,
                }
              : undefined,
          })
        } catch (error: any) {
          console.error('Session planning error:', error)
          workingMessages.push({
            role: 'user',
            content: padMissingToolResults(
              [
                ...dataResultBlocks,
                {
                  type: 'tool_result',
                  toolUseId: planCall.id,
                  name: planCall.name,
                  content: 'Session planning failed. Apologize and ask the user to try again or specify a time budget.',
                  isError: true,
                },
              ],
              toolUses
            ),
          })
          continue
        }
      }

      if (replyCall) {
        // Batch-integrity check: did this request name multiple missions but only
        // touch some of them? Give the model one chance to self-correct before we
        // let it finish — this is what directly targets the "3 of 4 missions
        // updated, no warning" bug.
        if (!batchIntegrityChecked) {
          batchIntegrityChecked = true
          const mentionedIds = findMentionedProjectIds(newUserMessageText, projectSummaries)
          const missed = mentionedIds.length > 1 ? mentionedIds.filter((id) => !touchedProjectIds.has(id)) : []

          if (missed.length > 0) {
            const missedNames = missed.map((id) => projectSummaries.find((p) => p.id === id)?.name).filter(Boolean)
            const correctiveText = `Before you finish: this request named ${mentionedIds.length} missions, but no tool call touched: ${missedNames.join(
              ', '
            )}. If your request applies to those too, call the right tool(s) for them now. If not, call reply_to_user again and briefly explain why not.`

            workingMessages.push({
              role: 'user',
              content: padMissingToolResults(
                [...dataResultBlocks, { type: 'tool_result', toolUseId: replyCall.id, name: replyCall.name, content: correctiveText }],
                toolUses
              ),
            })
            continue
          }
        }

        const input = replyCall.input || {}
        const response: AIResponse = {
          action: toolsExecuted.length > 0 ? 'execute_tools' : 'respond',
          message: input.message || '',
          suggestions: input.suggestions,
          suggested_next_actions: input.suggested_next_actions,
          action_buttons: input.action_buttons,
          warnings: input.warnings,
          learning_opportunity: input.learning_opportunity,
          ...(toolsExecuted.length > 0 ? { requiresConfirmation: false } : {}),
          metadata: contextLoaded.length > 0 ? { contextLoaded: contextLoaded.map((c) => c.projectName) } : undefined,
        }

        return persistAndReturn({ success: true, response, contextLoaded, toolsExecuted, credits: creditsInfo() })
      }

      // No terminal meta-tool this round — if data tools ran, keep going so the model
      // can react to their results (chain set_task_dependency, then reply, etc).
      if (dataCalls.length > 0) {
        workingMessages.push({ role: 'user', content: padMissingToolResults(dataResultBlocks, toolUses) })
        continue
      }

      // Model ignored tool-calling entirely and just returned text — accept it as a
      // fallback rather than erroring, but this should be rare.
      const fallbackText = textOf(completion)
      if (fallbackText) {
        return persistAndReturn({
          success: true,
          response: { action: 'respond', message: fallbackText },
          contextLoaded,
          toolsExecuted,
          credits: creditsInfo(),
        })
      }

      break
    }

    // Max iterations exhausted
    return persistAndReturn({
      success: true,
      response: {
        action: 'respond',
        message: 'I encountered an issue processing that request. Please try rephrasing or breaking it into smaller steps.',
      },
      contextLoaded,
      toolsExecuted,
    })
  } catch (error: any) {
    console.error('Chat API error:', error)

    let errorCode = 'server_error'
    let errorMessage = 'An unexpected error occurred. Please try again.'

    if (error.status === 401 || error.message?.includes('API key')) {
      errorCode = 'api_error'
      errorMessage = 'AI provider authentication failed. Please contact support.'
    } else if (error.status === 429) {
      errorCode = 'rate_limit'
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'
    }

    return NextResponse.json(
      { success: false, error: { code: errorCode, message: errorMessage } } as ChatAPIResponse,
      { status: 200 }
    )
  }
}
