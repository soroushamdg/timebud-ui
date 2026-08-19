export const TOOL_SCHEMAS = {
  load_project_context: {
    name: "load_project_context",
    description: "Load full job list and memories for a mission",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the mission to load context for",
        },
      },
      required: ["projectId"],
    },
  },

  create_task: {
    name: "create_task",
    description: "Create a single job",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the mission this job belongs to",
        },
        title: {
          type: "string",
          description: "The job title",
        },
        description: {
          type: "string",
          description: "Optional job description",
        },
        estimatedMinutes: {
          type: "number",
          description: "Estimated time in minutes",
        },
        dueDate: {
          type: "string",
          description:
            "Due date in plain calendar-date format (YYYY-MM-DD, no time/timezone component)",
        },
        priority: {
          type: "boolean",
          description: "Whether this is a high priority job",
        },
        dependsOnTask: {
          type: "string",
          description: "ID of job this depends on",
        },
      },
      required: ["projectId", "title"],
    },
  },

  edit_task: {
    name: "edit_task",
    description: "Update fields of an existing job",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the job to edit",
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
              description: "Plain calendar-date format (YYYY-MM-DD, no time/timezone component)",
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
    description: "Delete a job (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the job to delete",
        },
      },
      required: ["taskId"],
    },
  },

  bulk_create_tasks: {
    name: "bulk_create_tasks",
    description:
      "Create multiple jobs at once. Supports setting dependencies between jobs using dependsOnTaskIndex (single, 0-based index in same batch) or dependsOnTaskIndices (array of indices, for multi-dep within batch). Use dependsOnTaskId (single UUID) or dependsOnTaskIds (array of UUIDs) for existing jobs. Example: job C depends on A(index 0) and B(index 1) → dependsOnTaskIndices: [0, 1].",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the mission",
        },
        tasks: {
          type: "array",
          description: "Array of jobs to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              estimatedMinutes: { type: "number" },
              dueDate: {
                type: "string",
                description: "Plain calendar-date format (YYYY-MM-DD, no time/timezone component)",
              },
              priority: { type: "boolean" },
              dependsOnTaskIndex: {
                type: "number",
                description:
                  "0-based index of a single job in this same array that this job depends on",
              },
              dependsOnTaskIndices: {
                type: "array",
                items: { type: "number" },
                description:
                  "0-based indices of multiple jobs in this same array that this job depends on (use for multi-dependency within the batch)",
              },
              dependsOnTaskId: {
                type: "string",
                description:
                  "UUID of a single existing job that this job depends on",
              },
              dependsOnTaskIds: {
                type: "array",
                items: { type: "string" },
                description:
                  "UUIDs of multiple existing jobs that this job depends on (use for multi-dependency on pre-existing jobs)",
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
    description: "Create an objective",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the mission",
        },
        title: {
          type: "string",
          description: "The objective title",
        },
        dueDate: {
          type: "string",
          description: "Due date in plain calendar-date format (YYYY-MM-DD)",
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
    description: "Edit an objective",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: {
          type: "string",
          description: "The ID of the objective to edit",
        },
        updates: {
          type: "object",
          properties: {
            title: { type: "string" },
            dueDate: {
              type: "string",
              description: "Plain calendar-date format (YYYY-MM-DD, no time/timezone component)",
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
    description: "Delete an objective (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: {
          type: "string",
          description: "The ID of the objective to delete",
        },
      },
      required: ["milestoneId"],
    },
  },

  create_project: {
    name: "create_project",
    description:
      "Create a new mission (requires confirmation via preview_creation)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Mission name",
        },
        description: {
          type: "string",
          description: "Mission description",
        },
        deadline: {
          type: "string",
          description: "Mission deadline in plain calendar-date format (YYYY-MM-DD)",
        },
        color: {
          type: "string",
          description: "Mission color hex code",
        },
      },
      required: ["name"],
    },
  },

  add_memory: {
    name: "add_memory",
    description: "Save important context to mission memories",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The ID of the mission",
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
    description: "Mark a job as completed",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the job to mark complete",
        },
      },
      required: ["taskId"],
    },
  },

  set_task_dependency: {
    name: "set_task_dependency",
    description: "Set or replace ALL dependencies for a job. Deletes existing deps and inserts new ones. Use dependsOnTaskIds (array) for 2+ dependencies. Pass neither field to clear all dependencies.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "The ID of the job",
        },
        dependsOnTaskId: {
          type: "string",
          description: "The ID of a single job this depends on (use dependsOnTaskIds for multiple)",
        },
        dependsOnTaskIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of job IDs this job depends on. Replaces all existing dependencies. Use this when a job has 2+ dependencies.",
        },
      },
      required: ["taskId"],
    },
  },
};
