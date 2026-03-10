// Test the final fix for task completion preference
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
const ALLOW_PARTIAL = true;

function daysUntil(dateStr, today) {
  if (!dateStr) return NO_DL;
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function urgencyMult(days) {
  return Math.exp(URGENCY_K / days);
}

function isSolo(t) {
  return t.project_id === null && t.milestone_id === null;
}

function isTier1(t) {
  return isSolo(t) && t.priority && t.due_date !== null;
}

// Simplified version of the fixed planSession
function planSessionFixed(input) {
  const today = input.today || new Date();
  const { projects, milestones, budgetMinutes, allowPartial } = input;
  const shouldAllowPartial = allowPartial !== undefined ? allowPartial : ALLOW_PARTIAL;
  
  // Filter pending tasks
  const pendingTasks = input.tasks.filter(t => t.status !== 'completed');
  if (pendingTasks.length === 0) {
    return {
      budgetMinutes,
      totalUsedMinutes: 0,
      slackMinutes: budgetMinutes,
      taskCount: 0,
      tasks: [],
    };
  }
  
  // Simplified tier1 scheduling (none in this test)
  const tier1Scheduled = [];
  const tier1Consumed = 0;
  
  // NEW LOGIC: Check for tasks with identical deadlines - prioritize completing one fully
  const remainingBudget = budgetMinutes - tier1Consumed;
  const nonTier1Tasks = pendingTasks.filter(t => !isTier1(t));
  
  // Group tasks by deadline
  const tasksByDeadline = new Map();
  nonTier1Tasks.forEach(task => {
    if (task.due_date) {
      const key = task.due_date;
      if (!tasksByDeadline.has(key)) tasksByDeadline.set(key, []);
      tasksByDeadline.get(key).push(task);
    }
  });
  
  console.log('=== DEADLINE GROUPS ===');
  tasksByDeadline.forEach((tasks, deadline) => {
    console.log(`Deadline ${deadline}: ${tasks.length} tasks`);
    tasks.forEach(task => {
      console.log(`  - ${task.title}: ${task.estimated_minutes}min (budget: ${remainingBudget}min)`);
    });
  });
  
  // Find deadlines where we can complete a full task
  for (const [deadline, tasks] of tasksByDeadline) {
    const fullyCompletableTask = tasks.find(task => 
      (task.estimated_minutes || DEFAULT_EST) <= remainingBudget
    );
    
    if (fullyCompletableTask) {
      console.log(`\n=== FULL TASK COMPLETION FOUND ===`);
      console.log(`Scheduling: ${fullyCompletableTask.title} (${fullyCompletableTask.estimated_minutes}min)`);
      console.log(`Budget used: ${fullyCompletableTask.estimated_minutes}min`);
      
      // Schedule this task fully and skip project allocation
      const scheduledTask = {
        position: tier1Scheduled.length + 1,
        taskId: fullyCompletableTask.id,
        projectId: fullyCompletableTask.project_id,
        isSolo: isSolo(fullyCompletableTask),
        tier1: false,
        milestoneTitle: null,
        title: fullyCompletableTask.title,
        priority: fullyCompletableTask.priority,
        scheduledMinutes: fullyCompletableTask.estimated_minutes || DEFAULT_EST,
        partial: false,
        carryOverMinutes: 0,
      };
      
      return {
        budgetMinutes,
        totalUsedMinutes: tier1Consumed + scheduledTask.scheduledMinutes,
        slackMinutes: budgetMinutes - (tier1Consumed + scheduledTask.scheduledMinutes),
        taskCount: tier1Scheduled.length + 1,
        tasks: [...tier1Scheduled, scheduledTask],
      };
    }
  }
  
  console.log(`\n=== NO FULL TASK COMPLETION POSSIBLE ===`);
  console.log('Falling back to project allocation...');
  
  // If no single task can be completed, return empty (simplified)
  return {
    budgetMinutes,
    totalUsedMinutes: 0,
    slackMinutes: budgetMinutes,
    taskCount: 0,
    tasks: [],
  };
}

// Test data
const testData = {
  projects: [
    {
      id: 'project-1',
      name: 'Project 1',
      deadline: '2025-04-20',
      priority: false,
      status: 'active'
    },
    {
      id: 'project-2', 
      name: 'Project 2',
      deadline: '2025-05-01',
      priority: false,
      status: 'active'
    }
  ],
  milestones: [],
  tasks: [
    {
      id: 'task-1',
      project_id: 'project-1',
      milestone_id: null,
      title: 'Task 1 of Project 1',
      estimated_minutes: 30,
      status: 'pending',
      due_date: '2025-03-09',
      order: 1,
      priority: false,
      depends_on_task: null,
      item_type: 'task'
    },
    {
      id: 'task-2',
      project_id: 'project-2', 
      milestone_id: null,
      title: 'Task 1 of Project 2',
      estimated_minutes: 30,
      status: 'pending',
      due_date: '2025-03-09',
      order: 1,
      priority: false,
      depends_on_task: null,
      item_type: 'task'
    }
  ],
  budgetMinutes: 30,
  today: new Date('2025-03-10')
};

console.log('=== FINAL FIX TEST ===');
console.log('Today:', testData.today.toDateString());
console.log('Budget:', testData.budgetMinutes, 'minutes');
console.log('');

const result = planSessionFixed(testData);

console.log('\n=== RESULT ===');
console.log('Tasks scheduled:', result.taskCount);
console.log('Total used minutes:', result.totalUsedMinutes);
console.log('Slack minutes:', result.slackMinutes);

if (result.tasks.length > 0) {
  console.log('\nScheduled task:');
  result.tasks.forEach((task, index) => {
    const project = testData.projects.find(p => p.id === task.projectId);
    console.log(`${index + 1}. ${task.title} from ${project?.name}: ${task.scheduledMinutes} minutes`);
  });
}
