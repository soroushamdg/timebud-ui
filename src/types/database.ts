export type ProjectStatus = "active" | "paused" | "archived";
export type TaskStatus = "pending" | "completed" | "skipped";
export type ItemType = "task" | "milestone";
export interface DbUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  created_at: string;
}
export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  deadline: string | null;
  priority: boolean;
  status: ProjectStatus;
  color: string | null;
  project_avatar_url: string | null;
  created_at: string;
}
export interface DbTask {
  id: string;
  user_id: string;
  project_id: string | null;
  milestone_id: string | null;
  item_type: ItemType;
  title: string;
  description: string | null;
  estimated_minutes: number | null; // null for milestone rows
  status: TaskStatus | null; // null for milestone rows
  due_date: string | null;
  order: number; // decimal in DB, number in TS
  priority: boolean;
  created_at: string;
  // Recurring fields
  is_recurring_template: boolean;
  recurrence_type: "daily" | "specific_days" | "interval" | null;
  recurrence_days: number[] | null; // e.g., [1,3,5] for Mon/Wed/Fri
  recurrence_interval: number | null; // e.g., 2 for every 2 weeks
  recurrence_end_date: string | null;
  recurrence_end_after: number | null; // end after N occurrences
  recurrence_missed_behavior: "skip" | "overdue" | null;
  recurrence_parent_id: string | null; // links occurrence to template
  recurrence_occurrence_date: string | null;
  // On hold fields
  on_hold: boolean;
  on_hold_reason: string | null;
  on_hold_type: "indefinite" | "until_date" | "until_task" | null;
  on_hold_until: string | null; // date or task_id
  // Dependencies fetched via join (not a column)
  dependencies?: string[]; // array of task IDs this task depends on
}
export interface DbMilestone {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  order: number;
  priority: boolean;
  created_at: string;
}
export interface DbFocusSession {
  id: string;
  user_id: string;
  budget_minutes: number;
  start_time: string | null;
  end_time: string | null;
  tasks_list: string[];
}

export type AIProvider = "anthropic" | "openai" | "google";

export interface DbAIMemory {
  id: string;
  user_id: string;
  project_id: string;
  content: string;
  created_at: string;
}

export interface DbUserAISettings {
  user_id: string;
  provider: AIProvider;
  model: string;
  thinking_mode: boolean;
  timezone?: string;
  first_day_of_week?: string;
  preferred_session_minutes?: number;
  allow_partial_tasks?: boolean;
  allow_research?: boolean;
  auto_estimate_tasks?: boolean;
}

export interface DbTaskDependency {
  task_id: string;
  depends_on_id: string;
  created_at: string;
}

export interface DbSessionTaskLog {
  id: string;
  session_id: string;
  task_id: string;
  task_title: string;
  project_id: string | null;
  project_name: string | null;
  outcome: "completed" | "partial" | "skipped" | null;
  scheduled_minutes: number;
  actual_minutes: number | null;
  created_at: string;
}
