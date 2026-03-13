import { SupabaseClient } from '@supabase/supabase-js'
import { ToolExecutionResult } from '@/types/ai'

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

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: projectId,
      item_type: 'task',
      title,
      description: description || null,
      estimated_minutes: estimatedMinutes || null,
      status: 'pending',
      due_date: dueDate || null,
      order: nextOrder,
      priority: priority || false,
      depends_on_task: dependsOnTask || null,
    })
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Created task: ${title}`,
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
      due_date: updates.dueDate,
      priority: updates.priority,
      depends_on_task: updates.dependsOnTask,
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Updated task: ${data.title}`,
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

  if (fetchError) throw new Error(`Task not found: ${taskId}`)

  const taskTitle = task?.title || 'Unknown task'

  // Delete the task
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) throw error

  return {
    success: true,
    summary: `Deleted task: ${taskTitle}`,
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

  const tasksToInsert = tasks.map((task: any) => {
    // Convert priority to boolean if it's a string
    let priority = false
    if (typeof task.priority === 'boolean') {
      priority = task.priority
    } else if (typeof task.priority === 'string') {
      priority = task.priority.toLowerCase() === 'high' || task.priority.toLowerCase() === 'true'
    }

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: projectId,
      item_type: 'task',
      title: task.title,
      description: task.description || null,
      estimated_minutes: task.estimatedMinutes || null,
      status: 'pending',
      due_date: task.dueDate || null,
      order: nextOrder++,
      priority,
      depends_on_task: null,
    }
  })

  const { data, error } = await supabase
    .from('tasks')
    .insert(tasksToInsert)
    .select()

  if (error) throw error

  return {
    success: true,
    summary: `Created ${tasks.length} tasks`,
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
      due_date: dueDate || null,
      order: nextOrder,
      priority: priority || false,
      depends_on_task: null,
    })
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Created milestone: ${title}`,
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
      due_date: updates.dueDate,
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
    summary: `Updated milestone: ${data.title}`,
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

  if (fetchError) throw new Error(`Milestone not found: ${milestoneId}`)

  const milestoneTitle = milestone?.title || 'Unknown milestone'

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
    summary: `Deleted milestone: ${milestoneTitle}`,
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
      deadline: deadline || null,
      priority: false,
      status: 'active',
      color: color || '#F5C518',
    })
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: `Created project: ${name}`,
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
  const { taskId, dependsOnTaskId } = input

  const { data, error } = await supabase
    .from('tasks')
    .update({ depends_on_task: dependsOnTaskId || null })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return {
    success: true,
    summary: dependsOnTaskId 
      ? `Set dependency for: ${data.title}`
      : `Cleared dependency for: ${data.title}`,
    data,
  }
}
