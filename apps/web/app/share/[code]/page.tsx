"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Crown, Link2, Music2, Share2, Trophy, X } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

type RankingRow = {
  rank: number;
  accountId: string;
  participantId?: string;
  name?: string;
  avatar?: string;
  isEphemeral?: boolean;
  partyScore: number;
  votesReceived: number;
  songsWithVotes: number;
  songsAdded: number;
};

type TopSong = {
  videoId: string;
  title: string;
  artistName?: string;
  thumbnail?: string;
  votes: number;
  addedBy?: string;
  addedByAccountId?: string;
  played: boolean;
};

type PartyResult = {
  code: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  uniqueParticipants: number;
  totalVotes: number;
  songsPlayed: number;
  totalSongs: number;
  ranking: RankingRow[];
  topSongs: TopSong[];
  host?: { accountId: string; name: string; avatar?: string } | null;
};

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

function initials(name?: string) {
  return String(name || "MP")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Avatar({ name, src, size = "h-12 w-12" }: { name?: string; src?: string; size?: string }) {
  if (src) {
    return <img src={src} alt="" className={`${size} shrink-0 rounded-full border border-white/10 object-cover`} />;
  }
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.07] text-xs font-black text-white/70`}>
      {initials(name)}
    </div>
  );
}

export default function PartySharePage() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code || "").trim().toUpperCase();

  const [result, setResult] = useState<PartyResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/party/${encodeURIComponent(code)}/share`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.result) throw new Error(data?.error || "Récap indisponible.");
        setResult(data.result);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e instanceof Error ? e.message : "Récap indisponible.");
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [code]);

  const shareUrl = typeof window !== "undefined"
    ? window.location.href
    : `https://mixpartyapp.fr/share/${encodeURIComponent(code)}`;

  const shareText = useMemo(() => {
    const winner = result?.ranking?.[0]?.name;
    return winner
      ? `🏆 ${winner} remporte la soirée MixParty ${result?.code} ! Découvre le classement 👇`
      : `🎉 Découvre le récap de la soirée MixParty ${code} !`;
  }, [result, code]);

  async function share() {
    if (!result) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MixParty · ${result.code}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie ce lien :", shareUrl);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#070510] text-white">
        <div className="text-center">
          <img src="/branding/icon.png" alt="" className="mx-auto h-16 w-16 animate-pulse object-contain" />
          <p className="mt-4 text-sm font-black uppercase tracking-[.18em] text-fuchsia-200/70">MixParty</p>
          <p className="mt-2 text-sm text-white/35">Chargement du récap…</p>
        </div>
      </main>
    );
  }

  if (!result || error) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#070510] px-5 text-white">
        <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[0.04] p-7 text-center">
          <img src="/branding/icon.png" alt="" className="mx-auto h-14 w-14 object-contain" />
          <h1 className="mt-5 text-2xl font-black">Récap indisponible</h1>
          <p className="mt-2 text-sm text-white/40">{error || "Impossible de retrouver cette soirée."}</p>
          <a href="/" className="mt-6 inline-flex rounded-2xl bg-fuchsia-500/15 px-5 py-3 text-sm font-black text-fuchsia-100">Découvrir MixParty</a>
        </div>
      </main>
    );
  }

  const winner = result.ranking?.[0];
  const dateText = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(result.endedAt));

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#070510] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(124,58,237,.34),transparent_34%),radial-gradient(circle_at_88%_16%,rgba(236,72,153,.26),transparent_31%),radial-gradient(circle_at_78%_88%,rgba(249,115,22,.16),transparent_34%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            <img src="/branding/icon.png" alt="" className="h-11 w-11 object-contain" />
            <div>
              <p className="text-lg font-black">MIXPARTY</p>
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/30">Vote · Ajoute · Danse</p>
            </div>
          </a>
          <button onClick={share} className="inline-flex items-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-2.5 text-sm font-black text-fuchsia-100">
            <Share2 className="h-4 w-4" /> Partager
          </button>
        </header>

        <section className="mt-6 overflow-hidden rounded-[34px] border border-white/10 bg-black/30 p-6 text-center shadow-2xl backdrop-blur-2xl sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-fuchsia-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.2em] text-fuchsia-200">
            <Crown className="h-3.5 w-3.5" /> Soirée terminée
          </span>
          <h1 className="mt-5 text-3xl font-black sm:text-5xl">Classement de la soirée</h1>
          <p className="mt-2 text-sm font-bold text-white/35">
            {result.code} · {dateText}{result.host?.name ? ` · ${result.host.name}` : ""}
          </p>

          <div className="mx-auto mt-7 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={formatDuration(result.durationMs)} label="Durée" />
            <Stat value={String(result.uniqueParticipants)} label="Participants" />
            <Stat value={String(result.totalVotes)} label="Votes" />
            <Stat value={String(result.songsPlayed)} label="Titres joués" />
          </div>
        </section>

        {winner ? (
          <section className="mt-5 rounded-[34px] border border-amber-300/15 bg-[linear-gradient(135deg,rgba(245,158,11,.12),rgba(236,72,153,.07),rgba(0,0,0,.30))] p-5 backdrop-blur-2xl sm:p-7">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="relative">
                <Avatar name={winner.name} src={winner.avatar} size="h-20 w-20 sm:h-24 sm:w-24" />
                <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-black">👑</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-amber-300">Roi de la soirée</p>
                <h2 className="mt-1 truncate text-3xl font-black">{winner.name || "Invité"}</h2>
                <p className="mt-1 text-sm text-white/40">{winner.votesReceived} votes reçus · {winner.songsAdded} titre{winner.songsAdded > 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-3xl border border-amber-300/15 bg-black/25 px-6 py-4">
                <p className="text-4xl font-black text-amber-200">{winner.partyScore}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[.18em] text-white/30">PartyScore</p>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.85fr]">
          <section className="rounded-[30px] border border-white/10 bg-black/30 p-4 backdrop-blur-2xl sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.2em] text-fuchsia-200/80">Classement complet</p>
                <h2 className="mt-1 text-2xl font-black">Tous les scores</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black text-white/35">
                {result.ranking.length} classé{result.ranking.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-5 space-y-2.5">
              {result.ranking.map((row) => (
                <div key={`${row.accountId}-${row.rank}`} className="flex min-w-0 items-center gap-3 rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-sm font-black">
                    {row.rank === 1 ? "👑" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
                  </div>
                  <Avatar name={row.name} src={row.avatar} size="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{row.name || "Invité"}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-white/30">{row.votesReceived} votes · {row.songsAdded} titre{row.songsAdded > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black">{row.partyScore}</p>
                    <p className="text-[7px] font-black uppercase tracking-[.14em] text-white/25">score</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-black/30 p-4 backdrop-blur-2xl sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[.2em] text-orange-200/85">Morceaux de la soirée</p>
            <h2 className="mt-1 text-2xl font-black">Les plus votés</h2>
            <div className="mt-5 space-y-2.5">
              {result.topSongs.slice(0, 6).map((song, index) => (
                <div key={`${song.videoId}-${index}`} className="flex min-w-0 items-center gap-3 rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-3">
                  {song.thumbnail ? (
                    <img src={song.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/[0.05]"><Music2 className="h-5 w-5 text-white/30" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    {index === 0 ? <span className="mb-1 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[.15em] text-orange-200"><Trophy className="h-3 w-3" /> Banger</span> : null}
                    <p className="truncate text-sm font-black">{song.title}</p>
                    <p className="truncate text-[10px] font-bold text-white/30">{song.artistName || song.addedBy || "MixParty"}</p>
                  </div>
                  <div className="text-right"><p className="font-black text-orange-100">{song.votes}</p><p className="text-[7px] uppercase text-white/25">votes</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-[30px] border border-fuchsia-300/10 bg-[linear-gradient(120deg,rgba(124,58,237,.10),rgba(236,72,153,.08),rgba(249,115,22,.05))] p-5 text-center backdrop-blur-2xl sm:p-7">
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-fuchsia-200/75">Fais tourner le classement</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Partage la soirée avec tout le monde</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={share} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400 px-5 py-3 text-sm font-black text-white">
              <Share2 className="h-4 w-4" /> Partager
            </button>
            <button onClick={copy} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-white/80">
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {copied ? "Lien copié" : "Copier le lien"}
            </button>
            <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white/70">
              <Share2 className="h-4 w-4" /> Facebook
            </button>
            <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white/70">
              <X className="h-4 w-4" /> X
            </button>
          </div>
        </section>

        <footer className="py-8 text-center">
          <a href="/" className="inline-flex items-center gap-2 text-xs font-black text-white/30"><Link2 className="h-3.5 w-3.5" /> Créer ma soirée sur MixParty</a>
        </footer>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-4">
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-white/25">{label}</p>
    </div>
  );
}


