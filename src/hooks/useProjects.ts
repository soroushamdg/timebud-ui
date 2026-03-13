import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbProject } from '@/types/database'
import { useReplan } from '@/contexts/ReplanContext'

type Project = DbProject
type ProjectInsert = Omit<DbProject, 'id' | 'created_at' | 'user_id' | 'status'>
type ProjectUpdate = Partial<Omit<DbProject, 'id' | 'created_at'>>

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      const supabase = createClient()
      console.log('[useProjects] Fetching projects...')
      
      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[useProjects] No authenticated user, returning empty array')
        return []
      }
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      console.log('[useProjects] Result:', { count: data?.length, error, data })
      if (error) {
        console.error('[useProjects] Error fetching projects:', error)
        throw error
      }
      const result = data || []
      console.log('[useProjects] Returning:', result, 'Length:', result.length)
      return result
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })
}

export const useProjectsForTasks = () => {
  return useQuery({
    queryKey: ['projects', 'for-tasks'],
    queryFn: async (): Promise<Project[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export const useAllProjects = () => {
  return useQuery({
    queryKey: ['projects', 'all'],
    queryFn: async (): Promise<Project[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export const useTargetProjects = (targetProjectIds: string[]) => {
  return useQuery({
    queryKey: ['projects', 'targets', targetProjectIds],
    queryFn: async (): Promise<Project[]> => {
      if (targetProjectIds.length === 0) return []
      
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', targetProjectIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: targetProjectIds.length > 0,
  })
}

export const useProject = (id: string | undefined) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async (): Promise<Project | null> => {
      if (!id) return null
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export const useCreateProject = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async (project: Omit<ProjectInsert, 'user_id' | 'status' | 'created_at' | 'updated_at'>) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      const projectData = {
        ...project,
        user_id: user.id,
        status: 'active' as const,
        created_at: toUtcString(new Date()),
      }
      
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      triggerReplan()
    },
  })
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async (projectId: string) => {
      const supabase = createClient()
      
      // First delete all tasks associated with this project
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('project_id', projectId)
      
      if (tasksError) {
        console.error('Error deleting tasks:', tasksError)
        throw tasksError
      }
      
      // Then delete all memories associated with this project
      const { error: memoriesError } = await supabase
        .from('ai_memory')
        .delete()
        .eq('project_id', projectId)
      
      if (memoriesError) {
        console.error('Error deleting memories:', memoriesError)
        throw memoriesError
      }
      
      // Finally delete the project
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
      
      if (projectError) {
        console.error('Error deleting project:', projectError)
        throw projectError
      }
      
      return projectId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      triggerReplan()
    },
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()
  const { triggerReplan } = useReplan()
  
  return useMutation({
    mutationFn: async ({ id, ...fields }: ProjectUpdate & { id: string }) => {
      console.log('useUpdateProject called with:', { id, fields })
      const supabase = createClient()
      const updateData = {
        ...fields,
      }
      
      console.log('Updating project in database:', id, updateData)
      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        console.error('Supabase update error:', error)
        throw error
      }
      
      console.log('Project updated successfully:', data)
      return data
    },
    onSuccess: (_, variables) => {
      console.log('Update onSuccess called for variables:', variables)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] })
      triggerReplan()
    },
    onError: (error, variables) => {
      console.error('Update onError called:', { 
        error: error || 'No error object',
        errorMessage: error instanceof Error ? error.message : 'No message',
        errorString: JSON.stringify(error, null, 2),
        variables 
      })
    },
  })
}
