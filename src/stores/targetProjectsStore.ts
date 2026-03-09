import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TargetProjectsStore {
  targetProjectIds: string[]
  setTargetProjects: (projectIds: string[]) => void
  addTargetProject: (projectId: string) => void
  removeTargetProject: (projectId: string) => void
  isTargetProject: (projectId: string) => boolean
}

export const useTargetProjectsStore = create<TargetProjectsStore>()(
  persist(
    (set, get) => ({
      targetProjectIds: [],
      
      setTargetProjects: (projectIds: string[]) => 
        set({ targetProjectIds: projectIds }),
      
      addTargetProject: (projectId: string) =>
        set((state) => ({
          targetProjectIds: [...new Set([...state.targetProjectIds, projectId])]
        })),
      
      removeTargetProject: (projectId: string) =>
        set((state) => ({
          targetProjectIds: state.targetProjectIds.filter(id => id !== projectId)
        })),
      
      isTargetProject: (projectId: string) =>
        get().targetProjectIds.includes(projectId),
    }),
    {
      name: 'target-projects-storage',
    }
  )
)
