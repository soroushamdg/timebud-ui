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
  template?: string
): string {
  const projectList = projects
    .map(p => `- ${p.name} (${p.status}, ${p.taskCount} tasks) [ID: ${p.id}]`)
    .join('\n')

  if (!template) {
    throw new Error('System prompt template must be provided from server context')
  }
  
  // Replace variables in template
  let result = template
  const variables = {
    firstName,
    date,
    projectList: projectList || '(No projects yet)'
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
        t.depends_on_task ? `\n  Depends on: ${t.depends_on_task}` : '',
        `\n  ID: ${t.id}`,
      ]
      return parts.filter(Boolean).join('')
    })
    .join('\n')

  const memoryList = memories
    .map(m => `- ${m.content} (${new Date(m.created_at).toLocaleDateString()})`)
    .join('\n')

  return `[CONTEXT LOADED]

PROJECT: ${project.name}
Status: ${project.status}
${project.description ? `Description: ${project.description}` : ''}
${project.deadline ? `Deadline: ${project.deadline}` : ''}
${project.priority ? 'Priority: HIGH' : ''}
Project ID: ${project.id}

TASKS (${tasks.length}):
${taskList || '(No tasks)'}

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
  load_project_context: 'Load full task list and memories for a project',
  create_task: 'Create a single task or milestone',
  edit_task: 'Update any fields of an existing task',
  delete_task: 'Delete a task (requires confirmation)',
  bulk_create_tasks: 'Create multiple tasks at once',
  create_milestone: 'Create a milestone',
  edit_milestone: 'Edit a milestone',
  delete_milestone: 'Delete a milestone (requires confirmation)',
  create_project: 'Create a new project (requires confirmation)',
  add_memory: 'Save important context to project memories',
  remove_memory: 'Delete a memory (requires confirmation)',
  mark_task_complete: 'Mark a task as completed',
  set_task_dependency: 'Set or clear task dependency',
}
