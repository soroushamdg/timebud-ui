import { LevelProgress } from '@/lib/gamification/xp'

interface LevelUpModalProps {
  levelProgress: LevelProgress
  onDismiss: () => void
}

// This whole modal is a deliberate, always-dark "spotlight" moment (see the
// celebration-* token comments in globals.css) — every color reference below is
// either one of those fixed tokens or a literal hex pinned to the app's dark-mode
// brand colors, never the flipping accent-*/text-*/bg-* tokens the rest of the app
// uses, so it doesn't wash out (or invert into a mess) when the app theme is light.
const CONFETTI = [
  { left: '8%', top: '18%', w: 8, h: 14, color: '#f5c518', rot: 20 },
  { left: '20%', top: '12%', w: 6, h: 6, color: '#e8004d', round: true },
  { left: '82%', top: '16%', w: 7, h: 12, color: '#2ecc71', rot: -25 },
  { left: '90%', top: '26%', w: 6, h: 6, color: '#f5c518', round: true },
  { left: '12%', top: '40%', w: 6, h: 6, color: '#fff', round: true },
  { left: '88%', top: '44%', w: 8, h: 14, color: '#e8004d', rot: 15 },
  { left: '6%', top: '60%', w: 7, h: 12, color: '#f5c518', rot: -15 },
  { left: '93%', top: '62%', w: 6, h: 6, color: '#2ecc71', round: true },
]

export function LevelUpModal({ levelProgress, onDismiss }: LevelUpModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center text-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 500px 400px at 50% 30%, rgba(245,197,24,.22), transparent 65%), var(--color-celebration-bg)',
      }}
    >
      {CONFETTI.map((c, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: c.left,
            top: c.top,
            width: c.w,
            height: c.h,
            background: c.color,
            borderRadius: c.round ? 999 : 2,
            transform: c.rot ? `rotate(${c.rot}deg)` : undefined,
          }}
        />
      ))}

      <button
        onClick={onDismiss}
        className="absolute top-14 right-5 w-9 h-9 rounded-full bg-overlay-surface flex items-center justify-center text-celebration-text/70 text-sm"
      >
        &#10005;
      </button>

      <div className="relative flex-1 flex flex-col items-center justify-center px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bud/bud-avatar.png"
          alt="Bud"
          className="w-20 h-20 rounded-full border-2 object-cover mb-3 shadow-[0_0_30px_rgba(245,197,24,0.35)]"
          style={{ borderColor: '#f5c518' }}
        />
        <div className="text-xs font-extrabold tracking-[0.14em] uppercase" style={{ color: '#f5c518' }}>
          Level Up
        </div>
        <div
          className="text-7xl font-black leading-none mt-2"
          style={{
            background: 'linear-gradient(180deg, #fff, #f5c518)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          LVL {levelProgress.level}
        </div>
        <div className="text-lg font-bold text-celebration-text mt-3">
          You outgrew Level {levelProgress.level - 1}.
        </div>
        <div className="text-sm text-celebration-text/60 mt-1.5">
          {levelProgress.xpTotal} XP total &middot; welcome to {levelProgress.levelTitle}
        </div>

        <div
          className="mt-6 w-full max-w-sm rounded-2xl px-5 py-4 text-left"
          style={{ backgroundColor: 'var(--color-celebration-card)', border: '1px solid var(--color-celebration-border)' }}
        >
          <div className="flex justify-between text-sm">
            <span className="text-celebration-text/60">Progress to Level {levelProgress.level + 1}</span>
            <span className="font-bold" style={{ color: '#f5c518' }}>
              {levelProgress.xpIntoLevel}/{levelProgress.xpForNextLevel} XP
            </span>
          </div>
          <div className="h-2 rounded-full bg-celebration-track mt-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (levelProgress.xpIntoLevel / Math.max(1, levelProgress.xpForNextLevel)) * 100)}%`,
                background: 'linear-gradient(90deg, #f5c518, #ffdf6b)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm px-6 pb-10">
        <button
          onClick={onDismiss}
          className="w-full font-extrabold py-4 rounded-full"
          style={{ backgroundColor: '#f5c518', color: '#000000' }}
        >
          Keep grinding
        </button>
      </div>
    </div>
  )
}
