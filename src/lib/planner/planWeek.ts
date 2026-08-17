import { addDays, format } from 'date-fns';
import { planSession, PlannedTaskResult, PlannerProject, PlannerTask } from './index';

export interface WeekDayPlan {
  date: string; // 'YYYY-MM-DD', local
  budgetMinutes: number;
  totalUsedMinutes: number;
  slackMinutes: number;
  tasks: PlannedTaskResult[];
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

export function planWeek(input: PlanWeekInput): PlanWeekOutput {
  const days = input.days ?? 7;
  const allowPartial = input.allowPartial ?? true;
  const budgetForDay = (i: number): number =>
    Array.isArray(input.dailyBudgetMinutes) ? input.dailyBudgetMinutes[i] ?? 0 : input.dailyBudgetMinutes;

  // Mutable working pool: fully-scheduled tasks are removed after each day,
  // partially-scheduled tasks have their remaining minutes carried into the next day.
  const pool = new Map<string, PlannerTask>(input.tasks.map((t) => [t.id, { ...t }]));
  const dayResults: WeekDayPlan[] = [];

  for (let i = 0; i < days; i++) {
    const virtualToday = addDays(input.startDate, i);
    const budgetMinutes = budgetForDay(i);

    const result = planSession({
      projects: input.projects,
      milestones: [],
      tasks: Array.from(pool.values()),
      budgetMinutes,
      today: virtualToday,
      allowPartial,
    });

    for (const scheduled of result.tasks) {
      if (scheduled.partial && scheduled.carryOverMinutes > 0) {
        const remaining = pool.get(scheduled.taskId);
        if (remaining) remaining.estimated_minutes = scheduled.carryOverMinutes;
      } else {
        pool.delete(scheduled.taskId);
      }
    }

    dayResults.push({
      date: format(virtualToday, 'yyyy-MM-dd'),
      budgetMinutes,
      totalUsedMinutes: result.totalUsedMinutes,
      slackMinutes: result.slackMinutes,
      tasks: result.tasks,
    });
  }

  const unscheduledTasks = Array.from(pool.values());
  const totalBacklogMinutes = input.tasks.reduce((sum, t) => sum + getEffectiveEstimate(t), 0);
  const totalCapacityMinutes = Array.from({ length: days }, (_, i) => budgetForDay(i)).reduce((a, b) => a + b, 0);

  return { days: dayResults, unscheduledTasks, totalBacklogMinutes, totalCapacityMinutes };
}
