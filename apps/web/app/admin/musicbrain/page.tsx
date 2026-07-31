"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Database, Music2, Network, RefreshCw, Search, Sparkles, ThumbsUp, type LucideIcon } from "lucide-react";
import { getApiBaseUrl } from "../../../lib/config";

type Stats = {
  version: number;
  createdAt: number;
  updatedAt: number;
  brain: { name: string; level: number; levelProgress: number; knowledgePoints: number };
  storage: { mode: string; path: string; persistent: boolean };
  totals: {
    searches: number;
    additions: number;
    plays: number;
    votes: number;
    artists: number;
    songs: number;
    transitions: number;
    youtubeCalls: number;
    quotaSaved: number;
  };
  topArtists: Array<{
    key: string;
    name: string;
    searchCount: number;
    songCount: number;
    totalAdds: number;
    totalVotes: number;
  }>;
  topSongs: Array<{
    videoId: string;
    title: string;
    artistName: string;
    featuredArtistNames?: string[];
    albumName?: string;
    metadataSource?: "ART_TRACK_DESCRIPTION" | "TITLE_CHANNEL" | "QUERY_FALLBACK";
    metadataConfidence?: number;
    thumbnail: string;
    searchCount: number;
    addedCount: number;
    playedCount: number;
    voteCount: number;
    score?: number;
  }>;
  topTransitions: Array<{
    fromVideoId: string;
    toVideoId: string;
    fromTitle: string;
    toTitle: string;
    count: number;
  }>;
};

const number = new Intl.NumberFormat("fr-FR");

export default function MusicBrainAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  async function loadStats() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/musicbrain/stats`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "MusicBrain indisponible");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "MusicBrain indisponible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const visibleSongs = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return stats?.topSongs || [];
    return (stats?.topSongs || []).filter((song) =>
      `${song.title} ${song.artistName}`.toLowerCase().includes(query)
    );
  }, [filter, stats]);

  const summaryCards: Array<[string, number, LucideIcon]> = stats ? [
    ["Artistes", stats.totals.artists, BrainCircuit],
    ["Morceaux", stats.totals.songs, Music2],
    ["Recherches", stats.totals.searches, Search],
    ["Quota économisé", stats.totals.quotaSaved, Sparkles],
  ] : [];

  return (
    <main className="min-h-screen bg-[#07040f] px-4 py-6 text-white sm:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-violet-600/20 blur-[110px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <section className="relative mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-500 shadow-[0_0_35px_rgba(168,85,247,.35)]">
              <BrainCircuit className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.28em] text-fuchsia-300">MixParty Admin</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">PartyBrain</h1>
              <p className="mt-1 text-sm text-white/55">Le cerveau musical qui apprend de chaque soirée.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/admin/partybrain/graph" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-500/15">
              <Network className="h-4 w-4" />
              Explorer le cerveau
            </Link>
            <button
              type="button"
              onClick={loadStats}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black transition hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 text-red-100">{error}</div>
        ) : !stats ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">Chargement de MusicBrain…</div>
        ) : (
          <>
            <section className="mb-7 rounded-[28px] border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-500/10 via-violet-500/10 to-cyan-500/10 p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">Intelligence MixParty</p>
                  <h2 className="mt-2 text-3xl font-black">PartyBrain — Niveau {stats.brain.level}</h2>
                  <p className="mt-1 text-sm text-white/50">{number.format(stats.brain.knowledgePoints)} points de connaissance</p>
                </div>
                <div className="min-w-[240px]">
                  <div className="mb-2 flex justify-between text-xs font-bold text-white/55"><span>Progression</span><span>{stats.brain.levelProgress}%</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400" style={{ width: `${stats.brain.levelProgress}%` }} /></div>
                  <p className={`mt-3 text-xs font-bold ${stats.storage.persistent ? "text-emerald-300" : "text-amber-300"}`}>
                    {stats.storage.persistent ? "● Stockage persistant Railway actif" : "● Stockage local — ajouter un volume Railway avant production"}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map(([label, value, Icon]) => (
                <article key={String(label)} className="rounded-[24px] border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between text-white/55">
                    <span className="text-xs font-black uppercase tracking-[.18em]">{String(label)}</span>
                    <Icon className="h-5 w-5 text-fuchsia-300" />
                  </div>
                  <p className="mt-4 text-3xl font-black">{number.format(Number(value))}</p>
                </article>
              ))}
            </div>

            <div className="mt-7 grid gap-7 xl:grid-cols-[.85fr_1.15fr]">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">Classement</p>
                    <h2 className="mt-1 text-2xl font-black">Top artistes</h2>
                  </div>
                  <Database className="h-6 w-6 text-cyan-300" />
                </div>
                <div className="space-y-3">
                  {stats.topArtists.slice(0, 12).map((artist, index) => (
                    <div key={artist.key} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600/60 to-fuchsia-500/60 text-sm font-black">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{artist.name}</p>
                        <p className="text-xs text-white/45">{artist.songCount} morceaux • {artist.searchCount} recherches</p>
                      </div>
                      <div className="text-right text-xs text-white/55">
                        <p>{artist.totalAdds} ajouts</p>
                        <p>{artist.totalVotes} votes</p>
                      </div>
                    </div>
                  ))}
                  {!stats.topArtists.length && <p className="text-sm text-white/45">La base se remplira à la prochaine recherche.</p>}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">Catalogue</p>
                    <h2 className="mt-1 text-2xl font-black">Morceaux appris</h2>
                  </div>
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                    <Search className="h-4 w-4 text-white/40" />
                    <input
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                      placeholder="Filtrer…"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-white/30 sm:w-44"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {visibleSongs.slice(0, 20).map((song) => (
                    <article key={song.videoId} className="flex gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <img src={song.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-black">{song.title}</p>
                        <p className="mt-1 truncate text-xs text-fuchsia-200/70">
                          {song.artistName}
                          {song.featuredArtistNames?.length ? ` feat. ${song.featuredArtistNames.join(", ")}` : ""}
                        </p>
                        {song.albumName ? <p className="mt-1 truncate text-[11px] text-cyan-200/55">Album : {song.albumName}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/45">
                          <span>{song.addedCount} ajouts</span>
                          <span>{song.playedCount} lectures</span>
                          <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{song.voteCount}</span>
                          <span className="font-black text-fuchsia-300">Score {song.score || 0}</span>
                          <span className={song.metadataSource === "ART_TRACK_DESCRIPTION" ? "font-black text-emerald-300" : "text-white/35"}>
                            {song.metadataSource === "ART_TRACK_DESCRIPTION" ? "Métadonnées Art Track" : song.metadataSource === "TITLE_CHANNEL" ? "Métadonnées YouTube" : "Analyse PartyBrain"}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-7 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-xs font-black uppercase tracking-[.22em] text-violet-300">Apprentissage</p>
              <h2 className="mt-1 text-2xl font-black">Enchaînements les plus fréquents</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {stats.topTransitions.map((transition) => (
                  <div key={`${transition.fromVideoId}-${transition.toVideoId}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="truncate text-sm font-bold text-white/65">{transition.fromTitle}</p>
                    <p className="my-2 text-center text-fuchsia-300">↓</p>
                    <p className="truncate font-black">{transition.toTitle}</p>
                    <p className="mt-2 text-xs text-white/40">Observé {transition.count} fois</p>
                  </div>
                ))}
                {!stats.topTransitions.length && <p className="text-sm text-white/45">Les enchaînements apparaîtront après plusieurs lectures.</p>}
              </div>
            </section>

            <footer className="mt-6 text-center text-xs text-white/35">
              Dernière mise à jour : {new Date(stats.updatedAt).toLocaleString("fr-FR")}. {stats.storage.persistent ? "Les connaissances sont conservées sur le volume Railway." : "Le stockage local sera perdu lors d’un redéploiement Railway."}
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
