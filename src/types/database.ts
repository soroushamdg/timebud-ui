export type ProjectStatus = 'active' | 'paused' | 'archived' | 'deleted'
export type TaskStatus    = 'pending' | 'completed'
export interface DbUser      { id: string; email: string; first_name: string; last_name: string; created_at: string }
export interface DbProject   { id: string; user_id: string; name: string; description: string | null; deadline: string | null; priority: boolean; status: ProjectStatus; color: string | null; created_at: string }
export interface DbMilestone { id: string; project_id: string; title: string; description: string | null; target_date: string | null; order: number; created_at: string }
export interface DbTask      { id: string; project_id: string | null; milestone_id: string | null; user_id: string; title: string; description: string | null; estimated_minutes: number; status: TaskStatus; due_date: string | null; order: number; priority: boolean; depends_on_task: string | null; created_at: string }
export interface DbSession   { id: string; user_id: string; budget_minutes: number; start_time: string | null; end_time: string | null; tasks_list: string[] }
