import 'server-only'
import fs from 'fs'
import path from 'path'

let cachedPromptTemplate: string | null = null

export function loadSystemPromptTemplate(): string {
  if (cachedPromptTemplate) {
    return cachedPromptTemplate
  }

  const promptPath = path.join(process.cwd(), 'prompts', 'system-prompt.md')
  cachedPromptTemplate = fs.readFileSync(promptPath, 'utf-8')
  return cachedPromptTemplate
}

export function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\$${key}`, 'g'), value)
  }
  return result
}
