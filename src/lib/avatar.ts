const cache = new Map<string, string>()
export function getDiceBearUrl(seed: string, color?: string | null): string {
  const key = `${seed}-${color ?? ''}` 
  if (cache.has(key)) return cache.get(key)!
  const bg = (color ?? '#F5C518').replace('#', '')
  const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=${bg}&backgroundType=solid` 
  cache.set(key, url)
  return url
}
