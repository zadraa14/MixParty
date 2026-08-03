"use client";

import { useEffect, useMemo, useState } from "react";
import { Headphones, Pause, Play, SkipBack, SkipForward, Sparkles, Users, Vote } from "lucide-react";
import { NeonBadge } from "./ui";

const BARS = [28, 58, 42, 76, 46, 88, 54, 72, 36, 64, 92, 51, 79, 45, 68, 31, 57, 83, 49, 70, 40, 61, 34, 52, 27, 43, 24];

export default function PartyCard() {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(102);
  const [votes, setVotes] = useState(87);
  const reduceMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    if (!playing || reduceMotion) return;
    const timer = window.setInterval(() => setElapsed((value) => (value >= 199 ? 0 : value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [playing, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setVotes((value) => value + 1), 5200);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const progress = `${Math.min(100, (elapsed / 200) * 100)}%`;
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <section className="mixparty-reveal mixparty-reveal-delay-4 relative mx-auto w-full max-w-[340px] sm:max-w-[430px] lg:max-w-[560px] lg:mx-0">
      <div className="mixparty-phone-aura pointer-events-none absolute -inset-12 rounded-[68px]" />
      <div className="mixparty-phone-frame relative overflow-hidden rounded-[46px] p-[2px]">
        <div className="mixparty-phone-shell rounded-[44px] p-4 sm:p-5">
          <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-white/10" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Aperçu en direct</p>
              <p className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black">Ta soirée prend vie</p>
            </div>
            <NeonBadge accent="success"><RadioDot /> Live</NeonBadge>
          </div>

          <div className="mixparty-now-card mt-5 rounded-[27px] p-4 sm:p-5">
            <div className="flex gap-4">
              <div className="mixparty-premium-cover relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] sm:h-28 sm:w-28">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,#ff4a8d_0%,#9b1aff_35%,#16051f_72%)]" />
                <div className="absolute inset-x-5 bottom-0 h-[78%] rounded-t-[48%] bg-black/70 blur-[1px]" />
                <div className="absolute left-[26%] top-[18%] h-10 w-12 rounded-[45%] bg-black/85 shadow-[0_0_28px_rgba(255,55,145,.65)]" />
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,.25),transparent_35%,rgba(249,115,22,.22))]" />
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Maintenant</p>
                <p className="mt-1 truncate font-[family:var(--font-exo-2)] text-2xl font-black">Blinding Lights</p>
                <p className="mt-1 text-sm font-semibold text-white/45">The Weeknd</p>
              </div>

              <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/10 px-3 py-2 text-center self-start">
                <p className="text-xl font-black text-fuchsia-100">{votes}</p>
                <p className="text-[9px] uppercase tracking-wider text-white/30">votes</p>
              </div>
            </div>

            <div className="mixparty-waveform mt-5 flex h-14 items-center gap-[3px] overflow-hidden">
              {BARS.map((height, index) => <span key={index} style={{ height: `${height}%`, animationDelay: `${index * 45}ms` }} />)}
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-400 to-orange-400 transition-[width] duration-1000" style={{ width: progress }} /></div>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-white/30"><span>{format(elapsed)}</span><span>3:20</span></div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/25 px-3 py-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/25">Prochain titre</p>
                <p className="mt-1 text-sm font-black">Levitating <span className="font-medium text-white/35">— Dua Lipa</span></p>
              </div>
              <span className="text-xs font-bold text-white/42">42 votes</span>
            </div>
          </div>

          <div className="mixparty-controls mt-4 flex items-center justify-center gap-8 rounded-[24px] border border-white/[0.07] bg-black/25 py-4">
            <button type="button" className="mixparty-skip-button" aria-label="Titre précédent"><SkipBack className="h-5 w-5 fill-current" /></button>
            <button type="button" className="mixparty-big-play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause" : "Lecture"}>
              <span className="mixparty-big-play-ring" />
              {playing ? <Pause className="relative h-7 w-7 fill-current" /> : <Play className="relative ml-1 h-7 w-7 fill-current" />}
            </button>
            <button type="button" className="mixparty-skip-button" aria-label="Titre suivant"><SkipForward className="h-5 w-5 fill-current" /></button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat icon={Users} value="27" label="En ligne" accent="purple" />
            <MiniStat icon={Vote} value="156" label="Votes" accent="pink" />
            <MiniStat icon={Headphones} value="Auto" label="DJ actif" accent="orange" />
          </div>
        </div>
      </div>
    </section>
  );
}

function RadioDot() {
  return <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.85)]" />;
}

function MiniStat({ icon: Icon, value, label, accent }: { icon: typeof Sparkles; value: string; label: string; accent: string }) {
  return <div className={`mixparty-mini-stat mixparty-mini-stat--${accent}`}><Icon className="mx-auto h-4 w-4" /><p className="mt-2 text-lg font-black">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-white/30">{label}</p></div>;
}
