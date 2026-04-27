# Default 60-Minute Estimate Implementation

## Summary
Successfully implemented a 60-minute default estimate for tasks without estimated time. Tasks with `estimated_minutes = 0` or `null` are now included in planning and treated as 60-minute tasks for all calculations.

## Changes Made

### 1. Added Helper Function
**File**: `src/lib/planner/index.ts`

```typescript
const DEFAULT_ESTIMATE_MINUTES = 60;

function getEffectiveEstimate(task: TaskWithMeta): number {
  return task.estimated_minutes > 0 ? task.estimated_minutes : DEFAULT_ESTIMATE_MINUTES;
}
```

This function returns the task's actual estimate if > 0, otherwise returns 60 minutes.

### 2. Removed Filter
**Before**:
```typescript
const schedulableTasks = tasksWithDeadlines.filter(t => 
  t.status !== 'completed' && t.estimated_minutes > 0
);
```

**After**:
```typescript
const schedulableTasks = tasksWithDeadlines.filter(t => 
  t.status !== 'completed'
);
```

Tasks without estimates are no longer filtered out.

### 3. Replaced All Direct References
Updated approximately 15 locations where `task.estimated_minutes` was used directly:

**Locations Updated**:
- Chain time calculations (overdue and non-overdue sections)
- Scheduled minutes assignments
- Budget reduction calculations
- Quick win candidate filtering
- Partial completion logic

**Example Change**:
```typescript
// Before
const estimate = task.estimated_minutes;

// After
const estimate = getEffectiveEstimate(task);
```

## Test Results

### Test 5: Tasks Without Estimated Time
```
Input:
- Task with 30min estimate
- Task without estimate (0 min)
- Task with 20min estimate

Budget: 120 minutes

Output:
1. Task with 30min estimate (30min)
2. Task without estimate (60min) ✅
3. Another task with 20min estimate (20min)

Total: 110 minutes used
Slack: 10 minutes
```

✅ Task without estimate was correctly scheduled with 60 minutes

## Behavior

### What Changed
- Tasks with `estimated_minutes = 0` or `null` are now included in planning
- They are treated as 60-minute tasks for:
  - Scoring calculations
  - Budget allocation
  - Schedule positioning
  - Dependency chain calculations
  - Quick win filtering

### What Stayed the Same
- Database values remain unchanged (no writes to `estimated_minutes`)
- UI can still display "No estimate" or similar
- Only the planner algorithm uses the 60-minute default
- All existing tests continue to pass

## Impact on Features

### Dependency Chains
Tasks without estimates in dependency chains are treated as 60-minute tasks:
- Chain time calculation includes 60 minutes for tasks without estimates
- Budget allocation accounts for the full chain including default estimates

### Quick Wins
Tasks without estimates can be quick wins if 60 minutes ≤ threshold (20 min):
- Currently, tasks without estimates won't qualify as quick wins (60 > 20)
- This is expected behavior

### Partial Completion
Tasks without estimates can be partially completed:
- If budget is insufficient, they can be scheduled for less than 60 minutes
- Carry-over minutes calculated based on 60-minute assumption

## Files Modified
1. `src/lib/planner/index.ts` - Added helper function and updated all references
2. `src/lib/planner/test-planner.ts` - Added test case for tasks without estimates

## Build Status
✅ TypeScript compilation: Success
✅ Next.js build: Success  
✅ All tests passing: Success
✅ New test case: Success

## Usage Example

**Before**: Task without estimate would be excluded from planning
```typescript
{
  id: 'task-1',
  title: 'Review document',
  estimated_minutes: 0, // No estimate
  // ... other fields
}
// Result: Task not scheduled ❌
```

**After**: Task without estimate is included with 60-minute default
```typescript
{
  id: 'task-1',
  title: 'Review document',
  estimated_minutes: 0, // No estimate
  // ... other fields
}
// Result: Task scheduled for 60 minutes ✅
```

## Notes
- The 60-minute default is only used in the planner algorithm
- Database values are never modified
- UI components can still show "No estimate" or prompt users to add estimates
- This allows users to add tasks quickly without estimates while still getting them planned
