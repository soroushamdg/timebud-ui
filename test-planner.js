import { planSession } from './src/lib/planner/index.ts';

const result = planSession({
  projects: [
    { id: 'p1', name: 'Test', deadline: null, priority: true, status: 'active' }
  ],
  tasks: [
    { 
      id: 't1', 
      project_id: 'p1', 
      item_type: 'task', 
      title: 'Task 1', 
      estimated_minutes: 30, 
      status: 'pending', 
      due_date: null, 
      order: 1, 
      priority: false, 
      depends_on_task: null, 
      milestone_id: null 
    },
    { 
      id: 't2', 
      project_id: 'p1', 
      item_type: 'task', 
      title: 'Task 2 (depends on t1)', 
      estimated_minutes: 20, 
      status: 'pending', 
      due_date: null, 
      order: 2, 
      priority: false, 
      depends_on_task: 't1', 
      milestone_id: null 
    },
    { 
      id: 't3', 
      project_id: null, 
      item_type: 'task', 
      title: 'Solo quick win', 
      estimated_minutes: 15, 
      status: 'pending', 
      due_date: null, 
      order: 1, 
      priority: true, 
      depends_on_task: null, 
      milestone_id: null 
    }
  ],
  milestones: [],
  budgetMinutes: 60
});

console.log(JSON.stringify(result, null, 2));
