import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { deductCreditsForAction, refundCreditsForAction } from '@/lib/credits/deduct'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, error: { code: 'invalid_request', message: 'audio file is required' } }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: { code: 'unauthorized', message: 'You must be logged in' } }, { status: 200 })
    }

    const serviceSupabase = createServiceClient()
    const deductResult = await deductCreditsForAction({
      userId: user.id,
      actionType: 'voice_transcription',
      description: 'Quick capture: voice transcription',
      supabase: serviceSupabase,
    })

    if (!deductResult.success) {
      return NextResponse.json({
        success: false,
        error: { code: 'insufficient_credits', message: 'Not enough credits to transcribe audio', balance: deductResult.balance },
      }, { status: 200 })
    }

    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const transcription = await client.audio.transcriptions.create({
        file: audio,
        model: 'whisper-1',
      })

      return NextResponse.json({ success: true, text: transcription.text })
    } catch (error) {
      await refundCreditsForAction({ userId: user.id, actionType: 'voice_transcription', supabase: serviceSupabase })
      throw error
    }
  } catch (error) {
    console.error('Voice transcription error:', error)
    return NextResponse.json({
      success: false,
      error: { code: 'server_error', message: error instanceof Error ? error.message : 'Failed to transcribe audio' },
    }, { status: 200 })
  }
}
