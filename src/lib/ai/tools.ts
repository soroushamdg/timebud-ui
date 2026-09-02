// Canonical tool registry for Bud. Every one of these is registered as a native
// tool with whichever provider the user has configured (Anthropic tool_use / OpenAI
// function-calling / Gemini functionDeclarations — see src/lib/ai/providers/*).
// This used to be dead code (never imported) from an earlier, abandoned attempt to
// move off the hand-rolled "reply with raw JSON text" protocol — it's now the real
// source of truth for what the model can do.
//
// Two categories:
//   - Data tools (create_task, edit_project, ...) mutate or read the user's missions/
//     jobs. Executed by src/lib/ai/execute.ts, unchanged.
//   - Meta tools (reply_to_user, request_research, plan_focus_session,
//     load_project_context) replace the old six-action JSON envelope
//     (respond / research_required / plan_session / need_context). Calling one of
//     these is how the model "talks" or asks for something, instead of narrating in
//     free text that may or may not correspond to anything actually happening.

export interface ToolSchema {
  name: string
  description: string
  inputSchema: Record<string, any>
}

// Shared across create_task, edit_task, and bulk_create_tasks so the recurrence
// parameters can't drift out of sync between them. Mirrors the six recurrence_*
// columns on `tasks` (see src/types/database.ts DbTask and
// src/components/tasks/RecurrenceEditor.tsx, the regular UI's equivalent).
const RECURRENCE_SCHEMA_PROPERTIES = {
  recurrenceType: {
    type: 'string',
    enum: ['daily', 'specific_days', 'interval'],
    description:
      'Set this to make the job a real recurring job (see RECURRENCE rules) — the same row rolls its dueDate forward on completion instead of a new job being created each time. Omit entirely for a one-off job; on edit_task, set to null to stop it recurring.',
  },
  recurrenceDays: {
    type: 'array',
    items: { type: 'number' },
    description: 'Days of week, 0=Sun..6=Sat. Required (and only used) when recurrenceType is "specific_days".',
  },
  recurrenceInterval: {
    type: 'number',
    description: 'Repeat every N days. Required (and only used) when recurrenceType is "interval".',
  },
  recurrenceEndDate: {
    type: 'string',
    description: 'Stop recurring after this date, plain calendar-date format (YYYY-MM-DD). Omit for no end date.',
  },
  recurrenceEndAfter: {
    type: 'number',
    description: 'Stop recurring after this many completed occurrences. Omit for no limit.',
  },
  recurrenceMissedBehavior: {
    type: 'string',
    enum: ['overdue', 'skip'],
    description:
      'How a missed occurrence is handled: "overdue" (default) keeps it visible as overdue, "skip" auto-advances past it.',
  },
} as const

export const TOOL_SCHEMAS: Record<string, ToolSchema> = {
  // ---- Meta tools ---------------------------------------------------------

  reply_to_user: {
    name: 'reply_to_user',
    description:
      'Send your reply for this turn — the message the user will see, plus any optional UI affordances. Call this exactly once, as your LAST tool call, after any data tools you needed to call. If you already called data tools this turn, describe what you DID in past tense ("Added...", "Updated...") — never describe something as done unless you actually called a tool for it this turn. If you are only answering a question with nothing to change, call this alone.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Markdown reply shown to the user.',
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: 2-4 short follow-up prompts shown as tappable chips.',
        },
        suggested_next_actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              prompt: { type: 'string' },
              icon: { type: 'string' },
              category: { type: 'string' },
            },
            required: ['label', 'prompt'],
          },
          description: 'Optional: 2-3 richer follow-up suggestions (related questions, alternative actions, next steps).',
        },
        action_buttons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              action: { type: 'string' },
              context: { type: 'object' },
              style: { type: 'string', enum: ['primary', 'secondary', 'danger', 'success'] },
              estimatedCredits: { type: 'number' },
            },
            required: ['id', 'label', 'action', 'context', 'style'],
          },
          description: 'Optional: buttons for follow-on actions (e.g. Start Focus Session, Approve Research).',
        },
        warnings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['type', 'message', 'severity'],
          },
          description: 'Optional: deadline conflicts, overdue jobs, missing dependencies, etc.',
        },
        learning_opportunity: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            context: { type: 'string' },
            feedbackType: { type: 'string', enum: ['thumbs_up_down'] },
            taskId: { type: 'string' },
          },
          description: 'Optional: ask for feedback on a time estimate you just made.',
        },
      },
      required: ['message'],
    },
  },

  request_research: {
    name: 'request_research',
    description:
      "Ask the user's PERMISSION to search the web via Perplexity before answering a question that needs current information (best practices, trends, technical recommendations, \"how to build X\"). Do not call this if the user already said to skip/answer without research — answer directly with reply_to_user instead in that case.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The specific search query to run.' },
        message: { type: 'string', description: "What you'll tell the user you're about to search for." },
      },
      required: ['query', 'message'],
    },
  },

  plan_focus_session: {
    name: 'plan_focus_session',
    description:
      "Plan the user's next focus run against a time budget, prioritizing overdue and high-priority jobs. Use when the user mentions a time budget, asks what to work on, or asks you to plan their day/morning/afternoon.",
    inputSchema: {
      type: 'object',
      properties: {
        budgetMinutes: {
          type: 'number',
          description: "Minutes available for the run. Omit to use the user's preferred session length.",
        },
      },
      required: [],
    },
  },

  load_project_context: {
    name: 'load_project_context',
    description:
      'Load the full job list and memories for a mission. You MUST call this before answering any question about a specific mission\'s jobs/details — the mission list in your system prompt only has names and counts, not job-level detail.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the mission to load context for',
        },
      },
      required: ['projectId'],
    },
  },

  // ---- Data tools -----------------------------------------------------------

  create_task: {
    name: 'create_task',
    description: 'Create a single job',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the mission this job belongs to',
        },
        title: {
          type: 'string',
          description: 'The job title',
        },
        description: {
          type: 'string',
          description: 'Optional job description',
        },
        estimatedMinutes: {
          type: 'number',
          description: 'Estimated time in minutes — always include this (see job-estimation rules).',
        },
        dueDate: {
          type: 'string',
          description:
            'Due date in plain calendar-date format (YYYY-MM-DD, no time/timezone component)',
        },
        priority: {
          type: 'boolean',
          description: 'Whether this is a high priority job',
        },
        dependsOnTask: {
          type: 'string',
          description: 'ID of job this depends on',
        },
        ...RECURRENCE_SCHEMA_PROPERTIES,
      },
      required: ['projectId', 'title'],
    },
  },

  edit_task: {
    name: 'edit_task',
    description: 'Update fields of an existing job',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The exact UUID of the job to edit, copied from loaded context — never invented.',
        },
        updates: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            estimatedMinutes: { type: 'number' },
            dueDate: {
              type: 'string',
              description: 'Plain calendar-date format (YYYY-MM-DD, no time/timezone component)',
            },
            priority: { type: 'boolean' },
            dependsOnTask: { type: 'string' },
            ...RECURRENCE_SCHEMA_PROPERTIES,
          },
        },
      },
      required: ['taskId', 'updates'],
    },
  },

  delete_task: {
    name: 'delete_task',
    description: 'Delete a job. Always requires user confirmation before it runs.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The exact UUID of the job to delete, copied from loaded context — never invented.',
        },
      },
      required: ['taskId'],
    },
  },

  bulk_create_tasks: {
    name: 'bulk_create_tasks',
    description:
      'Create multiple jobs at once. Supports setting dependencies between jobs using dependsOnTaskIndex (single, 0-based index in same batch) or dependsOnTaskIndices (array of indices, for multi-dep within batch). Use dependsOnTaskId (single UUID) or dependsOnTaskIds (array of UUIDs) for existing jobs. Example: job C depends on A(index 0) and B(index 1) → dependsOnTaskIndices: [0, 1].',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the mission',
        },
        tasks: {
          type: 'array',
          description: 'Array of jobs to create',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              estimatedMinutes: { type: 'number' },
              dueDate: {
                type: 'string',
                description: 'Plain calendar-date format (YYYY-MM-DD, no time/timezone component)',
              },
              priority: { type: 'boolean' },
              dependsOnTaskIndex: {
                type: 'number',
                description: '0-based index of a single job in this same array that this job depends on',
              },
              dependsOnTaskIndices: {
                type: 'array',
                items: { type: 'number' },
                description: '0-based indices of multiple jobs in this same array that this job depends on',
              },
              dependsOnTaskId: {
                type: 'string',
                description: 'UUID of a single existing job that this job depends on',
              },
              dependsOnTaskIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'UUIDs of multiple existing jobs that this job depends on',
              },
              ...RECURRENCE_SCHEMA_PROPERTIES,
            },
            required: ['title'],
          },
        },
      },
      required: ['projectId', 'tasks'],
    },
  },

  create_milestone: {
    name: 'create_milestone',
    description: 'Create an objective',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The ID of the mission' },
        title: { type: 'string', description: 'The objective title' },
        dueDate: { type: 'string', description: 'Due date in plain calendar-date format (YYYY-MM-DD)' },
        priority: { type: 'boolean', description: 'Whether this is high priority' },
      },
      required: ['projectId', 'title'],
    },
  },

  edit_milestone: {
    name: 'edit_milestone',
    description: 'Edit an objective',
    inputSchema: {
      type: 'object',
      properties: {
        milestoneId: {
          type: 'string',
          description: 'The exact UUID of the objective to edit, copied from loaded context.',
        },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            dueDate: {
              type: 'string',
              description: 'Plain calendar-date format (YYYY-MM-DD, no time/timezone component)',
            },
            priority: { type: 'boolean' },
          },
        },
      },
      required: ['milestoneId', 'updates'],
    },
  },

  delete_milestone: {
    name: 'delete_milestone',
    description: 'Delete an objective. Always requires user confirmation before it runs.',
    inputSchema: {
      type: 'object',
      properties: {
        milestoneId: {
          type: 'string',
          description: 'The exact UUID of the objective to delete, copied from loaded context.',
        },
      },
      required: ['milestoneId'],
    },
  },

  create_project: {
    name: 'create_project',
    description: 'Create a new mission. Always requires user confirmation before it runs.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Mission name' },
        description: { type: 'string', description: 'Mission description' },
        deadline: { type: 'string', description: 'Mission deadline in plain calendar-date format (YYYY-MM-DD)' },
        color: { type: 'string', description: 'Mission color hex code' },
      },
      required: ['name'],
    },
  },

  edit_project: {
    name: 'edit_project',
    description: "Update fields of an existing mission (name, description, deadline, status, color, priority). Use this for mission-level deadlines — a mission's \"deadline\" is not the same as a job's \"dueDate\".",
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The ID of the mission to edit' },
        updates: {
          type: 'object',
          description: 'Fields to update — only include the ones you actually want changed.',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            deadline: { type: 'string', description: 'Plain calendar-date format (YYYY-MM-DD, no time/timezone component)' },
            status: { type: 'string', description: 'e.g. active, completed, archived' },
            color: { type: 'string', description: 'Hex color code' },
            priority: { type: 'boolean' },
          },
        },
      },
      required: ['projectId', 'updates'],
    },
  },

  add_memory: {
    name: 'add_memory',
    description: 'Save important context to mission memories',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'The ID of the mission' },
        content: { type: 'string', description: 'The memory content to save' },
      },
      required: ['projectId', 'content'],
    },
  },

  remove_memory: {
    name: 'remove_memory',
    description: 'Delete a memory. Always requires user confirmation before it runs.',
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: { type: 'string', description: 'The ID of the memory to delete' },
      },
      required: ['memoryId'],
    },
  },

  mark_task_complete: {
    name: 'mark_task_complete',
    description: 'Mark a job as completed',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The exact UUID of the job to mark complete' },
      },
      required: ['taskId'],
    },
  },

  set_task_dependency: {
    name: 'set_task_dependency',
    description:
      'Set or replace ALL dependencies for a job. Deletes existing deps and inserts new ones. Use dependsOnTaskIds (array) for 2+ dependencies. Pass neither field to clear all dependencies.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID of the job' },
        dependsOnTaskId: {
          type: 'string',
          description: 'The ID of a single job this depends on (use dependsOnTaskIds for multiple)',
        },
        dependsOnTaskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of job IDs this job depends on. Replaces all existing dependencies.',
        },
      },
      required: ['taskId'],
    },
  },
}

export const TOOL_LIST: ToolSchema[] = Object.values(TOOL_SCHEMAS)

/** Tools whose `inputSchema` doesn't get you here — they're conversation control, not data mutation. */
export const META_TOOL_NAMES = new Set([
  'reply_to_user',
  'request_research',
  'plan_focus_session',
  'load_project_context',
])

/** Tools executed via src/lib/ai/execute.ts against the database. */
export const DATA_TOOL_NAMES = new Set(
  TOOL_LIST.map((t) => t.name).filter((name) => !META_TOOL_NAMES.has(name))
)
