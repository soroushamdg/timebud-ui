import { ActionType } from '@/types/credits'

export const CREDIT_COSTS: Record<ActionType, number> = {
  ai_message: 20,
  ai_thinking: 60,
  ai_cheap: 5,
  file_analysis: 25,
  project_from_file: 50,
  bulk_tasks: 30,
  avatar_generation: 15,
  purchase: 0,
  renewal: 0,
  subscription: 0,
  refund: 0,
}

export const FREE_MONTHLY_CREDITS = 300
export const LOW_CREDIT_THRESHOLD = 0.2

export function getActionCost(actionType: ActionType): number {
  return CREDIT_COSTS[actionType] || 0
}

export function getActionType(params: {
  hasFiles?: boolean
  isThinking?: boolean
  isBulkCreation?: boolean
  isProjectFromFile?: boolean
  modelTier?: 'cheap' | 'standard'
}): ActionType {
  if (params.isProjectFromFile) {
    return 'project_from_file'
  }
  
  if (params.hasFiles) {
    return 'file_analysis'
  }
  
  if (params.isThinking) {
    return 'ai_thinking'
  }
  
  if (params.isBulkCreation) {
    return 'bulk_tasks'
  }
  
  if (params.modelTier === 'cheap') {
    return 'ai_cheap'
  }
  
  return 'ai_message'
}
