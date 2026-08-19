import { SupabaseClient } from '@supabase/supabase-js'
import { ToolExecutionResult } from '@/types/ai'

// Defense in depth: due_date/deadline are calendar days, not moments in time. The
// system prompt instructs the AI to emit plain YYYY-MM-DD, but this normalizes
// whatever comes back to just the date part regardless, so a model that doesn't
// perfectly follow that instruction still can't write a bad-format date into the DB.
// Preserves undefined ("don't touch this field" in a partial update) vs null
// ("explicitly clear it") vs a real value (normalize to date-only).
function normalizeDateOnly(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return value.split('T')[0]
}

export async function executeTool(
  toolName: string,
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case 'create_task':
        return await createTask(input, supabase, userId)
      
      case 'edit_task':
        return await editTask(input, supabase, userId)
      
      case 'delete_task':
        return await deleteTask(input, supabase, userId)
      
      case 'bulk_create_tasks':
        return await bulkCreateTasks(input, supabase, userId)
      
      case 'create_milestone':
        return await createMilestone(input, supabase, userId)
      
      case 'edit_milestone':
        return await editMilestone(input, supabase, userId)
      
      case 'delete_milestone':
        return await deleteMilestone(input, supabase, userId)
      
      case 'create_project':
        return await createProject(input, supabase, userId)
      
      case 'edit_project':
        return await editProject(input, supabase, userId)
      
      case 'add_memory':
        return await addMemory(input, supabase, userId)
      
      case 'remove_memory':
        return await removeMemory(input, supabase, userId)
      
      case 'mark_task_complete':
        return await markTaskComplete(input, supabase, userId)
      
      case 'set_task_dependency':
        return await setTaskDependency(input, supabase, userId)
      
      default:
        return {
          success: false,
          summary: `Unknown tool: ${toolName}`,
        }
    }
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error)
    return {
      success: false,
      summary: `Failed to execute ${toolName}: ${error.message}`,
    }
  }
}

async function createTask(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { projectId, title, description, estimatedMinutes, dueDate, priority, dependsOnTask } = input

  // Get max order for this project
  const { data: maxOrderData } = await supabase
    .from('tasks')
    .select('order')
    .eq('project_id', projectId)
    .order('order', { ascending: false })
    .limit(1)

  const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order + 1.0 : 1.0

  const taskId = crypto.randomUUID()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      id: taskId,
      user_id: userId,
      project_id: projectId,
      item_type: 'task',
      title,
      description: description || null,
      estimated_minutes: estimatedMinutes || null,
      status: 'pending',
      due_date: normalizeDateOnly(dueDate) ?? null,
      order: nextOrder,
      priority: priority || false,
    })
    .select()
    .single()

  if (error) throw error

  // Handle dependency if provided
  if (dependsOnTask) {
    const { error: depError } = await supabase
      .from('task_dependencies')
      .insert({
        task_id: taskId,
        depends_on_id: dependsOnTask,
      })
    
    if (depError) throw depError
  }

  return {
    success: true,
    summary: `Created job: ${title}`,
    data,
  }
}

async function editTask(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { taskId, updates } = input

  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updates,
      title: updates.title,
      description: updates.description,
      estimated_minutes: updates.estimatedMinutes,
      due_date: normalizeDateOnly(updates.dueDate),
      priority: updates.priority,
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Updated job: ${data.title}`,
    data,
  }
}

async function deleteTask(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { taskId } = input

  // Fetch task title before deletion
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (fetchError) throw new Error(`Job not found: ${taskId}`)

  const taskTitle = task?.title || 'Unknown job'

  // Delete the task
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) throw error

  return {
    success: true,
    summary: `Deleted job: ${taskTitle}`,
  }
}

async function bulkCreateTasks(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { projectId, tasks } = input

  // Get max order for this project
  const { data: maxOrderData } = await supabase
    .from('tasks')
    .select('order')
    .eq('project_id', projectId)
    .order('order', { ascending: false })
    .limit(1)

  let nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order + 1.0 : 1.0

  // Pre-generate UUIDs for all tasks
  const taskIds = tasks.map(() => crypto.randomUUID())

  // Validate dependencies
  let dependencyCount = 0
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    if (task.dependsOnTaskIndex !== undefined && task.dependsOnTaskIndex !== null) {
      const depIndex = task.dependsOnTaskIndex

      // Validate index is within bounds
      if (depIndex < 0 || depIndex >= tasks.length) {
        throw new Error(`Job "${task.title}" has invalid dependsOnTaskIndex: ${depIndex}. Must be between 0 and ${tasks.length - 1}`)
      }

      // Prevent self-reference
      if (depIndex === i) {
        throw new Error(`Job "${task.title}" cannot depend on itself`)
      }

      dependencyCount++
    }

    if (Array.isArray(task.dependsOnTaskIndices)) {
      for (const depIndex of task.dependsOnTaskIndices) {
        if (depIndex < 0 || depIndex >= tasks.length) {
          throw new Error(`Job "${task.title}" has invalid dependsOnTaskIndices entry: ${depIndex}. Must be between 0 and ${tasks.length - 1}`)
        }
        if (depIndex === i) {
          throw new Error(`Job "${task.title}" cannot depend on itself`)
        }
        dependencyCount++
      }
    }

    if (task.dependsOnTaskId) {
      dependencyCount++
    }

    if (Array.isArray(task.dependsOnTaskIds)) {
      dependencyCount += task.dependsOnTaskIds.length
    }
  }

  const tasksToInsert = tasks.map((task: any, index: number) => {
    // Convert priority to boolean if it's a string
    let priority = false
    if (typeof task.priority === 'boolean') {
      priority = task.priority
    } else if (typeof task.priority === 'string') {
      priority = task.priority.toLowerCase() === 'high' || task.priority.toLowerCase() === 'true'
    }

    return {
      id: taskIds[index],
      user_id: userId,
      project_id: projectId,
      item_type: 'task',
      title: task.title,
      description: task.description || null,
      estimated_minutes: task.estimatedMinutes || null,
      status: 'pending',
      due_date: normalizeDateOnly(task.dueDate) ?? null,
      order: nextOrder++,
      priority,
    }
  })

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  if (error) throw error

  // Insert dependencies into task_dependencies table
  const dependenciesToInsert = []
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const depIds: string[] = []

    // Collect from singular UUID field
    if (task.dependsOnTaskId) {
      depIds.push(task.dependsOnTaskId)
    }
    // Collect from plural UUID array field
    if (Array.isArray(task.dependsOnTaskIds)) {
      depIds.push(...task.dependsOnTaskIds)
    }
    // Collect from singular index field
    if (task.dependsOnTaskIndex !== undefined && task.dependsOnTaskIndex !== null) {
      depIds.push(taskIds[task.dependsOnTaskIndex])
    }
    // Collect from plural index array field
    if (Array.isArray(task.dependsOnTaskIndices)) {
      for (const idx of task.dependsOnTaskIndices) {
        depIds.push(taskIds[idx])
      }
    }

    // Deduplicate and insert a row per dependency
    for (const depId of [...new Set(depIds)]) {
      dependenciesToInsert.push({
        task_id: taskIds[i],
        depends_on_id: depId,
      })
    }
  }

  if (dependenciesToInsert.length > 0) {
    const { error: depError } = await supabase
      .from('task_dependencies')
      .insert(dependenciesToInsert)
    
    if (depError) throw depError
  }

  const summary = dependencyCount > 0
    ? `Created ${tasks.length} jobs with ${dependencyCount} ${dependencyCount === 1 ? 'dependency' : 'dependencies'}`
    : `Created ${tasks.length} jobs`

  return {
    success: true,
    summary,
    data,
  }
}

async function createMilestone(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { projectId, title, dueDate, priority } = input

  // Get max order for this project
  const { data: maxOrderData } = await supabase
    .from('tasks')
    .select('order')
    .eq('project_id', projectId)
    .order('order', { ascending: false })
    .limit(1)

  const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order + 1.0 : 1.0

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: projectId,
      item_type: 'milestone',
      title,
      description: null,
      estimated_minutes: null,
      status: null,
      due_date: normalizeDateOnly(dueDate) ?? null,
      order: nextOrder,
      priority: priority || false,
    })
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Created objective: ${title}`,
    data,
  }
}

async function editMilestone(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { milestoneId, updates } = input

  const { data, error } = await supabase
    .from('tasks')
    .update({
      title: updates.title,
      due_date: normalizeDateOnly(updates.dueDate),
      priority: updates.priority,
    })
    .eq('id', milestoneId)
    .eq('user_id', userId)
    .eq('item_type', 'milestone')
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Updated objective: ${data.title}`,
    data,
  }
}

async function deleteMilestone(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { milestoneId } = input

  // Fetch milestone title before deletion
  const { data: milestone, error: fetchError } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', milestoneId)
    .eq('user_id', userId)
    .eq('item_type', 'milestone')
    .single()

  if (fetchError) throw new Error(`Objective not found: ${milestoneId}`)

  const milestoneTitle = milestone?.title || 'Unknown objective'

  // Delete the milestone
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', milestoneId)
    .eq('user_id', userId)
    .eq('item_type', 'milestone')

  if (error) throw error

  return {
    success: true,
    summary: `Deleted objective: ${milestoneTitle}`,
  }
}

async function createProject(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { name, description, deadline, color } = input

  const projectId = crypto.randomUUID()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      user_id: userId,
      name,
      description: description || null,
      deadline: normalizeDateOnly(deadline) ?? null,
      priority: false,
      status: 'active',
      color: color || '#F5C518',
    })
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Created mission: ${name}`,
    data,
  }
}

async function editProject(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { projectId, updates } = input

  const updateData: Record<string, any> = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.deadline !== undefined) updateData.deadline = normalizeDateOnly(updates.deadline)
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.color !== undefined) updateData.color = updates.color
  if (updates.priority !== undefined) updateData.priority = updates.priority

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Updated mission: ${data.name}`,
    data,
  }
}

async function addMemory(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { projectId, content } = input

  const { data, error } = await supabase
    .from('ai_memory')
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: projectId,
      content,
    })
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Saved memory: ${content.substring(0, 50)}...`,
    data,
  }
}

async function removeMemory(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { memoryId } = input

  const { error } = await supabase
    .from('ai_memory')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId)

  if (error) throw error

  return {
    success: true,
    summary: `Deleted memory`,
  }
}

async function markTaskComplete(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { taskId } = input

  const { data, error } = await supabase
    .from('tasks')
    .update({ status: 'completed' })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Marked complete: ${data.title}`,
    data,
  }
}

async function setTaskDependency(
  input: Record<string, any>,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  const { taskId, dependsOnTaskId, dependsOnTaskIds } = input

  // Normalize: merge singular and plural into one deduplicated array
  const resolvedIds: string[] = []
  if (dependsOnTaskId) resolvedIds.push(dependsOnTaskId)
  if (Array.isArray(dependsOnTaskIds)) resolvedIds.push(...dependsOnTaskIds)
  const uniqueIds = [...new Set(resolvedIds)]

  // Verify task belongs to user
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('title')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (taskError) throw taskError

  // Always delete all existing deps first
  await supabase
    .from('task_dependencies')
    .delete()
    .eq('task_id', taskId)

  if (uniqueIds.length > 0) {
    const { error: insertError } = await supabase
      .from('task_dependencies')
      .insert(uniqueIds.map(depId => ({
        task_id: taskId,
        depends_on_id: depId,
      })))

    if (insertError) throw insertError

    return {
      success: true,
      summary: `Set ${uniqueIds.length} ${uniqueIds.length === 1 ? 'dependency' : 'dependencies'} for: ${task.title}`,
      data: task,
    }
  } else {
    return {
      success: true,
      summary: `Cleared all dependencies for: ${task.title}`,
      data: task,
    }
  }
}
