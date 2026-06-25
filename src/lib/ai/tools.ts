export const TOOL_SCHEMAS = {
  load_project_context: {
    name: "load_project_context",
    description: "Load full task list and memories for a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the project to load context for",
        },
      },
      required: ["projectId"],
    },
  },

  create_task: {
    name: "create_task",
    description: "Create a single task",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the project this task belongs to",
        },
        title: {
          type: "string",
          description: "The task title",
        },
        description: {
          type: "string",
          description: "Optional task description",
        },
        estimatedMinutes: {
          type: "number",
          description: "Estimated time in minutes",
        },
        dueDate: {
          type: "string",
          description:
            "Due date in ISO 8601 UTC string format (YYYY-MM-DDTHH:mm:ssZ)",
        },
        priority: {
          type: "boolean",
          description: "Whether this is a high priority task",
        },
        dependsOnTask: {
          type: "string",
          description: "ID of task this depends on",
        },
      },
      required: ["projectId", "title"],
    },
  },

  edit_task: {
    name: "edit_task",
    description: "Update fields of an existing task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task to edit",
        },
        updates: {
          type: "object",
          description: "Fields to update",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            estimatedMinutes: { type: "number" },
            dueDate: {
              type: "string",
              description: "ISO 8601 UTC string format",
            },
            priority: { type: "boolean" },
            dependsOnTask: { type: "string" },
          },
        },
      },
      required: ["taskId", "updates"],
    },
  },

  delete_task: {
    name: "delete_task",
    description: "Delete a task (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task to delete",
        },
      },
      required: ["taskId"],
    },
  },

  bulk_create_tasks: {
    name: "bulk_create_tasks",
    description:
      "Create multiple tasks at once. Supports setting dependencies between tasks using dependsOnTaskIndex (single, 0-based index in same batch) or dependsOnTaskIndices (array of indices, for multi-dep within batch). Use dependsOnTaskId (single UUID) or dependsOnTaskIds (array of UUIDs) for existing tasks. Example: task C depends on A(index 0) and B(index 1) → dependsOnTaskIndices: [0, 1].",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the project",
        },
        tasks: {
          type: "array",
          description: "Array of tasks to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              estimatedMinutes: { type: "number" },
              dueDate: {
                type: "string",
                description: "ISO 8601 UTC string format",
              },
              priority: { type: "boolean" },
              dependsOnTaskIndex: {
                type: "number",
                description:
                  "0-based index of a single task in this same array that this task depends on",
              },
              dependsOnTaskIndices: {
                type: "array",
                items: { type: "number" },
                description:
                  "0-based indices of multiple tasks in this same array that this task depends on (use for multi-dependency within the batch)",
              },
              dependsOnTaskId: {
                type: "string",
                description:
                  "UUID of a single existing task that this task depends on",
              },
              dependsOnTaskIds: {
                type: "array",
                items: { type: "string" },
                description:
                  "UUIDs of multiple existing tasks that this task depends on (use for multi-dependency on pre-existing tasks)",
              },
            },
            required: ["title"],
          },
        },
      },
      required: ["projectId", "tasks"],
    },
  },

  create_milestone: {
    name: "create_milestone",
    description: "Create a milestone",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the project",
        },
        title: {
          type: "string",
          description: "The milestone title",
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO 8601 UTC string format",
        },
        priority: {
          type: "boolean",
          description: "Whether this is high priority",
        },
      },
      required: ["projectId", "title"],
    },
  },

  edit_milestone: {
    name: "edit_milestone",
    description: "Edit a milestone",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: {
          type: "string",
          description: "The ID of the milestone to edit",
        },
        updates: {
          type: "object",
          properties: {
            title: { type: "string" },
            dueDate: {
              type: "string",
              description: "ISO 8601 UTC string format",
            },
            priority: { type: "boolean" },
          },
        },
      },
      required: ["milestoneId", "updates"],
    },
  },

  delete_milestone: {
    name: "delete_milestone",
    description: "Delete a milestone (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: {
          type: "string",
          description: "The ID of the milestone to delete",
        },
      },
      required: ["milestoneId"],
    },
  },

  create_project: {
    name: "create_project",
    description:
      "Create a new project (requires confirmation via preview_creation)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Project name",
        },
        description: {
          type: "string",
          description: "Project description",
        },
        deadline: {
          type: "string",
          description: "Project deadline in ISO 8601 UTC string format",
        },
        color: {
          type: "string",
          description: "Project color hex code",
        },
      },
      required: ["name"],
    },
  },

  add_memory: {
    name: "add_memory",
    description: "Save important context to project memories",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the project",
        },
        content: {
          type: "string",
          description: "The memory content to save",
        },
      },
      required: ["projectId", "content"],
    },
  },

  remove_memory: {
    name: "remove_memory",
    description: "Delete a memory (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The ID of the memory to delete",
        },
      },
      required: ["memoryId"],
    },
  },

  mark_task_complete: {
    name: "mark_task_complete",
    description: "Mark a task as completed",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task to mark complete",
        },
      },
      required: ["taskId"],
    },
  },

  set_task_dependency: {
    name: "set_task_dependency",
    description: "Set or replace ALL dependencies for a task. Deletes existing deps and inserts new ones. Use dependsOnTaskIds (array) for 2+ dependencies. Pass neither field to clear all dependencies.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the task",
        },
        dependsOnTaskId: {
          type: "string",
          description: "The ID of a single task this depends on (use dependsOnTaskIds for multiple)",
        },
        dependsOnTaskIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of task IDs this task depends on. Replaces all existing dependencies. Use this when a task has 2+ dependencies.",
        },
      },
      required: ["taskId"],
    },
  },
};
