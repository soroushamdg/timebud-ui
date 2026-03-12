import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAdapter, resolveModel, getMaxTokens } from '@/lib/ai/router'
import { buildSystemPrompt, buildContextBlock } from '@/lib/ai/config'
import { parseAIResponse } from '@/lib/ai/response'
import { executeTool } from '@/lib/ai/execute'
import { ChatAPIRequest, ChatAPIResponse } from '@/types/ai'

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
          code: 'no_api_key',
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

    // 4. Build system prompt
    const firstName = (user as any).first_name || 'there'
    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = buildSystemPrompt(firstName, today, projectSummaries)

    // 5. Run AI loop (max 4 iterations)
    const conversationHistory = [...messages]
    const contextLoaded: Array<{ projectId: string; projectName: string }> = []
    let iterations = 0
    const maxIterations = 4

    while (iterations < maxIterations) {
      iterations++

      // Resolve model and get adapter
      const model = resolveModel(settings, complexity)
      const adapter = getAdapter(settings.provider)
      const maxTokens = getMaxTokens(complexity)

      // Call AI
      const rawResponse = await adapter.completeMessage(
        model,
        systemPrompt,
        conversationHistory,
        settings.thinking_mode,
        settings.api_key,
        maxTokens
      )

      // Parse response
      const aiResponse = parseAIResponse(rawResponse)

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

          const contextBlock = buildContextBlock({
            ...project,
            tasks: tasks || [],
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

        return NextResponse.json({
          success: true,
          response: aiResponse,
          contextLoaded,
          toolsExecuted,
        } as ChatAPIResponse, { status: 200 })
      }

      if (aiResponse.action === 'preview_creation' || aiResponse.action === 'respond') {
        // Final response
        return NextResponse.json({
          success: true,
          response: aiResponse,
          contextLoaded,
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
      errorCode = 'invalid_api_key'
      errorMessage = 'Your API key is invalid or expired. Please update it in Settings.'
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
