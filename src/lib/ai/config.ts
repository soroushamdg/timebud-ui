import { ModelConfig } from '@/types/ai'
import { DbProject, DbTask, DbAIMemory } from '@/types/database'

export const SUPPORTED_MODELS: ModelConfig[] = [
  // Anthropic
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'anthropic',
    supportsThinking: true,
    acceptsFiles: true,
    isCheap: false,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    supportsThinking: false,
    acceptsFiles: true,
    isCheap: true,
  },
  // OpenAI
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    supportsThinking: false,
    acceptsFiles: true,
    isCheap: false,
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    supportsThinking: false,
    acceptsFiles: true,
    isCheap: true,
  },
  {
    id: 'o3-mini',
    displayName: 'o3 Mini (Reasoning)',
    provider: 'openai',
    supportsThinking: true,
    acceptsFiles: false,
    isCheap: false,
  },
  // Google
  {
    id: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    supportsThinking: false,
    acceptsFiles: true,
    isCheap: false,
  },
  {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'google',
    supportsThinking: false,
    acceptsFiles: true,
    isCheap: true,
  },
]

export interface ProjectSummary {
  id: string
  name: string
  status: string
  taskCount: number
}

export function buildSystemPrompt(
  firstName: string,
  date: string,
  projects: ProjectSummary[],
  template?: string,
  temporalContext?: {
    currentUtcTime?: string
    currentLocalTime?: string
    userTimezone?: string
    weekStart?: string
    weekEnd?: string
    endOfWeek?: string
    humanReadable?: string
  }
): string {
  const projectList = projects
    .map(p => `- ${p.name} (${p.status}, ${p.taskCount} jobs) [ID: ${p.id}]`)
    .join('\n')

  if (!template) {
    throw new Error('System prompt template must be provided from server context')
  }
  
  // Replace variables in template
  let result = template
  const variables: Record<string, string> = {
    firstName,
    date,
    projectList: projectList || '(No projects yet)',
    currentUtcTime: temporalContext?.currentUtcTime || new Date().toISOString(),
    currentLocalTime: temporalContext?.currentLocalTime || date,
    userTimezone: temporalContext?.userTimezone || 'UTC',
    weekStart: temporalContext?.weekStart || date,
    weekEnd: temporalContext?.weekEnd || date,
    endOfWeek: temporalContext?.endOfWeek || date,
    humanReadable: temporalContext?.humanReadable || `Today is ${date}`,
  }
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\$${key}`, 'g'), value)
  }
  
  return result
}

export function buildContextBlock(
  project: DbProject & { tasks?: DbTask[]; memories?: DbAIMemory[] }
): string {
  const tasks = project.tasks || []
  const memories = project.memories || []

  const taskList = tasks
    .map(t => {
      const parts = [
        `- [${t.status === 'completed' ? '✓' : ' '}] ${t.title}`,
        t.description ? `\n  Desc: ${t.description}` : '',
        t.estimated_minutes ? `\n  Est: ${t.estimated_minutes}min` : '',
        t.due_date ? `\n  Due: ${t.due_date}` : '',
        t.priority ? `\n  Priority: HIGH` : '',
        t.dependencies && t.dependencies.length > 0 ? `\n  Depends on: ${t.dependencies.join(', ')}` : '',
        `\n  ID: ${t.id}`,
      ]
      return parts.filter(Boolean).join('')
    })
    .join('\n')

  const memoryList = memories
    .map(m => `- ${m.content} (${new Date(m.created_at).toLocaleDateString()})`)
    .join('\n')

  return `[CONTEXT LOADED]

MISSION: ${project.name}
Status: ${project.status}
${project.description ? `Description: ${project.description}` : ''}
${project.deadline ? `Deadline: ${project.deadline}` : ''}
${project.priority ? 'Priority: HIGH' : ''}
Mission ID: ${project.id}

JOBS (${tasks.length}):
${taskList || '(No jobs)'}

MEMORIES (${memories.length}):
${memoryList || '(No memories saved)'}

---`
}

export const ROUTING_RULES = {
  simple: ['mark_task_complete', 'set_task_dependency', 'add_memory'],
  complex: ['create_project', 'bulk_create_tasks', 'edit_task', 'delete_task'],
  maxTokens: {
    simple: 1000,
    complex: 4000,
  },
}

export const TOOL_DESCRIPTIONS = {
  load_project_context: 'Load full job list and memories for a mission',
  create_task: 'Create a single job or objective',
  edit_task: 'Update any fields of an existing job',
  delete_task: 'Delete a job (requires confirmation)',
  bulk_create_tasks: 'Create multiple jobs at once',
  create_milestone: 'Create an objective',
  edit_milestone: 'Edit an objective',
  delete_milestone: 'Delete an objective (requires confirmation)',
  create_project: 'Create a new mission (requires confirmation)',
  add_memory: 'Save important context to mission memories',
  remove_memory: 'Delete a memory (requires confirmation)',
  mark_task_complete: 'Mark a job as completed',
  set_task_dependency: 'Set or clear job dependency',
}
