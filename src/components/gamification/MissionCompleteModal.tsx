interface MissionCompleteModalProps {
  missionName: string
  xpEarned: number
  onDismiss: () => void
}

export function MissionCompleteModal({ missionName, xpEarned, onDismiss }: MissionCompleteModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center text-center"
      style={{
        background:
          'radial-gradient(ellipse 500px 400px at 50% 30%, rgba(46,204,113,.20), transparent 65%), #000',
      }}
    >
      <button
        onClick={onDismiss}
        className="absolute top-14 right-5 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-sm"
      >
        &#10005;
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bud/bud-avatar.png"
            alt="Bud"
            className="w-24 h-24 rounded-full border-2 border-accent-green object-cover shadow-[0_0_30px_rgba(46,204,113,0.35)]"
          />
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-accent-green border-2 border-black flex items-center justify-center text-lg">
            &#127942;
          </div>
        </div>
        <div className="text-xs font-extrabold tracking-[0.14em] text-accent-green uppercase">
          Mission Complete
        </div>
        <div className="text-2xl font-black text-white mt-4">{missionName}</div>
        <div className="text-sm text-text-sec mt-1">Every job done. Nothing left on hold.</div>

        <div className="mt-6 bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl px-6 py-4">
          <div className="text-xs text-text-sec uppercase tracking-wide">Total earned</div>
          <div className="text-3xl font-black text-accent-green mt-1">{xpEarned} XP</div>
        </div>
      </div>

      <div className="w-full max-w-sm px-6 pb-10">
        <button
          onClick={onDismiss}
          className="w-full bg-accent-green text-black font-extrabold py-4 rounded-full"
        >
          Start the next one
        </button>
      </div>
    </div>
  )
}
