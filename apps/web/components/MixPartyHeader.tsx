export default function MixPartyHeader() {
  return (
    <header className="flex items-center justify-center sm:justify-between">
      <div className="group flex items-center gap-2.5 sm:gap-4">
        <div className="relative shrink-0">
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/25 to-orange-400/20 opacity-60 blur-xl transition duration-500 group-hover:scale-125 group-hover:opacity-90" />
          <img
            src="/mixparty-logo-officiel.svg"
            alt=""
            aria-hidden="true"
            className="relative h-16 w-16 object-contain transition duration-500 group-hover:rotate-2 group-hover:scale-105 sm:h-24 sm:w-24"
          />
        </div>

        <div
          aria-label="MixParty"
          className="-skew-x-6 font-[family:var(--font-exo-2)] text-[1.65rem] font-black leading-none tracking-[0.11em] transition-transform duration-300 group-hover:scale-[1.03] sm:text-[2.5rem] sm:tracking-[0.16em]"
        >
          <span className="text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.16)]">MIX</span>
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(236,72,153,0.28)]">PARTY</span>
        </div>
      </div>

      <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/45 backdrop-blur-xl sm:flex">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
        Soirées en direct
      </div>
    </header>
  );
}
