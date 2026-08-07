"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  Headphones,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Sparkles,
  UsersRound,
  Vote,
  WandSparkles,
  Zap,
} from "lucide-react";
import MixPartyBackground from "../components/MixPartyBackground";
import MixPartyFooter from "../components/MixPartyFooter";
import MixPartyHeader from "../components/MixPartyHeader";
import MixPartyLoader from "../components/MixPartyLoader";
import { getApiBaseUrl } from "../lib/config";

const STEPS = [
  { number: "01", title: "Crée", text: "Lance ta salle MixParty en quelques secondes.", icon: Sparkles, accent: "purple" },
  { number: "02", title: "Partage", text: "Tes invités rejoignent la soirée avec le QR Code.", icon: QrCode, accent: "cyan" },
  { number: "03", title: "Vote", text: "Chaque participant influence la prochaine musique.", icon: Vote, accent: "pink" },
  { number: "04", title: "Profite", text: "PartyBrain maintient l’ambiance toute la nuit.", icon: Radio, accent: "orange" },
] as const;

const STATS = [
  { label: "Temps réel", value: "Instantané", description: "Votes, file et participants synchronisés.", icon: Zap, accent: "orange" },
  { label: "Collaboratif", value: "Tout le monde", description: "Chaque invité participe à l’ambiance.", icon: UsersRound, accent: "purple" },
  { label: "PartyBrain", value: "Plus malin", description: "Des suggestions adaptées à ta soirée.", icon: Bot, accent: "cyan" },
  { label: "Accès", value: "1 QR Code", description: "Aucun compte nécessaire pour rejoindre.", icon: QrCode, accent: "pink" },
] as const;

const WAVE = [30, 52, 74, 44, 88, 58, 96, 68, 42, 82, 56, 92, 64, 38, 76, 48, 86, 60, 34, 70, 50, 90, 62, 40, 78, 54, 84, 46];

export default function Home() {
  const router = useRouter();
  const [partyCode, setPartyCode] = useState("");
  const [creatingParty, setCreatingParty] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [resumeParty, setResumeParty] = useState<{ code: string; role: "dj" | "guest"; name?: string } | null>(null);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLoaderVisible(false), 1900);
    const removeTimer = window.setTimeout(() => setShowLoader(false), 2550);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function detectLastParty() {
      const raw = localStorage.getItem("mixparty.lastParty.v1");
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { code?: string; role?: "dj" | "guest"; name?: string };
        const code = String(saved?.code || "").trim().toUpperCase();
        if (!code) { localStorage.removeItem("mixparty.lastParty.v1"); return; }
        const response = await fetch(`${getApiBaseUrl()}/party/${encodeURIComponent(code)}`, { cache: "no-store" });
        if (!response.ok) {
          localStorage.removeItem("mixparty.lastParty.v1");
          if (!cancelled) setResumeParty(null);
          return;
        }
        const creatorToken = localStorage.getItem(`mixparty_creator_${code}`);
        if (!cancelled) setResumeParty({ code, role: creatorToken ? "dj" : "guest", name: saved?.name });
      } catch {
        localStorage.removeItem("mixparty.lastParty.v1");
      }
    }
    void detectLastParty();
    return () => { cancelled = true; };
  }, []);

  async function createParty() {
    if (creatingParty) return;
    setCreatingParty(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/party`, { method: "POST" });
      if (!response.ok) throw new Error(`Erreur API ${response.status}`);
      const party = (await response.json()) as { code?: string; creatorToken?: string };
      if (!party.code || !party.creatorToken) throw new Error("La réponse de création est incomplète.");
      localStorage.setItem(`mixparty_creator_${party.code}`, party.creatorToken);
      localStorage.setItem("mixparty.lastParty.v1", JSON.stringify({ code: party.code, role: "dj", savedAt: Date.now() }));
      router.push(`/party/${party.code}`);
    } catch (error) {
      console.error(error);
      window.alert("Impossible de créer la soirée. Vérifie que l’API est démarrée.");
      setCreatingParty(false);
    }
  }

  function joinParty() {
    const normalizedCode = partyCode.trim().toUpperCase();
    if (!normalizedCode) {
      window.alert("Entre un code de soirée");
      return;
    }
    router.push(`/party/${normalizedCode}`);
  }

  function resumeLastParty() {
    if (!resumeParty?.code) return;
    router.push(`/party/${resumeParty.code}`);
  }

  return (
    <>
      {showLoader && <MixPartyLoader visible={loaderVisible} />}

      <main className="mp521-page relative isolate min-h-[100dvh] overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />
        <div className="mp521-depth pointer-events-none fixed inset-0 z-[1]" />
        <div className="mp521-particles pointer-events-none fixed inset-0 z-[2]" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
          <MixPartyHeader />

          <section className="grid min-h-[calc(100dvh-108px)] items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(460px,.98fr)] lg:gap-16 lg:py-16">
            <div className="relative z-10 max-w-2xl">
              <div className="mp521-reveal mp521-reveal-1 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/[0.08] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-200 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl sm:text-xs">
                <span className="mp521-live-dot h-2 w-2 rounded-full bg-emerald-400" />
                La soirée devient collaborative
              </div>

              <h1 className="mp521-reveal mp521-reveal-2 mt-6 font-[family:var(--font-exo-2)] text-[clamp(3.25rem,8vw,6.7rem)] font-black leading-[.88] tracking-[-.065em]">
                <span className="block text-white drop-shadow-[0_0_22px_rgba(255,255,255,.11)]">Ta soirée.</span>
                <span className="mp521-hero-gradient block">Leur playlist.</span>
              </h1>

              <p className="mp521-reveal mp521-reveal-3 mt-7 max-w-xl text-base font-medium leading-7 text-white/52 sm:text-lg sm:leading-8">
                Crée une salle, partage le QR Code et laisse tes invités proposer puis voter pour les prochains titres. MixParty s’occupe du reste.
              </p>

              {resumeParty ? (
                <button type="button" onClick={resumeLastParty} className="mp521-reveal mp521-reveal-4 mt-7 flex w-full max-w-xl items-center gap-4 rounded-[22px] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/[0.09] via-purple-500/[0.08] to-orange-400/[0.07] p-3.5 text-left shadow-[0_18px_55px_rgba(34,211,238,.08)] transition hover:border-cyan-300/35 hover:bg-white/[0.07] sm:p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200"><RotateCcw className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-[.18em] text-cyan-300/70">{resumeParty.role === "dj" ? "Ta soirée est toujours active" : "Tu étais dans cette soirée"}</span>
                    <span className="mt-1 block truncate text-sm font-black text-white sm:text-base">{resumeParty.role === "dj" ? "Reprendre ma soirée" : "Retourner à la soirée"} · {resumeParty.code}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-white/45" />
                </button>
              ) : null}

              <div className="mp521-reveal mp521-reveal-4 mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={createParty} disabled={creatingParty} className="mp521-primary-button group">
                  <span className="mp521-button-shine" aria-hidden="true" />
                  <span className="relative z-10 flex items-center justify-center gap-2.5">
                    {creatingParty ? <span className="mp-button-spinner" /> : <Sparkles className="h-5 w-5" />}
                    {creatingParty ? "Création..." : "Créer ma soirée"}
                    {!creatingParty && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />}
                  </span>
                </button>

                <a href="#rejoindre" className="mp521-secondary-button group">
                  <span className="flex items-center justify-center gap-2.5">
                    <UsersRound className="h-5 w-5" />
                    Rejoindre une soirée
                  </span>
                </a>
              </div>

              <div className="mp521-reveal mp521-reveal-5 mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-white/35">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Sans compte</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />En temps réel</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" />Pensé pour mobile</span>
              </div>
            </div>

            <div className="mp521-reveal mp521-reveal-3 relative mx-auto w-full max-w-[570px] lg:mx-0">
              <div className="mp521-phone-aura pointer-events-none absolute inset-[10%] rounded-full" />
              <div className="mp521-orbit mp521-orbit-one" />
              <div className="mp521-orbit mp521-orbit-two" />

              <div className="mp521-phone-shell relative mx-auto w-[min(100%,390px)] rounded-[48px] p-[7px] sm:w-[390px]">
                <div className="relative overflow-hidden rounded-[41px] border border-white/[0.09] bg-[#090913] px-5 pb-6 pt-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
                  <div className="mx-auto h-1.5 w-20 rounded-full bg-white/10" />

                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.23em] text-orange-300/75">En lecture</p>
                      <p className="mt-1 text-sm font-black text-white">MixParty Live</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[9px] font-black text-emerald-300">
                      <span className="mp521-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE
                    </div>
                  </div>

                  <div className="mp521-cover relative mx-auto mt-6 aspect-square w-full max-w-[285px] overflow-hidden rounded-[32px]">
                    <div className="mp521-cover-grid absolute inset-0" />
                    <div className="mp521-cover-glow absolute -left-10 top-8 h-40 w-40 rounded-full bg-purple-500/60 blur-[45px]" />
                    <div className="mp521-cover-glow absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-orange-500/55 blur-[50px] [animation-delay:1.2s]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="mp521-vinyl flex h-[68%] w-[68%] items-center justify-center rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,#0a0a12_0_13%,#f97316_14%_17%,#18111f_18%_26%,#0a0a12_27%_36%,#211228_37%_48%,#07070d_49%_100%)] shadow-[0_24px_70px_rgba(0,0,0,.55),0_0_55px_rgba(236,72,153,.24)]">
                        <div className="h-3 w-3 rounded-full bg-white/85 shadow-[0_0_16px_rgba(255,255,255,.65)]" />
                      </div>
                    </div>
                    <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">PartyBrain selection</p>
                      <p className="mt-1 truncate font-[family:var(--font-exo-2)] text-base font-black">Midnight Energy</p>
                    </div>
                  </div>

                  <div className="mt-5 text-center">
                    <p className="font-[family:var(--font-exo-2)] text-xl font-black tracking-tight">Midnight Energy</p>
                    <p className="mt-1 text-xs font-semibold text-white/35">MixParty Session • 3:42</p>
                  </div>

                  <div className="mp521-waveform mt-5" aria-label="Visualisation audio">
                    {WAVE.map((height, index) => (
                      <span key={index} style={{ height: `${height}%`, animationDelay: `${index * 48}ms` }} />
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-5">
                    <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Titre précédent">
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    </button>
                    <button type="button" className="mp521-play-button" aria-label="Lecture">
                      <span className="mp521-play-ring" />
                      <Play className="relative z-10 ml-1 h-7 w-7 fill-current" />
                    </button>
                    <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Titre suivant">
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <div className="mp521-mini-stat"><UsersRound className="h-4 w-4 text-purple-300" /><strong>24</strong><span>invités</span></div>
                    <div className="mp521-mini-stat"><Vote className="h-4 w-4 text-pink-300" /><strong>186</strong><span>votes</span></div>
                    <div className="mp521-mini-stat"><Headphones className="h-4 w-4 text-orange-300" /><strong>38</strong><span>titres</span></div>
                  </div>
                </div>
              </div>

              <div className="mp521-floating-card mp521-floating-card-left hidden sm:flex">
                <div className="mp521-floating-icon bg-purple-400/10 text-purple-200"><UsersRound className="h-4 w-4" /></div>
                <div><strong>+8 invités</strong><span>viennent de rejoindre</span></div>
              </div>
              <div className="mp521-floating-card mp521-floating-card-right hidden sm:flex">
                <div className="mp521-floating-icon bg-orange-400/10 text-orange-200"><WandSparkles className="h-4 w-4" /></div>
                <div><strong>PartyBrain</strong><span>ambiance optimisée</span></div>
              </div>
            </div>
          </section>

          <section id="rejoindre" className="py-14 sm:py-20">
            <div className="mp521-join-card mx-auto grid max-w-5xl gap-7 rounded-[34px] p-5 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
              <div>
                <span className="mp521-section-kicker">Déjà invité ?</span>
                <h2 className="mt-3 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-4xl">Entre dans la soirée.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/42 sm:text-base">Saisis le code affiché par l’organisateur et rejoins instantanément la playlist collective.</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <input
                  value={partyCode}
                  onChange={(event) => setPartyCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => event.key === "Enter" && joinParty()}
                  maxLength={8}
                  placeholder="CODE"
                  className="mp521-code-input min-w-0 sm:w-44"
                  aria-label="Code de la soirée"
                />
                <button type="button" onClick={joinParty} className="mp521-primary-button mp521-primary-button--compact group">
                  <span className="mp521-button-shine" aria-hidden="true" />
                  <span className="relative z-10 flex items-center justify-center gap-2">Rejoindre <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </button>
              </div>
            </div>
          </section>

          <section className="py-14 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mp521-section-kicker">Pourquoi MixParty</span>
              <h2 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-5xl">Une soirée qui <span className="mp521-inline-gradient">réagit en direct.</span></h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/42 sm:text-base">Chaque téléphone devient une télécommande musicale collective, sans compte et sans installation compliquée.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map(({ label, value, description, icon: Icon, accent }, index) => (
                <article key={label} className={`mp521-stat-card mp521-accent-${accent}`} style={{ animationDelay: `${index * 100}ms` }}>
                  <div className="mp521-stat-icon"><Icon className="h-5 w-5" /></div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-white/27">{label}</p>
                  <p className="mt-2 font-[family:var(--font-exo-2)] text-xl font-black text-white">{value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/38">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="py-14 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mp521-section-kicker mp521-section-kicker--pink">Comment ça marche</span>
              <h2 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-5xl">Quatre étapes. <span className="mp521-inline-gradient">Une seule ambiance.</span></h2>
            </div>
            <div className="mp521-timeline relative mt-12 grid gap-5 lg:grid-cols-4">
              <div className="mp521-timeline-line hidden lg:block" />
              {STEPS.map(({ number, title, text, icon: Icon, accent }, index) => (
                <article key={number} className={`mp521-step-card mp521-accent-${accent}`}>
                  <div className="mp521-step-node"><span>{number}</span></div>
                  <div className="mp521-stat-icon"><Icon className="h-5 w-5" /></div>
                  <p className="mt-5 font-[family:var(--font-exo-2)] text-xl font-black">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/40">{text}</p>
                  <span className="mp521-step-index">0{index + 1}</span>
                </article>
              ))}
            </div>
          </section>

          <MixPartyFooter />
        </div>
      </main>
    </>
  );
}
