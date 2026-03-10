// Test the fixed planner algorithm
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

// FIXED version of allocateBudget
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
    const projectDays = daysUntil(project.deadline, today);
    const projectUrgency = urgencyMult(projectDays);
    
    // Calculate average task urgency for this project
    const taskUrgencies = projectTaskList
      .filter(t => t.status !== 'completed')
      .map(t => {
        const taskDays = daysUntil(t.due_date, today);
        return urgencyMult(taskDays);
      });
    
    const avgTaskUrgency = taskUrgencies.length > 0 
      ? taskUrgencies.reduce((sum, urgency) => sum + urgency, 0) / taskUrgencies.length
      : 1.0;
    
    // Combine project urgency and average task urgency
    // Give more weight to task urgency (70%) vs project urgency (30%)
    const combinedUrgency = (avgTaskUrgency * 0.7) + (projectUrgency * 0.3);
    const weight = priorityScore * combinedUrgency * pendingMinutes;
    
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
  
  return { allocations, weights };
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

console.log('=== FIXED PLANNER DEBUG TEST ===');
console.log('Today:', testData.today.toDateString());
console.log('Budget:', testData.budgetMinutes, 'minutes');
console.log('');

// Test the fixed algorithm
const { allocations, weights } = allocateBudget(testData.projects, testData.tasks, testData.budgetMinutes, testData.today);

console.log('=== FIXED PROJECT WEIGHT CALCULATIONS ===');
console.log('WEIGHTS:');
weights.forEach((weight, projectId) => {
  const project = testData.projects.find(p => p.id === projectId);
  console.log(`${project?.name}: ${weight.toFixed(6)}`);
});
console.log('');

console.log('ALLOCATIONS:');
allocations.forEach((allocation, projectId) => {
  const project = testData.projects.find(p => p.id === projectId);
  console.log(`${project?.name}: ${allocation} minutes`);
});
console.log('');

// Detailed breakdown
console.log('=== DETAILED BREAKDOWN ===');
testData.projects.forEach(project => {
  const projectDays = daysUntil(project.deadline, testData.today);
  const projectUrgency = urgencyMult(projectDays);
  const projectTasks = testData.tasks.filter(t => t.project_id === project.id);
  
  const taskUrgencies = projectTasks
    .filter(t => t.status !== 'completed')
    .map(t => {
      const taskDays = daysUntil(t.due_date, testData.today);
      return urgencyMult(taskDays);
    });
  
  const avgTaskUrgency = taskUrgencies.length > 0 
    ? taskUrgencies.reduce((sum, urgency) => sum + urgency, 0) / taskUrgencies.length
    : 1.0;
  
  const combinedUrgency = (avgTaskUrgency * 0.7) + (projectUrgency * 0.3);
  const pendingMinutes = projectTasks.reduce((sum, t) => sum + t.estimated_minutes, 0);
  const weight = (project.priority ? PRI : DEF) * combinedUrgency * pendingMinutes;
  
  console.log(`${project.name}:`);
  console.log(`  Project days until deadline: ${projectDays}`);
  console.log(`  Project urgency: ${projectUrgency.toFixed(6)}`);
  console.log(`  Task urgencies: ${taskUrgencies.map(u => u.toFixed(6)).join(', ')}`);
  console.log(`  Average task urgency: ${avgTaskUrgency.toFixed(6)}`);
  console.log(`  Combined urgency (70% task, 30% project): ${combinedUrgency.toFixed(6)}`);
  console.log(`  Pending minutes: ${pendingMinutes}`);
  console.log(`  Final weight: ${weight.toFixed(6)}`);
  console.log('');
});
