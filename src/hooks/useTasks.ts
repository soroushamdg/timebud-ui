import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString, calculateNextDueDate } from '@/lib/dates'
import { DbTask, TaskStatus } from '@/types/database'
import { useReplan } from '@/contexts/ReplanContext'

type Task = DbTask
type TaskInsert = Omit<DbTask, 'id' | 'created_at' | 'user_id'>
type TaskUpdate = Partial<Omit<DbTask, 'id' | 'created_at' | 'user_id'>>

interface TaskFilters {
  projectId?: string
  status?: TaskStatus | null
  type?: 'task' | 'milestone' | 'all'
}

export const useTasks = (filters?: TaskFilters) => {
  return useQuery({
    queryKey: ['tasks', filters?.projectId ?? 'all', JSON.stringify(filters)],
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      let query = supabase.from('tasks').select('*').eq('user_id', user.id)
      
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId)
      }
      
      if (filters?.status !== undefined) {
        query = query.eq('status', filters.status)
      }
      
      if (filters?.type === 'task') {
        query = query.eq('item_type', 'task')
      } else if (filters?.type === 'milestone') {
        query = query.eq('item_type', 'milestone')
      }
      // If filters.type === 'all' or undefined: no item_type filter
      
      const { data: tasks, error } = await query.order('order', { ascending: true })
      if (error) throw error
      
      // Fetch all dependencies in a single query
      const { data: dependencies, error: depsError } = await supabase
        .from('task_dependencies')
        .select('task_id, depends_on_id')
      
      if (depsError) throw depsError
      
      // Build a map of task_id -> array of depends_on_ids
      const depsMap = new Map<string, string[]>()
      for (const dep of dependencies || []) {
        if (!depsMap.has(dep.task_id)) {
          depsMap.set(dep.task_id, [])
        }
        depsMap.get(dep.task_id)!.push(dep.depends_on_id)
      }
      
      // Attach dependencies to each task
      return tasks.map(task => ({
        ...task,
        dependencies: depsMap.get(task.id) || []
      }))
    },
  })
}

export const useTask = (id: string | undefined) => {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async (): Promise<Task | null> => {
      if (!id) return null
      const supabase = createClient()
      const { data: task, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      
      // Fetch dependencies for this task
      const { data: dependencies, error: depsError } = await supabase
        .from('task_dependencies')
        .select('depends_on_id')
        .eq('task_id', id)
      
      if (depsError) throw depsError
      
      return {
        ...task,
        dependencies: dependencies?.map(d => d.depends_on_id) || []
      }
    },
  })
}

export const useUpdateTask = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async ({ id, ...fields }: TaskUpdate & { id: string }) => {
      const supabase = createClient()
      
      // Fetch current task to check if it's recurring
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()
      
      if (!currentTask) throw new Error('Task not found')
      
      // If marking a recurring task as completed, calculate next due_date
      if (fields.status === 'completed' && currentTask.recurrence_type && currentTask.item_type === 'task') {
        const nextDueDate = calculateNextDueDate(currentTask.due_date, currentTask as any)
        const updateFields = {
          status: nextDueDate ? 'pending' : 'completed',
          due_date: nextDueDate,
        }
        const { data, error } = await supabase
          .from('tasks')
          .update(updateFields)
          .eq('id', id)
          .select()
          .single()
        if (error) throw new Error(error.message || error.details || error.hint || 'Failed to update task')
        return data
      }

      // Normal update
      const { data, error } = await supabase
        .from('tasks')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw new Error(error.message || error.details || error.hint || 'Failed to update task')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      triggerReplan()
    },
  })
}

export const useCreateTask = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'created_at'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const taskData = {
        ...task,
        item_type: task.item_type || 'task',
        user_id: user.id,
        created_at: toUtcString(new Date()),
      }
      
      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      triggerReplan()
    },
  })
}

export const useDeleteTask = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      triggerReplan()
    },
  })
}
