interface MissionCompleteModalProps {
  missionName: string
  xpEarned: number
  onDismiss: () => void
}

// Always-dark celebration modal — see the comment on LevelUpModal (same rationale):
// pinned to the celebration-* tokens and literal brand-green hex, not the flipping
// accent-*/text-*/bg-* tokens, so it stays a proper spotlight moment in light mode too.
export function MissionCompleteModal({ missionName, xpEarned, onDismiss }: MissionCompleteModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center text-center"
      style={{
        background:
          'radial-gradient(ellipse 500px 400px at 50% 30%, rgba(46,204,113,.20), transparent 65%), var(--color-celebration-bg)',
      }}
    >
      <button
        onClick={onDismiss}
        className="absolute top-14 right-5 w-9 h-9 rounded-full bg-overlay-surface flex items-center justify-center text-celebration-text/70 text-sm"
      >
        &#10005;
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bud/bud-avatar.png"
            alt="Bud"
            className="w-24 h-24 rounded-full border-2 object-cover shadow-[0_0_30px_rgba(46,204,113,0.35)]"
            style={{ borderColor: '#2ecc71' }}
          />
          <div
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full border-2 flex items-center justify-center text-lg"
            style={{ backgroundColor: '#2ecc71', borderColor: 'var(--color-celebration-ring)' }}
          >
            &#127942;
          </div>
        </div>
        <div className="text-xs font-extrabold tracking-[0.14em] uppercase" style={{ color: '#2ecc71' }}>
          Mission Complete
        </div>
        <div className="text-2xl font-black text-celebration-text mt-4">{missionName}</div>
        <div className="text-sm text-celebration-text/60 mt-1">Every job done. Nothing left on hold.</div>

        <div
          className="mt-6 rounded-2xl px-6 py-4"
          style={{ backgroundColor: 'var(--color-celebration-card)', border: '1px solid var(--color-celebration-border)' }}
        >
          <div className="text-xs text-celebration-text/60 uppercase tracking-wide">Total earned</div>
          <div className="text-3xl font-black mt-1" style={{ color: '#2ecc71' }}>{xpEarned} XP</div>
        </div>
      </div>

      <div className="w-full max-w-sm px-6 pb-10">
        <button
          onClick={onDismiss}
          className="w-full font-extrabold py-4 rounded-full"
          style={{ backgroundColor: '#2ecc71', color: '#000000' }}
        >
          Start the next one
        </button>
      </div>
    </div>
  )
}
