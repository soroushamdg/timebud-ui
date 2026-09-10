// Shared shapes between the calendar data layer (src/lib/google-calendar/*, the hooks
// that read the local caches) and the planner (planDay / planWeek). Kept in the planner
// folder so the planner never has to import from the Google-specific modules.

/** A confirmed, mission-mapped event on the dedicated TimeBud calendar — a reservation. */
export interface DayBlock {
  /** google_calendar_events_cache.id */
  id: string
  title: string
  /** Missions this block is mapped to (confirmed mapping only). Caller may pre-filter to active missions. */
  projectIds: string[]
  /** "French" or "French & Thesis" — for headers. */
  missionLabel: string
  /** ISO timestamps. */
  startTime: string
  endTime: string
}

/** A busy interval from any other calendar (or an unmapped TimeBud event) — a wall. */
export interface BusyInterval {
  startTime: string
  endTime: string
}

/** Everything the planner needs to know about one local calendar day. */
export interface DayCalendar {
  /** 'YYYY-MM-DD' in the user's timezone. */
  date: string
  blocks: DayBlock[]
  busy: BusyInterval[]
}

/** The part of the day the planner is allowed to schedule into, as local wall-clock 'HH:MM'. */
export interface PlanningHours {
  start: string
  end: string
  /** Free gaps shorter than this are ignored rather than planned. */
  minGapMinutes: number
  /** Free windows start this long after a busy event or block ends and stop this long
   *  before the next one starts. Blocks keep their full minutes; only free time shrinks. */
  bufferMinutes: number
}

export const DEFAULT_PLANNING_HOURS: PlanningHours = { start: '06:00', end: '23:00', minGapMinutes: 20, bufferMinutes: 0 }
