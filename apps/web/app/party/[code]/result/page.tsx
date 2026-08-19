"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Disc3,
  Flame,
  Medal,
  Music2,
  PartyPopper,
  Trophy,
  UsersRound,
} from "lucide-react";
import MixPartyBackground from "../../../../components/MixPartyBackground";
import { getApiBaseUrl } from "../../../../lib/config";

const ACCOUNT_TOKEN_KEY = "mixparty.account.token.v1";

type RankingRow = {
  rank: number;
  accountId: string;
  name: string;
  avatar?: string;
  partyScore: number;
  votesReceived: number;
  songsWithVotes: number;
  songsAdded: number;
};

type ResultSong = {
  videoId: string;
  title: string;
  artistName?: string;
  thumbnail?: string;
  votes: number;
  addedBy?: string;
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
  topSongs: ResultSong[];
  host?: {
    accountId: string;
    name: string;
    avatar?: string;
  };
  viewerAccountId?: string;
};

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

function avatarFallback(name: string) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

export default function PartyResultPage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();

  const [result, setResult] = useState<PartyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!code) return;

    let cached: PartyResult | null = null;

    try {
      const raw = sessionStorage.getItem(`mixparty.partyResult.${code}`);
      cached = raw ? (JSON.parse(raw) as PartyResult) : null;
      if (cached?.code) setResult(cached);
    } catch {
      cached = null;
    }

    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY) || "";

    if (!token) {
      setLoading(false);
      if (!cached) {
        setMessage(
          "Ce récap est disponible immédiatement après la soirée. Pour le retrouver plus tard, utilise un compte MixParty.",
        );
      }
      return;
    }

    let cancelled = false;

    async function loadStoredResult() {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/party/${encodeURIComponent(code)}/result`,
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
              "cache-control": "no-cache",
            },
          },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (!cached) {
            throw new Error(
              data?.error || "Impossible de retrouver ce récap.",
            );
          }
          return;
        }

        if (!cancelled && data?.result) {
          setResult(data.result);
          try {
            sessionStorage.setItem(
              `mixparty.partyResult.${code}`,
              JSON.stringify(data.result),
            );
          } catch {}
        }
      } catch (error) {
        if (!cancelled && !cached) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Impossible de retrouver ce récap.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStoredResult();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const podium = useMemo(() => result?.ranking?.slice(0, 3) || [], [result]);
  const rest = useMemo(() => result?.ranking?.slice(3) || [], [result]);
  const bestSong = result?.topSongs?.[0];

  if (loading && !result) {
    return (
      <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />
        <div className="relative z-10 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-fuchsia-400" />
          <p className="mt-4 text-sm font-black text-white/50">
            Génération du classement…
          </p>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#070711] px-4 text-white">
        <MixPartyBackground />
        <div className="relative z-10 w-full max-w-lg rounded-[30px] border border-white/10 bg-[#0b0813]/90 p-7 text-center backdrop-blur-2xl">
          <PartyPopper className="mx-auto h-10 w-10 text-fuchsia-300" />
          <h1 className="mt-4 text-2xl font-black">Récap indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-white/45">{message}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 min-h-12 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/10 px-5 text-sm font-black text-fuchsia-100"
          >
            Retour à l’accueil
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#070711] font-[family:var(--font-geist-sans)] text-white">
      <MixPartyBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_22%_8%,rgba(139,92,246,.12),transparent_30%),radial-gradient(circle_at_78%_14%,rgba(236,72,153,.13),transparent_28%),radial-gradient(circle_at_72%_86%,rgba(249,115,22,.08),transparent_32%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white/55 transition hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Mon profil
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/branding/icon.png"
              alt="MixParty"
              className="h-9 w-9 object-contain"
            />
            <span className="font-[family:var(--font-exo-2)] text-lg font-black">
              MIX<span className="text-fuchsia-300">PARTY</span>
            </span>
          </div>
        </header>

        <section className="relative mt-8 overflow-hidden rounded-[34px] border border-fuchsia-300/15 bg-[#0b0813]/82 p-5 shadow-[0_35px_120px_rgba(0,0,0,.45),0_0_80px_rgba(236,72,153,.08)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/12 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-orange-500/8 blur-[90px]" />

          <div className="relative text-center">
            <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-fuchsia-300/15 bg-fuchsia-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-200">
              <PartyPopper className="h-3.5 w-3.5" />
              Soirée terminée
            </span>

            <h1 className="mt-4 font-[family:var(--font-exo-2)] text-3xl font-black tracking-tight sm:text-5xl">
              Classement de la soirée
            </h1>

            <p className="mt-2 text-sm font-bold text-white/35">
              {result.code} ·{" "}
              {new Date(result.endedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {result.host?.name ? ` · organisée par ${result.host.name}` : ""}
            </p>

            <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  label: "Durée",
                  value: formatDuration(result.durationMs),
                  Icon: Flame,
                  accent: "text-orange-200",
                },
                {
                  label: "Participants",
                  value: result.uniqueParticipants,
                  Icon: UsersRound,
                  accent: "text-violet-200",
                },
                {
                  label: "Votes",
                  value: result.totalVotes,
                  Icon: Trophy,
                  accent: "text-fuchsia-200",
                },
                {
                  label: "Titres joués",
                  value: result.songsPlayed,
                  Icon: Music2,
                  accent: "text-cyan-200",
                },
              ].map(({ label, value, Icon, accent }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/[0.07] bg-black/18 p-3"
                >
                  <Icon className={`mx-auto h-4 w-4 ${accent}`} />
                  <p className="mt-2 font-[family:var(--font-exo-2)] text-xl font-black">
                    {value}
                  </p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-[.12em] text-white/28">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {podium.length > 0 ? (
          <section className="mt-8">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300/80">
                Le podium
              </p>
              <h2 className="mt-2 font-[family:var(--font-exo-2)] text-2xl font-black sm:text-3xl">
                Les rois de la soirée
              </h2>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3 md:items-end">
              {podium.map((row) => {
                const winner = row.rank === 1;
                const second = row.rank === 2;
                const accent = winner
                  ? "border-amber-300/25 bg-gradient-to-b from-amber-500/[0.13] via-orange-500/[0.05] to-black/15 shadow-[0_24px_75px_rgba(245,158,11,.10)] md:min-h-[280px]"
                  : second
                    ? "border-slate-200/15 bg-gradient-to-b from-slate-200/[0.08] to-black/15 md:min-h-[240px]"
                    : "border-orange-300/15 bg-gradient-to-b from-orange-500/[0.08] to-black/15 md:min-h-[220px]";

                return (
                  <article
                    key={row.accountId}
                    className={`relative overflow-hidden rounded-[28px] border p-5 text-center ${accent} ${
                      winner ? "md:order-2" : second ? "md:order-1" : "md:order-3"
                    }`}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <span
                      className={`mx-auto grid h-10 w-10 place-items-center rounded-full border ${
                        winner
                          ? "border-amber-300/30 bg-amber-500/15 text-amber-200"
                          : second
                            ? "border-white/15 bg-white/[0.06] text-white/75"
                            : "border-orange-300/20 bg-orange-500/10 text-orange-200"
                      }`}
                    >
                      {winner ? (
                        <Crown className="h-5 w-5" />
                      ) : (
                        <Medal className="h-5 w-5" />
                      )}
                    </span>

                    <div className="mx-auto mt-4 grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/10 bg-black/20 text-2xl font-black">
                      {row.avatar ? (
                        <img
                          src={row.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        avatarFallback(row.name)
                      )}
                    </div>

                    <p className="mt-4 text-[10px] font-black uppercase tracking-[.16em] text-white/35">
                      #{row.rank}
                    </p>
                    <h3 className="mt-1 truncate font-[family:var(--font-exo-2)] text-xl font-black">
                      {row.name}
                    </h3>
                    <p
                      className={`mt-2 font-[family:var(--font-exo-2)] text-3xl font-black ${
                        winner ? "text-amber-200" : "text-fuchsia-100"
                      }`}
                    >
                      {row.partyScore}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/28">
                      PartyScore
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-[28px] border border-white/[0.08] bg-[#0b0813]/78 p-4 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">
                  Classement complet
                </p>
                <h2 className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black">
                  Tous les scores
                </h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[9px] font-black text-white/35">
                {result.ranking.length} classés
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {[...podium, ...rest].map((row) => {
                const isViewer = result.viewerAccountId === row.accountId;
                return (
                  <div
                    key={row.accountId}
                    className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 ${
                      row.rank === 1
                        ? "border-amber-300/15 bg-amber-500/[0.06]"
                        : isViewer
                          ? "border-fuchsia-300/20 bg-fuchsia-500/[0.07]"
                          : "border-white/[0.06] bg-black/15"
                    }`}
                  >
                    <span className="text-center font-[family:var(--font-exo-2)] text-sm font-black text-white/45">
                      #{row.rank}
                    </span>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-black/20 text-xs font-black">
                        {row.avatar ? (
                          <img
                            src={row.avatar}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          avatarFallback(row.name)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {row.name}
                          {isViewer ? (
                            <span className="ml-2 text-[8px] uppercase tracking-[.12em] text-fuchsia-300">
                              Toi
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[9px] font-bold text-white/28">
                          {row.votesReceived} votes reçus · {row.songsAdded} titres
                        </p>
                      </div>
                    </div>
                    <strong className="font-[family:var(--font-exo-2)] text-lg text-fuchsia-100">
                      {row.partyScore}
                    </strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/[0.08] bg-[#0b0813]/78 p-4 backdrop-blur-xl sm:p-5">
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-orange-300">
              Morceaux de la soirée
            </p>
            <h2 className="mt-1 font-[family:var(--font-exo-2)] text-xl font-black">
              Les plus votés
            </h2>

            {bestSong ? (
              <div className="mt-4 overflow-hidden rounded-[22px] border border-orange-300/12 bg-orange-500/[0.04] p-3">
                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    {bestSong.thumbnail ? (
                      <img
                        src={bestSong.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Disc3 className="m-auto h-6 w-6 text-white/20" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/15 bg-orange-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-orange-200">
                      <Flame className="h-3 w-3" />
                      Banger de la soirée
                    </span>
                    <p className="mt-2 line-clamp-2 text-sm font-black">
                      {bestSong.title}
                    </p>
                    <p className="mt-1 text-[9px] font-bold text-white/28">
                      {bestSong.artistName || bestSong.addedBy || "MixParty"}
                    </p>
                    <p className="mt-2 font-[family:var(--font-exo-2)] text-xl font-black text-orange-200">
                      {bestSong.votes} votes
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {(result.topSongs || []).slice(bestSong ? 1 : 0, 6).map((song, index) => (
                <div
                  key={`${song.videoId}-${index}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/15 p-2.5"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
                    {song.thumbnail ? (
                      <img
                        src={song.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black">{song.title}</p>
                    <p className="mt-0.5 truncate text-[9px] text-white/28">
                      {song.artistName || song.addedBy || "MixParty"}
                    </p>
                  </div>
                  <strong className="text-sm text-fuchsia-100">
                    {song.votes}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="min-h-12 w-full rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.08] px-5 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-500/[0.13] sm:w-auto"
          >
            Voir mon profil
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/55 transition hover:bg-white/[0.08] sm:w-auto"
          >
            Retour à l’accueil
          </button>
        </section>
      </div>
    </main>
  );
}
