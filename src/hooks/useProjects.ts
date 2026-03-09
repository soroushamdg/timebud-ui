import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toUtcString } from '@/lib/dates'
import { DbProject } from '@/types/database'

type Project = DbProject
type ProjectInsert = Omit<DbProject, 'id' | 'created_at' | 'user_id' | 'status'>
type ProjectUpdate = Partial<Omit<DbProject, 'id' | 'created_at'>>

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
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
        .neq('status', 'deleted')
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
    },
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...fields }: ProjectUpdate & { id: string }) => {
      const supabase = createClient()
      const updateData = {
        ...fields,
      }
      
      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] })
    },
  })
}
