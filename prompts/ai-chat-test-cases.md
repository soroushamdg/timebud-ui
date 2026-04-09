# TimeBud AI Chat - Comprehensive Test Cases

This document contains 50+ test cases covering all AI chat features including CRUD operations, AI agent capabilities, temporal awareness, session planning, research integration, and error handling.

## Test Environment Setup

**Initial State**: Fresh TimeBud account with no projects or tasks
**Settings**: 
- First day of week: Monday
- Timezone: User's local timezone
- Preferred session: 60 minutes
- Allow research: Enabled
- Thinking mode: Enabled (if available)

---

# PART 1: REALISTIC USER WORKFLOWS

## Workflow 1: New User Onboarding (5 tests)

### Test 1: Create First Project
**Prerequisites**: None (fresh account)
**User Input**: "I want to build a mobile fitness app"
**Expected Behavior**:
- ✓ AI uses `preview_creation` action
- ✓ Shows project preview with suggested tasks
- ✓ Requires confirmation before creation
- ✓ Displays "Create everything" and "Cancel" buttons
**Validation**:
- [x] Project preview shows app name
- [x] Preview includes initial tasks (if AI suggests them)
- [x] Confirmation required (requiresConfirmation: true)
- [x] Action buttons present

### Test 2: Add Initial Tasks with AI Estimation
**Prerequisites**: "Fitness App" project exists
**User Input**: "Add a task to design the home screen"
**Expected Behavior**:
- ✓ AI creates task with automatic time estimation (60-120 min)
- ✓ Task created without confirmation (requiresConfirmation: false)
- ✓ Learning opportunity appears asking "Does this time estimate feel right?"
- ✓ Action buttons: "Mark Complete", "Change Priority", "Edit Task"
- ✓ Suggested next actions provided
**Validation**:
- [ ] Task created in database with estimatedMinutes
- [ ] Learning opportunity with thumbs up/down
- [ ] Action buttons rendered
- [ ] 2-3 suggested next actions present

### Test 3: Set Up Milestone with Deadline
**Prerequisites**: "Fitness App" project exists
**User Input**: "Create a milestone for MVP launch by end of this week"
**Expected Behavior**:
- ✓ AI uses temporal context to calculate end of week date
- ✓ Creates milestone with correct dueDate (based on first_day_of_week setting)
- ✓ No confirmation required
- ✓ Success message with milestone name
**Validation**:
- [ ] Milestone created with dueDate = end of week
- [ ] Date calculated correctly based on user's first_day_of_week
- [ ] item_type = 'milestone' in database

### Test 4: Plan First Focus Session
**Prerequisites**: Project with 3+ tasks exists
**User Input**: "I have 90 minutes, what should I work on?"
**Expected Behavior**:
- ✓ AI uses `plan_session` action
- ✓ Returns session plan with task allocation
- ✓ Shows budgetMinutes: 90, totalUsedMinutes, slackMinutes
- ✓ Lists prioritized tasks with reasoning
- ✓ Action buttons: "Start Focus Session", "Change Time"
- ✓ Suggested actions for different time budgets
**Validation**:
- [ ] Session plan includes tasks from project
- [ ] Total time ≤ 90 minutes
- [ ] Each task shows scheduledMinutes and reasoning
- [ ] "Start Focus Session" button present

### Test 5: Complete Task and Provide Feedback
**Prerequisites**: Task "Design home screen" exists
**User Input**: "Mark the home screen design task as complete"
**Expected Behavior**:
- ✓ AI loads project context first (need_context)
- ✓ Then marks task complete using exact task ID
- ✓ Success message confirms completion
- ✓ Suggested next actions provided
**Validation**:
- [ ] Task status changed to 'completed'
- [ ] AI used correct task UUID (not placeholder)
- [ ] Context loaded before execution

---

## Workflow 2: Project Management (5 tests)

### Test 6: Create Project from Description
**Prerequisites**: None
**User Input**: "Start a new project called 'Website Redesign' with deadline December 31, 2026"
**Expected Behavior**:
- ✓ AI uses `preview_creation` action
- ✓ Shows project preview with name and deadline
- ✓ Requires confirmation
- ✓ Preview shows deadline date
**Validation**:
- [ ] Project preview includes name and deadline
- [ ] Confirmation required
- [ ] Deadline in ISO format

### Test 7: Bulk Task Creation
**Prerequisites**: "Website Redesign" project exists
**User Input**: "Add these tasks: wireframe homepage, design color scheme, write copy for about page, set up hosting"
**Expected Behavior**:
- ✓ AI uses `bulk_create_tasks` tool
- ✓ Creates all 4 tasks in one operation
- ✓ Each task has automatic time estimation
- ✓ No confirmation required (requiresConfirmation: false)
- ✓ Success message lists all created tasks
**Validation**:
- [ ] 4 tasks created in database
- [ ] Each has estimatedMinutes
- [ ] All linked to correct project_id
- [ ] Order values set correctly

### Test 8: Edit Project Deadline
**Prerequisites**: "Website Redesign" project exists with deadline
**User Input**: "Change the website redesign project deadline to January 15, 2027"
**Expected Behavior**:
- ✓ AI uses `edit_project` tool (NOT edit_milestone)
- ✓ Updates project deadline field
- ✓ Success message confirms update
- ✓ No confirmation required
**Validation**:
- [ ] Project deadline updated in database
- [ ] AI used edit_project, not edit_milestone
- [ ] Date in correct ISO format

### Test 9: Add Task Dependencies
**Prerequisites**: Tasks "wireframe homepage" and "design color scheme" exist
**User Input**: "The color scheme task depends on the wireframe being done first"
**Expected Behavior**:
- ✓ AI loads project context to get task IDs
- ✓ Uses `set_task_dependency` with correct UUIDs
- ✓ Sets depends_on_task field
- ✓ Success message explains dependency
**Validation**:
- [ ] depends_on_task field set correctly
- [ ] AI used actual task UUIDs from context
- [ ] No placeholder IDs used

### Test 10: Delete Completed Project
**Prerequisites**: "Website Redesign" project exists
**User Input**: "Delete the website redesign project"
**Expected Behavior**:
- ✓ AI requires confirmation (requiresConfirmation: true)
- ✓ Shows confirmation summary
- ✓ Displays "Delete" and "Cancel" buttons
- ✓ Warning about deleting all associated tasks
**Validation**:
- [ ] Confirmation required
- [ ] Delete button styled as danger (pink)
- [ ] Summary explains what will be deleted

---

## Workflow 3: Daily Work Session (5 tests)

### Test 11: Morning Planning
**Prerequisites**: Multiple projects with tasks
**User Input**: "What should I work on today?"
**Expected Behavior**:
- ✓ AI uses `plan_session` action
- ✓ Uses default session time (60 min from settings)
- ✓ Prioritizes overdue and high-priority tasks
- ✓ Shows session plan with reasoning
- ✓ Warnings if overdue tasks exist
**Validation**:
- [ ] Session plan generated
- [ ] Overdue tasks prioritized
- [ ] Warning banner for overdue items (if any)
- [ ] Reasoning explains prioritization

### Test 12: Session Planning with Specific Time
**Prerequisites**: Tasks exist across multiple projects
**User Input**: "Plan a 45 minute session"
**Expected Behavior**:
- ✓ AI uses `plan_session` with budgetMinutes: 45
- ✓ Allocates tasks within 45 minute budget
- ✓ May include partial tasks if allow_partial_tasks enabled
- ✓ Shows slack time remaining
**Validation**:
- [ ] totalUsedMinutes ≤ 45
- [ ] slackMinutes calculated correctly
- [ ] Partial tasks marked if applicable

### Test 13: Complete Task During Session
**Prerequisites**: Active session with planned tasks
**User Input**: "I finished the wireframe task"
**Expected Behavior**:
- ✓ AI loads context to find task
- ✓ Uses `mark_task_complete` with correct ID
- ✓ Success confirmation
- ✓ Suggested next action from session plan
**Validation**:
- [ ] Task marked complete
- [ ] Suggestions include next task from plan
- [ ] Correct task ID used

### Test 14: Handle Overdue Tasks
**Prerequisites**: Task with due_date in the past exists
**User Input**: "Show me my tasks"
**Expected Behavior**:
- ✓ AI loads project context
- ✓ Identifies overdue tasks
- ✓ Includes warning with severity: high
- ✓ Suggests rescheduling or completing
- ✓ Action buttons: "Defer Task", "Mark Complete"
**Validation**:
- [ ] Warning banner appears
- [ ] Severity marked as high
- [ ] Action buttons for overdue tasks
- [ ] Suggested actions to resolve

### Test 15: End of Day Review
**Prerequisites**: Some completed tasks today
**User Input**: "What did I accomplish today?"
**Expected Behavior**:
- ✓ AI responds with summary (action: respond)
- ✓ Lists completed tasks
- ✓ Calculates total time spent
- ✓ Suggests planning for tomorrow
**Validation**:
- [ ] Completed tasks listed
- [ ] Summary is helpful and concise
- [ ] Suggested next actions for tomorrow

---

## Workflow 4: Research & Planning (5 tests)

### Test 16: Request Research for Technology
**Prerequisites**: Allow research enabled in settings
**User Input**: "What's the best architecture for a React Native fitness app?"
**Expected Behavior**:
- ✓ AI uses `research_required` action
- ✓ Shows research query to be executed
- ✓ Action buttons: "Approve Research (100 cr)", "Skip Research"
- ✓ Explains research will use Perplexity
**Validation**:
- [ ] research_query field populated
- [ ] Action buttons with credit cost shown
- [ ] User approval required before research

### Test 17: Create Tasks Based on Research
**Prerequisites**: Research completed on React Native architecture
**User Input**: "Create tasks based on that research"
**Expected Behavior**:
- ✓ AI uses research results to suggest tasks
- ✓ Uses `bulk_create_tasks` with researched items
- ✓ Each task has estimated time
- ✓ Tasks reflect research findings
**Validation**:
- [ ] Tasks created match research topics
- [ ] Time estimates appropriate for complexity
- [ ] Metadata shows researchPerformed: true

### Test 18: Plan Complex Project with AI
**Prerequisites**: None
**User Input**: "Help me plan a 3-month e-commerce project with milestones"
**Expected Behavior**:
- ✓ AI creates project via preview_creation
- ✓ Suggests milestones for each month
- ✓ Creates initial task breakdown
- ✓ Sets realistic deadlines using temporal context
**Validation**:
- [ ] Project created with 3-month deadline
- [ ] Milestones spaced appropriately
- [ ] Tasks organized by milestone
- [ ] Deadlines use temporal awareness

### Test 19: Time-Aware Deadline Setting
**Prerequisites**: Project exists
**User Input**: "Set the API integration task deadline to next Monday"
**Expected Behavior**:
- ✓ AI calculates next Monday from current date
- ✓ Uses first_day_of_week setting for calculation
- ✓ Sets task due_date correctly
- ✓ Confirms with human-readable date
**Validation**:
- [ ] due_date is next Monday
- [ ] Calculation respects first_day_of_week
- [ ] Date in ISO format in database
- [ ] Confirmation shows readable date

### Test 20: Complex Dependency Management
**Prerequisites**: Project with 5+ tasks
**User Input**: "The deployment task should depend on testing, which depends on development"
**Expected Behavior**:
- ✓ AI loads project context
- ✓ Sets up dependency chain correctly
- ✓ Uses multiple `set_task_dependency` calls
- ✓ Warns if circular dependencies detected
**Validation**:
- [ ] Dependencies set correctly
- [ ] No circular dependencies created
- [ ] Warning if conflict detected
- [ ] All task IDs are real UUIDs

---

# PART 2: FEATURE-SPECIFIC TESTS

## Project Operations (5 tests)

### Test 21: Create Project with All Parameters
**Prerequisites**: None
**User Input**: "Create a project called 'Marketing Campaign' with description 'Q1 2027 launch campaign', deadline March 31 2027, and blue color"
**Expected Behavior**:
- ✓ AI uses preview_creation
- ✓ Preview shows all parameters
- ✓ Color, deadline, description all included
- ✓ Requires confirmation
**Validation**:
- [ ] All fields in preview
- [ ] Color code or name shown
- [ ] Deadline formatted correctly

### Test 22: Edit Project Name
**Prerequisites**: "Marketing Campaign" project exists
**User Input**: "Rename the marketing campaign project to 'Q1 Product Launch'"
**Expected Behavior**:
- ✓ AI uses `edit_project` with name update
- ✓ Success message with new name
- ✓ No confirmation required
**Validation**:
- [ ] Project name updated
- [ ] edit_project tool used
- [ ] Success message accurate

### Test 23: Change Project Status
**Prerequisites**: Project exists with status 'active'
**User Input**: "Pause the Q1 Product Launch project"
**Expected Behavior**:
- ✓ AI uses `edit_project` with status: 'paused'
- ✓ Confirms status change
- ✓ Explains what paused means
**Validation**:
- [ ] Status changed to 'paused'
- [ ] Project still accessible
- [ ] Status reflected in UI

### Test 24: Edit Project Color
**Prerequisites**: Project exists
**User Input**: "Change the project color to yellow"
**Expected Behavior**:
- ✓ AI uses `edit_project` with color update
- ✓ Converts color name to hex code
- ✓ Success confirmation
**Validation**:
- [ ] Color updated in database
- [ ] Hex code format used
- [ ] UI reflects new color

### Test 25: AI Refuses Non-Existent Project Edit
**Prerequisites**: No project named "Fake Project"
**User Input**: "Update the deadline for the Fake Project"
**Expected Behavior**:
- ✓ AI responds with error (action: respond)
- ✓ Explains project doesn't exist
- ✓ Suggests listing available projects
- ✓ No tool execution attempted
**Validation**:
- [ ] No database changes
- [ ] Error message clear
- [ ] Helpful suggestions provided

---

## Task Operations (8 tests)

### Test 26: Create Task with All Parameters
**Prerequisites**: Project exists
**User Input**: "Add a high priority task 'Write API documentation' with 120 minute estimate, due tomorrow, description 'Document all REST endpoints'"
**Expected Behavior**:
- ✓ AI creates task with all fields
- ✓ priority: true
- ✓ estimatedMinutes: 120
- ✓ dueDate: tomorrow (calculated)
- ✓ description included
- ✓ Learning opportunity for time estimate
**Validation**:
- [ ] All fields set correctly
- [ ] Tomorrow calculated from temporal context
- [ ] Priority boolean is true
- [ ] Learning opportunity present

### Test 27: Create Simple Task (Minimal Parameters)
**Prerequisites**: Project exists
**User Input**: "Add task: review pull requests"
**Expected Behavior**:
- ✓ AI creates task with title only
- ✓ Automatically estimates time (15-30 min)
- ✓ priority defaults to false
- ✓ No due date set
**Validation**:
- [ ] Task created with title
- [ ] estimatedMinutes auto-assigned
- [ ] priority: false
- [ ] due_date: null

### Test 28: Bulk Create with Different Priorities
**Prerequisites**: Project exists
**User Input**: "Add these tasks: 'Setup CI/CD' (high priority), 'Update README', 'Refactor auth module' (high priority)"
**Expected Behavior**:
- ✓ AI uses `bulk_create_tasks`
- ✓ Correctly sets priority: true for specified tasks
- ✓ priority: false for others
- ✓ All tasks get time estimates
**Validation**:
- [ ] 3 tasks created
- [ ] Priority set correctly per task
- [ ] All have estimatedMinutes
- [ ] Order values sequential

### Test 29: Edit Task Title and Description
**Prerequisites**: Task "review pull requests" exists
**User Input**: "Change the PR review task to 'Code review for authentication module' with description 'Focus on security best practices'"
**Expected Behavior**:
- ✓ AI loads context to get task ID
- ✓ Uses `edit_task` with updates
- ✓ Updates both title and description
- ✓ Success message with new title
**Validation**:
- [ ] Title updated
- [ ] Description updated
- [ ] Correct task ID used
- [ ] Context loaded first

### Test 30: Edit Task Deadline
**Prerequisites**: Task exists
**User Input**: "Move the API documentation task deadline to end of this week"
**Expected Behavior**:
- ✓ AI calculates end of week date
- ✓ Uses `edit_task` with dueDate update
- ✓ Temporal context used for calculation
**Validation**:
- [ ] due_date updated correctly
- [ ] End of week calculated properly
- [ ] ISO format used

### Test 31: Change Task Priority
**Prerequisites**: Task with priority: false exists
**User Input**: "Make the refactor auth module task high priority"
**Expected Behavior**:
- ✓ AI loads context
- ✓ Uses `edit_task` with priority: true
- ✓ Confirms priority change
**Validation**:
- [ ] priority changed to true
- [ ] Correct task updated
- [ ] Success message clear

### Test 32: Delete Task with Confirmation
**Prerequisites**: Task exists
**User Input**: "Delete the README update task"
**Expected Behavior**:
- ✓ AI loads context for task ID
- ✓ Uses `delete_task` with requiresConfirmation: true
- ✓ Shows confirmation dialog
- ✓ "Delete" button in danger style
**Validation**:
- [ ] Confirmation required
- [ ] Task name shown in summary
- [ ] Delete button styled as danger
- [ ] Cancel option available

### Test 33: AI Refuses Edit Without Context
**Prerequisites**: Project exists but context not loaded
**User Input**: "Edit the first task in the project"
**Expected Behavior**:
- ✓ AI uses `need_context` action first
- ✓ Loads project details
- ✓ Then asks for clarification on which task
- ✓ Does not attempt edit without specific task
**Validation**:
- [ ] Context loaded
- [ ] No premature edit attempt
- [ ] AI asks for clarification
- [ ] No placeholder IDs used

---

## Milestone Operations (3 tests)

### Test 34: Create Milestone with Due Date
**Prerequisites**: Project exists
**User Input**: "Create milestone 'Beta Release' due February 15, 2027"
**Expected Behavior**:
- ✓ AI uses `create_milestone`
- ✓ Sets dueDate (not deadline)
- ✓ item_type: 'milestone'
- ✓ Success message with milestone name
**Validation**:
- [ ] Milestone created
- [ ] dueDate field set
- [ ] item_type is 'milestone'
- [ ] Linked to correct project

### Test 35: Edit Milestone Due Date
**Prerequisites**: Milestone "Beta Release" exists
**User Input**: "Move the beta release milestone to February 28"
**Expected Behavior**:
- ✓ AI loads context
- ✓ Uses `edit_milestone` (NOT edit_project)
- ✓ Updates dueDate field
- ✓ Confirms with milestone name
**Validation**:
- [ ] dueDate updated
- [ ] edit_milestone tool used
- [ ] Correct milestone ID used
- [ ] No confusion with project deadline

### Test 36: Delete Milestone with Confirmation
**Prerequisites**: Milestone exists
**User Input**: "Remove the beta release milestone"
**Expected Behavior**:
- ✓ AI uses `delete_milestone`
- ✓ Requires confirmation
- ✓ Shows milestone name in summary
- ✓ Delete button available
**Validation**:
- [ ] Confirmation dialog shown
- [ ] Milestone name displayed
- [ ] requiresConfirmation: true
- [ ] Danger styling on delete button

---

## Memory Operations (2 tests)

### Test 37: Add Memory to Project
**Prerequisites**: Project exists
**User Input**: "Remember that this project uses TypeScript and React"
**Expected Behavior**:
- ✓ AI uses `add_memory` tool
- ✓ Saves content to ai_memory table
- ✓ Links to current project
- ✓ Success message confirms save
**Validation**:
- [ ] Memory created in database
- [ ] Linked to correct project_id
- [ ] Content saved accurately
- [ ] No confirmation required

### Test 38: Remove Memory with Confirmation
**Prerequisites**: Memory exists in project
**User Input**: "Delete the memory about TypeScript and React"
**Expected Behavior**:
- ✓ AI loads project context including memories
- ✓ Uses `remove_memory` with correct ID
- ✓ Requires confirmation
- ✓ Shows memory content in summary
**Validation**:
- [ ] Confirmation required
- [ ] Memory content shown
- [ ] Correct memory ID used
- [ ] Delete button available

---

## AI Agent Features (7 tests)

### Test 39: Session Planning with Multiple Projects
**Prerequisites**: 3+ projects with tasks
**User Input**: "I have 2 hours, plan my work"
**Expected Behavior**:
- ✓ AI uses `plan_session` with budgetMinutes: 120
- ✓ Selects tasks across projects
- ✓ Prioritizes by deadline and priority
- ✓ Shows project names with tasks
- ✓ Reasoning explains selections
**Validation**:
- [ ] Session plan includes multiple projects
- [ ] Total time ≤ 120 minutes
- [ ] Each task shows project context
- [ ] Reasoning provided per task
- [ ] Metadata: plannerExecuted: true

### Test 40: Temporal Awareness - End of Week
**Prerequisites**: Current date known, first_day_of_week set
**User Input**: "Create a task due by end of week"
**Expected Behavior**:
- ✓ AI calculates end of week from temporal context
- ✓ Uses $endOfWeek variable
- ✓ Sets correct date based on first_day_of_week
- ✓ Confirms with human-readable date
**Validation**:
- [ ] Date matches end of current week
- [ ] Respects first_day_of_week setting
- [ ] ISO format in database
- [ ] Human-readable in message

### Test 41: Temporal Awareness - Tomorrow
**Prerequisites**: Current date known
**User Input**: "Schedule the deployment for tomorrow"
**Expected Behavior**:
- ✓ AI calculates tomorrow from $date
- ✓ Sets task due_date correctly
- ✓ Confirms with readable date
**Validation**:
- [ ] Date is exactly 1 day after current date
- [ ] Calculation accurate
- [ ] ISO format used

### Test 42: Web Research Trigger
**Prerequisites**: Allow research enabled
**User Input**: "What are the best practices for React performance optimization?"
**Expected Behavior**:
- ✓ AI uses `research_required` action
- ✓ Sets research_query appropriately
- ✓ Action buttons: "Approve Research", "Skip Research"
- ✓ Shows credit cost (100 cr)
- ✓ Explains Perplexity will be used
**Validation**:
- [ ] research_query field set
- [ ] Action buttons present
- [ ] Credit cost displayed
- [ ] User approval required

### Test 43: Action Buttons for Task Creation
**Prerequisites**: None
**User Input**: "Add task to implement user authentication"
**Expected Behavior**:
- ✓ Task created successfully
- ✓ action_buttons array includes:
  - "Mark Complete" (success style)
  - "Change Priority" (secondary style)
  - "Edit Task" (secondary style)
- ✓ Each button has proper context
**Validation**:
- [ ] 3+ action buttons present
- [ ] Correct styles applied
- [ ] Context includes task ID
- [ ] Buttons functional

### Test 44: Suggested Next Actions
**Prerequisites**: Any AI response
**User Input**: "Show my projects"
**Expected Behavior**:
- ✓ AI responds with project list
- ✓ suggested_next_actions array includes 2-3 items
- ✓ Suggestions are contextual and helpful
- ✓ Each has label and prompt
**Validation**:
- [ ] 2-3 suggestions present
- [ ] Labels are clear
- [ ] Prompts are actionable
- [ ] Contextually relevant

### Test 45: Warnings for Deadline Conflicts
**Prerequisites**: Task A depends on Task B, but Task A due before Task B
**User Input**: "Show me the project status"
**Expected Behavior**:
- ✓ AI loads context
- ✓ Detects deadline conflict
- ✓ warnings array includes conflict warning
- ✓ severity: high or medium
- ✓ Explains the conflict clearly
**Validation**:
- [ ] Warning detected
- [ ] Severity appropriate
- [ ] Message explains conflict
- [ ] Suggests resolution

---

# PART 3: EDGE CASES & ERROR HANDLING

## Context & Validation (4 tests)

### Test 46: AI Requests Context Before Editing
**Prerequisites**: Project exists but not loaded
**User Input**: "Edit the second task"
**Expected Behavior**:
- ✓ AI uses `need_context` action
- ✓ Loads project details
- ✓ Then responds asking which task specifically
- ✓ Does not attempt edit without context
**Validation**:
- [ ] need_context action used
- [ ] Project context loaded
- [ ] No premature edit
- [ ] AI asks for clarification

### Test 47: AI Refuses Action Without Proper Tool
**Prerequisites**: None
**User Input**: "Send an email to the team"
**Expected Behavior**:
- ✓ AI responds with action: respond
- ✓ Explains it cannot send emails
- ✓ Suggests alternatives (create task to send email)
- ✓ No tool execution attempted
**Validation**:
- [ ] Polite refusal
- [ ] Explanation provided
- [ ] Alternative suggested
- [ ] No error thrown

### Test 48: AI Handles Missing Required Parameters
**Prerequisites**: Project exists
**User Input**: "Create a task"
**Expected Behavior**:
- ✓ AI responds asking for task title
- ✓ Does not create task without title
- ✓ Suggests what information is needed
**Validation**:
- [ ] No task created
- [ ] AI asks for required info
- [ ] Helpful guidance provided

### Test 49: AI Validates Date Formats
**Prerequisites**: Project exists
**User Input**: "Set task deadline to 'next week sometime'"
**Expected Behavior**:
- ✓ AI interprets "next week" using temporal context
- ✓ Asks for specific day if ambiguous
- ✓ Suggests specific dates
- ✓ Does not set invalid date
**Validation**:
- [ ] No invalid date set
- [ ] AI seeks clarification
- [ ] Temporal context used
- [ ] Suggestions provided

---

## Confirmation Flows (3 tests)

### Test 50: Delete Operation Requires Confirmation
**Prerequisites**: Task exists
**User Input**: "Delete the authentication task"
**Expected Behavior**:
- ✓ AI uses execute_tools with requiresConfirmation: true
- ✓ Confirmation dialog appears
- ✓ Shows task name in summary
- ✓ "Delete" button in danger style (pink)
- ✓ "Cancel" button available
**Validation**:
- [ ] Confirmation required
- [ ] Task not deleted until confirmed
- [ ] UI shows confirmation dialog
- [ ] Both buttons present

### Test 51: Project Creation Shows Preview
**Prerequisites**: None
**User Input**: "Create project 'Mobile App Redesign' with 10 initial tasks"
**Expected Behavior**:
- ✓ AI uses preview_creation action
- ✓ Shows project name
- ✓ Lists up to 6 tasks in preview
- ✓ Shows "+X more tasks" if > 6
- ✓ "Create everything" button
- ✓ "Cancel" button
**Validation**:
- [ ] Preview displayed
- [ ] Task count accurate
- [ ] Truncation if > 6 tasks
- [ ] Confirmation required
- [ ] Nothing created until confirmed

### Test 52: Bulk Operations Show Summary
**Prerequisites**: Project exists
**User Input**: "Create 5 tasks for the onboarding flow"
**Expected Behavior**:
- ✓ AI uses bulk_create_tasks
- ✓ Creates all tasks
- ✓ Success message shows count
- ✓ Lists task names
- ✓ No confirmation required (non-destructive)
**Validation**:
- [ ] All 5 tasks created
- [ ] Summary message clear
- [ ] Task names listed
- [ ] Auto-executed without confirmation

---

## Error Scenarios (3 tests)

### Test 53: Invalid Project ID
**Prerequisites**: None
**User Input**: "Edit project with ID abc-123"
**Expected Behavior**:
- ✓ AI attempts to use edit_project
- ✓ Supabase returns 0 rows error
- ✓ AI shows error message (not success)
- ✓ Suggests listing available projects
- ✓ No action buttons on error
**Validation**:
- [ ] Error message displayed
- [ ] No success message shown
- [ ] Helpful suggestion provided
- [ ] No action buttons on error

### Test 54: Conflicting Deadlines
**Prerequisites**: Task A depends on Task B
**User Input**: "Set Task A deadline to tomorrow and Task B deadline to next week"
**Expected Behavior**:
- ✓ AI detects conflict
- ✓ warnings array includes deadline conflict
- ✓ severity: high
- ✓ Explains Task A cannot complete before Task B
- ✓ Suggests reordering or adjusting dates
**Validation**:
- [ ] Warning displayed
- [ ] Conflict explained clearly
- [ ] Suggestions provided
- [ ] Both tasks still updated (warning only)

### Test 55: Missing Dependencies
**Prerequisites**: Complex project with multiple tasks
**User Input**: "The testing task should run after development"
**Expected Behavior**:
- ✓ AI loads context
- ✓ Identifies both tasks
- ✓ Sets dependency correctly
- ✓ If development task doesn't exist, suggests creating it
**Validation**:
- [ ] Dependency set if both exist
- [ ] Helpful error if task missing
- [ ] Suggestion to create missing task
- [ ] No invalid dependency created

---

## Additional Edge Cases (5+ tests)

### Test 56: Research When Disabled
**Prerequisites**: Allow research disabled in settings
**User Input**: "What's the best database for my app?"
**Expected Behavior**:
- ✓ AI responds without triggering research
- ✓ Uses general knowledge
- ✓ Explains research is disabled
- ✓ Suggests enabling in settings
**Validation**:
- [ ] No research_required action
- [ ] Helpful response still provided
- [ ] Settings mentioned
- [ ] No error thrown

### Test 57: Session Planning with No Tasks
**Prerequisites**: Project exists with no tasks
**User Input**: "Plan a session"
**Expected Behavior**:
- ✓ AI responds explaining no tasks available
- ✓ Suggests creating tasks first
- ✓ No session plan generated
**Validation**:
- [ ] Helpful error message
- [ ] Suggestion to create tasks
- [ ] No empty session plan

### Test 58: Partial Task Allocation
**Prerequisites**: allow_partial_tasks enabled, task estimated at 90 min
**User Input**: "Plan a 60 minute session"
**Expected Behavior**:
- ✓ AI includes task as partial
- ✓ scheduledMinutes: 60
- ✓ partial: true
- ✓ Explains remaining 30 min for later
**Validation**:
- [ ] Task marked as partial
- [ ] Correct time allocation
- [ ] Reasoning explains partial completion

### Test 59: Learning Opportunity Feedback
**Prerequisites**: Task created with time estimate
**User Input**: *User clicks thumbs up on learning opportunity*
**Expected Behavior**:
- ✓ Feedback sent to /api/ai/estimation-feedback
- ✓ user_confirmed: true in database
- ✓ Learning opportunity dismissed
- ✓ "Thanks for feedback" message
**Validation**:
- [ ] Database updated
- [ ] UI shows confirmation
- [ ] Learning opportunity removed
- [ ] Feedback recorded

### Test 60: Action Button Execution
**Prerequisites**: Task created with action buttons
**User Input**: *User clicks "Mark Complete" button*
**Expected Behavior**:
- ✓ Request sent to /api/ai/action-button
- ✓ Task marked complete
- ✓ Button removed from message
- ✓ Success feedback shown
**Validation**:
- [ ] Task status updated
- [ ] Button disappears
- [ ] Success message shown
- [ ] Database reflects change

---

## Test Execution Guide

### How to Run These Tests

1. **Manual Testing**: Go through each test sequentially, entering the exact user input
2. **Validation**: Check each validation item after AI response
3. **Database Verification**: Use Supabase dashboard to confirm data changes
4. **UI Verification**: Confirm action buttons, warnings, and suggestions appear
5. **Error Checking**: Browser console should show no errors

### Success Criteria

- ✅ All 60 tests pass validation
- ✅ No placeholder IDs used (all UUIDs from context)
- ✅ Confirmations required only for destructive actions
- ✅ Action buttons present on all relevant responses
- ✅ Suggested next actions always provided (2-3 items)
- ✅ Temporal awareness working correctly
- ✅ Research integration functional
- ✅ Session planning accurate
- ✅ Error messages clear and helpful
- ✅ No success messages on failed operations

### Common Issues to Watch For

- ⚠️ AI using placeholder task IDs instead of loading context
- ⚠️ Confirmation required for non-destructive actions
- ⚠️ Missing action buttons or suggestions
- ⚠️ Incorrect date calculations (temporal awareness)
- ⚠️ Success messages shown when tools fail
- ⚠️ Wrong tool used (edit_milestone vs edit_project)
- ⚠️ Missing time estimates on tasks
- ⚠️ No learning opportunities after task creation

---

## Coverage Summary

**Total Tests**: 60+
**CRUD Operations**: 25 tests
**AI Agent Features**: 15 tests
**Workflows**: 20 tests
**Edge Cases**: 15+ tests

**Tools Covered**:
- ✅ create_task
- ✅ edit_task
- ✅ delete_task
- ✅ bulk_create_tasks
- ✅ create_milestone
- ✅ edit_milestone
- ✅ delete_milestone
- ✅ create_project
- ✅ edit_project
- ✅ add_memory
- ✅ remove_memory
- ✅ mark_task_complete
- ✅ set_task_dependency
- ✅ load_project_context

**Actions Covered**:
- ✅ need_context
- ✅ respond
- ✅ execute_tools
- ✅ preview_creation
- ✅ plan_session
- ✅ research_required

**AI Agent Rules Tested**:
- ✅ Task estimation (Rule 14)
- ✅ Time awareness (Rule 15)
- ✅ Action buttons (Rule 16)
- ✅ Suggested actions (Rule 17)
- ✅ Warnings (Rule 18)
- ✅ Learning opportunities (Rule 19)
- ✅ Research triggers (Rule 20)
- ✅ Session planning (Rule 21)
- ✅ Project vs milestone distinction (Rule 22)
