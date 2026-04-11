# Testing the AI Chat Fix

## Quick Test Guide

### Prerequisites
1. Have a project in your database called "FINA 210" with deadline on March 31
2. Open the chat page at `/chat`
3. Open browser console (F12) to see debug logs

### Test Case 1: Original Issue
**Input:**
```
add tasks of studying topics 5,6,7,8 for fina 210 project;
each topic takes 90 minutes; put the deadline of the project and the tasks on 17 april
```

**Expected Behavior:**
- ✅ No JSON displayed in chat UI
- ✅ Status messages appear: "✓ Created 4 tasks" and "✓ Updated project: FINA 210"
- ✅ 4 tasks created with titles: "Study Topic 5", "Study Topic 6", "Study Topic 7", "Study Topic 8"
- ✅ Each task has `estimatedMinutes: 90`
- ✅ Each task has `dueDate: 2026-04-17T23:59:59Z`
- ✅ Project deadline updated to `2026-04-17T23:59:59Z`

**Console Logs to Check:**
```
[AI Response Parser] Raw response length: ...
[AI Response Parser] First 200 chars: ...
[AI Response Parser] Parsed action: execute_tools
[Chat API] AI raw response length: ...
[Chat API] Parsed AI action: execute_tools
```

**If AI Misbehaves (but fix works):**
```
[AI Response Parser] Found text before JSON, stripping: ...
[AI Response Parser] Detected nested JSON in respond message (raw), extracting actual response
[Chat API] ⚠️ AI VIOLATED FORMAT: Returned execute_tools wrapped in respond action
```

### Test Case 2: Simple Task Creation
**Input:**
```
add a task to review lecture notes for fina 210
```

**Expected Behavior:**
- ✅ Task created immediately
- ✅ Status message: "✓ Created task: Review lecture notes"
- ✅ Task has automatic time estimate (15-30 min)

### Test Case 3: Edit Project Deadline
**Input:**
```
change the fina 210 project deadline to april 30
```

**Expected Behavior:**
- ✅ Project deadline updated
- ✅ Status message: "✓ Updated project: FINA 210"
- ✅ No confirmation required

## What to Look For

### ✅ Success Indicators
1. **No JSON in chat**: You should never see raw JSON displayed as a message
2. **Green checkmarks**: Status messages with ✓ appear
3. **Immediate execution**: Tools run without asking for confirmation (for non-destructive actions)
4. **Database changes**: Tasks/projects actually created/updated

### ❌ Failure Indicators
1. **JSON displayed**: Raw JSON appears as a chat message
2. **No status messages**: No "✓ Created..." messages appear
3. **No database changes**: Tasks/projects not created/updated
4. **Console errors**: Red errors in console about parsing

## Debug Console Logs

### Normal Flow (AI Behaves Correctly)
```
[AI Response Parser] Raw response length: 450
[AI Response Parser] First 200 chars: {"action":"execute_tools","message":"Adding study tasks...
[AI Response Parser] Parsed action: execute_tools
[Chat API] AI raw response length: 450
[Chat API] AI raw response preview: {"action":"execute_tools"...
[Chat API] Parsed AI action: execute_tools
```

### Recovery Flow (AI Misbehaves, Parser Fixes)
```
[AI Response Parser] Raw response length: 520
[AI Response Parser] First 200 chars: To add these study tasks: {"action":"execute_tools"...
[AI Response Parser] Found text before JSON, stripping: To add these study tasks: 
[AI Response Parser] Parsed action: execute_tools
[Chat API] Parsed AI action: execute_tools
```

### Nested JSON Recovery
```
[AI Response Parser] Parsed action: respond
[AI Response Parser] Detected nested JSON in respond message (raw), extracting actual response
[Chat API] ⚠️ AI VIOLATED FORMAT: Returned execute_tools wrapped in respond action
[Chat API] Parsed AI action: execute_tools
```

## Troubleshooting

### Issue: Still seeing JSON in chat
**Check:**
1. Console logs - what does `[AI Response Parser] Parsed action:` show?
2. Is it showing `respond` instead of `execute_tools`?
3. Are there any parser warnings about nested JSON?

**Solution:**
- If parser shows `respond`, the nested JSON extraction failed
- Check the raw response in console to see the exact format
- May need to enhance parser further for that specific format

### Issue: Tools not executing
**Check:**
1. Does console show `Parsed AI action: execute_tools`?
2. Are there any errors in the console?
3. Check Network tab for `/api/chat` response

**Solution:**
- If action is correct but tools don't execute, issue is in the execution pipeline
- Check `src/app/api/chat/route.ts` around line 267-316 (execute_tools handler)

### Issue: Format violation warnings
**This is OK!** The warnings mean:
- AI is still wrapping JSON incorrectly
- BUT the parser successfully extracted it
- Tools should still execute correctly

**To fix long-term:**
- The system prompt may need further strengthening
- Or the AI provider/model may need adjustment

## Next Steps

If tests pass:
1. ✅ Mark the issue as resolved
2. ✅ Monitor console logs for format violations
3. ✅ If violations are frequent, consider adjusting AI provider settings

If tests fail:
1. ❌ Check console logs for exact error
2. ❌ Share the raw response from console
3. ❌ May need to enhance parser for new edge case
