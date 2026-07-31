"use client";

import { useRef, type MouseEvent } from "react";
import { ArrowRight, Flame, Hash, LogIn, Play, Users } from "lucide-react";

type PartyCardProps = {
  partyCode: string;
  creatingParty: boolean;
  onPartyCodeChange: (value: string) => void;
  onCreateParty: () => void;
  onJoinParty: () => void;
};

export default function PartyCard({
  partyCode,
  creatingParty,
  onPartyCodeChange,
  onCreateParty,
  onJoinParty,
}: PartyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;

    const rect = card.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((mouseX - centerX) / centerX) * 2.5;
    const rotateX = ((centerY - mouseY) / centerY) * 2.5;

    card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    glow.style.transform = `translate(${(mouseX - centerX) * 0.06}px, ${(mouseY - centerY) * 0.06}px) scale(1.08)`;
  }

  function resetCard() {
    if (cardRef.current) {
      cardRef.current.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0)";
    }
    if (glowRef.current) {
      glowRef.current.style.transform = "translate(0, 0) scale(1)";
    }
  }

  return (
    <section className="relative mx-auto w-full max-w-md [perspective:1200px] lg:max-w-none">
      <div ref={glowRef} className="absolute inset-10 hidden sm:block rounded-full bg-gradient-to-br from-purple-600/25 via-pink-500/20 to-orange-400/15 blur-[80px] transition-transform duration-300 ease-out" />

      <div
        ref={cardRef}
        onMouseMove={handleMove}
        onMouseLeave={resetCard}
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.065] p-4 sm:rounded-[34px] shadow-[0_35px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform duration-300 ease-out will-change-transform sm:p-7"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="mb-4 flex items-center justify-between sm:mb-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">MixParty</p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">Lance ta soirée</h2>
          </div>
          <img src="/mixparty-logo-officiel.svg" alt="Logo MixParty" className="h-14 w-20 sm:h-20 sm:w-24 shrink-0 object-contain" />
        </div>

        <div className="mb-5 hidden overflow-hidden sm:block rounded-[24px] border border-white/[0.08] bg-black/25 p-4 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/25 via-pink-500/20 to-orange-400/20">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/30">En lecture</p>
                <p className="mt-1 font-black">One More Time</p>
                <p className="text-xs text-white/35">Daft Punk</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
              <Users className="h-3.5 w-3.5" />18
            </div>
          </div>

          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-medium text-white/25"><span>2:13</span><span>3:42</span></div>
          </div>

          <div className="my-4 h-px bg-white/[0.07]" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/30">Prochain titre</p>
              <p className="mt-1 text-sm font-black">Titanium</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-sm font-black text-purple-300">
              <Users className="h-4 w-4" /><span>42 votes</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateParty}
          disabled={creatingParty}
          className="group relative w-full rounded-[22px] transition duration-300 hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 opacity-35 blur-xl transition duration-500 group-hover:opacity-70" />
          <div className="relative overflow-hidden rounded-[22px] border border-white/20 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_18px_50px_rgba(168,85,247,0.25)]">
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/10" />
            <div className="absolute -left-28 top-[-40%] h-[180%] w-20 rotate-[20deg] bg-white/30 blur-md transition-all duration-700 ease-out group-hover:left-[120%]" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-base font-black sm:text-lg">{creatingParty ? "Création en cours..." : "Créer une soirée"}</p>
                <p className="mt-1 text-xs text-white/75 sm:text-sm">Obtiens immédiatement ton code et ton QR Code.</p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)] backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-white/30">
                <ArrowRight className="h-5 w-5 text-white transition duration-300 group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </button>

        <div className="my-5 flex items-center gap-4 sm:my-7">
          <div className="h-px flex-1 bg-white/10" />
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/25">ou</p>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div>
          <label htmlFor="party-code" className="mb-2 block text-sm font-bold sm:mb-3 text-white/65">Rejoindre une soirée existante</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Hash className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
              <input
                suppressHydrationWarning
                id="party-code"
                placeholder="CODE"
                value={partyCode}
                maxLength={10}
                onChange={(event) => onPartyCodeChange(event.target.value.toUpperCase())}
                onKeyDown={(event) => { if (event.key === "Enter") onJoinParty(); }}
                inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-4 pl-12 pr-4 font-black uppercase tracking-[0.16em] text-white outline-none transition duration-300 placeholder:text-xs placeholder:text-white/20 hover:border-white/20 focus:border-purple-400/60 focus:bg-black/35 focus:shadow-[0_0_25px_rgba(168,85,247,0.18)]"
              />
            </div>
            <button type="button" onClick={onJoinParty} className="group flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-6 py-4 font-black transition duration-300 hover:-translate-y-0.5 hover:border-purple-400/40 hover:bg-purple-500/15 hover:shadow-[0_12px_30px_rgba(168,85,247,0.14)] active:translate-y-0 active:scale-[0.98]">
              <LogIn className="h-5 w-5 text-purple-300 transition duration-300 group-hover:translate-x-0.5 group-hover:text-purple-200" />
              <span>Rejoindre</span>
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-[20px] sm:mt-7 sm:rounded-[22px] border border-white/[0.07] bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10"><Flame className="h-5 w-5 text-orange-300" /></div>
            <div>
              <p className="font-black">Aucun compte nécessaire</p>
              <p className="mt-1 text-xs leading-relaxed text-white/35 sm:text-sm">Un code suffit pour rejoindre, proposer des musiques et voter avec tes amis.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
