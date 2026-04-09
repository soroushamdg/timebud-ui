import { ResearchResult } from '@/types/ai'

export interface ResearchContext {
  projectId?: string
  userContext: string
  maxTokens?: number
}

export async function performResearch(
  query: string,
  context: ResearchContext
): Promise<ResearchResult> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY
    
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured')
    }

    const systemPrompt = `You are a research assistant helping with task and project planning. 
Provide concise, structured research findings that are immediately actionable.
Focus on: best practices, current trends, technical recommendations, and practical implementation steps.
User context: ${context.userContext}`

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: context.maxTokens || 1000,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Parse the response to extract structured information
    const lines = content.split('\n').filter((line: string) => line.trim())
    
    // Extract key findings (lines that start with bullets or numbers)
    const keyFindings = lines
      .filter((line: string) => /^[\d\-\*•]/.test(line.trim()))
      .map((line: string) => line.replace(/^[\d\-\*•]\s*/, '').trim())
      .slice(0, 5)

    // Extract sources if present (URLs in the content)
    const urlRegex = /https?:\/\/[^\s]+/g
    const sources = (content.match(urlRegex) || []).slice(0, 3)

    return {
      summary: content.substring(0, 500), // First 500 chars as summary
      keyFindings: keyFindings.length > 0 ? keyFindings : ['Research completed - see summary for details'],
      sources,
      creditsUsed: 100,
    }
  } catch (error: any) {
    console.error('Perplexity research error:', error)
    
    // Return error result without throwing
    return {
      summary: `Research failed: ${error.message}. Please try again or proceed without research.`,
      keyFindings: ['Research service temporarily unavailable'],
      sources: [],
      creditsUsed: 0, // Don't charge for failed requests
    }
  }
}
