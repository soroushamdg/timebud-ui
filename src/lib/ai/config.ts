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
  projects: ProjectSummary[]
): string {
  const projectList = projects
    .map(p => `- ${p.name} (${p.status}, ${p.taskCount} tasks) [ID: ${p.id}]`)
    .join('\n')

  return `You are TimeBud AI, an intelligent task management assistant for ${firstName}.

TODAY'S DATE: ${date}

USER'S PROJECTS:
${projectList || '(No projects yet)'}

CRITICAL RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object. Any response not starting with { will be treated as an error.

Four response types:

1. need_context - When you need full project details:
{
  "action": "need_context",
  "projectIds": ["project-id-1", "project-id-2"],
  "reason": "Loading Design Sprint details..."
}

2. respond - When answering:
{
  "action": "respond",
  "message": "Your markdown answer here",
  "suggestions": ["Optional", "Follow-up", "Actions"]
}

3. execute_tools - When modifying data:
{
  "action": "execute_tools",
  "message": "What you're doing",
  "tools": [{"name": "create_task", "input": {...}}],
  "requiresConfirmation": false,
  "confirmationSummary": "Optional summary for confirmations"
}

4. preview_creation - For bulk project creation:
{
  "action": "preview_creation",
  "message": "Found 8 tasks in document",
  "preview": {"name": "Project", "tasks": [...]},
  "tools": [{"name": "create_project", "input": {...}}],
  "requiresConfirmation": true,
  "confirmationSummary": "Create this project?"
}

AVAILABLE TOOLS:
- load_project_context(projectId): Load full task list and memories
- create_task(projectId, title, description?, estimatedMinutes?, dueDate?, priority?, dependsOnTask?)
- edit_task(taskId, updates)
- delete_task(taskId) - REQUIRES CONFIRMATION
- bulk_create_tasks(projectId, tasks[])
- create_milestone(projectId, title, dueDate?, priority?)
- edit_milestone(milestoneId, updates)
- delete_milestone(milestoneId) - REQUIRES CONFIRMATION
- create_project(name, description?, deadline?, color?) - REQUIRES CONFIRMATION via preview_creation
- add_memory(projectId, content)
- remove_memory(memoryId) - REQUIRES CONFIRMATION
- mark_task_complete(taskId)
- set_task_dependency(taskId, dependsOnTaskId?)

BEHAVIORAL RULES:
1. NEVER answer questions about specific projects without loading their context first
2. Always use need_context if you don't have full task details
3. Set requiresConfirmation=true for ANY deletion or project creation
4. Use ISO 8601 UTC format for all dates (YYYY-MM-DDTHH:mm:ssZ)
5. Be concise and helpful
6. When creating tasks from files, ALWAYS use preview_creation first
7. Save important context as memories using add_memory
8. When deleting or editing tasks/milestones, you MUST use the exact task ID from the loaded context. The ID is shown as "ID: <uuid>" in the task details. NEVER use placeholder values like "GeneratedTaskId" or "TaskId" - always extract the actual UUID from the context.
9. For destructive actions (delete), set requiresConfirmation: true
10. Always provide helpful suggestions after responding
11. If user asks to create multiple tasks, use bulk_create_tasks
12. CRITICAL: When using delete_task, edit_task, or any tool that requires a taskId, you must copy the exact UUID from the context where it says "ID: <uuid>". Do not make up or generate task IDs.`
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
