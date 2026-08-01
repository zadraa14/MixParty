"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, Flame, Hash, LogIn, Music2, Play, Sparkles, ThumbsUp, Users } from "lucide-react";

type PartyCardProps = {
  partyCode: string;
  creatingParty: boolean;
  onPartyCodeChange: (value: string) => void;
  onCreateParty: () => void;
  onJoinParty: () => void;
};

type DemoSong = {
  title: string;
  artist: string;
  duration: number;
  next: string;
  accent: string;
  glow: string;
};

const DEMO_SONGS: DemoSong[] = [
  {
    title: "One More Time",
    artist: "Daft Punk",
    duration: 222,
    next: "Titanium",
    accent: "from-violet-500 via-fuchsia-500 to-orange-400",
    glow: "rgba(168,85,247,0.34)",
  },
  {
    title: "Titanium",
    artist: "David Guetta",
    duration: 245,
    next: "Lose Yourself",
    accent: "from-cyan-400 via-blue-500 to-violet-500",
    glow: "rgba(59,130,246,0.34)",
  },
  {
    title: "Lose Yourself",
    artist: "Eminem",
    duration: 326,
    next: "Freed From Desire",
    accent: "from-rose-500 via-red-500 to-orange-400",
    glow: "rgba(244,63,94,0.32)",
  },
  {
    title: "Freed From Desire",
    artist: "Gala",
    duration: 213,
    next: "One More Time",
    accent: "from-emerald-400 via-cyan-400 to-blue-500",
    glow: "rgba(34,211,238,0.3)",
  },
];

const ACTIVITY = [
  { icon: Music2, label: "Emma a ajouté un titre" },
  { icon: ThumbsUp, label: "Lucas vient de voter" },
  { icon: Sparkles, label: "La file évolue en direct" },
];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function PartyCard({
  partyCode,
  creatingParty,
  onPartyCodeChange,
  onCreateParty,
  onJoinParty,
}: PartyCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [songIndex, setSongIndex] = useState(0);
  const [elapsed, setElapsed] = useState(133);
  const [participants, setParticipants] = useState(18);
  const [votes, setVotes] = useState(42);
  const [activityIndex, setActivityIndex] = useState(0);
  const [activityVisible, setActivityVisible] = useState(true);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const song = DEMO_SONGS[songIndex];
  const progress = Math.min(100, (elapsed / song.duration) * 100);

  useEffect(() => {
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= song.duration) {
          setSongIndex((index) => (index + 1) % DEMO_SONGS.length);
          setVotes((value) => Math.max(24, value - 9));
          return 18;
        }
        return current + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reduceMotion, song.duration]);

  useEffect(() => {
    if (reduceMotion) return;

    const voteTimer = window.setInterval(() => {
      setVotes((value) => value + 1);
      setParticipants((value) => Math.max(15, Math.min(27, value + (Math.random() > 0.45 ? 1 : -1))));
    }, 4800);

    const activityTimer = window.setInterval(() => {
      setActivityVisible(false);
      window.setTimeout(() => {
        setActivityIndex((index) => (index + 1) % ACTIVITY.length);
        setActivityVisible(true);
      }, 260);
    }, 6200);

    return () => {
      window.clearInterval(voteTimer);
      window.clearInterval(activityTimer);
    };
  }, [reduceMotion]);

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow || window.matchMedia("(pointer: coarse)").matches) return;

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
    if (cardRef.current) cardRef.current.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0)";
    if (glowRef.current) glowRef.current.style.transform = "translate(0, 0) scale(1)";
  }

  const ActivityIcon = ACTIVITY[activityIndex].icon;

  return (
    <section className="relative mx-auto w-full max-w-md [perspective:1200px] lg:max-w-none mixparty-reveal mixparty-reveal-delay-3">
      <div
        ref={glowRef}
        className="absolute inset-8 hidden rounded-full blur-[90px] transition-all duration-700 sm:block mixparty-card-aura"
        style={{ background: song.glow }}
      />

      <div
        ref={cardRef}
        onMouseMove={handleMove}
        onMouseLeave={resetCard}
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.065] p-4 shadow-[0_35px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-transform duration-300 ease-out will-change-transform sm:rounded-[34px] sm:p-7"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40 mixparty-sheen" />

        <div className="relative mb-4 flex items-center justify-between sm:mb-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">MixParty</p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">Lance ta soirée</h2>
          </div>
          <img src="/mixparty-logo-officiel.svg" alt="Logo MixParty" className="mixparty-logo-live h-14 w-20 shrink-0 object-contain sm:h-20 sm:w-24" />
        </div>

        <div className="relative mb-5 hidden overflow-hidden rounded-[24px] border border-white/[0.09] bg-black/30 p-4 shadow-inner sm:block">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${song.accent} opacity-[0.08] transition-opacity duration-700`} />
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl transition-colors duration-700" style={{ background: song.glow }} />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${song.accent} shadow-[0_12px_30px_rgba(0,0,0,0.3)]`}>
                <div className="absolute inset-1 rounded-full border border-white/20 mixparty-record-spin" />
                <Play className="relative z-10 h-5 w-5 fill-white text-white" />
                <span className="absolute inset-0 rounded-2xl border border-white/30 mixparty-play-ring" />
              </div>
              <div className="min-w-0 mixparty-song-swap" key={`${song.artist}-${song.title}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">En lecture</p>
                <p className="mt-1 truncate font-black">{song.title}</p>
                <p className="truncate text-xs text-white/40">{song.artist}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300 mixparty-live-pill">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 mixparty-live-dot" />
              <Users className="h-3.5 w-3.5" />
              <span key={participants} className="mixparty-number-pop">{participants}</span>
            </div>
          </div>

          <div className="relative mt-4 flex h-6 items-end gap-1" aria-hidden="true">
            {Array.from({ length: 22 }, (_, index) => (
              <span
                key={index}
                className={`mixparty-equalizer-bar flex-1 rounded-full bg-gradient-to-t ${song.accent}`}
                style={{ animationDelay: `${index * 70}ms`, animationDuration: `${700 + (index % 5) * 110}ms` }}
              />
            ))}
          </div>

          <div className="relative mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className={`relative h-full rounded-full bg-gradient-to-r ${song.accent} transition-[width] duration-1000 ease-linear`} style={{ width: `${progress}%` }}>
                <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]" />
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-medium text-white/30">
              <span>{formatTime(elapsed)}</span>
              <span>{formatTime(song.duration)}</span>
            </div>
          </div>

          <div className={`relative my-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-xs font-semibold text-white/55 transition duration-300 ${activityVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
            <ActivityIcon className="h-3.5 w-3.5 text-pink-300" />
            <span>{ACTIVITY[activityIndex].label}</span>
          </div>

          <div className="relative h-px bg-white/[0.07]" />

          <div className="relative mt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">Prochain titre</p>
              <p className="mt-1 text-sm font-black mixparty-next-title" key={song.next}>{song.next}</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-sm font-black text-purple-300">
              <ThumbsUp className="h-4 w-4" />
              <span key={votes} className="mixparty-number-pop">{votes} votes</span>
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
          <div className="relative overflow-hidden rounded-[22px] border border-white/20 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-4 py-4 shadow-[0_18px_50px_rgba(168,85,247,0.25)] sm:px-5 sm:py-5">
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
          <label htmlFor="party-code" className="mb-2 block text-sm font-bold text-white/65 sm:mb-3">Rejoindre une soirée existante</label>
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
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-4 pl-12 pr-4 font-black uppercase tracking-[0.16em] text-white outline-none transition duration-300 placeholder:text-xs placeholder:text-white/20 hover:border-white/20 focus:border-purple-400/60 focus:bg-black/35 focus:shadow-[0_0_25px_rgba(168,85,247,0.18)]"
              />
            </div>
            <button type="button" onClick={onJoinParty} className="group flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-6 py-4 font-black transition duration-300 hover:-translate-y-0.5 hover:border-purple-400/40 hover:bg-purple-500/15 hover:shadow-[0_12px_30px_rgba(168,85,247,0.14)] active:translate-y-0 active:scale-[0.98]">
              <LogIn className="h-5 w-5 text-purple-300 transition duration-300 group-hover:translate-x-0.5 group-hover:text-purple-200" />
              <span>Rejoindre</span>
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-[20px] border border-white/[0.07] bg-black/20 p-4 sm:mt-7 sm:rounded-[22px]">
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
