import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { deductCreditsForAction, refundCreditsForAction } from '@/lib/credits/deduct'
import { uploadAvatarToStorage } from '@/lib/avatars/storage'
import { LEGO_TRANSFORM_PROMPT } from '@/lib/avatars/config'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const projectId = formData.get('projectId') as string

    if (!imageFile || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload JPEG, PNG, or WebP' },
        { status: 400 }
      )
    }

    const maxSize = 2 * 1024 * 1024
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 2MB' },
        { status: 400 }
      )
    }

    const deductResult = await deductCreditsForAction({
      userId: user.id,
      actionType: 'avatar_generation',
      description: `LEGO avatar transformation for project ${projectId}`,
      supabase: serviceClient,
    })

    if (!deductResult.success) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: 'Not enough credits for avatar generation. 15 credits required.',
          balance: deductResult.balance,
        },
        { status: 200 }
      )
    }

    let transformedImageBuffer: Buffer
    try {
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
      const base64Image = imageBuffer.toString('base64')

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      let response
      try {
        response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `${LEGO_TRANSFORM_PROMPT}\n\nBase this LEGO scene on the following image concept.`,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'b64_json',
        })
      } catch (openaiError: any) {
        console.error('OpenAI API error (first attempt):', openaiError)
        
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `${LEGO_TRANSFORM_PROMPT}\n\nBase this LEGO scene on the following image concept.`,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'b64_json',
        })
      }

      if (!response.data || !response.data[0]?.b64_json) {
        throw new Error('No image data received from OpenAI')
      }

      transformedImageBuffer = Buffer.from(response.data[0].b64_json, 'base64')
    } catch (error: any) {
      console.error('Failed to transform image:', error)
      
      await refundCreditsForAction({
        userId: user.id,
        actionType: 'avatar_generation',
        supabase: serviceClient,
      })

      return NextResponse.json(
        {
          error: 'transformation_failed',
          message: 'Failed to transform image. Your credits have been refunded.',
        },
        { status: 200 }
      )
    }

    let publicUrl: string
    try {
      publicUrl = await uploadAvatarToStorage({
        file: transformedImageBuffer,
        mimeType: 'image/png',
        userId: user.id,
        bucket: 'project-avatars',
        entityId: projectId,
      })
    } catch (error: any) {
      console.error('Failed to upload transformed image:', error)
      
      await refundCreditsForAction({
        userId: user.id,
        actionType: 'avatar_generation',
        supabase: serviceClient,
      })

      return NextResponse.json(
        {
          error: 'upload_failed',
          message: 'Failed to upload transformed image. Your credits have been refunded.',
        },
        { status: 200 }
      )
    }

    const { error: updateError } = await serviceClient
      .from('projects')
      .update({ project_avatar_url: publicUrl })
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to update project avatar URL:', updateError)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
    })
  } catch (error: any) {
    console.error('Unexpected error in avatar transform:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
