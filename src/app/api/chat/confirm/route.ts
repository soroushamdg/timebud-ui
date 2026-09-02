import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { executeTool } from '@/lib/ai/execute'
import { getOrCreateConversation, appendTurn } from '@/lib/ai/chat-history'
import { ToolCall } from '@/types/ai'

interface ConfirmRequest {
  tools: ToolCall[]
  confirmed: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmRequest = await request.json()
    const { tools, confirmed } = body

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
      }, { status: 200 })
    }

    // If cancelled, return empty success
    if (!confirmed) {
      return NextResponse.json({
        success: true,
        toolsExecuted: [],
      }, { status: 200 })
    }

    // Execute tools
    const serviceSupabase = createServiceClient()
    const toolsExecuted: Array<{ tool: string; success: boolean; summary: string }> = []
    let createdProjectId: string | null = null

    for (const tool of tools) {
      // Replace {{PROJECT_ID}} placeholder if we've created a project
      let toolInput = tool.input
      if (createdProjectId && JSON.stringify(toolInput).includes('{{PROJECT_ID}}')) {
        const inputStr = JSON.stringify(toolInput)
        const replacedStr = inputStr.replace(/\{\{PROJECT_ID\}\}/g, createdProjectId)
        toolInput = JSON.parse(replacedStr)
      }

      const result = await executeTool(
        tool.name,
        toolInput,
        serviceSupabase,
        user.id
      )
      
      // Capture project ID if this was a create_project call
      if (tool.name === 'create_project' && result.success && result.data?.id) {
        createdProjectId = result.data.id
      }

      toolsExecuted.push({
        tool: tool.name,
        success: result.success,
        summary: result.summary,
      })
    }

    // Persisted history needs to know this happened too — otherwise a confirmed
    // action is just as invisible to future turns as the bug this rewrite fixes.
    try {
      const conversation = await getOrCreateConversation(serviceSupabase, user.id)
      const summary = toolsExecuted.map((t) => (t.success ? `✓ ${t.summary}` : `✗ ${t.summary}`)).join('\n')
      await appendTurn(serviceSupabase, conversation.id, {
        role: 'assistant',
        content: summary || 'Confirmed action cancelled.',
        toolCalls: toolsExecuted,
      })
    } catch (err) {
      console.error('Failed to persist confirmed action to chat history:', err)
    }

    return NextResponse.json({
      success: true,
      toolsExecuted,
    }, { status: 200 })

  } catch (error: any) {
    console.error('Confirm API error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'server_error',
        message: 'Failed to execute tools',
      },
    }, { status: 200 })
  }
}
