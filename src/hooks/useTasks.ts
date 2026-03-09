import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbTask, TaskStatus } from '@/types/database'

type Task = DbTask
type TaskInsert = Omit<DbTask, 'id' | 'created_at' | 'user_id'>
type TaskUpdate = Partial<Omit<DbTask, 'id' | 'created_at' | 'user_id'>>

interface TaskFilters {
  projectId?: string
  status?: TaskStatus
  type?: 'solo'
}

export const useTasks = (filters?: TaskFilters) => {
  return useQuery({
    queryKey: ['tasks', JSON.stringify(filters || {})],
    queryFn: async (): Promise<Task[]> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
      
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId)
      }
      
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      
      if (filters?.type === 'solo') {
        query = query.is('project_id', null).is('milestone_id', null)
      }
      
      const { data, error } = await query.order('order', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export const useTask = (id: string | undefined) => {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async (): Promise<Task | null> => {
      if (!id) return null
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export const useUpdateTask = () => {
  const queryClient = useQueryClient()
  
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
    },
  })
}

export const useCreateTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'created_at'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const taskData = {
        ...task,
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
    },
  })
}
