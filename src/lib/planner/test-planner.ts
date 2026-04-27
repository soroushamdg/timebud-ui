import { planSession, PlannerInput, PlannerProject, PlannerTask } from './index';

// Test data based on user's screenshots
const testProjects: PlannerProject[] = [
  {
    id: 'technical-report',
    name: 'Technical Report',
    deadline: '2026-03-30',
    priority: false,
    status: 'active'
  },
  {
    id: 'fina-210',
    name: 'FINA 210',
    deadline: '2026-03-31',
    priority: false,
    status: 'active'
  },
  {
    id: 'comp-474',
    name: 'COMP 474',
    deadline: '2026-04-14',
    priority: false,
    status: 'active'
  },
  {
    id: '425-hw2',
    name: '425 hw2',
    deadline: '2026-03-23',
    priority: false,
    status: 'active'
  }
];

const testTasks: PlannerTask[] = [
  // Technical Report tasks
  {
    id: 'task-1',
    project_id: 'technical-report',
    milestone_id: null,
    title: 'Use perplexity to write a new draft',
    estimated_minutes: 60,
    status: 'completed',
    due_date: '2026-03-14',
    order: 1,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-2',
    project_id: 'technical-report',
    milestone_id: null,
    title: 'Read the draft and add or remove topics',
    estimated_minutes: 60,
    status: 'completed',
    due_date: '2026-03-15',
    order: 2,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-3',
    project_id: 'technical-report',
    milestone_id: null,
    title: 'Use claude to make it final; avoid ai dete...',
    estimated_minutes: 60,
    status: 'pending',
    due_date: '2026-03-25',
    order: 3,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-4',
    project_id: 'technical-report',
    milestone_id: null,
    title: 'Send to professor',
    estimated_minutes: 15,
    status: 'pending',
    due_date: '2026-03-29',
    order: 4,
    priority: false,
    depends_on_task: null
  },
  // FINA 210 tasks
  {
    id: 'task-5',
    project_id: 'fina-210',
    milestone_id: null,
    title: 'create excel template with formulas a...',
    estimated_minutes: 0,
    status: 'completed',
    due_date: '2026-03-20',
    order: 1,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-6',
    project_id: 'fina-210',
    milestone_id: null,
    title: 'do market research',
    estimated_minutes: 0,
    status: 'completed',
    due_date: null,
    order: 2,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-7',
    project_id: 'fina-210',
    milestone_id: null,
    title: 'complete the excel with market research data',
    estimated_minutes: 0,
    status: 'completed',
    due_date: null,
    order: 3,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-8',
    project_id: 'fina-210',
    milestone_id: null,
    title: 'assignment 2',
    estimated_minutes: 120,
    status: 'completed',
    due_date: '2026-03-24',
    order: 4,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-9',
    project_id: 'fina-210',
    milestone_id: null,
    title: 'convert the excel format to given template',
    estimated_minutes: 120,
    status: 'pending',
    due_date: '2026-03-26',
    order: 5,
    priority: false,
    depends_on_task: null
  },
  // COMP 474 tasks
  {
    id: 'task-10',
    project_id: 'comp-474',
    milestone_id: null,
    title: 'add more features to the existing code',
    estimated_minutes: 120,
    status: 'pending',
    due_date: '2026-03-28',
    order: 1,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-11',
    project_id: 'comp-474',
    milestone_id: null,
    title: 'write the report',
    estimated_minutes: 120,
    status: 'pending',
    due_date: '2026-04-10',
    order: 2,
    priority: false,
    depends_on_task: null
  },
  // 425 hw2 tasks
  {
    id: 'task-12',
    project_id: '425-hw2',
    milestone_id: null,
    title: 'write the report',
    estimated_minutes: 60,
    status: 'completed',
    due_date: '2026-03-23',
    order: 1,
    priority: false,
    depends_on_task: null
  }
];

// Test with today being March 26, 2026 (user's actual date)
// Simulate how the app creates the date in production (local timezone)
const testToday = new Date(2026, 2, 26); // Month is 0-indexed, so 2 = March

const input: PlannerInput = {
  projects: testProjects,
  milestones: [],
  tasks: testTasks,
  budgetMinutes: 300,
  today: testToday,
  allowPartial: true
};

console.log('=== PLANNER TEST ===');
console.log('Today:', testToday.toISOString());
console.log('Budget:', input.budgetMinutes, 'minutes');
console.log('\n=== INPUT TASKS ===');
testTasks.forEach(task => {
  if (task.status === 'pending' && task.estimated_minutes > 0) {
    const daysUntil = task.due_date 
      ? Math.floor((new Date(task.due_date + 'T00:00:00Z').getTime() - testToday.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    console.log(`- ${task.title} (${task.estimated_minutes}min, due: ${task.due_date || 'none'}, days: ${daysUntil})`);
  }
});

console.log('\n=== RUNNING PLANNER ===');

// Add debugging by importing the internal functions
import { daysUntil } from './index';

// Check which tasks are considered overdue
console.log('\n=== OVERDUE CHECK ===');
console.log('Today (input):', testToday.toISOString());
testTasks.forEach(task => {
  if (task.status === 'pending' && task.estimated_minutes > 0 && task.due_date) {
    const target = new Date(task.due_date + 'T00:00:00Z');
    const todayUTC = new Date(Date.UTC(testToday.getFullYear(), testToday.getMonth(), testToday.getDate()));
    console.log(`\nTask: ${task.title}`);
    console.log(`  Due date string: ${task.due_date}`);
    console.log(`  Target UTC: ${target.toISOString()}`);
    console.log(`  Today UTC: ${todayUTC.toISOString()}`);
    const diff = (target.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`  Diff (ms): ${target.getTime() - todayUTC.getTime()}`);
    console.log(`  Diff (days): ${diff}`);
    const days = daysUntil(task.due_date, testToday);
    const isOverdue = days < 0;
    console.log(`  daysUntil result: ${days}, overdue=${isOverdue}`);
  }
});

const result = planSession(input);

console.log('\n=== PLANNER OUTPUT ===');
console.log('Tasks scheduled:', result.taskCount);
console.log('Total used minutes:', result.totalUsedMinutes);
console.log('Slack minutes:', result.slackMinutes);
console.log('\n=== SCHEDULED TASKS ===');
result.tasks.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title} (${task.scheduledMinutes}min${task.partial ? ' - PARTIAL' : ''})`);
});

if (result.tasks.length === 0) {
  console.log('\n⚠️  NO TASKS SCHEDULED - DEBUGGING NEEDED');
}

// Test 2: With 60 min budget (user's actual scenario)
console.log('\n\n=== TEST 2: 60 MIN BUDGET (USER SCENARIO) ===');
const input60 = {
  ...input,
  budgetMinutes: 60
};

const result60 = planSession(input60);
console.log('Tasks scheduled:', result60.taskCount);
console.log('Total used minutes:', result60.totalUsedMinutes);
console.log('Slack minutes:', result60.slackMinutes);
console.log('\n=== SCHEDULED TASKS (60 MIN) ===');
result60.tasks.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title} (${task.scheduledMinutes}min${task.partial ? ' - PARTIAL' : ''})`);
});

// Test 3: Dependency Chain Test
console.log('\n\n=== TEST 3: DEPENDENCY CHAIN ===');
const chainTestTasks: PlannerTask[] = [
  {
    id: 'chain-task-1',
    project_id: 'test-project',
    milestone_id: null,
    title: 'Task 1 (Root)',
    estimated_minutes: 30,
    status: 'pending',
    due_date: '2026-03-26', // Today - high urgency
    order: 1,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'chain-task-2',
    project_id: 'test-project',
    milestone_id: null,
    title: 'Task 2 (Depends on Task 1)',
    estimated_minutes: 30,
    status: 'pending',
    due_date: '2026-03-26', // Today - high urgency
    order: 2,
    priority: false,
    depends_on_task: 'chain-task-1'
  },
  {
    id: 'chain-task-3',
    project_id: 'test-project',
    milestone_id: null,
    title: 'Task 3 (Depends on Task 2)',
    estimated_minutes: 30,
    status: 'pending',
    due_date: '2026-03-26', // Today - high urgency
    order: 3,
    priority: false,
    depends_on_task: 'chain-task-2'
  },
  {
    id: 'independent-task',
    project_id: 'test-project',
    milestone_id: null,
    title: 'Independent Task',
    estimated_minutes: 20,
    status: 'pending',
    due_date: '2026-03-27', // Tomorrow - lower urgency
    order: 4,
    priority: false,
    depends_on_task: null
  }
];

const chainInput: PlannerInput = {
  projects: [{
    id: 'test-project',
    name: 'Test Project',
    deadline: null,
    priority: false,
    status: 'active'
  }],
  milestones: [],
  tasks: chainTestTasks,
  budgetMinutes: 100, // Enough for full chain + independent
  today: testToday,
  allowPartial: true
};

const chainResult = planSession(chainInput);
console.log('Tasks scheduled:', chainResult.taskCount);
console.log('Total used minutes:', chainResult.totalUsedMinutes);
console.log('Slack minutes:', chainResult.slackMinutes);
console.log('\n=== SCHEDULED TASKS (CHAIN TEST) ===');
chainResult.tasks.forEach((task, index) => {
  const chainInfo = task.isPartOfChain ? ` [Chain pos: ${task.chainPosition}, Locked: ${task.isLocked}]` : '';
  console.log(`${index + 1}. ${task.title} (${task.scheduledMinutes}min${task.partial ? ' - PARTIAL' : ''})${chainInfo}`);
});

// Test 4: Partial Chain Test (insufficient budget)
console.log('\n\n=== TEST 4: PARTIAL CHAIN (INSUFFICIENT BUDGET) ===');
const partialChainInput: PlannerInput = {
  ...chainInput,
  budgetMinutes: 50 // Only enough for first 2 tasks
};

const partialChainResult = planSession(partialChainInput);
console.log('Tasks scheduled:', partialChainResult.taskCount);
console.log('Total used minutes:', partialChainResult.totalUsedMinutes);
console.log('Slack minutes:', partialChainResult.slackMinutes);
console.log('\n=== SCHEDULED TASKS (PARTIAL CHAIN) ===');
partialChainResult.tasks.forEach((task, index) => {
  const chainInfo = task.isPartOfChain ? ` [Chain pos: ${task.chainPosition}, Locked: ${task.isLocked}]` : '';
  console.log(`${index + 1}. ${task.title} (${task.scheduledMinutes}min${task.partial ? ' - PARTIAL' : ''})${chainInfo}`);
});
