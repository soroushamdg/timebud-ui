export interface PlannerProject {
  id: string;
  name: string;
  deadline: string | null;
  priority: boolean;
  status: string;
}

export interface PlannerMilestone {
  id: string;
  project_id: string;
  title: string;
  order: number;
}

export interface PlannerTask {
  id: string;
  project_id: string | null;
  milestone_id: string | null;
  title: string;
  estimated_minutes: number;
  status: string;
  due_date: string | null;
  order: number;
  priority: boolean;
  depends_on_task: string | null;
  item_type?: string;
}

export interface PlannerInput {
  projects: PlannerProject[];
  milestones: PlannerMilestone[];
  tasks: PlannerTask[];
  budgetMinutes: number;
  today?: Date;
  allowPartial?: boolean;
}

export interface PlannedTaskResult {
  position: number;
  taskId: string;
  projectId: string | null;
  isSolo: boolean;
  tier1: boolean;
  isOpener?: boolean;
  inheritedDeadline?: boolean;
  milestoneTitle: string | null;
  title: string;
  priority: boolean;
  scheduledMinutes: number;
  partial: boolean;
  carryOverMinutes: number;
}

export interface PlannerOutput {
  budgetMinutes: number;
  totalUsedMinutes: number;
  slackMinutes: number;
  taskCount: number;
  tasks: PlannedTaskResult[];
}

const URGENCY_K = 3.5;
const URGENCY_CAP = 20.0;
const TASK_PRIORITY_BOOST = 5.0;
const PROJECT_PRIORITY_BOOST = 3.0;
const UNLOCK_BOOST_PER_TASK = 2.0;
const SOLO_PRIORITY_BOOST = 1.5;
const MILESTONE_DEADLINE_MULT = 0.6;
const QUICK_WIN_THRESHOLD_MIN = 20;
const URGENT_DEADLINE_DAYS = 2;
const PARTIAL_FLOOR = 5;
const NO_DEADLINE_DAYS = 30;

interface TaskWithMeta extends PlannerTask {
  _inherited?: boolean;
}

function daysUntil(dateStr: string, today: Date): number {
  const target = new Date(dateStr + 'T00:00:00Z');
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const diff = (target.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.5, diff);
}

function inheritMilestoneDeadlines(allItems: PlannerTask[]): TaskWithMeta[] {
  const result: TaskWithMeta[] = [];
  const byProject = new Map<string | null, PlannerTask[]>();
  
  for (const item of allItems) {
    const key = item.project_id ?? null;
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(item);
  }
  
  for (const [projectId, projectItems] of byProject) {
    const sorted = [...projectItems].sort((a, b) => a.order - b.order);
    
    for (const item of sorted) {
      if (item.item_type === 'milestone') continue;
      
      if (item.due_date) {
        result.push({ ...item, _inherited: false });
        continue;
      }
      
      const nextMilestone = sorted.find(
        m => m.item_type === 'milestone' && m.order > item.order && m.due_date !== null
      );
      
      if (nextMilestone?.due_date) {
        result.push({
          ...item,
          due_date: nextMilestone.due_date,
          _inherited: true
        });
      } else {
        result.push({ ...item, _inherited: false });
      }
    }
  }
  
  return result;
}

function buildUnlockMap(tasks: TaskWithMeta[]): Map<string, number> {
  const unlockMap = new Map<string, number>();
  
  for (const task of tasks) {
    if (task.depends_on_task) {
      const count = unlockMap.get(task.depends_on_task) ?? 0;
      unlockMap.set(task.depends_on_task, count + 1);
    }
  }
  
  return unlockMap;
}

function gateDependencies(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return tasks.filter(task => {
    if (!task.depends_on_task) return true;
    
    const dependency = tasks.find(t => t.id === task.depends_on_task);
    return dependency?.status === 'completed';
  });
}

function scoreTask(
  task: TaskWithMeta,
  projects: PlannerProject[],
  unlockMap: Map<string, number>,
  today: Date
): number {
  let score = 0;
  
  if (task.due_date) {
    const days = Math.max(0.5, daysUntil(task.due_date, today));
    const rawUrgency = Math.exp(URGENCY_K / days);
    const multiplier = task._inherited ? MILESTONE_DEADLINE_MULT : 1.0;
    score += Math.min(rawUrgency * multiplier, URGENCY_CAP);
  } else {
    score += Math.exp(URGENCY_K / NO_DEADLINE_DAYS);
  }
  
  if (task.priority) {
    score += TASK_PRIORITY_BOOST;
  }
  
  const project = projects.find(p => p.id === task.project_id);
  if (project?.priority) {
    score += PROJECT_PRIORITY_BOOST;
  }
  
  if (!task.project_id && task.priority) {
    score += SOLO_PRIORITY_BOOST;
  }
  
  const unlocks = unlockMap.get(task.id) ?? 0;
  score += unlocks * UNLOCK_BOOST_PER_TASK;
  
  return score;
}

export function planSession(input: PlannerInput): PlannerOutput {
  try {
    const today = input.today || new Date();
    const { budgetMinutes, allowPartial = true } = input;
    
    const activeProjects = input.projects.filter(p => 
      p.status === 'active' || p.status === 'target'
    );
    const activeProjectIds = new Set(activeProjects.map(p => p.id));
    
    let tasksWithDeadlines = inheritMilestoneDeadlines(input.tasks);
    
    tasksWithDeadlines = tasksWithDeadlines.filter(t => 
      t.status !== 'completed' && 
      (t.project_id === null || activeProjectIds.has(t.project_id))
    );
    
    if (tasksWithDeadlines.length === 0) {
      return {
        budgetMinutes,
        totalUsedMinutes: 0,
        slackMinutes: budgetMinutes,
        taskCount: 0,
        tasks: [],
      };
    }
    
    const eligibleTasks = gateDependencies(tasksWithDeadlines);
    
    if (eligibleTasks.length === 0) {
      return {
        budgetMinutes,
        totalUsedMinutes: 0,
        slackMinutes: budgetMinutes,
        taskCount: 0,
        tasks: [],
      };
    }
    
    const unlockMap = buildUnlockMap(eligibleTasks);
    
    const scoredTasks = eligibleTasks.map(task => ({
      task,
      score: scoreTask(task, activeProjects, unlockMap, today)
    }));
    
    const hasUrgentTask = eligibleTasks.some(t => 
      t.due_date && daysUntil(t.due_date, today) < URGENT_DEADLINE_DAYS
    );
    
    let quickWinOpener: typeof scoredTasks[0] | null = null;
    let remainingBudget = budgetMinutes;
    const scheduledTasks: PlannedTaskResult[] = [];
    let position = 1;
    
    if (!hasUrgentTask) {
      const quickWinCandidates = scoredTasks
        .filter(st => st.task.estimated_minutes && st.task.estimated_minutes <= QUICK_WIN_THRESHOLD_MIN)
        .sort((a, b) => b.score - a.score);
      
      if (quickWinCandidates.length > 0) {
        quickWinOpener = quickWinCandidates[0];
        const task = quickWinOpener.task;
        
        scheduledTasks.push({
          position: position++,
          taskId: task.id,
          projectId: task.project_id,
          isSolo: task.project_id === null,
          tier1: false,
          isOpener: true,
          inheritedDeadline: task._inherited ?? false,
          milestoneTitle: null,
          title: task.title,
          priority: task.priority,
          scheduledMinutes: task.estimated_minutes,
          partial: false,
          carryOverMinutes: 0
        });
        
        remainingBudget -= task.estimated_minutes;
      }
    }
    
    const remainingTasks = quickWinOpener 
      ? scoredTasks.filter(st => st.task.id !== quickWinOpener!.task.id)
      : scoredTasks;
    
    remainingTasks.sort((a, b) => b.score - a.score);
    
    const tasksByProject = new Map<string | null, typeof remainingTasks>();
    for (const st of remainingTasks) {
      const key = st.task.project_id;
      if (!tasksByProject.has(key)) tasksByProject.set(key, []);
      tasksByProject.get(key)!.push(st);
    }
    
    const projectScores = new Map<string | null, number>();
    for (const [projectId, tasks] of tasksByProject) {
      const maxScore = Math.max(...tasks.map(st => st.score));
      projectScores.set(projectId, maxScore);
    }
    
    const projectOrder = Array.from(projectScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([projectId]) => projectId);
    
    for (const projectId of projectOrder) {
      if (remainingBudget <= 0) break;
      
      const projectTasks = tasksByProject.get(projectId)!;
      projectTasks.sort((a, b) => b.score - a.score);
      
      for (const st of projectTasks) {
        const task = st.task;
        const estimate = task.estimated_minutes;
        
        if (estimate <= remainingBudget) {
          scheduledTasks.push({
            position: position++,
            taskId: task.id,
            projectId: task.project_id,
            isSolo: task.project_id === null,
            tier1: false,
            isOpener: false,
            inheritedDeadline: task._inherited ?? false,
            milestoneTitle: null,
            title: task.title,
            priority: task.priority,
            scheduledMinutes: estimate,
            partial: false,
            carryOverMinutes: 0
          });
          remainingBudget -= estimate;
        } else if (allowPartial && remainingBudget >= PARTIAL_FLOOR) {
          scheduledTasks.push({
            position: position++,
            taskId: task.id,
            projectId: task.project_id,
            isSolo: task.project_id === null,
            tier1: false,
            isOpener: false,
            inheritedDeadline: task._inherited ?? false,
            milestoneTitle: null,
            title: task.title,
            priority: task.priority,
            scheduledMinutes: remainingBudget,
            partial: true,
            carryOverMinutes: estimate - remainingBudget
          });
          remainingBudget = 0;
          break;
        }
        
        if (remainingBudget <= 0) break;
      }
    }
    
    const totalUsedMinutes = budgetMinutes - remainingBudget;
    
    return {
      budgetMinutes,
      totalUsedMinutes,
      slackMinutes: remainingBudget,
      taskCount: scheduledTasks.length,
      tasks: scheduledTasks
    };
  } catch (error) {
    return {
      budgetMinutes: input.budgetMinutes,
      totalUsedMinutes: 0,
      slackMinutes: input.budgetMinutes,
      taskCount: 0,
      tasks: [],
    };
  }
}
