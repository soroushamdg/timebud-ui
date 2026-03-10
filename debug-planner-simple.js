// Debug planner algorithm with user's scenario - simplified version
// Copying the key planner logic here for testing

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

// Simplified version of the key functions for debugging
function allocateBudget(projects, tasks, budget, today) {
  const allocations = new Map();
  
  // Group tasks by project
  const projectTasks = new Map();
  const soloTasks = tasks.filter(isSolo);
  
  projects.forEach(project => {
    projectTasks.set(project.id, tasks.filter(t => t.project_id === project.id));
  });
  
  // Calculate weights
  const weights = new Map();
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
  const validAllocations = new Map();
  
  weights.forEach((weight, projectId) => {
    if (weight === 0) return;
    
    const allocation = Math.round((weight / totalWeight) * budget);
    if (allocation >= MIN_ALLOC) {
      validAllocations.set(projectId, allocation);
      allocatedBudget += allocation;
    }
  });
  
  return validAllocations;
}

function selectProjectTasks(projectId, tasks, alloc, milestones, allowPartial, today) {
  const scheduled = [];
  let remainingBudget = alloc;
  
  // Get tasks for this project
  const projectTasks = tasks.filter(t => t.project_id === projectId && t.status !== 'completed');
  
  // Sort by deadline urgency first, then milestone order, then task order
  projectTasks.sort((a, b) => {
    // Primary sort: by deadline urgency (tasks with earlier deadlines first)
    const daysA = daysUntil(a.due_date, today);
    const daysB = daysUntil(b.due_date, today);
    
    // If both have deadlines, sort by urgency (earlier deadline first)
    if (a.due_date && b.due_date) {
      const urgencyA = urgencyMult(daysA);
      const urgencyB = urgencyMult(daysB);
      if (urgencyA !== urgencyB) {
        return urgencyB - urgencyA; // Higher urgency first
      }
    }
    // If only one has a deadline, prioritize the one with deadline
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    // Secondary sort: by milestone order (not applicable in this test)
    // Tertiary sort: by task order
    return a.order - b.order;
  });
  
  // Simple scheduling for this test
  for (const task of projectTasks) {
    if (remainingBudget <= 0) break;
    
    const estimate = task.estimated_minutes || DEFAULT_EST;
    const scheduledMinutes = Math.min(estimate, remainingBudget);
    
    scheduled.push({
      taskId: task.id,
      projectId,
      title: task.title,
      scheduledMinutes,
      priority: task.priority,
      due_date: task.due_date
    });
    
    remainingBudget -= scheduledMinutes;
  }
  
  return scheduled;
}

// Test data matching user's scenario
const testData = {
  projects: [
    {
      id: 'project-1',
      name: 'Project 1',
      deadline: '2025-04-20', // 20 April
      priority: false,
      status: 'active'
    },
    {
      id: 'project-2', 
      name: 'Project 2',
      deadline: '2025-05-01', // 1 May
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
      due_date: '2025-03-09', // 9 March
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
      due_date: '2025-03-09', // 9 March
      order: 1,
      priority: false,
      depends_on_task: null,
      item_type: 'task'
    }
  ],
  budgetMinutes: 30,
  today: new Date('2025-03-10') // Current date: 10 March (day after both task deadlines)
};

console.log('=== PLANNER DEBUG TEST ===');
console.log('Today:', testData.today.toDateString());
console.log('Budget:', testData.budgetMinutes, 'minutes');
console.log('');

console.log('PROJECTS:');
testData.projects.forEach(p => {
  console.log(`- ${p.name}: deadline ${p.deadline}`);
});
console.log('');

console.log('TASKS:');
testData.tasks.forEach(t => {
  const project = testData.projects.find(p => p.id === t.project_id);
  console.log(`- ${t.title}: ${t.estimated_minutes}min, deadline ${t.due_date}, project: ${project?.name}`);
});
console.log('');

// Test project weight calculations
console.log('=== PROJECT WEIGHT CALCULATIONS ===');
const allocations = allocateBudget(testData.projects, testData.tasks, testData.budgetMinutes, testData.today);

console.log('ALLOCATIONS:');
allocations.forEach((allocation, projectId) => {
  const project = testData.projects.find(p => p.id === projectId);
  console.log(`${project?.name || projectId}: ${allocation} minutes`);
});
console.log('');

// Test task selection for each project
console.log('=== TASK SELECTION ===');
allocations.forEach((allocation, projectId) => {
  const project = testData.projects.find(p => p.id === projectId);
  console.log(`${project?.name} (${allocation} minutes budget):`);
  
  const scheduledTasks = selectProjectTasks(projectId, testData.tasks, allocation, testData.milestones, ALLOW_PARTIAL, testData.today);
  
  scheduledTasks.forEach(task => {
    console.log(`  - ${task.title}: ${task.scheduledMinutes} minutes`);
  });
  console.log('');
});

// Manual debugging of calculations
console.log('=== DETAILED DEBUG ===');
testData.projects.forEach(project => {
  const days = daysUntil(project.deadline, testData.today);
  const urgency = urgencyMult(days);
  const projectTasks = testData.tasks.filter(t => t.project_id === project.id);
  const pendingMinutes = projectTasks.reduce((sum, t) => sum + t.estimated_minutes, 0);
  const weight = (project.priority ? PRI : DEF) * urgency * pendingMinutes;
  
  console.log(`${project.name}:`);
  console.log(`  Days until deadline: ${days}`);
  console.log(`  Urgency multiplier: ${urgency.toFixed(6)}`);
  console.log(`  Pending minutes: ${pendingMinutes}`);
  console.log(`  Priority score: ${project.priority ? PRI : DEF}`);
  console.log(`  Total weight: ${weight.toFixed(6)}`);
  console.log('');
});

console.log('=== TASK DEADLINE ANALYSIS ===');
testData.tasks.forEach(task => {
  const days = daysUntil(task.due_date, testData.today);
  const urgency = urgencyMult(days);
  console.log(`${task.title}:`);
  console.log(`  Days until deadline: ${days}`);
  console.log(`  Urgency multiplier: ${urgency.toFixed(6)}`);
  console.log('');  
});
