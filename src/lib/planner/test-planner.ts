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
    status: 'pending',
    due_date: '2026-03-24',
    order: 4,
    priority: false,
    depends_on_task: null
  },
  {
    id: 'task-9',
    project_id: 'fina-210',
    milestone_id: null,
    title: 'Make presentation',
    estimated_minutes: 120,
    status: 'pending',
    due_date: '2026-03-24',
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

// Test with today being March 25, 2026
const testToday = new Date('2026-03-25T00:00:00Z');

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
