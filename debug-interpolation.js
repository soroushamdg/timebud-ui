// Debug the interpolation logic
const SOLO_ID = '__solo__';

function interpolate(projectTasksMap, soloTasks, weights, soloWeight) {
  const result = [];
  
  // Create weighted round-robin schedule
  const entries = [];
  
  projectTasksMap.forEach((tasks, projectId) => {
    const weight = weights.get(projectId) || 0;
    if (tasks.length > 0 && weight > 0) {
      entries.push({ projectId, tasks, weight });
    }
  });
  
  if (soloTasks.length > 0 && soloWeight > 0) {
    entries.push({ projectId: SOLO_ID, tasks: soloTasks, weight: soloWeight });
  }
  
  // Sort by weight descending
  entries.sort((a, b) => b.weight - a.weight);
  
  console.log('=== INTERPOLATION ENTRIES ===');
  entries.forEach(entry => {
    console.log(`${entry.projectId}: weight=${entry.weight}, tasks=${entry.tasks.length}`);
  });
  
  // Round-robin selection
  const taskQueues = new Map();
  entries.forEach(entry => {
    taskQueues.set(entry.projectId, [...entry.tasks]);
  });
  
  console.log('=== ROUND-ROBIN SCHEDULING ===');
  let round = 0;
  while (taskQueues.size > 0) {
    round++;
    console.log(`\nRound ${round}:`);
    
    for (const entry of entries) {
      const queue = taskQueues.get(entry.projectId);
      if (!queue || queue.length === 0) continue;
      
      const task = queue.shift();
      result.push(task);
      console.log(`  Selected: ${task.title} from ${entry.projectId}`);
      
      if (queue.length === 0) {
        taskQueues.delete(entry.projectId);
        console.log(`  ${entry.projectId} queue empty`);
      }
    }
  }
  
  return result;
}

// Simulate the result from our previous test
const projectTasksMap = new Map([
  ['project-1', [
    { taskId: 'task-1', projectId: 'project-1', title: 'Task 1 of Project 1', scheduledMinutes: 15, priority: false, due_date: '2025-03-09' }
  ]],
  ['project-2', [
    { taskId: 'task-2', projectId: 'project-2', title: 'Task 1 of Project 2', scheduledMinutes: 15, priority: false, due_date: '2025-03-09' }
  ]]
]);

const weights = new Map([
  ['project-1', 32.673464],
  ['project-2', 32.088736]
]);

const soloTasks = [];
const soloWeight = 0;

const finalOrder = interpolate(projectTasksMap, soloTasks, weights, soloWeight);

console.log('\n=== FINAL SCHEDULING ORDER ===');
finalOrder.forEach((task, index) => {
  console.log(`${index + 1}. ${task.title} (${task.scheduledMinutes} minutes)`);
});
