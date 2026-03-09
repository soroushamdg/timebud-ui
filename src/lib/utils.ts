import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function getDiceBearUrl(seed: string, color?: string): string {
  const baseUrl = 'https://api.dicebear.com/7.x/avataaars/svg'
  const params = new URLSearchParams()
  params.set('seed', seed)
  if (color) {
    params.set('backgroundColor', color.replace('#', ''))
  }
  return `${baseUrl}?${params.toString()}`
}
