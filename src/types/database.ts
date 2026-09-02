export type ProjectStatus = "active" | "paused" | "archived";
export type TaskStatus = "pending" | "completed";
export type ItemType = "task" | "milestone";
export type MissionDifficulty = "easy" | "medium" | "hard";
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
  difficulty: MissionDifficulty;
  mission_bonus_awarded: boolean;
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
  recurrence_type: "daily" | "specific_days" | "interval" | null;
  recurrence_days: number[] | null; // e.g., [1,3,5] for Mon/Wed/Fri
  recurrence_interval: number | null; // e.g., 2 for every 2 weeks
  recurrence_end_date: string | null;
  recurrence_end_after: number | null; // end after N occurrences
  recurrence_missed_behavior: "skip" | "overdue" | null;
  recurrence_completed_count: number; // occurrences completed so far, for recurrence_end_after
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
export type FocusSessionStatus = "running" | "paused" | "completed" | "abandoned";

export interface DbFocusSession {
  id: string;
  user_id: string;
  budget_minutes: number;
  start_time: string | null;
  end_time: string | null;
  tasks_list: string[];
  unfinished_reminder_sent_at?: string | null;
  status: FocusSessionStatus;
  paused_at: string | null;
  total_paused_seconds: number;
  // Structurally the same as `PlannedTask` (src/stores/sessionStore.ts) — kept as a
  // loose JSON shape here since this column is opaque jsonb to the DB layer.
  planned_tasks: Record<string, unknown>[];
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
  reminder_enabled?: boolean;
  reminder_time?: string | null; // 'HH:MM', 24h, interpreted in `timezone` — the inactivity nudge
  auto_timezone_enabled?: boolean;
  morning_briefing_enabled?: boolean;
  morning_briefing_time?: string | null; // 'HH:MM', 24h — also governs deadline alerts + weekly look-ahead
  deadline_alerts_enabled?: boolean;
  weekly_lookahead_enabled?: boolean;
  unfinished_session_alerts_enabled?: boolean;
  streak_alerts_enabled?: boolean;
  last_streak_milestone?: number;
  xp_total?: number;
  calendar_block_alerts_enabled?: boolean;
}

export interface DbPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
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

export interface DbGoogleCalendarConnection {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  google_calendar_id: string;
  google_account_email: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface DbCalendarBlockMapping {
  id: string;
  user_id: string;
  event_title: string;
  confirmed: boolean;
  created_at: string;
  // Fetched via join (not a column)
  project_ids?: string[];
}

export interface DbCalendarBlockMissionLink {
  mapping_id: string;
  project_id: string;
}

export interface DbCalendarEventCache {
  id: string;
  user_id: string;
  google_event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  notified_at: string | null;
  synced_at: string;
}

export interface DbChatConversation {
  id: string;
  user_id: string;
  summary: string | null;
  summary_token_count: number;
  summarized_message_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls: unknown | null;
  tool_results: unknown | null;
  created_at: string;
}
