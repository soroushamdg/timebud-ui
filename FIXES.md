# AI Chat Fix - Tool Execution Issue

## Problem
The AI chatbot was returning properly formatted JSON with `execute_tools` action but displaying it as text in the chat UI instead of executing the tools. When users sent messages like:

> "add tasks of studying topics 5,6,7,8 for fina 210 project; each topic takes 90 minutes; put the deadline of the project and the tasks on 17 april"

The AI would return a valid JSON response with `bulk_create_tasks` and `edit_project` tools, but instead of executing them, it would display the JSON as a message.

## Root Cause
The AI model was wrapping the JSON response in one of these problematic formats:
1. Adding explanatory text before the JSON: `"To add these tasks: {...}"`
2. Wrapping in markdown code blocks: `` ```json\n{...}\n``` ``
3. Nesting the execute_tools JSON inside a respond action's message field

The existing parser had some handling for nested JSON, but wasn't catching all cases.

## Solution Implemented

### 1. Enhanced Response Parser (`src/lib/ai/response.ts`)
**Changes:**
- Added aggressive text stripping: finds the first `{` character and removes everything before it
- Improved nested JSON detection: now checks for both markdown code blocks AND raw JSON objects
- Added comprehensive logging with `[AI Response Parser]` prefix to help debug issues
- Better error messages showing what went wrong

**Key improvements:**
```typescript
// Strip any explanatory text before the JSON object
const firstBraceIndex = trimmed.indexOf("{");
if (firstBraceIndex > 0) {
  console.log("[AI Response Parser] Found text before JSON, stripping:", trimmed.substring(0, firstBraceIndex));
  trimmed = trimmed.substring(firstBraceIndex);
}

// Extract raw JSON from respond messages (not just code blocks)
const jsonObjectMatch = parsed.message.match(/(\{[\s\S]*\})/);
if (jsonObjectMatch) {
  const extractedParsed = JSON.parse(jsonObjectMatch[1].trim());
  if (extractedParsed.action && isValidAction(extractedParsed.action)) {
    return extractedParsed as AIResponse;
  }
}
```

### 2. Strengthened System Prompt (`prompts/system-prompt.md`)
**Changes:**
- Added explicit "ANTI-PATTERNS" section showing what NOT to do
- Added examples of wrong vs. correct responses
- Special emphasis on `execute_tools` action not being wrapped
- More prominent formatting rules

**New section:**
```markdown
ANTI-PATTERNS (DO NOT DO THIS):
❌ WRONG: "Here's the response: {\"action\": \"respond\", ...}"
❌ WRONG: "```json\n{\"action\": \"respond\", ...}\n```"
❌ WRONG: "{\"action\": \"respond\", \"message\": \"{\\\"action\\\": \\\"execute_tools\\\", ...}\"}"
❌ WRONG: "To add these tasks: {\"action\": \"execute_tools\", ...}"

✅ CORRECT: {"action": "execute_tools", "message": "Adding tasks", "tools": [...], "requiresConfirmation": false}

ESPECIALLY FOR execute_tools ACTION:
When you want to execute tools, return the execute_tools JSON directly. DO NOT wrap it in a respond action.
DO NOT put the execute_tools JSON inside a message field.
DO NOT add any text before or after the JSON.
```

### 3. Added Debug Logging (`src/app/api/chat/route.ts`)
**Changes:**
- Log raw AI response length and preview
- Log parsed action type
- Detect and warn when AI violates format (execute_tools wrapped in respond)

**New logging:**
```typescript
console.log('[Chat API] AI raw response length:', rawResponse.length)
console.log('[Chat API] AI raw response preview:', rawResponse.substring(0, 300))
console.log('[Chat API] Parsed AI action:', aiResponse.action)

// Detect format violations
if (aiResponse.action === 'respond' && aiResponse.message) {
  const msgPreview = aiResponse.message.substring(0, 100)
  if (msgPreview.includes('"action"') && msgPreview.includes('"execute_tools"')) {
    console.error('[Chat API] ⚠️ AI VIOLATED FORMAT: Returned execute_tools wrapped in respond action')
  }
}
```

## Expected Behavior After Fix

### Before Fix:
1. User sends: "add tasks for topics 5,6,7,8..."
2. AI returns JSON as text message in chat
3. User sees the raw JSON displayed
4. No tools execute, no tasks created

### After Fix:
1. User sends: "add tasks for topics 5,6,7,8..."
2. AI returns execute_tools JSON (even if wrapped)
3. Parser extracts the actual JSON from any wrapping
4. Tools execute automatically (requiresConfirmation: false)
5. User sees status messages: "✓ Created 4 tasks" and "✓ Updated project: FINA 210"
6. Tasks appear in the project immediately

## Testing

To verify the fix works:

1. **Test the original scenario:**
   ```
   "add tasks of studying topics 5,6,7,8 for fina 210 project; 
   each topic takes 90 minutes; put the deadline of the project 
   and the tasks on 17 april"
   ```
   
2. **Expected result:**
   - 4 tasks created (Study Topic 5, 6, 7, 8)
   - Each task has 90 minutes estimated time
   - Each task has due date of April 17, 2026
   - Project deadline updated to April 17, 2026
   - Status messages shown in chat
   - No JSON displayed as text

3. **Check browser console:**
   - Look for `[AI Response Parser]` logs
   - Look for `[Chat API]` logs
   - Should NOT see format violation warnings if AI behaves correctly
   - Should see extraction warnings if AI misbehaves but parser recovers

## Debugging

If the issue persists, check browser console for:

1. **`[AI Response Parser] Raw response length:`** - Shows what the AI actually returned
2. **`[AI Response Parser] First 200 chars:`** - Preview of the response
3. **`[AI Response Parser] Parsed action:`** - What action was detected
4. **`[Chat API] ⚠️ AI VIOLATED FORMAT:`** - AI wrapped execute_tools in respond

These logs will help identify if:
- The AI is still violating format (needs prompt adjustment)
- The parser is failing to extract nested JSON (needs parser improvement)
- The issue is elsewhere in the execution pipeline

## Files Modified

1. `/Users/soro/Documents/Development/timebud/timebud-ui/src/lib/ai/response.ts`
2. `/Users/soro/Documents/Development/timebud/timebud-ui/prompts/system-prompt.md`
3. `/Users/soro/Documents/Development/timebud/timebud-ui/src/app/api/chat/route.ts`

## Related Test Cases

See `prompts/ai-chat-test-cases.md`:
- Test 7: Bulk Task Creation
- Test 8: Edit Project Deadline
- Test 52: Bulk Operations Show Summary
