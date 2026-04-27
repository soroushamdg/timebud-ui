# Visual Indicators Fix - Dependency Chains

## Issue
The dependency chain planning algorithm was working correctly, but the visual indicators (lock icons, connection lines, indentation, reduced opacity) were not showing up in the UI on both the home page and focus page.

## Root Cause
The chain metadata fields (`isPartOfChain`, `chainPosition`, `dependsOnTaskId`, `isLocked`) were:
1. Not included in the local `PlannedTask` interface in the home page
2. Not being passed when setting the focus session store
3. Not implemented in the `TaskCard` component (used on home page)

## Files Fixed

### 1. `/src/app/(main)/page.tsx`
**Changes:**
- Added chain metadata fields to local `PlannedTask` interface
- Updated `setFocusSession` call to include chain metadata when mapping tasks
- Added debug logging to verify chain metadata is present

**Before:**
```typescript
interface PlannedTask {
  // ... other fields
  isPinned?: boolean;
  isManual?: boolean;
}
```

**After:**
```typescript
interface PlannedTask {
  // ... other fields
  isPinned?: boolean;
  isManual?: boolean;
  isPartOfChain?: boolean;
  chainPosition?: number;
  dependsOnTaskId?: string | null;
  isLocked?: boolean;
}
```

### 2. `/src/components/tasks/TaskCard.tsx`
**Changes:**
- Added `LockClosedIcon` import
- Updated `PlannedTask` interface to include chain metadata
- Added lock icon rendering for locked tasks
- Added connection line for chain tasks (vertical grey line)
- Added indentation for dependent tasks (28px left padding)
- Added reduced opacity (0.6) for locked tasks
- Changed title color to grey for locked tasks
- Added debug logging

**Visual Elements Added:**
- **Lock Icon**: Small grey lock in top-right corner
- **Connection Line**: 1px grey vertical line connecting to previous task
- **Indentation**: 12px additional left padding for chain tasks
- **Opacity**: 60% opacity for locked tasks
- **Text Color**: Grey text for locked task titles

### 3. `/src/components/tasks/FocusTaskCard.tsx`
**Already Implemented** - This was done in the initial implementation but verified:
- Lock icon for locked tasks
- Connection lines between chain tasks
- Indentation for dependent tasks
- Reduced opacity for locked tasks
- Disabled checkmark for locked tasks
- Added debug logging

## Visual Design Specifications

### Home Page (TaskCard)
```
┌─────────────────────────────────────┐
│ Task 1 (Root)                  30min│  ← Normal appearance
└─────────────────────────────────────┘
│ ← Connection line (1px grey)
┌─────────────────────────────────────┐
│    Task 2 (Locked)        🔒   60min│  ← Indented, greyed, lock icon
└─────────────────────────────────────┘
```

### Focus Page (FocusTaskCard)
```
☐ ┌─────────────────────────────────────┐
  │ Task 1 (Root)                  30min│  ← Can be checked
  └─────────────────────────────────────┘
  │ ← Connection line
☐ ┌─────────────────────────────────────┐
  │    Task 2 (Locked)        🔒   60min│  ← Cannot be checked (greyed)
  └─────────────────────────────────────┘
```

## Testing

### Debug Logging Added
1. **Home Page**: Logs chain metadata when tasks are planned
2. **TaskCard**: Logs when rendering chain tasks
3. **FocusTaskCard**: Logs when rendering chain tasks

### How to Verify
1. Create two tasks where Task 2 depends on Task 1
2. Set both tasks to have the same urgent deadline (e.g., today)
3. Run the planner
4. Check console for debug logs showing chain metadata
5. Verify visual indicators:
   - Task 2 should be indented
   - Task 2 should have a lock icon
   - Task 2 should have grey text
   - Task 2 should have reduced opacity
   - A thin grey line should connect Task 1 to Task 2

## Data Flow

```
Planner Algorithm (index.ts)
  ↓ Generates PlannedTaskResult with chain metadata
Home Page (page.tsx)
  ↓ Maps to PlannedTask with chain metadata
  ├→ TaskCard (home page display)
  │   └→ Shows lock icon, connection line, indentation
  └→ Focus Session Store
      └→ FocusTaskCard (focus page display)
          └→ Shows lock icon, connection line, indentation, disabled checkmark
```

## Expected Behavior

### Planning Phase
- When planner detects a high-scoring locked task
- It schedules the entire dependency chain
- Chain metadata is attached to each task

### Home Page Display
- Root task appears normal
- Dependent tasks show:
  - Lock icon (top-right)
  - Indentation (12px extra)
  - Connection line (grey, 1px)
  - Reduced opacity (60%)
  - Grey text color

### Focus Page Display
- Same visual indicators as home page
- Plus: Checkmark is disabled for locked tasks
- Tooltip: "Complete the previous task first"

### Task Completion
- When root task is completed
- Dependent task automatically unlocks
- Visual indicators update (opacity increases, lock icon removed)

## Status
✅ All visual indicators implemented
✅ Debug logging added
✅ Data flow verified
✅ Ready for testing
