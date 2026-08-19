import { MissionDifficulty } from '@/types/database'

// Mirrors the `award_xp_on_task_completion` Postgres trigger (supabase/migrations/
// 20260819001410_add_gamification_xp_and_difficulty.sql) — kept here too so the UI can
// show an accurate "+15 XP" preview before a job is actually completed.
export const BASE_JOB_XP = 10
export const MISSION_COMPLETE_BONUS_XP = 100
export const DIFFICULTY_XP_MULTIPLIER: Record<MissionDifficulty, number> = {
  easy: 0.5,
  medium: 1,
  hard: 1.5,
}

// Awarded once per newly-crossed streak milestone (3/7/14/30/60/100 days) — applied
// alongside `last_streak_milestone` in the cron route, not via the DB trigger, since
// streak state lives in `user_ai_settings` and is already deduped there.
export const STREAK_MILESTONE_BONUS_XP = 50

export function getJobXpPreview(difficulty: MissionDifficulty): number {
  return Math.round(BASE_JOB_XP * DIFFICULTY_XP_MULTIPLIER[difficulty])
}

const LEVEL_TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 20, title: 'Legend' },
  { minLevel: 10, title: 'Operator' },
  { minLevel: 5, title: 'Grinder' },
  { minLevel: 1, title: 'Rookie' },
]

function getLevelTitle(level: number): string {
  return LEVEL_TITLES.find((t) => level >= t.minLevel)?.title ?? 'Rookie'
}

// Cumulative XP needed to REACH a given level, on a quadratic curve (gaps between
// levels grow over time instead of every level costing the same, flat amount).
function cumulativeXpForLevel(level: number): number {
  return 50 * level * level
}

export interface LevelProgress {
  level: number
  levelTitle: string
  xpIntoLevel: number
  xpForNextLevel: number
  xpTotal: number
}

export function getLevelProgress(xpTotal: number): LevelProgress {
  const xp = Math.max(0, xpTotal)
  let level = 1
  while (cumulativeXpForLevel(level + 1) <= xp) level++

  const currentLevelFloor = cumulativeXpForLevel(level)
  const nextLevelFloor = cumulativeXpForLevel(level + 1)

  return {
    level,
    levelTitle: getLevelTitle(level),
    xpIntoLevel: xp - currentLevelFloor,
    xpForNextLevel: nextLevelFloor - currentLevelFloor,
    xpTotal: xp,
  }
}
