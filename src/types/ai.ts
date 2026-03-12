import { AIProvider } from './database'

export interface ModelConfig {
  id: string
  displayName: string
  provider: AIProvider
  supportsThinking: boolean
  acceptsFiles: boolean
  isCheap: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  suggestions?: string[]
  confirmationPayload?: ConfirmationPayload
  timestamp: number
  isOptimistic?: boolean
  isPinned?: boolean
  metadata?: ResponseMetadata
}

export interface ConfirmationPayload {
  type: 'delete' | 'project_preview' | 'generic'
  tools: ToolCall[]
  confirmationSummary: string
  preview?: ProjectPreview
}

export interface ProjectPreview {
  name: string
  description?: string
  deadline?: string
  color?: string
  tasks: Array<{
    title: string
    description?: string
    estimatedMinutes?: number
    dueDate?: string
    priority?: boolean
  }>
}

export interface ToolCall {
  name: string
  input: Record<string, any>
}

export interface ResponseMetadata {
  contextLoaded?: string[]
  tokenCount?: number
  modelUsed?: string
  confidence?: 'high' | 'medium' | 'low'
  thinkingUsed?: boolean
}

export interface AIResponse {
  action: 'need_context' | 'respond' | 'execute_tools' | 'preview_creation'
  message?: string
  suggestions?: string[]
  projectIds?: string[]
  reason?: string
  tools?: ToolCall[]
  requiresConfirmation?: boolean
  confirmationSummary?: string
  preview?: ProjectPreview
  confirmPrompt?: string
  metadata?: ResponseMetadata
}

export interface ChatAPIRequest {
  messages: Array<{ role: string; content: string }>
  files?: FileAttachment[]
  complexity?: 'simple' | 'complex'
}

export interface FileAttachment {
  mimeType: string
  base64: string
  filename: string
  url?: string
}

export interface ChatAPIResponse {
  success: boolean
  response?: AIResponse
  contextLoaded?: Array<{ projectId: string; projectName: string }>
  toolsExecuted?: Array<{ tool: string; success: boolean; summary: string }>
  error?: {
    code: string
    message: string
  }
}

export interface ToolExecutionResult {
  success: boolean
  summary: string
  data?: any
}
