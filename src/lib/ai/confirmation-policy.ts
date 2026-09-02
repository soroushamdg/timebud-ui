// Whether a turn's tool calls need the user to click Confirm before anything runs is
// decided HERE, in code — never by trusting the model's own judgment. Previously this
// was a `requiresConfirmation` boolean the model set itself in its JSON response, per
// prompt instructions alone; a single prompt-compliance slip could silently start
// auto-executing deletes. This is defense in depth: even if the system prompt is wrong
// or the model ignores it, these rules still hold.

export interface PendingToolCall {
  id: string
  name: string
  input: Record<string, any>
}

const ALWAYS_CONFIRM = new Set(['delete_task', 'delete_milestone', 'remove_memory', 'create_project'])

const BULK_CREATE_CONFIRM_THRESHOLD = 8
const MULTI_EDIT_CONFIRM_THRESHOLD = 3
const EDIT_TOOL_NAMES = new Set(['edit_task', 'edit_project', 'edit_milestone'])

function editTargetId(call: PendingToolCall): string | undefined {
  return call.input?.taskId || call.input?.projectId || call.input?.milestoneId
}

/**
 * True if ANY tool call in this batch crosses a confirmation-tier rule. Confirmation is
 * all-or-nothing for the batch (matches the existing one-card review UX) — we don't
 * auto-execute part of a turn while holding back the rest, since a mix of "already
 * happened" and "still pending" is exactly the kind of ambiguity this whole rewrite
 * exists to remove.
 */
export function turnRequiresConfirmation(calls: PendingToolCall[]): boolean {
  if (calls.some((c) => ALWAYS_CONFIRM.has(c.name))) return true

  if (
    calls.some(
      (c) => c.name === 'bulk_create_tasks' && Array.isArray(c.input?.tasks) && c.input.tasks.length > BULK_CREATE_CONFIRM_THRESHOLD
    )
  ) {
    return true
  }

  // A single turn that edits more than a few distinct existing records (e.g. "set the
  // deadline for all 4 of these missions") becomes one reviewable batch instead of N
  // silent auto-executes that can partially, silently fail.
  const editTargets = new Set(
    calls.filter((c) => EDIT_TOOL_NAMES.has(c.name)).map(editTargetId).filter((id): id is string => !!id)
  )
  if (editTargets.size > MULTI_EDIT_CONFIRM_THRESHOLD) return true

  return false
}
