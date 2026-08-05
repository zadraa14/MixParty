"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, Database, KeyRound, Music2, Network, RefreshCw, Search, ShieldCheck, Sparkles, ThumbsUp, Timer, Trash2, type LucideIcon } from "lucide-react";
import { getApiBaseUrl } from "../../../lib/config";
import MixMateCard, { type MixMate } from "./components/MixMateCard";

type Stats = {
  version: number;
  createdAt: number;
  updatedAt: number;
  brain: { name: string; level: number; levelProgress: number; knowledgePoints: number };
  storage: { mode: string; path: string; persistent: boolean };
  academy: {
    enabled: boolean;
    running: boolean;
    dailyLimit: number;
    used: number;
    remaining: number;
    resetAt: number;
    minutesUntilReset: number;
    launchWindowMinutes: number;
    inLaunchWindow: boolean;
    timeZone: string;
    targetSongsPerArtist: number;
    lastCheckAt?: number;
    lastSessionAt?: number;
    currentSession?: {
      id: string;
      startedAt: number;
      callsPlanned: number;
      callsUsed: number;
      songsAdded: number;
      artistsTouched: string[];
      status: string;
    } | null;
    lastSession?: {
      id: string;
      startedAt: number;
      finishedAt?: number;
      callsPlanned: number;
      callsUsed: number;
      songsAdded: number;
      artistsTouched: string[];
      status: string;
      reason?: string;
    } | null;
    missions: Array<{
      artistKey: string;
      artistName: string;
      knownSongs: number;
      targetSongs: number;
      priority: number;
      attempts: number;
      nextQuery: string;
    }>;
    sessions: Array<{
      id: string;
      startedAt: number;
      finishedAt?: number;
      callsPlanned: number;
      callsUsed: number;
      songsAdded: number;
      artistsTouched: string[];
      status: string;
      reason?: string;
    }>;
    logs: Array<{
      at: number;
      level: "info" | "success" | "warning" | "error";
      message: string;
      artist?: string;
      query?: string;
      songsAdded?: number;
    }>;
  };
  covers: {
    downloaded: number;
    pending: number;
    activeDownloads: number;
    exactMatches: number;
    artistFallbacks: number;
    notFound: number;
    errors: number;
    unrequested: number;
  };
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

const RECOMMENDED_MIXMATES: MixMate[] = [
  {
    id: "mixmate-max",
    name: "Max",
    compatibility: 96,
    commonArtists: ["Jul", "SCH", "Ninho"],
    commonSongs: 42,
    isConnected: true,
  },
  {
    id: "mixmate-thomas",
    name: "Thomas",
    compatibility: 91,
    commonArtists: ["SDM", "Tiakola", "Gazo"],
    commonSongs: 31,
    isConnected: true,
  },
  {
    id: "mixmate-yoann",
    name: "Yoann",
    compatibility: 87,
    commonArtists: ["PLK", "Hamza", "Dinos"],
    commonSongs: 24,
    isConnected: false,
  },
];


export default function MusicBrainAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceError, setMaintenanceError] = useState("");
  const [invitedMixMateIds, setInvitedMixMateIds] = useState<string[]>([]);

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

  async function clearYoutubeCache() {
    setMaintenanceMessage("");
    setMaintenanceError("");

    if (!adminToken.trim()) {
      setMaintenanceError("Entre le code administrateur Railway avant de vider le cache.");
      return;
    }

    const confirmed = window.confirm(
      "Vider uniquement le cache des recherches YouTube ? La mémoire PartyBrain, les artistes et les morceaux appris seront conservés."
    );
    if (!confirmed) return;

    setMaintenanceLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/maintenance/youtube-cache/clear`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de vider le cache YouTube");
      setMaintenanceMessage(data?.message || "Cache YouTube vidé.");
      setAdminToken("");
      await loadStats();
    } catch (err) {
      setMaintenanceError(err instanceof Error ? err.message : "Impossible de vider le cache YouTube");
    } finally {
      setMaintenanceLoading(false);
    }
  }

  useEffect(() => {
    const refreshDelay = stats?.academy.running ? 5_000 : 60_000;
    const timer = window.setInterval(() => {
      void loadStats();
    }, refreshDelay);
    return () => window.clearInterval(timer);
  }, [stats?.academy.running]);

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

  const academyHistory = stats?.academy.sessions.slice(0, 7) || [];
  const academyTotals = academyHistory.reduce(
    (acc, session) => ({
      calls: acc.calls + session.callsUsed,
      songs: acc.songs + session.songsAdded,
      artists: acc.artists + session.artistsTouched.length,
      completed: acc.completed + (session.status === "completed" ? 1 : 0),
      errors: acc.errors + (session.status === "failed" ? 1 : 0),
    }),
    { calls: 0, songs: 0, artists: 0, completed: 0, errors: 0 },
  );
  const chartMax = Math.max(1, ...academyHistory.map((session) => session.songsAdded));

  function inviteMixMate(mixMate: MixMate) {
    setInvitedMixMateIds((current) =>
      current.includes(mixMate.id) ? current : [...current, mixMate.id]
    );
  }

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

            <section className="mb-7 rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.24em] text-cyan-300">PartyBrain Academy</p>
                      <h2 className="mt-1 text-2xl font-black">
                        {stats.academy.running ? "Apprentissage en cours" : stats.academy.enabled ? "En attente de la fenêtre Academy" : "Academy désactivée"}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/55">
                    Academy utilise automatiquement tout le quota YouTube restant juste avant sa réinitialisation, puis conserve un journal complet de chaque recherche et de chaque morceau appris.
                  </p>
                </div>

                <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[.18em] text-white/40">Quota estimé</p>
                    <p className="mt-2 text-2xl font-black">{stats.academy.remaining}<span className="text-sm text-white/35"> / {stats.academy.dailyLimit}</span></p>
                    <p className="mt-1 text-xs text-white/40">{stats.academy.used} appel(s) utilisé(s)</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[.18em] text-white/40">Réinitialisation</p>
                    <p className="mt-2 text-lg font-black">{new Date(stats.academy.resetAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="mt-1 text-xs text-white/40">dans {stats.academy.minutesUntilReset} min</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[.18em] text-white/40">Fenêtre Academy</p>
                    <p className={`mt-2 text-lg font-black ${stats.academy.inLaunchWindow ? "text-emerald-300" : "text-fuchsia-200"}`}>
                      {stats.academy.inLaunchWindow ? "Ouverte" : `${stats.academy.launchWindowMinutes} min avant`}
                    </p>
                    <p className="mt-1 text-xs text-white/40">{stats.academy.timeZone}</p>
                  </div>
                </div>
              </div>

              {stats.academy.running && stats.academy.currentSession ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-black text-emerald-200">
                      <Activity className="h-4 w-4 animate-pulse" />
                      Session en cours
                    </div>
                    <span className="text-xs text-white/55">
                      {stats.academy.currentSession.callsUsed}/{stats.academy.currentSession.callsPlanned} recherches
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                      style={{ width: `${Math.min(100, (stats.academy.currentSession.callsUsed / Math.max(1, stats.academy.currentSession.callsPlanned)) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    +{stats.academy.currentSession.songsAdded} morceau(x) • {stats.academy.currentSession.artistsTouched.length} artiste(s)
                  </p>
                </div>
              ) : stats.academy.lastSession ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Dernière session</p>
                      <p className="mt-1 font-black">
                        {new Date(stats.academy.lastSession.startedAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="text-sm text-white/55">
                      {stats.academy.lastSession.callsUsed} recherches • +{stats.academy.lastSession.songsAdded} morceaux • {stats.academy.lastSession.artistsTouched.length} artistes
                    </div>
                  </div>
                  {stats.academy.lastSession.reason ? <p className="mt-2 text-xs text-white/40">{stats.academy.lastSession.reason}</p> : null}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
                  Aucune session Academy enregistrée pour le moment. La première démarrera automatiquement dans la fenêtre précédant la prochaine réinitialisation.
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[.16em]">Sessions réussies</span></div>
                  <p className="mt-3 text-2xl font-black">{academyTotals.completed}</p>
                  <p className="mt-1 text-xs text-white/35">sur les 7 dernières</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-cyan-300"><Search className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[.16em]">Recherches Academy</span></div>
                  <p className="mt-3 text-2xl font-black">{academyTotals.calls}</p>
                  <p className="mt-1 text-xs text-white/35">appels transformés en savoir</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-fuchsia-300"><Music2 className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[.16em]">Morceaux appris</span></div>
                  <p className="mt-3 text-2xl font-black">+{academyTotals.songs}</p>
                  <p className="mt-1 text-xs text-white/35">sur les sessions affichées</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-violet-300"><BrainCircuit className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[.16em]">Artistes touchés</span></div>
                  <p className="mt-3 text-2xl font-black">{academyTotals.artists}</p>
                  <p className="mt-1 text-xs text-white/35">enrichissements cumulés</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className={`flex items-center gap-2 ${academyTotals.errors ? "text-amber-300" : "text-emerald-300"}`}><AlertTriangle className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[.16em]">Incidents</span></div>
                  <p className="mt-3 text-2xl font-black">{academyTotals.errors}</p>
                  <p className="mt-1 text-xs text-white/35">session(s) interrompue(s)</p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-fuchsia-300" /><h3 className="font-black">Historique des sessions</h3></div>
                    <span className="text-[11px] text-white/35">7 dernières sessions</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                        <tr><th className="pb-3">Date</th><th className="pb-3">État</th><th className="pb-3">Recherches</th><th className="pb-3">Morceaux</th><th className="pb-3">Artistes</th><th className="pb-3">Durée</th></tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {academyHistory.map((session) => {
                          const durationSeconds = session.finishedAt ? Math.max(0, Math.round((session.finishedAt - session.startedAt) / 1000)) : 0;
                          return (
                            <tr key={session.id} className="text-white/70">
                              <td className="py-3 font-bold text-white/85">{new Date(session.startedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} <span className="text-white/35">{new Date(session.startedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></td>
                              <td className="py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${session.status === "completed" ? "bg-emerald-500/15 text-emerald-300" : session.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}>{session.status === "completed" ? "Terminée" : session.status === "failed" ? "Erreur" : session.status}</span></td>
                              <td className="py-3">{session.callsUsed}/{session.callsPlanned}</td>
                              <td className="py-3 font-black text-fuchsia-200">+{session.songsAdded}</td>
                              <td className="py-3">{session.artistsTouched.length}</td>
                              <td className="py-3">{durationSeconds ? `${durationSeconds}s` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!academyHistory.length ? <p className="py-5 text-sm text-white/45">Aucune session enregistrée pour le moment.</p> : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300" /><h3 className="font-black">Progression récente</h3></div>
                  <div className="flex h-44 items-end gap-2 rounded-2xl border border-white/5 bg-white/[0.025] p-4">
                    {[...academyHistory].reverse().map((session) => (
                      <div key={session.id} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                        <span className="text-[10px] font-black text-white/45 opacity-0 transition group-hover:opacity-100">+{session.songsAdded}</span>
                        <div className="w-full rounded-t-lg bg-gradient-to-t from-violet-600 via-fuchsia-500 to-cyan-400 transition-all group-hover:brightness-125" style={{ height: `${Math.max(6, (session.songsAdded / chartMax) * 120)}px` }} />
                        <span className="text-[9px] text-white/30">{new Date(session.startedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>
                      </div>
                    ))}
                    {!academyHistory.length ? <div className="m-auto text-center text-sm text-white/35"><Timer className="mx-auto mb-2 h-6 w-6" />La courbe apparaîtra après la première session.</div> : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/40">Chaque barre représente le nombre de nouveaux morceaux appris pendant une session Academy.</p>
                </section>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-fuchsia-300" />
                    <h3 className="font-black">Prochaines missions</h3>
                  </div>
                  <div className="space-y-2">
                    {stats.academy.missions.slice(0, 6).map((mission, index) => (
                      <div key={mission.artistKey} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-xs font-black text-violet-200">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">{mission.artistName}</p>
                          <p className="truncate text-xs text-white/35">{mission.nextQuery}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-black text-cyan-200">{mission.knownSongs}/{mission.targetSongs}</p>
                          <p className="text-white/35">morceaux</p>
                        </div>
                      </div>
                    ))}
                    {!stats.academy.missions.length ? <p className="text-sm text-white/45">Aucune mission utile en attente.</p> : null}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-cyan-300" />
                    <h3 className="font-black">Journal Academy</h3>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {stats.academy.logs.slice(0, 20).map((entry, index) => (
                      <div key={`${entry.at}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm font-bold ${
                            entry.level === "error" ? "text-red-200" :
                            entry.level === "warning" ? "text-amber-200" :
                            entry.level === "success" ? "text-emerald-200" : "text-white/75"
                          }`}>{entry.message}</p>
                          <span className="shrink-0 text-[10px] text-white/30">{new Date(entry.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                        </div>
                        {entry.query ? <p className="mt-1 truncate text-xs text-white/30">{entry.query}</p> : null}
                      </div>
                    ))}
                    {!stats.academy.logs.length ? <p className="text-sm text-white/45">Le journal se remplira lors de la première session.</p> : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-7 rounded-[28px] border border-orange-400/15 bg-gradient-to-br from-orange-500/[0.08] via-fuchsia-500/[0.05] to-cyan-500/[0.06] p-5 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.22em] text-orange-300">HD Cover System</p>
                  <h2 className="mt-1 text-2xl font-black">Bibliothèque de jaquettes</h2>
                  <p className="mt-2 text-sm text-white/45">Correspondance exacte artiste + titre, puis secours fiable du même artiste.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-white/55">
                  {number.format(stats.covers.downloaded)} téléchargée(s)
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Jaquettes téléchargées", stats.covers.downloaded, "text-emerald-300"],
                  ["En attente", stats.covers.pending, "text-amber-300"],
                  ["Téléchargements actifs", stats.covers.activeDownloads, "text-cyan-300"],
                  ["Correspondances exactes", stats.covers.exactMatches, "text-fuchsia-300"],
                  ["Secours artiste", stats.covers.artistFallbacks, "text-violet-300"],
                  ["Introuvables", stats.covers.notFound, "text-white/55"],
                  ["Erreurs", stats.covers.errors, "text-red-300"],
                  ["Pas encore recherchées", stats.covers.unrequested, "text-white/40"],
                ].map(([label, value, tone]) => (
                  <article key={String(label)} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.15em] text-white/35">{String(label)}</p>
                    <p className={`mt-3 text-2xl font-black ${String(tone)}`}>{number.format(Number(value))}</p>
                  </article>
                ))}
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

            <section className="mt-7 rounded-[28px] border border-fuchsia-400/15 bg-gradient-to-br from-fuchsia-500/[0.08] via-violet-500/[0.05] to-cyan-500/[0.06] p-5 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">Social Intelligence</p>
                  <h2 className="mt-1 text-2xl font-black">MixMates recommandés</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                    PartyBrain rapproche les profils qui partagent le plus d’artistes, de morceaux et d’habitudes musicales.
                  </p>
                </div>
                <span className="self-start rounded-full border border-cyan-400/15 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-cyan-200 sm:self-auto">
                  {RECOMMENDED_MIXMATES.length} profils compatibles
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {RECOMMENDED_MIXMATES.map((mixMate) => (
                  <MixMateCard
                    key={mixMate.id}
                    mixMate={mixMate}
                    invited={invitedMixMateIds.includes(mixMate.id)}
                    onInvite={inviteMixMate}
                  />
                ))}
              </div>
            </section>

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

            <section className="mt-7 rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-fuchsia-500/5 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-amber-200">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">Maintenance sécurisée</p>
                      <h2 className="mt-1 text-2xl font-black">Cache des recherches YouTube</h2>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/55">
                    Ce bouton supprime uniquement les anciennes recherches mises en cache. Les artistes, morceaux, scores et connaissances de PartyBrain restent intacts.
                  </p>
                </div>

                <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/25 p-4">
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                    <KeyRound className="h-4 w-4 text-amber-300" />
                    <input
                      type="password"
                      value={adminToken}
                      onChange={(event) => setAdminToken(event.target.value)}
                      placeholder="Code administrateur Railway"
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={clearYoutubeCache}
                    disabled={maintenanceLoading}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {maintenanceLoading ? "Nettoyage en cours…" : "Vider le cache YouTube"}
                  </button>
                  {maintenanceMessage ? <p className="mt-3 text-sm font-bold text-emerald-300">{maintenanceMessage}</p> : null}
                  {maintenanceError ? <p className="mt-3 text-sm font-bold text-red-300">{maintenanceError}</p> : null}
                  <p className="mt-3 text-xs text-white/35">Protection : variable Railway <code className="text-amber-200">PARTYBRAIN_ADMIN_TOKEN</code>.</p>
                </div>
              </div>
            </section>

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
