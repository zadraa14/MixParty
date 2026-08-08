"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, QrCode, Radio, RotateCcw, Sparkles, UsersRound, Vote } from "lucide-react";
import MixPartyBackground from "../components/MixPartyBackground";
import MixPartyFooter from "../components/MixPartyFooter";
import MixPartyHeader from "../components/MixPartyHeader";
import MixPartyHero from "../components/MixPartyHero";
import MixPartyLoader from "../components/MixPartyLoader";
import PartyCard from "../components/PartyCard";
import { GlassCard, GradientText, SectionTitle, StatCard } from "../components/ui";
import { getApiBaseUrl } from "../lib/config";

const STEPS = [
  { number: "01", title: "Crée", text: "Lance ta salle MixParty en quelques secondes.", icon: Sparkles, accent: "purple" as const },
  { number: "02", title: "Partage", text: "Tes invités rejoignent la soirée avec le QR Code.", icon: QrCode, accent: "cyan" as const },
  { number: "03", title: "Vote", text: "Chaque participant influence la prochaine musique.", icon: Vote, accent: "pink" as const },
  { number: "04", title: "Profite", text: "Le DJ automatique maintient l’ambiance toute la nuit.", icon: Radio, accent: "orange" as const },
];

export default function Home() {
  const router = useRouter();
  const [partyCode, setPartyCode] = useState("");
  const [creatingParty, setCreatingParty] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [lastParty, setLastParty] = useState<{
    code: string;
    role: "dj" | "guest";
  } | null>(null);

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
        const saved = JSON.parse(raw) as {
          code?: string;
          role?: "dj" | "guest";
        };

        const code = String(saved?.code || "").trim().toUpperCase();

        if (!code) {
          localStorage.removeItem("mixparty.lastParty.v1");
          return;
        }

        const response = await fetch(
          `${getApiBaseUrl()}/party/${encodeURIComponent(code)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          localStorage.removeItem("mixparty.lastParty.v1");
          if (!cancelled) setLastParty(null);
          return;
        }

        const creatorToken = localStorage.getItem(`mixparty_creator_${code}`);

        if (!cancelled) {
          setLastParty({
            code,
            role: creatorToken ? "dj" : "guest",
          });
        }
      } catch {
        localStorage.removeItem("mixparty.lastParty.v1");
      }
    }

    void detectLastParty();

    return () => {
      cancelled = true;
    };
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
      localStorage.setItem(
        "mixparty.lastParty.v1",
        JSON.stringify({
          code: party.code,
          role: "dj",
          savedAt: Date.now(),
        })
      );
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
    if (!lastParty?.code) return;
    router.push(`/party/${lastParty.code}`);
  }

  return (
    <>
      {showLoader && <MixPartyLoader visible={loaderVisible} />}

      <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />
        <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(to_bottom,rgba(7,7,17,.03),rgba(7,7,17,.14)_54%,rgba(7,7,17,.32))]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
          <MixPartyHeader />

          <section className="grid min-h-[calc(100svh-88px)] items-center gap-8 py-6 sm:py-10 lg:min-h-[calc(100dvh-110px)] lg:grid-cols-[minmax(0,1.02fr)_minmax(470px,.98fr)] lg:gap-14 lg:py-16">
            <MixPartyHero creatingParty={creatingParty} onCreateParty={createParty} onJoinClick={() => document.getElementById("mixparty-join")?.scrollIntoView({ behavior: "smooth", block: "center" })} />
            <PartyCard />
          </section>

          {lastParty ? (
            <div className="-mt-2 flex justify-center pb-2 sm:-mt-4 sm:pb-4">
              <button
                type="button"
                onClick={resumeLastParty}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-black text-white backdrop-blur-xl transition hover:border-fuchsia-400/35 hover:bg-white/[0.085]"
              >
                <RotateCcw className="h-4 w-4 text-fuchsia-300" />
                Reprendre la soirée
              </button>
            </div>
          ) : null}

          <section id="mixparty-join" className="mixparty-join-strip py-10 sm:py-12">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-3 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:flex-row">
            <button
  type="button"
  onClick={resumeLastParty}
  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-5 text-sm font-black text-white transition hover:border-fuchsia-400/35 hover:bg-white/[0.085]"
>
  <span className="relative flex h-3 w-3">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
  </span>

  <RotateCcw className="h-4 w-4 text-fuchsia-300" />

  Reprendre la soirée
</button>
              <div className="flex-1 px-2">
                <p className="text-sm font-black text-white">Tu as déjà un code ?</p>
                <p className="mt-1 text-xs text-white/40">Entre-le ici pour rejoindre la soirée instantanément.</p>
              </div>
              <input value={partyCode} onChange={(event) => setPartyCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && joinParty()} placeholder="CODE" maxLength={8} className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-center text-sm font-black uppercase tracking-[.2em] outline-none focus:border-fuchsia-400/50 sm:w-48" />
              <button type="button" onClick={joinParty} className="mixparty-secondary-cta h-14 w-full sm:w-auto">Rejoindre</button>
            </div>
          </section>

          <section className="py-10 sm:py-16">
            <SectionTitle
              eyebrow="Pourquoi MixParty"
              title={<>Une soirée qui <GradientText animated>réagit en direct.</GradientText></>}
              description="MixParty transforme chaque téléphone en télécommande musicale collective, sans compte et sans installation compliquée."
              accent="purple"
            />
            <div className="mixparty-stats-grid mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Temps réel" value="Instantané" description="Votes, file et participants synchronisés." icon={<Radio className="h-5 w-5" />} accent="orange" />
              <StatCard label="Collaboratif" value="Tout le monde" description="Chaque invité peut participer à l’ambiance." icon={<UsersRound className="h-5 w-5" />} accent="purple" />
              <StatCard label="PartyBrain" value="Plus malin" description="MixParty apprend et prépare de meilleures suggestions." icon={<Bot className="h-5 w-5" />} accent="cyan" />
              <StatCard label="Accès" value="1 QR Code" description="Aucun compte nécessaire pour rejoindre." icon={<QrCode className="h-5 w-5" />} accent="pink" />
            </div>
          </section>

          <section className="mixparty-how-section py-12 sm:py-16">
            <SectionTitle
              eyebrow="Comment ça marche"
              title={<>Quatre étapes. <GradientText>Une seule ambiance.</GradientText></>}
              description="De la création de la salle au passage automatique des morceaux, tout est pensé pour rester simple."
              accent="pink"
            />
            <div className="mixparty-timeline relative mt-6 sm:mt-10 grid gap-5 lg:grid-cols-4">
              <div className="mixparty-timeline-line pointer-events-none absolute left-[8%] right-[8%] top-10 hidden h-px lg:block" />
              {STEPS.map(({ number, title, text, icon: Icon, accent }) => (
                <GlassCard key={number} accent={accent} hoverable animatedBorder={number === "01"} className="mixparty-timeline-card relative h-full">
                  <div className={`mixparty-timeline-node mp-stat-icon mp-stat-icon--${accent}`}><Icon className="h-5 w-5" /></div>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-white/24">Étape {number}</p>
                  <p className="mt-2 font-[family:var(--font-exo-2)] text-xl font-black">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/40">{text}</p>
                </GlassCard>
              ))}
            </div>
          </section>

          <MixPartyFooter />
        </div>
      </main>
    </>
  );
}
