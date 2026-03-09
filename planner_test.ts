import { planSession, PlannerInput, PlannerTask, PlannerProject, PlannerMilestone } from './src/lib/planner/index';

// Create test data for your example
const today = new Date();

const tasks: PlannerTask[] = [
  {
    id: 'task1',
    project_id: null,
    milestone_id: null,
    title: 'Task 1 - Priority',
    estimated_minutes: 60,
    status: 'pending',
    due_date: null,
    order: 1,
    priority: true,
    depends_on_task: null,
  },
  {
    id: 'task2',
    project_id: null,
    milestone_id: null,
    title: 'Task 2 - Normal',
    estimated_minutes: 30,
    status: 'pending',
    due_date: null,
    order: 2,
    priority: false,
    depends_on_task: null,
  },
];

const input: PlannerInput = {
  projects: [],
  milestones: [],
  tasks: tasks,
  budgetMinutes: 75,
  today: today,
};

const result = planSession(input);

console.log('=== PLANNER RESULT ===');
console.log(`Budget: ${result.budgetMinutes} minutes`);
console.log(`Used: ${result.totalUsedMinutes} minutes`);
console.log(`Slack: ${result.slackMinutes} minutes`);
console.log(`Task count: ${result.taskCount}`);
console.log('');

result.tasks.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title}`);
  console.log(`   Scheduled: ${task.scheduledMinutes} minutes`);
  console.log(`   Priority: ${task.priority}`);
  console.log(`   Partial: ${task.partial}`);
  if (task.carryOverMinutes > 0) {
    console.log(`   Carry over: ${task.carryOverMinutes} minutes`);
  }
  console.log('');
});
