import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMessage, ConfirmationPayload, ResponseMetadata } from '@/types/ai'

interface ChatStore {
  messages: ChatMessage[]
  isLoading: boolean
  
  addUserMessage: (content: string, files?: any[]) => void
  addAssistantMessage: (
    content: string,
    suggestions?: string[],
    metadata?: ResponseMetadata,
    confirmationPayload?: ConfirmationPayload
  ) => void
  addStatusMessage: (content: string, type: 'loading' | 'success' | 'error') => void
  setLoading: (isLoading: boolean) => void
  clearHistory: () => void
  pinMessage: (id: string) => void
  unpinMessage: (id: string) => void
  updateMessageOptimistic: (id: string, isOptimistic: boolean) => void
  searchMessages: (query: string) => ChatMessage[]
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,

      addUserMessage: (content, files) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: Date.now(),
          isOptimistic: true,
        }
        set((state) => ({
          messages: [...state.messages, message],
        }))
      },

      addAssistantMessage: (content, suggestions, metadata, confirmationPayload) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          suggestions,
          metadata,
          confirmationPayload,
          timestamp: Date.now(),
        }
        set((state) => ({
          messages: [...state.messages, message],
        }))
      },

      addStatusMessage: (content, type) => {
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content,
          timestamp: Date.now(),
        }
        set((state) => ({
          messages: [...state.messages, message],
        }))
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      clearHistory: () => {
        set({ messages: [] })
      },

      pinMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, isPinned: true } : msg
          ),
        }))
      },

      unpinMessage: (id) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, isPinned: false } : msg
          ),
        }))
      },

      updateMessageOptimistic: (id, isOptimistic) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, isOptimistic } : msg
          ),
        }))
      },

      searchMessages: (query) => {
        const { messages } = get()
        const lowerQuery = query.toLowerCase()
        return messages.filter((msg) =>
          msg.content.toLowerCase().includes(lowerQuery)
        )
      },
    }),
    {
      name: 'timebud-chat-storage',
      partialize: (state) => ({
        // Only persist messages, trim to last 40
        messages: state.messages.slice(-40),
      }),
    }
  )
)
