import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
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
      
      let query = supabase.from('tasks').select('*').eq('user_id', user.id).eq('is_recurring_template', false)
      
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
      const { data, error } = await supabase
        .from('tasks')
        .update(fields)
        .eq('id', id)
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

export const useCompleteTask = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()

  return useMutation({
    mutationFn: async (task: DbTask) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id)
        .select()
        .single()
      if (error) throw error

      if (task.recurrence_parent_id) {
        const today = new Date().toISOString().split('T')[0]
        const { data: existing } = await supabase
          .from('tasks')
          .select('id')
          .eq('recurrence_parent_id', task.recurrence_parent_id)
          .in('status', ['pending', 'in_progress'])
          .gte('recurrence_occurrence_date', today)
          .limit(1)
        if (!existing || existing.length === 0) {
          await supabase.rpc('generate_next_occurrence', { p_template_id: task.recurrence_parent_id })
        }
      }

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
