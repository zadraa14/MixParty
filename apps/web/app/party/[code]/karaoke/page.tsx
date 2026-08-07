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

  const backdrop = songArtwork(currentSong);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070711] text-white">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-[70px]"
        style={{ backgroundImage: `url(${backdrop})` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(168,85,247,.18),transparent_42%),linear-gradient(180deg,rgba(7,7,17,.55),rgba(7,7,17,.96))]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-5 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/15 shadow-[0_0_35px_rgba(217,70,239,.18)]">
              <Mic2 className="h-6 w-6 text-fuchsia-200" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-300">
                MIXPARTY
              </p>
              <h1 className="text-lg font-black sm:text-xl">Karaoké Beta</h1>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${
              connected
                ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-200"
                : "border-red-300/15 bg-red-500/10 text-red-200"
            }`}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? "Synchronisé" : "Reconnexion…"}
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center py-8">
          {!currentSong ? (
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] border border-white/10 bg-white/[0.05]">
                <Music4 className="h-10 w-10 text-white/35" />
              </div>
              <h2 className="mt-7 text-4xl font-black sm:text-6xl">En attente d’un morceau</h2>
              <p className="mt-4 text-base text-white/45 sm:text-lg">
                Lance une musique depuis la soirée MixParty. Les paroles synchronisées apparaîtront ici automatiquement.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex items-center justify-center gap-5 text-center sm:mb-12">
                <img
                  src={backdrop}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover shadow-[0_20px_60px_rgba(0,0,0,.45)] sm:h-24 sm:w-24"
                />
                <div className="min-w-0 text-left">
                  <p className="truncate text-xl font-black sm:text-3xl">
                    {currentSong.title}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-white/45 sm:text-base">
                    {currentSong.artistName || currentSong.addedBy || "MixParty"}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-fuchsia-200/70">
                    <Radio className="h-3.5 w-3.5" />
                    {playback.state === 1 ? "EN DIRECT" : playback.state === 2 ? "PAUSE" : "SYNCHRONISATION"}
                    <span className="text-white/25">•</span>
                    <span>{formatTime(playbackTime)}</span>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-6xl">
                {lyricsLoading ? (
                  <div className="rounded-[36px] border border-fuchsia-300/15 bg-black/25 p-10 text-center backdrop-blur-xl">
                    <Mic2 className="mx-auto h-10 w-10 animate-pulse text-fuchsia-300" />
                    <p className="mt-4 text-lg font-black">Chargement des paroles…</p>
                  </div>
                ) : lyrics?.available ? (
                  <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-black/30 px-6 py-10 text-center shadow-[0_35px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:px-12 sm:py-14">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent" />

                    <p className="min-h-8 text-base font-bold text-white/25 sm:text-xl">
                      {lyricState.previous?.text || "\u00A0"}
                    </p>

                    <div className="relative mx-auto mt-5 max-w-5xl">
                      <p className="text-balance text-4xl font-black leading-tight text-white sm:text-6xl lg:text-7xl">
                        {lyricState.current?.text ||
                          (lyricState.next ? "♪" : "…")}
                      </p>

                      {lyricState.current?.text ? (
                        <div className="mx-auto mt-6 h-1.5 max-w-3xl overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-300 transition-[width] duration-100"
                            style={{ width: `${Math.round(lyricState.progress * 100)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>

                    <p className="mt-8 min-h-12 text-balance text-2xl font-black text-fuchsia-200/65 sm:text-3xl lg:text-4xl">
                      {lyricState.next?.text || "\u00A0"}
                    </p>

                    <p className="mt-4 min-h-8 text-base font-bold text-white/20 sm:text-lg">
                      {lyricState.afterNext?.text || "\u00A0"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[36px] border border-amber-300/15 bg-amber-500/[0.06] p-10 text-center backdrop-blur-xl">
                    <Mic2 className="mx-auto h-10 w-10 text-amber-200/70" />
                    <h2 className="mt-4 text-2xl font-black">Karaoké indisponible pour ce morceau</h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
                      {lyrics?.message ||
                        "Aucune parole synchronisée n’est encore disponible dans MusicBrain pour ce titre."}
                    </p>
                    {lyrics?.kind === "unchecked" ? (
                      <p className="mt-3 text-xs font-bold text-fuchsia-200/55">
                        Le morceau pourra devenir compatible après un prochain audit LRCLIB.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <footer className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4 text-[11px] font-bold text-white/30">
          <span>Soirée {code || "—"}</span>
          <span>Paroles synchronisées par LRCLIB • Karaoké Beta</span>
        </footer>
      </div>
    </main>
  );
}
