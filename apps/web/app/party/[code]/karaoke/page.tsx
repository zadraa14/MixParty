"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io } from "socket.io-client";
import { Mic2, Music4, Pause, Play, Radio, SkipBack, SkipForward, Wifi, WifiOff } from "lucide-react";
import { getApiBaseUrl, getSocketPath, getSocketUrl } from "../../../../lib/config";

type Song = {
  title: string;
  videoId: string;
  thumbnail?: string;
  artistName?: string;
  addedBy?: string;
  durationSeconds?: number;
  coverStatus?: "pending" | "found" | "not_found" | "error";
  coverUrl?: string;
  votes?: number;
  addedAt?: number;
  played?: boolean;
};

type Party = {
  code: string;
  currentSong?: Song | null;
  songs?: Song[];
  history?: Song[];
  participants?: Array<{ id: string; name: string }>;
};

type TimedLine = {
  time: number;
  text: string;
};

type LyricsPayload = {
  videoId: string;
  available: boolean;
  kind: "synced" | "plain" | "instrumental" | "not_found" | "unchecked" | "error";
  lrclibId?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  lines?: TimedLine[];
  message?: string;
};

type PlaybackState = {
  videoId: string;
  state: number;
  time: number;
  receivedAt: number;
};

const DEFAULT_COVER = "/branding/icon.png";
const KARAOKE_FLOW_LEAD_SECONDS = 0.38;
const KARAOKE_FLOW_WINDOW = 4;
const KARAOKE_FLOW_LINE_GAP_PX = 118;

function songArtwork(song?: Song | null) {
  return song?.coverStatus === "found" && song.coverUrl
    ? song.coverUrl
    : song?.thumbnail || DEFAULT_COVER;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}


export default function KaraokePartyPage() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code || "").toUpperCase();

  const [party, setParty] = useState<Party | null>(null);
  const [lyrics, setLyrics] = useState<LyricsPayload | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>({
    videoId: "",
    state: 2,
    time: 0,
    receivedAt: Date.now(),
  });
  const [clock, setClock] = useState(Date.now());
  const [creatorToken, setCreatorToken] = useState("");
  const lyricsRequestRef = useRef("");
  const socketRef = useRef<any>(null);

  async function loadParty() {
    if (!code) return;

    try {
      const response = await fetch(`${getApiBaseUrl()}/party/${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Soirée introuvable");
      setParty(data);
    } catch {
      setParty(null);
    }
  }

  useEffect(() => {
    setCreatorToken(localStorage.getItem(`mixparty_creator_${code}`) || "");
  }, [code]);

  useEffect(() => {
    void loadParty();
    const timer = window.setInterval(() => void loadParty(), 2500);
    return () => window.clearInterval(timer);
  }, [code]);

  useEffect(() => {
    if (!code) return;

    const socket = io(getSocketUrl(), {
      path: getSocketPath(),
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      const token = localStorage.getItem(`mixparty_creator_${code}`) || "";
      socket.emit("join_party_room", { code });
      if (token) setCreatorToken(token);
      socket.emit("request_playback_sync", code);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on(
      "playback_sync",
      (payload: { code?: string; videoId?: string; state?: number; time?: number }) => {
        if (String(payload?.code || "").toUpperCase() !== code) return;

        setPlayback({
          videoId: String(payload?.videoId || ""),
          state: Number(payload?.state ?? 2),
          time: Math.max(0, Number(payload?.time || 0)),
          receivedAt: Date.now(),
        });
      }
    );

    const syncTimer = window.setInterval(() => {
      socket.emit("request_playback_sync", code);
    }, 1200);

    return () => {
      window.clearInterval(syncTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, []);

  function sendPlaybackControl(action: "play" | "pause" | "next" | "previous") {
    if (!creatorToken || !socketRef.current) return;

    socketRef.current.emit("playback_control_request", {
      code,
      creatorToken,
      action,
    });
  }

  const queue = useMemo(() => {
    return [...(party?.songs || [])]
      .filter((song) => !song.played)
      .sort((a, b) => {
        const votesDiff = Number(b.votes || 0) - Number(a.votes || 0);
        if (votesDiff !== 0) return votesDiff;
        return Number(a.addedAt || 0) - Number(b.addedAt || 0);
      });
  }, [party?.songs]);

  const currentSong = party?.currentSong || null;
  const currentVideoId = currentSong?.videoId || "";

  useEffect(() => {
    if (!currentVideoId) {
      setLyrics(null);
      lyricsRequestRef.current = "";
      return;
    }

    if (lyricsRequestRef.current === currentVideoId) return;
    lyricsRequestRef.current = currentVideoId;
    setLyricsLoading(true);
    setLyrics(null);

    let cancelled = false;

    fetch(
      `${getApiBaseUrl()}/partybrain/karaoke/lyrics/${encodeURIComponent(currentVideoId)}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok && response.status !== 429) {
          throw new Error(data?.message || "Paroles indisponibles");
        }
        return data as LyricsPayload;
      })
      .then((data) => {
        if (!cancelled) setLyrics(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setLyrics({
            videoId: currentVideoId,
            available: false,
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Impossible de charger les paroles.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentVideoId]);

  const playbackTime = useMemo(() => {
    if (!currentVideoId) return 0;

    const sameTrack = playback.videoId === currentVideoId;
    if (!sameTrack) return 0;

    if (playback.state === 1) {
      return Math.max(0, playback.time + (clock - playback.receivedAt) / 1000);
    }

    return Math.max(0, playback.time);
  }, [clock, currentVideoId, playback]);

  const rawLyricIndex = useMemo(() => {
    const lines = lyrics?.available ? lyrics.lines || [] : [];
    if (!lines.length) return -1;

    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].time <= playbackTime + KARAOKE_FLOW_LEAD_SECONDS) index = i;
      else break;
    }
    return index;
  }, [lyrics, playbackTime]);

  const lyricFlow = useMemo(() => {
    const lines = lyrics?.available ? lyrics.lines || [] : [];

    if (!lines.length) {
      return {
        position: -1,
        activeIndex: -1,
        visible: [] as Array<{
          line: TimedLine;
          index: number;
          distance: number;
          translateY: number;
          opacity: number;
          scale: number;
          blur: number;
        }>,
      };
    }

    if (rawLyricIndex < 0) {
      const firstVisible = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => String(line.text || "").trim())
        .slice(0, 3)
        .map(({ line, index }) => ({
          line,
          index,
          distance: index + 1,
          translateY: (index + 1) * KARAOKE_FLOW_LINE_GAP_PX,
          opacity: index === 0 ? 0.48 : 0.22,
          scale: index === 0 ? 0.92 : 0.82,
          blur: index === 0 ? 0 : 0.45,
        }));

      return {
        position: -1,
        activeIndex: -1,
        visible: firstVisible,
      };
    }

    const current = lines[rawLyricIndex];
    const next = lines[rawLyricIndex + 1];

    let fractionalProgress = 0;

    if (current && next) {
      const start = current.time - KARAOKE_FLOW_LEAD_SECONDS;
      const end = Math.max(start + 0.35, next.time - KARAOKE_FLOW_LEAD_SECONDS);
      const linear = Math.min(1, Math.max(0, (playbackTime - start) / (end - start)));

      // Smoothstep : le mouvement démarre et se termine sans à-coup.
      fractionalProgress = linear * linear * (3 - 2 * linear);
    }

    const position = rawLyricIndex + fractionalProgress;
    const centerIndex = Math.round(position);

    const visible = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line, index }) => {
        if (!String(line.text || "").trim()) return false;
        return Math.abs(index - position) <= KARAOKE_FLOW_WINDOW;
      })
      .map(({ line, index }) => {
        const distance = index - position;
        const absDistance = Math.abs(distance);

        return {
          line,
          index,
          distance,
          translateY: distance * KARAOKE_FLOW_LINE_GAP_PX,
          opacity:
            absDistance < 0.55
              ? 1
              : absDistance < 1.45
                ? 0.52
                : absDistance < 2.45
                  ? 0.24
                  : 0.10,
          scale:
            absDistance < 0.55
              ? 1
              : absDistance < 1.45
                ? 0.88
                : absDistance < 2.45
                  ? 0.78
                  : 0.70,
          blur:
            absDistance < 0.75
              ? 0
              : absDistance < 1.7
                ? 0.25
                : 0.7,
        };
      });

    return {
      position,
      activeIndex: centerIndex,
      visible,
    };
  }, [lyrics, playbackTime, rawLyricIndex]);



  const countdown = useMemo(() => {
    const lines = lyrics?.available ? lyrics.lines || [] : [];
    if (!lines.length) return null;

    const firstMeaningful = lines.find((line) => String(line.text || "").trim());
    if (!firstMeaningful) return null;

    const remaining = firstMeaningful.time - playbackTime;
    if (remaining <= 0 || remaining > 6) return null;

    return Math.max(1, Math.ceil(remaining));
  }, [lyrics, playbackTime]);

  const hasStartedLyrics = Boolean(
    lyrics?.available &&
      (lyrics.lines || []).some(
        (line) => String(line.text || "").trim() && line.time <= playbackTime + 0.08
      )
  );

  const backdrop = songArtwork(currentSong);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05050d] text-white">
      <div
        className="absolute inset-[-8%] scale-110 bg-cover bg-center opacity-30 blur-[95px] transition-all duration-1000"
        style={{ backgroundImage: `url(${backdrop})` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(168,85,247,.22),transparent_34%),radial-gradient(circle_at_78%_72%,rgba(249,115,22,.13),transparent_28%),radial-gradient(circle_at_18%_78%,rgba(236,72,153,.14),transparent_30%),linear-gradient(180deg,rgba(5,5,13,.42),rgba(5,5,13,.94))]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="pointer-events-none absolute left-[-12vw] top-[15vh] h-[38vw] w-[38vw] rounded-full bg-fuchsia-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-[-16vw] right-[-10vw] h-[42vw] w-[42vw] rounded-full bg-orange-500/10 blur-[110px]" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4 sm:px-7 lg:px-10">
        <header className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-500/20 via-purple-500/15 to-orange-500/15 shadow-[0_0_45px_rgba(217,70,239,.18)]">
              <Mic2 className="h-6 w-6 text-fuchsia-100" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.30em] text-fuchsia-300">
                MIXPARTY
              </p>
              <h1 className="bg-gradient-to-r from-white via-fuchsia-100 to-orange-100 bg-clip-text text-lg font-black text-transparent sm:text-xl">
                Karaoké
              </h1>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black backdrop-blur-xl ${
              connected
                ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-200"
                : "border-red-300/15 bg-red-500/10 text-red-200"
            }`}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? "Synchronisé" : "Reconnexion…"}
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-[1550px] flex-1 flex-col py-4 sm:py-6">
          {!currentSong ? (
            <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] border border-white/10 bg-white/[0.05] shadow-[0_0_70px_rgba(168,85,247,.12)] backdrop-blur-xl">
                <Music4 className="h-10 w-10 text-fuchsia-200/50" />
              </div>
              <p className="mt-7 text-xs font-black uppercase tracking-[.28em] text-fuchsia-300/70">
                MixParty Karaoké
              </p>
              <h2 className="mt-3 text-4xl font-black sm:text-6xl lg:text-7xl">
                Prêt pour la prochaine chanson
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/40 sm:text-lg">
                Choisis un morceau dans le catalogue Karaoké de la soirée.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-center gap-4 text-center sm:mb-6">
                <img
                  src={backdrop}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover shadow-[0_18px_55px_rgba(0,0,0,.50)] ring-1 ring-white/10 sm:h-20 sm:w-20"
                />
                <div className="min-w-0 text-left">
                  <p className="max-w-[72vw] truncate text-2xl font-black sm:text-3xl">
                    {currentSong.title}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-white/45 sm:text-base">
                    {currentSong.artistName || currentSong.addedBy || "MixParty"}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-fuchsia-200/70">
                    <Radio className="h-3.5 w-3.5" />
                    {playback.state === 1 ? "En direct" : playback.state === 2 ? "Pause" : "Synchronisation"}
                    <span className="text-white/20">•</span>
                    <span>{formatTime(playbackTime)}</span>
                  </div>
                </div>
              </div>

              <div className="grid min-h-[72vh] w-full gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <section className="relative overflow-hidden rounded-[38px] border border-fuchsia-300/20 bg-[linear-gradient(180deg,rgba(13,8,24,.88),rgba(5,5,13,.96))] shadow-[0_30px_100px_rgba(0,0,0,.48),0_0_60px_rgba(217,70,239,.08)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(217,70,239,.10),transparent_34%),radial-gradient(circle_at_18%_50%,rgba(124,58,237,.08),transparent_35%)]" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent" />

                  {lyricsLoading ? (
                    <div className="relative z-10 grid min-h-[62vh] place-items-center">
                      <div className="text-center">
                        <Mic2 className="mx-auto h-11 w-11 animate-pulse text-fuchsia-300" />
                        <p className="mt-4 text-lg font-black">Chargement des paroles…</p>
                      </div>
                    </div>
                  ) : lyrics?.available ? (
                    <div className="relative z-10 flex min-h-[72vh] flex-col">
                      {countdown !== null && !hasStartedLyrics ? (
                        <div className="absolute inset-0 z-40 grid place-items-center bg-black/45 backdrop-blur-md">
                          <div className="text-center">
                            <p className="text-xs font-black uppercase tracking-[.35em] text-fuchsia-200/60">
                              Prépare-toi
                            </p>
                            <div
                              key={countdown}
                              className="mt-3 bg-gradient-to-br from-white via-fuchsia-100 to-orange-200 bg-clip-text text-[9rem] font-black leading-none text-transparent sm:text-[13rem]"
                              style={{ animation: "karaokeCountdown .7s ease-out both" }}
                            >
                              {countdown}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="relative flex-1 overflow-hidden px-5 sm:px-8">
                        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-[#08060f] via-[#08060f]/65 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#05050d] via-[#05050d]/70 to-transparent" />

                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative h-full w-full max-w-6xl">
                            {lyricFlow.visible.map(({ line, index, translateY, opacity, scale, blur }) => {
                              const isCenter = Math.abs(index - lyricFlow.position) < 0.58;

                              return (
                                <div
                                  key={`${line.time}-${index}`}
                                  className="absolute inset-x-0 top-1/2 flex w-full justify-center px-4 will-change-transform sm:px-8"
                                  style={{
                                    transform: `translateY(calc(-50% + ${translateY}px)) scale(${scale})`,
                                    transformOrigin: "center center",
                                    opacity,
                                    filter: `blur(${blur}px)`,
                                    transition:
                                      "transform 110ms linear, opacity 180ms ease, filter 180ms ease",
                                  }}
                                >
                                  <p
                                    className={`mx-auto w-full max-w-[88%] break-words text-center text-balance font-black leading-[1.08] tracking-[-0.035em] ${
                                      isCenter
                                        ? "bg-gradient-to-r from-fuchsia-300 via-pink-100 to-orange-200 bg-clip-text text-[clamp(2.5rem,5vw,5.7rem)] text-transparent drop-shadow-[0_0_28px_rgba(236,72,153,.20)]"
                                        : "text-[clamp(1.35rem,2.45vw,2.45rem)] text-white/55"
                                    }`}
                                  >
                                    {line.text}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="relative z-30 px-7 pb-6 pt-2 sm:px-10 sm:pb-7">
                        <div className="flex items-center gap-4 text-xs font-black text-white/70">
                          <span>{formatTime(playbackTime)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-pink-400 to-orange-300 shadow-[0_0_18px_rgba(217,70,239,.5)]"
                              style={{
                                width: `${
                                  (currentSong.durationSeconds || lyrics?.duration || 0) > 0
                                    ? Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          (playbackTime /
                                            Number(currentSong.durationSeconds || lyrics?.duration || 1)) *
                                            100
                                        )
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span>
                            {formatTime(Number(currentSong.durationSeconds || lyrics?.duration || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 grid min-h-[62vh] place-items-center p-10 text-center">
                      <div>
                        <Mic2 className="mx-auto h-11 w-11 text-amber-200/70" />
                        <h2 className="mt-4 text-2xl font-black">
                          Karaoké indisponible pour ce morceau
                        </h2>
                        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
                          {lyrics?.message ||
                            "Aucune parole synchronisée n’est encore disponible pour ce titre."}
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                <aside className="flex flex-col rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,10,22,.92),rgba(5,5,13,.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,.34)] backdrop-blur-2xl">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300/80">
                      À suivre
                    </p>
                    <h3 className="mt-1 text-lg font-black">Prochaines chansons</h3>
                  </div>

                  <div className="mt-4 space-y-2">
                    {queue.slice(0, 5).map((song, index) => (
                      <div
                        key={`${song.videoId}-${song.addedAt || index}`}
                        className={`flex items-center gap-3 rounded-2xl border p-2.5 ${
                          index === 0
                            ? "border-fuchsia-300/25 bg-fuchsia-500/[0.09]"
                            : "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                          index === 0
                            ? "bg-fuchsia-500/25 text-fuchsia-100"
                            : "bg-white/[0.06] text-white/40"
                        }`}>
                          {index + 1}
                        </span>

                        <img
                          src={songArtwork(song)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-white/90">
                            {song.title}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] font-bold text-white/35">
                            {song.artistName || song.addedBy || "MixParty"}
                          </p>
                          {Number(song.votes || 0) > 0 ? (
                            <p className="mt-1 text-[10px] font-black text-orange-300/80">
                              ♥ {song.votes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {!queue.length ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
                        <Music4 className="mx-auto h-5 w-5 text-white/20" />
                        <p className="mt-2 text-xs font-bold text-white/30">
                          Aucun morceau en attente
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="border-t border-white/[0.07] pt-4">
                      <div className="mb-4 flex items-center justify-center gap-2 text-xs font-black text-fuchsia-200/75">
                        <span>👥</span>
                        <span>{party?.participants?.length || 0} participant{(party?.participants?.length || 0) > 1 ? "s" : ""}</span>
                      </div>

                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => sendPlaybackControl("previous")}
                          disabled={!creatorToken || !(party?.history?.length)}
                          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 disabled:opacity-25"
                        >
                          <SkipBack className="h-5 w-5 fill-current" />
                        </button>

                        <button
                          type="button"
                          onClick={() => sendPlaybackControl(playback.state === 1 ? "pause" : "play")}
                          disabled={!creatorToken || !currentSong}
                          className="grid h-16 w-16 place-items-center rounded-full border border-fuchsia-300/30 bg-black/40 text-white shadow-[0_0_0_2px_rgba(217,70,239,.08),0_0_35px_rgba(217,70,239,.22)] disabled:opacity-30"
                        >
                          {playback.state === 1 ? (
                            <Pause className="h-7 w-7 fill-current" />
                          ) : (
                            <Play className="ml-1 h-7 w-7 fill-current" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => sendPlaybackControl("next")}
                          disabled={!creatorToken}
                          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/75 disabled:opacity-25"
                        >
                          <SkipForward className="h-5 w-5 fill-current" />
                        </button>
                      </div>

                      <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs font-black text-emerald-200">
                          {connected ? (
                            <Wifi className="h-4 w-4" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-red-300" />
                          )}
                          <span>{connected ? "Connecté" : "Reconnexion…"}</span>
                        </div>
                        <p className="mt-1 pl-6 text-[10px] font-bold text-emerald-200/55">
                          {connected ? "Synchronisé en direct" : "Synchronisation en attente"}
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>

        <footer className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4 text-[10px] font-black uppercase tracking-[.12em] text-white/22">
          <span>Soirée {code || "—"}</span>
          <span>MixParty Karaoké • Premium Flow V3</span>
        </footer>
      </div>

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .will-change-transform {
            transition: none !important;
          }
        }

        @keyframes karaokeCountdown {
          0% {
            opacity: 0;
            transform: scale(.72);
            filter: blur(8px);
          }
          55% {
            opacity: 1;
            transform: scale(1.08);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }
      `}</style>
    </main>
  );

}
