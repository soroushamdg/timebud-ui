'use client'

interface CacheEntry {
  url: string
  timestamp: number
  etag?: string
}

interface ImageCache {
  [key: string]: CacheEntry
}

export class ImageCacheManager {
  private cache: ImageCache = {}
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly CACHE_KEY = 'timebud_image_cache'

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    if (typeof window === 'undefined') return // Skip on server-side
    
    try {
      const cached = localStorage.getItem(this.CACHE_KEY)
      if (cached) {
        this.cache = JSON.parse(cached)
        this.cleanupExpired()
      }
    } catch (error) {
      console.warn('Failed to load image cache:', error)
      this.cache = {}
    }
  }

  private saveCache(): void {
    if (typeof window === 'undefined') return // Skip on server-side
    
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache))
    } catch (error) {
      console.warn('Failed to save image cache:', error)
    }
  }

  private cleanupExpired(): void {
    const now = Date.now()
    Object.keys(this.cache).forEach(key => {
      if (now - this.cache[key].timestamp > this.CACHE_DURATION) {
        delete this.cache[key]
      }
    })
  }

  get(key: string): string | null {
    const entry = this.cache[key]
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > this.CACHE_DURATION) {
      delete this.cache[key]
      this.saveCache()
      return null
    }

    return entry.url
  }

  set(key: string, url: string, etag?: string): void {
    this.cache[key] = {
      url,
      timestamp: Date.now(),
      etag
    }
    this.saveCache()
  }

  invalidate(key: string): void {
    delete this.cache[key]
    this.saveCache()
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    Object.keys(this.cache).forEach(key => {
      if (regex.test(key)) {
        delete this.cache[key]
      }
    })
    this.saveCache()
  }

  clear(): void {
    this.cache = {}
    this.saveCache()
  }

  // Generate cache key for different image types
  static generateProfileKey(userId: string): string {
    return `profile_${userId}`
  }

  static generateProjectKey(projectId: string): string {
    return `project_${projectId}`
  }

  static generateStaticKey(path: string): string {
    return `static_${path}`
  }
}

export const imageCache = new ImageCacheManager()
