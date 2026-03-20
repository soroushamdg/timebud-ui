import { GoogleGenAI } from "@google/genai"

export function createGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set')
  }
  
  return new GoogleGenAI({ apiKey })
}

export const GEMINI_CONFIG = {
  model: 'gemini-3.1-flash-image-preview', // Nano Banana 2 with native image generation
  imageConfig: {
    aspectRatio: '1:1', // Square format for avatars
    imageSize: '512', // Lower resolution for smaller files and faster processing
  },
  responseModalities: ['TEXT', 'IMAGE'] as string[], // Make responseModalities mutable
}
