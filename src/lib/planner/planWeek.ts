import { addDays, format } from 'date-fns';
import { planSession, PlannedTaskResult, PlannerProject, PlannerTask } from './index';
import { planDay, DaySegment } from './planDay';
import { DayCalendar, DEFAULT_PLANNING_HOURS, PlanningHours } from './calendarTypes';
import { localTimeToUtc } from './windows';

export interface WeekDayPlan {
  date: string; // 'YYYY-MM-DD', local
  budgetMinutes: number;
  totalUsedMinutes: number;
  slackMinutes: number;
  tasks: PlannedTaskResult[];
  // Present only when the week was planned against a calendar (see PlanWeekInput.calendarByDate).
  segments?: DaySegment[];
  reservedMinutes?: number;
  freeBudgetMinutes?: number;
  windowMinutes?: number | null;
  freeUsedMinutes?: number;
  unplannedWindowMinutes?: number;
}

export interface PlanWeekInput {
  projects: PlannerProject[];
  tasks: PlannerTask[];
  // A single value applies to every day; an array supplies one budget per day
  // (day 0 is often smaller than the rest since pinned/manual picks already ate into it).
  dailyBudgetMinutes: number | number[];
  startDate: Date;
  days?: number;
  allowPartial?: boolean;
  // Calendar-aware mode: blocks and busy time per local date ('YYYY-MM-DD'). When this is
  // given (even empty), each day is planned with planDay — block lanes plus free windows —
  // instead of a single flat planSession. Days missing from the map get no blocks/walls.
  calendarByDate?: Record<string, DayCalendar>;
  timezone?: string;
  planningHours?: PlanningHours;
  calendarConnected?: boolean;
  spilloverProjectIds?: Iterable<string>;
  budgetIncludesBlocks?: boolean;
  // When the first day is today, plan it from the real clock rather than from the start of
  // planning hours (which may already be behind us).
  nowForFirstDay?: Date;
}

export interface PlanWeekOutput {
  days: WeekDayPlan[];
  unscheduledTasks: PlannerTask[];
  totalBacklogMinutes: number;
  totalCapacityMinutes: number;
}

function getEffectiveEstimate(task: PlannerTask): number {
  return task.estimated_minutes > 0 ? task.estimated_minutes : 60;
}

function applyToPool(pool: Map<string, PlannerTask>, planned: PlannedTaskResult[]): void {
  for (const scheduled of planned) {
    if (scheduled.partial && scheduled.carryOverMinutes > 0) {
      const remaining = pool.get(scheduled.taskId);
      if (remaining) remaining.estimated_minutes = scheduled.carryOverMinutes;
    } else {
      pool.delete(scheduled.taskId);
    }
  }
}

export function planWeek(input: PlanWeekInput): PlanWeekOutput {
  const days = input.days ?? 7;
  const allowPartial = input.allowPartial ?? true;
  const budgetForDay = (i: number): number =>
    Array.isArray(input.dailyBudgetMinutes) ? input.dailyBudgetMinutes[i] ?? 0 : input.dailyBudgetMinutes;
  const calendarMode = input.calendarByDate !== undefined;
  const timezone = input.timezone || 'UTC';
  const planningHours = input.planningHours ?? DEFAULT_PLANNING_HOURS;

  // Mutable working pool: fully-scheduled tasks are removed after each day,
  // partially-scheduled tasks have their remaining minutes carried into the next day.
  const pool = new Map<string, PlannerTask>(input.tasks.map((t) => [t.id, { ...t }]));
  const dayResults: WeekDayPlan[] = [];

  for (let i = 0; i < days; i++) {
    const virtualToday = addDays(input.startDate, i);
    const dateStr = format(virtualToday, 'yyyy-MM-dd');
    const budgetMinutes = budgetForDay(i);

    if (calendarMode) {
      const calendar = input.calendarByDate?.[dateStr];
      const now =
        i === 0 && input.nowForFirstDay
          ? input.nowForFirstDay
          : localTimeToUtc(dateStr, planningHours.start, timezone);

      const day = planDay({
        projects: input.projects,
        tasks: Array.from(pool.values()),
        budgetMinutes,
        blocks: calendar?.blocks ?? [],
        busy: calendar?.busy ?? [],
        calendarConnected: input.calendarConnected ?? false,
        planningHours,
        now,
        timezone,
        allowPartial,
        spilloverProjectIds: input.spilloverProjectIds,
        budgetIncludesBlocks: input.budgetIncludesBlocks,
      });
      applyToPool(pool, day.orderedTasks);

      dayResults.push({
        date: dateStr,
        budgetMinutes,
        totalUsedMinutes: day.totalUsedMinutes,
        slackMinutes: Math.max(0, budgetMinutes - day.totalUsedMinutes),
        tasks: day.orderedTasks,
        segments: day.segments,
        reservedMinutes: day.reservedMinutes,
        freeBudgetMinutes: day.freeBudgetMinutes,
        windowMinutes: day.windowMinutes,
        freeUsedMinutes: day.freeUsedMinutes,
        unplannedWindowMinutes: day.unplannedWindowMinutes,
      });
      continue;
    }

    const result = planSession({
      projects: input.projects,
      milestones: [],
      tasks: Array.from(pool.values()),
      budgetMinutes,
      today: virtualToday,
      allowPartial,
    });
    applyToPool(pool, result.tasks);

    dayResults.push({
      date: dateStr,
      budgetMinutes,
      totalUsedMinutes: result.totalUsedMinutes,
      slackMinutes: result.slackMinutes,
      tasks: result.tasks,
    });
  }

  const unscheduledTasks = Array.from(pool.values()).filter((t) => t.status !== 'completed');
  const totalBacklogMinutes = input.tasks.reduce((sum, t) => sum + getEffectiveEstimate(t), 0);
  const totalCapacityMinutes = Array.from({ length: days }, (_, i) => budgetForDay(i)).reduce((a, b) => a + b, 0);

  return { days: dayResults, unscheduledTasks, totalBacklogMinutes, totalCapacityMinutes };
}
