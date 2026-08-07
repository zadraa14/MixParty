"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io } from "socket.io-client";
import { Mic2, Music4, Radio, Wifi, WifiOff } from "lucide-react";
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
};

type Party = {
  code: string;
  currentSong?: Song | null;
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
      socket.emit("join_party_room", { code });
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
    const timer = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

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

  const lyricState = useMemo(() => {
    const lines = lyrics?.available ? lyrics.lines || [] : [];
    if (!lines.length) {
      return {
        previous: null as TimedLine | null,
        current: null as TimedLine | null,
        next: null as TimedLine | null,
        afterNext: null as TimedLine | null,
        progress: 0,
      };
    }

    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].time <= playbackTime + 0.08) index = i;
      else break;
    }

    const current = index >= 0 ? lines[index] : null;
    const next = lines[index + 1] || null;
    const afterNext = lines[index + 2] || null;
    const previous = index > 0 ? lines[index - 1] : null;

    let progress = 0;
    if (current && next) {
      const duration = Math.max(0.2, next.time - current.time);
      progress = Math.min(1, Math.max(0, (playbackTime - current.time) / duration));
    } else if (current) {
      progress = 1;
    }

    return { previous, current, next, afterNext, progress };
  }, [lyrics, playbackTime]);




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

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12">
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

        <section className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col justify-center py-5 sm:py-8">
          {!currentSong ? (
            <div className="mx-auto max-w-3xl text-center">
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
                Choisis un morceau dans le catalogue Karaoké de la soirée. L’écran se mettra à jour automatiquement.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-center gap-4 text-center sm:mb-8">
                <img
                  src={backdrop}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover shadow-[0_18px_55px_rgba(0,0,0,.50)] ring-1 ring-white/10 sm:h-20 sm:w-20"
                />
                <div className="min-w-0 text-left">
                  <p className="max-w-[70vw] truncate text-xl font-black sm:text-2xl lg:text-3xl">
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

              <div className="mx-auto w-full max-w-7xl">
                {lyricsLoading ? (
                  <div className="rounded-[40px] border border-fuchsia-300/15 bg-black/25 p-12 text-center shadow-[0_35px_110px_rgba(0,0,0,.35)] backdrop-blur-2xl">
                    <Mic2 className="mx-auto h-11 w-11 animate-pulse text-fuchsia-300" />
                    <p className="mt-4 text-lg font-black">Chargement des paroles…</p>
                  </div>
                ) : lyrics?.available ? (
                  <div className="relative min-h-[56vh] overflow-hidden rounded-[42px] border border-white/10 bg-black/28 px-5 py-8 text-center shadow-[0_35px_120px_rgba(0,0,0,.48)] backdrop-blur-2xl sm:px-10 sm:py-10 lg:px-14">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/80 to-orange-300/70" />
                    <div className="absolute left-1/2 top-0 h-40 w-3/4 -translate-x-1/2 bg-fuchsia-500/[0.05] blur-[70px]" />

                    {countdown !== null && !hasStartedLyrics ? (
                      <div className="absolute inset-0 z-20 grid place-items-center bg-black/35 backdrop-blur-md">
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-[.35em] text-fuchsia-200/60">
                            Prépare-toi
                          </p>
                          <div
                            key={countdown}
                            className="mt-3 bg-gradient-to-br from-white via-fuchsia-100 to-orange-200 bg-clip-text text-[9rem] font-black leading-none text-transparent drop-shadow-[0_0_45px_rgba(217,70,239,.28)] sm:text-[13rem]"
                            style={{ animation: "karaokeCountdown .7s ease-out both" }}
                          >
                            {countdown}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="relative z-10 flex min-h-[48vh] flex-col justify-center">
                      <p
                        key={`prev-${lyricState.previous?.time ?? -1}`}
                        className="mx-auto min-h-8 max-w-5xl text-balance text-base font-black leading-snug text-white/20 blur-[0.15px] transition-all duration-500 sm:text-xl lg:text-2xl"
                      >
                        {lyricState.previous?.text || "\u00A0"}
                      </p>

                      <div
                        key={`current-${lyricState.current?.time ?? -1}`}
                        className="relative mx-auto mt-4 w-full max-w-6xl"
                        style={{ animation: "karaokeLineIn .55s cubic-bezier(.2,.8,.2,1) both" }}
                      >
                        <div className="relative mx-auto max-w-full">
                          <p className="mx-auto text-balance bg-gradient-to-r from-fuchsia-300 via-pink-200 to-orange-200 bg-clip-text text-[clamp(2.7rem,6.5vw,7.7rem)] font-black leading-[1.02] tracking-[-0.045em] text-transparent drop-shadow-[0_0_28px_rgba(236,72,153,.18)]">
                            {lyricState.current?.text || (lyricState.next ? "♪" : "…")}
                          </p>
                        </div>

                        {lyricState.current?.text ? (
                          <div className="mx-auto mt-7 h-1.5 max-w-4xl overflow-hidden rounded-full bg-white/[0.07]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-orange-300 shadow-[0_0_24px_rgba(217,70,239,.45)] transition-[width] duration-100 ease-linear"
                              style={{ width: `${Math.round(lyricState.progress * 100)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>

                      <p
                        key={`next-${lyricState.next?.time ?? -1}`}
                        className="mx-auto mt-8 min-h-14 max-w-5xl text-balance text-2xl font-black leading-tight text-fuchsia-100/45 blur-[0.35px] transition-all duration-500 sm:text-3xl lg:text-5xl"
                        style={{ animation: "karaokeNextIn .6s ease both" }}
                      >
                        {lyricState.next?.text || "\u00A0"}
                      </p>

                      <p className="mx-auto mt-4 min-h-8 max-w-4xl text-balance text-sm font-bold text-white/14 blur-[0.45px] sm:text-base lg:text-lg">
                        {lyricState.afterNext?.text || "\u00A0"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[40px] border border-amber-300/15 bg-black/30 p-10 text-center shadow-[0_35px_110px_rgba(0,0,0,.40)] backdrop-blur-2xl">
                    <Mic2 className="mx-auto h-11 w-11 text-amber-200/70" />
                    <h2 className="mt-4 text-2xl font-black">
                      Karaoké indisponible pour ce morceau
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
                      {lyrics?.message ||
                        "Aucune parole synchronisée n’est encore disponible dans MusicBrain pour ce titre."}
                    </p>
                    {lyrics?.kind === "unchecked" ? (
                      <p className="mt-3 text-xs font-bold text-fuchsia-200/55">
                        PartyBrain vérifiera automatiquement LRCLIB lorsque ce morceau sera appris.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <footer className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4 text-[10px] font-black uppercase tracking-[.12em] text-white/22">
          <span>Soirée {code || "—"}</span>
          <span>MixParty Karaoké • LRCLIB Sync</span>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes karaokeLineIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(.985);
            filter: blur(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes karaokeNextIn {
          0% {
            opacity: 0;
            transform: translateY(10px);
            filter: blur(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(.35px);
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
