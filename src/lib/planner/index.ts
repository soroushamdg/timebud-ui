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
}

export interface PlannerInput {
  projects: PlannerProject[];
  milestones: PlannerMilestone[];
  tasks: PlannerTask[];
  budgetMinutes: number;
  today?: Date;
}

export interface PlannedTaskResult {
  position: number;
  taskId: string;
  projectId: string | null;
  isSolo: boolean;
  tier1: boolean;
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
const PRI = 2.0;
const DEF = 1.0;
const SOLO_PRI = 2.0;
const SOLO_DEF = 1.0;
const MIN_ALLOC = 15;
const PARTIAL_FLOOR = 15;
const DEFAULT_EST = 25;
const NO_DL = 30;
const SOLO_ID = '__solo__';

function isSolo(t: PlannerTask): boolean {
  return t.project_id === null && t.milestone_id === null;
}

function isTier1(t: PlannerTask): boolean {
  return isSolo(t) && t.priority && t.due_date !== null;
}

function daysUntil(dateStr: string | null, today: Date): number {
  if (!dateStr) return NO_DL;
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function urgencyMult(days: number): number {
  return Math.exp(URGENCY_K / days);
}

function scheduleTier1(tasks: PlannerTask[], budget: number, today: Date): [PlannedTaskResult[], number] {
  const scheduled: PlannedTaskResult[] = [];
  let consumed = 0;
  
  const tier1Tasks = tasks.filter(isTier1).sort((a, b) => {
    const daysA = daysUntil(a.due_date, today);
    const daysB = daysUntil(b.due_date, today);
    return daysA - daysB;
  });
  
  for (const task of tier1Tasks) {
    if (consumed >= budget) break;
    
    const remaining = budget - consumed;
    const estimate = task.estimated_minutes || DEFAULT_EST;
    const scheduledMinutes = Math.min(estimate, remaining);
    
    if (scheduledMinutes >= PARTIAL_FLOOR) {
      scheduled.push({
        position: scheduled.length + 1,
        taskId: task.id,
        projectId: null,
        isSolo: true,
        tier1: true,
        milestoneTitle: null,
        title: task.title,
        priority: task.priority,
        scheduledMinutes,
        partial: scheduledMinutes < estimate,
        carryOverMinutes: scheduledMinutes < estimate ? estimate - scheduledMinutes : 0,
      });
      consumed += scheduledMinutes;
    }
  }
  
  return [scheduled, consumed];
}

function allocateBudget(
  projects: PlannerProject[],
  tasks: PlannerTask[],
  budget: number,
  today: Date
): Map<string, number> {
  const allocations = new Map<string, number>();
  
  // Group tasks by project
  const projectTasks = new Map<string, PlannerTask[]>();
  const soloTasks = tasks.filter(isSolo);
  
  projects.forEach(project => {
    projectTasks.set(project.id, tasks.filter(t => t.project_id === project.id));
  });
  
  // Calculate weights
  const weights = new Map<string, number>();
  let totalWeight = 0;
  
  projects.forEach(project => {
    const projectTaskList = projectTasks.get(project.id) || [];
    const pendingMinutes = projectTaskList
      .filter(t => t.status !== 'completed')
      .reduce((sum, t) => sum + (t.estimated_minutes || DEFAULT_EST), 0);
    
    if (pendingMinutes === 0) {
      weights.set(project.id, 0);
      return;
    }
    
    const priorityScore = project.priority ? PRI : DEF;
    const days = daysUntil(project.deadline, today);
    const weight = priorityScore * urgencyMult(days) * pendingMinutes;
    
    weights.set(project.id, weight);
    totalWeight += weight;
  });
  
  // Add solo tasks weight
  const soloPendingMinutes = soloTasks
    .filter(t => t.status !== 'completed' && !isTier1(t))
    .reduce((sum, t) => sum + (t.estimated_minutes || DEFAULT_EST), 0);
  
  if (soloPendingMinutes > 0) {
    const soloWeight = SOLO_DEF * soloPendingMinutes;
    weights.set(SOLO_ID, soloWeight);
    totalWeight += soloWeight;
  }
  
  // Allocate budget proportionally
  let allocatedBudget = 0;
  const validAllocations = new Map<string, number>();
  
  weights.forEach((weight, projectId) => {
    if (weight === 0) return;
    
    const allocation = Math.round((weight / totalWeight) * budget);
    if (allocation >= MIN_ALLOC) {
      validAllocations.set(projectId, allocation);
      allocatedBudget += allocation;
    }
  });
  
  // If all allocations were too small, give full budget to highest weight
  if (validAllocations.size === 0 && totalWeight > 0) {
    let maxWeight = 0;
    let maxProjectId = '';
    
    weights.forEach((weight, projectId) => {
      if (weight > maxWeight) {
        maxWeight = weight;
        maxProjectId = projectId;
      }
    });
    
    if (maxProjectId) {
      validAllocations.set(maxProjectId, budget);
      allocatedBudget = budget;
    }
  }
  
  return validAllocations;
}

function selectProjectTasks(
  projectId: string,
  tasks: PlannerTask[],
  alloc: number,
  milestones: PlannerMilestone[]
): PlannedTaskResult[] {
  const scheduled: PlannedTaskResult[] = [];
  let remainingBudget = alloc;
  
  // Get tasks for this project
  const projectTasks = tasks.filter(t => t.project_id === projectId && t.status !== 'completed');
  
  // Sort by milestone order then task order
  projectTasks.sort((a, b) => {
    if (a.milestone_id && b.milestone_id && a.milestone_id !== b.milestone_id) {
      const ma = milestones.find(m => m.id === a.milestone_id);
      const mb = milestones.find(m => m.id === b.milestone_id);
      return (ma?.order || 0) - (mb?.order || 0);
    }
    return a.order - b.order;
  });
  
  const scheduledTaskIds = new Set<string>();
  
  // Multiple passes: priority tasks first
  for (const pass of [true, false]) {
    for (const task of projectTasks) {
      if (remainingBudget < PARTIAL_FLOOR) break;
      if (scheduledTaskIds.has(task.id)) continue;
      if (pass !== task.priority) continue;
      
      // Check dependency
      if (task.depends_on_task) {
        const dep = tasks.find(t => t.id === task.depends_on_task);
        if (dep && dep.status !== 'completed' && !scheduledTaskIds.has(task.depends_on_task)) {
          continue;
        }
      }
      
      const estimate = task.estimated_minutes || DEFAULT_EST;
      const scheduledMinutes = Math.min(estimate, remainingBudget);
      
      if (scheduledMinutes >= PARTIAL_FLOOR) {
        const milestone = milestones.find(m => m.id === task.milestone_id);
        
        scheduled.push({
          position: scheduled.length + 1,
          taskId: task.id,
          projectId,
          isSolo: false,
          tier1: false,
          milestoneTitle: milestone?.title || null,
          title: task.title,
          priority: task.priority,
          scheduledMinutes,
          partial: scheduledMinutes < estimate,
          carryOverMinutes: scheduledMinutes < estimate ? estimate - scheduledMinutes : 0,
        });
        
        scheduledTaskIds.add(task.id);
        remainingBudget -= scheduledMinutes;
      }
    }
  }
  
  return scheduled;
}

function selectSoloTasks(tasks: PlannerTask[], alloc: number, today: Date): PlannedTaskResult[] {
  const scheduled: PlannedTaskResult[] = [];
  let remainingBudget = alloc;
  
  const soloTasks = tasks.filter(t => 
    isSolo(t) && 
    t.status !== 'completed' && 
    !isTier1(t)
  );
  
  // Sort by individual weight (priority * urgency)
  soloTasks.sort((a, b) => {
    const priorityA = a.priority ? SOLO_PRI : SOLO_DEF;
    const priorityB = b.priority ? SOLO_PRI : SOLO_DEF;
    const daysA = daysUntil(a.due_date, today);
    const daysB = daysUntil(b.due_date, today);
    
    const weightA = priorityA * urgencyMult(daysA);
    const weightB = priorityB * urgencyMult(daysB);
    
    return weightB - weightA;
  });
  
  for (const task of soloTasks) {
    if (remainingBudget < PARTIAL_FLOOR) break;
    
    const estimate = task.estimated_minutes || DEFAULT_EST;
    const scheduledMinutes = Math.min(estimate, remainingBudget);
    
    if (scheduledMinutes >= PARTIAL_FLOOR) {
      scheduled.push({
        position: scheduled.length + 1,
        taskId: task.id,
        projectId: null,
        isSolo: true,
        tier1: false,
        milestoneTitle: null,
        title: task.title,
        priority: task.priority,
        scheduledMinutes,
        partial: scheduledMinutes < estimate,
        carryOverMinutes: scheduledMinutes < estimate ? estimate - scheduledMinutes : 0,
      });
      
      remainingBudget -= scheduledMinutes;
    }
  }
  
  return scheduled;
}

function interpolate(
  projectTasksMap: Map<string, PlannedTaskResult[]>,
  soloTasks: PlannedTaskResult[],
  weights: Map<string, number>,
  soloWeight: number
): PlannedTaskResult[] {
  const result: PlannedTaskResult[] = [];
  
  // Extract tier1 tasks and prepend them
  const tier1Tasks = soloTasks.filter(t => t.tier1);
  result.push(...tier1Tasks);
  
  // Remove tier1 from solo tasks
  const remainingSoloTasks = soloTasks.filter(t => !t.tier1);
  
  // Create weighted round-robin schedule
  const entries: { projectId: string; tasks: PlannedTaskResult[]; weight: number }[] = [];
  
  projectTasksMap.forEach((tasks, projectId) => {
    const weight = weights.get(projectId) || 0;
    if (tasks.length > 0 && weight > 0) {
      entries.push({ projectId, tasks, weight });
    }
  });
  
  if (remainingSoloTasks.length > 0 && soloWeight > 0) {
    entries.push({ projectId: SOLO_ID, tasks: remainingSoloTasks, weight: soloWeight });
  }
  
  // Sort by weight descending
  entries.sort((a, b) => b.weight - a.weight);
  
  // Round-robin selection
  const taskQueues = new Map<string, PlannedTaskResult[]>();
  entries.forEach(entry => {
    taskQueues.set(entry.projectId, [...entry.tasks]);
  });
  
  while (taskQueues.size > 0) {
    for (const entry of entries) {
      const queue = taskQueues.get(entry.projectId);
      if (!queue || queue.length === 0) continue;
      
      const task = queue.shift()!;
      result.push(task);
      
      if (queue.length === 0) {
        taskQueues.delete(entry.projectId);
      }
    }
  }
  
  return result;
}

export function planSession(input: PlannerInput): PlannerOutput {
  try {
    const today = input.today || new Date();
    const { projects, milestones, tasks, budgetMinutes } = input;
    
    // Filter pending tasks
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    if (pendingTasks.length === 0) {
      return {
        budgetMinutes,
        totalUsedMinutes: 0,
        slackMinutes: budgetMinutes,
        taskCount: 0,
        tasks: [],
      };
    }
    
    // Schedule tier1 tasks first
    const [tier1Scheduled, tier1Consumed] = scheduleTier1(pendingTasks, budgetMinutes, today);
    
    if (tier1Consumed >= budgetMinutes) {
      return {
        budgetMinutes,
        totalUsedMinutes: tier1Consumed,
        slackMinutes: 0,
        taskCount: tier1Scheduled.length,
        tasks: tier1Scheduled,
      };
    }
    
    // Allocate remaining budget
    const remainingBudget = budgetMinutes - tier1Consumed;
    const allocations = allocateBudget(projects, pendingTasks, remainingBudget, today);
    
    // Select tasks for each allocation
    const projectTasksMap = new Map<string, PlannedTaskResult[]>();
    let totalScheduledMinutes = tier1Consumed;
    
    allocations.forEach((alloc, projectId) => {
      if (projectId === SOLO_ID) {
        const soloTasks = selectSoloTasks(pendingTasks, alloc, today);
        projectTasksMap.set(projectId, soloTasks);
        totalScheduledMinutes += soloTasks.reduce((sum, t) => sum + t.scheduledMinutes, 0);
      } else {
        const projectTasks = selectProjectTasks(projectId, pendingTasks, alloc, milestones);
        projectTasksMap.set(projectId, projectTasks);
        totalScheduledMinutes += projectTasks.reduce((sum, t) => sum + t.scheduledMinutes, 0);
      }
    });
    
    // Get weights for interpolation
    const weights = new Map<string, number>();
    let soloWeight = 0;
    
    allocations.forEach((alloc, projectId) => {
      if (projectId === SOLO_ID) {
        soloWeight = alloc;
      } else {
        weights.set(projectId, alloc);
      }
    });
    
    // Collect all solo tasks for interpolation
    const allSoloTasks: PlannedTaskResult[] = [];
    projectTasksMap.forEach((tasks, projectId) => {
      if (projectId === SOLO_ID) {
        allSoloTasks.push(...tasks);
      }
    });
    
    // Interleave tasks
    const finalTasks = interpolate(projectTasksMap, allSoloTasks, weights, soloWeight);
    
    // Add tier1 tasks to the beginning
    const allTasks = [...tier1Scheduled, ...finalTasks];
    
    // Update positions
    allTasks.forEach((task, index) => {
      task.position = index + 1;
    });
    
    return {
      budgetMinutes,
      totalUsedMinutes: totalScheduledMinutes,
      slackMinutes: budgetMinutes - totalScheduledMinutes,
      taskCount: allTasks.length,
      tasks: allTasks,
    };
  } catch (error) {
    // Never throw - return empty output on error
    return {
      budgetMinutes: input.budgetMinutes,
      totalUsedMinutes: 0,
      slackMinutes: input.budgetMinutes,
      taskCount: 0,
      tasks: [],
    };
  }
}
