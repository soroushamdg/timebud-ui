// Debug planner algorithm with user's scenario
const { planSession } = require('./src/lib/planner/index.ts');

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

// Run the planner
const result = planSession(testData);

console.log('=== PLANNER RESULT ===');
console.log('Total used minutes:', result.totalUsedMinutes);
console.log('Number of tasks scheduled:', result.taskCount);
console.log('');

console.log('SCHEDULED TASKS:');
result.tasks.forEach((task, index) => {
  const project = testData.projects.find(p => p.id === task.projectId);
  console.log(`${index + 1}. ${task.title}`);
  console.log(`   Project: ${project?.name || 'Solo'}`);
  console.log(`   Scheduled: ${task.scheduledMinutes} minutes`);
  console.log(`   Priority: ${task.priority}`);
  console.log(`   Position: ${task.position}`);
  console.log('');
});

// Let's also debug the internal calculations
console.log('=== INTERNAL DEBUG ===');
console.log('Checking project weight calculations...');

// Manually calculate what should happen
const URGENCY_K = 3.5;
const PRI = 2.0;
const DEF = 1.0;

function daysUntil(dateStr, today) {
  if (!dateStr) return 30;
  const target = new Date(dateStr);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

function urgencyMult(days) {
  return Math.exp(URGENCY_K / days);
}

testData.projects.forEach(project => {
  const days = daysUntil(project.deadline, testData.today);
  const urgency = urgencyMult(days);
  const projectTasks = testData.tasks.filter(t => t.project_id === project.id);
  const pendingMinutes = projectTasks.reduce((sum, t) => sum + t.estimated_minutes, 0);
  const weight = (project.priority ? PRI : DEF) * urgency * pendingMinutes;
  
  console.log(`${project.name}:`);
  console.log(`  Days until deadline: ${days}`);
  console.log(`  Urgency multiplier: ${urgency.toFixed(4)}`);
  console.log(`  Pending minutes: ${pendingMinutes}`);
  console.log(`  Total weight: ${weight.toFixed(4)}`);
  console.log('');
});

console.log('=== TASK DEADLINE COMPARISON ===');
testData.tasks.forEach(task => {
  const days = daysUntil(task.due_date, testData.today);
  const urgency = urgencyMult(days);
  console.log(`${task.title}:`);
  console.log(`  Days until deadline: ${days}`);
  console.log(`  Urgency multiplier: ${urgency.toFixed(4)}`);
  console.log('');
});
