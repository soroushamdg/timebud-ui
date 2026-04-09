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
  actionButtons?: ActionButton[]
  suggestedNextActions?: SuggestedAction[]
  sessionPlan?: SessionPlan
  warnings?: Warning[]
  learningOpportunity?: LearningOpportunity
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
  creditsUsed?: number
  researchPerformed?: boolean
  plannerExecuted?: boolean
  tasksAffected?: number
}

export interface AIResponse {
  action: 'need_context' | 'respond' | 'execute_tools' | 'preview_creation' | 'plan_session' | 'research_required'
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
  action_buttons?: ActionButton[]
  suggested_next_actions?: SuggestedAction[]
  session_plan?: SessionPlan
  research_query?: string
  warnings?: Warning[]
  learning_opportunity?: LearningOpportunity
  memory?: string
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
  credits?: {
    deducted: number
    free_remaining: number
    purchased_remaining: number
  }
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

export type ActionButtonType =
  | 'start_focus_session'
  | 'adjust_session_time'
  | 'defer_task'
  | 'delete_task'
  | 'mark_complete'
  | 'pin_task'
  | 'unpin_task'
  | 'edit_task'
  | 'approve_research'
  | 'confirm_bulk_creation'
  | 'open_project'
  | 'add_dependency'
  | 'change_priority'
  | 'reschedule_deadline'
  | 'generate_without_research'
  | 'open_edit_mode'

export interface ActionButton {
  id: string
  label: string
  action: ActionButtonType
  context: Record<string, any>
  style: 'primary' | 'secondary' | 'danger' | 'success'
  requiresConfirmation?: boolean
  estimatedCredits?: number
}

export interface SuggestedAction {
  label: string
  prompt: string
  icon?: string
  category?: string
}

export interface SessionPlan {
  budgetMinutes: number
  totalUsedMinutes: number
  slackMinutes: number
  reasoning?: string
  tasks: SessionPlanTask[]
}

export interface SessionPlanTask {
  taskId: string
  title: string
  projectName?: string
  projectId?: string
  projectColor?: string
  projectAvatarUrl?: string
  scheduledMinutes: number
  partial?: boolean
  priority: boolean
  reasoning: string
  estimatedMinutes?: number
  deadline?: string
}

export interface Warning {
  type: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface LearningOpportunity {
  question: string
  context: string
  feedbackType: 'thumbs_up_down'
  taskId: string
}

export interface ResearchResult {
  summary: string
  keyFindings: string[]
  sources: string[]
  creditsUsed: number
}
