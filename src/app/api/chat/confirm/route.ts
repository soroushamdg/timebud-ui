import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { executeTool } from '@/lib/ai/execute'
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

    for (const tool of tools) {
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
