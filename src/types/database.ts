export type ProjectStatus = 'active' | 'paused' | 'archived' | 'deleted'
export type TaskStatus    = 'pending' | 'completed'
export type ItemType = 'task' | 'milestone'
export interface DbUser      { id: string; email: string; first_name: string; last_name: string; created_at: string }
export interface DbProject   { id: string; user_id: string; name: string; description: string | null; deadline: string | null; priority: boolean; status: ProjectStatus; color: string | null; created_at: string }
export interface DbTask {
  id: string
  user_id: string
  project_id: string | null
  milestone_id: string | null
  item_type: ItemType
  title: string
  description: string | null
  estimated_minutes: number | null      // null for milestone rows
  status: TaskStatus | null             // null for milestone rows
  due_date: string | null
  order: number                         // decimal in DB, number in TS
  priority: boolean
  depends_on_task: string | null
  created_at: string
}
export interface DbMilestone {
  id: string
  user_id: string
  project_id: string | null
  title: string
  description: string | null
  due_date: string | null
  order: number
  priority: boolean
  created_at: string
}
export interface DbFocusSession   { id: string; user_id: string; budget_minutes: number; start_time: string | null; end_time: string | null; tasks_list: string[] }

export type AIProvider = 'anthropic' | 'openai' | 'google'

export interface DbAIMemory {
  id: string
  user_id: string
  project_id: string
  content: string
  created_at: string
}

export interface DbUserAISettings {
  user_id: string
  provider: AIProvider
  model: string
  api_key: string
  thinking_mode: boolean
}
