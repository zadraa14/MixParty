"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";
import {
  ArrowBigUp,
  Bot,
  Check,
  Copy,
  Crown,
  Disc3,
  ListMusic,
  Music4,
  Play,
  Plus,
  Radio,
  Sparkles,
  Search,
  SkipForward,
  TrendingUp,
  UserPlus,
  WandSparkles,
} from "lucide-react";
import { getApiBaseUrl, getAppBaseUrl, getSocketPath, getSocketUrl } from "../../../lib/config";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

type YoutubeSuggestion = {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
  durationSeconds?: number;
  sourceQuery?: string;
  suggestionPool?: YoutubeSuggestion[];
};

type Song = {
  title: string;
  videoId: string;
  thumbnail: string;
  votes: number;
  addedBy: string;
  voters: string[];
  played: boolean;
  addedAt: number;
  sourceQuery?: string;
  suggestionPool?: YoutubeSuggestion[];
};

type Participant = { id: string; name: string; avatar?: string };

const DEFAULT_AVATARS = [
  "/avatars/default/001-panda.png",
  "/avatars/default/002-corgi.png",
  "/avatars/default/003-black-cat.png",
  "/avatars/default/004-shiba.png",
  "/avatars/default/005-sloth.png",
  "/avatars/default/006-rabbit.png",
  "/avatars/default/007-tiger.png",
  "/avatars/default/008-lion.png",
  "/avatars/default/009-fox.png",
  "/avatars/default/010-wolf.png",
  "/avatars/default/011-koala.png",
  "/avatars/default/012-bear.png",
  "/avatars/default/013-raccoon.png",
  "/avatars/default/014-giraffe.png",
  "/avatars/default/015-monkey.png",
  "/avatars/default/016-bull.png",
  "/avatars/default/017-duck.png",
  "/avatars/default/018-owl.png",
  "/avatars/default/019-frog.png",
  "/avatars/default/020-penguin.png",
] as const;

function defaultAvatarForParticipant(participantId: string) {
  let hash = 0;
  for (let index = 0; index < participantId.length; index += 1) {
    hash = (hash * 31 + participantId.charCodeAt(index)) >>> 0;
  }
  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

type Party = {
  code: string;
  currentSong: Song | null;
  songs: Song[];
  history: Song[];
  participants: Participant[];
};

function normalizeParty(data: Partial<Party> | null | undefined): Party | null {
  if (!data?.code) return null;

  return {
    code: data.code,
    currentSong: data.currentSong ?? null,
    songs: Array.isArray(data.songs) ? data.songs : [],
    history: Array.isArray(data.history) ? data.history : [],
    participants: Array.isArray(data.participants) ? data.participants : [],
  };
}

function rotateSuggestions<T extends { id: string }>(items: T[], seed: string): T[] {
  if (items.length <= 1) return items;

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  const offset = hash % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export default function PartyPage() {
  const params = useParams();
  const code = params.code as string;

  const [party, setParty] = useState<Party | null>(null);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [participantAvatar, setParticipantAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [voteBurst, setVoteBurst] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"playback" | "add" | "queue" | "guests">("playback");
  const [isPlaybackController, setIsPlaybackController] = useState(false);
  const [remotePlayback, setRemotePlayback] = useState({ state: 2, time: 0, receivedAt: Date.now() });
  const [youtubeError, setYoutubeError] = useState<number | null>(null);

  const playerRef = useRef<any>(null);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<any>(null);
  const isPlaybackControllerRef = useRef(false);
  const applyingRemotePlaybackRef = useRef(false);
  const changingSongRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("playerName");
    const resolvedName = saved || "";

    let stableId = localStorage.getItem("mixparty.participant.id") || "";
    if (!stableId) {
      stableId = globalThis.crypto?.randomUUID?.() || `participant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("mixparty.participant.id", stableId);
    }

    const personalPhoto = localStorage.getItem("mixparty.profile.photo.v1") || "";
    const avatar = personalPhoto || defaultAvatarForParticipant(stableId);

    setParticipantId(stableId);
    setParticipantAvatar(avatar);

    if (resolvedName) {
      setPlayerName(resolvedName);
      setName(resolvedName);
    }
  }, []);

  useEffect(() => {
    if (code) {
      setShareUrl(`${getAppBaseUrl()}/party/${code}`);
    }
  }, [code]);

  useEffect(() => {
    if (!code || !playerName || !participantId) return;

    let cancelled = false;

    async function sendPresence() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/party/${code}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: participantId,
            name: playerName,
            avatar: participantAvatar || undefined,
          }),
        });
        if (!response.ok) return;
        const updated = normalizeParty(await response.json());
        if (!cancelled && updated) setParty(updated);
      } catch (error) {
        console.error("Présence participant indisponible", error);
      }
    }

    sendPresence();
    const timer = window.setInterval(sendPresence, 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [code, playerName, participantId, participantAvatar]);

  useEffect(() => {
    if (!code) return;

    async function loadParty() {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

      try {
        setLoadError("");
        const response = await fetch(
          `/mixparty-api/party/${encodeURIComponent(code)}`,
          {
            cache: "no-store",
            headers: { "cache-control": "no-cache" },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Erreur API ${response.status}`);
        }

        const data = await response.json();
        const normalized = normalizeParty(data);

        if (!normalized) {
          throw new Error("Soirée introuvable ou réponse incomplète");
        }

        setParty(normalized);
      } catch (error) {
        console.error("Impossible de charger la soirée", error);
        setLoadError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Le chargement de la soirée a dépassé 10 secondes. Appuie sur Réessayer."
            : "Impossible de charger la soirée. Appuie sur Réessayer."
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    loadParty();

    const socket = io(getSocketUrl(), {
      path: getSocketPath(),
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const creatorToken = localStorage.getItem(`mixparty_creator_${code}`) || "";
      socket.emit("join_party_room", { code, creatorToken });
      socket.emit("request_playback_sync", code);
    });

    socket.on("playback_role", ({ controller }: { controller: boolean }) => {
      isPlaybackControllerRef.current = controller;
      setIsPlaybackController(controller);
    });

    socket.on("playback_sync", (payload: { code: string; videoId: string; state: number; time: number }) => {
      if (payload.code !== code || payload.videoId !== party?.currentSong?.videoId) return;
      setRemotePlayback({ state: payload.state, time: payload.time, receivedAt: Date.now() });
      if (!playerRef.current || !isPlaybackControllerRef.current) return;
      applyingRemotePlaybackRef.current = true;
      try {
        const currentTime = Number(playerRef.current.getCurrentTime?.() || 0);
        if (Math.abs(currentTime - payload.time) > 1.25) playerRef.current.seekTo(payload.time, true);
        if (payload.state === 1) playerRef.current.playVideo();
        if (payload.state === 2) playerRef.current.pauseVideo();
      } finally {
        window.setTimeout(() => { applyingRemotePlaybackRef.current = false; }, 400);
      }
    });

    socket.on("provide_playback_sync", () => {
      if (!isPlaybackControllerRef.current || !playerRef.current || !party?.currentSong?.videoId) return;
      socket.emit("playback_sync", {
        code,
        videoId: party.currentSong.videoId,
        state: playerRef.current.getPlayerState?.() ?? 2,
        time: playerRef.current.getCurrentTime?.() ?? 0,
      });
    });

    socket.on(
      "party_updated",
      (updatedParty) => {
        if (updatedParty.code === code) {
          console.log(
            "🔥 PARTY UPDATE",
            updatedParty
          );

          setParty(normalizeParty(updatedParty));
        }
      }
    );

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, party?.currentSong?.videoId]);

  const queueSignature = (party?.songs || []).map((song) => song.videoId).join("|");
  const historySignature = (party?.history || []).map((song) => song.videoId).join("|");

  useEffect(() => {
    const currentSong = party?.currentSong;

    if (!currentSong?.title) {
      setSuggestions([]);
      return;
    }

    const activeSong = currentSong;
    const controller = new AbortController();

    async function loadSuggestions() {
      setLoadingSuggestions(true);

      try {
        const existingIds = new Set([
          activeSong.videoId,
          ...(party?.songs || []).map((song) => song.videoId),
          ...(party?.history || []).map((song) => song.videoId),
        ]);

        const storedPool = Array.isArray(activeSong.suggestionPool)
          ? activeSong.suggestionPool
          : [];

        const availableFromPool = storedPool
          .filter((video) => video?.id && !existingIds.has(video.id))
          .map((video) => ({
            ...video,
            sourceQuery: activeSong.sourceQuery || video.sourceQuery,
            suggestionPool: storedPool,
          }));

        const rotationSeed = `${activeSong.videoId}|${queueSignature}|${historySignature}`;
        const immediateSuggestions = rotateSuggestions(availableFromPool, rotationSeed).slice(0, 4);

        if (immediateSuggestions.length >= 4) {
          console.log("🎵 Suggestions instantanées depuis la recherche initiale", {
            sourceQuery: activeSong.sourceQuery,
            disponibles: immediateSuggestions.length,
          });
          setSuggestions(immediateSuggestions);
          return;
        }

        const cleanTitle = activeSong.title
          .replace(/\([^)]*(official|clip|lyrics|audio)[^)]*\)/gi, "")
          .replace(/\[[^\]]*(official|clip|lyrics|audio)[^\]]*\]/gi, "")
          .trim();
        const fallbackQuery = activeSong.sourceQuery?.trim() ||
          (cleanTitle.includes("-")
            ? cleanTitle.split("-")[0].trim()
            : cleanTitle.split(" ").slice(0, 3).join(" "));

        const response = await fetch(
          `${getApiBaseUrl()}/search/youtube?q=${encodeURIComponent(fallbackQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        const fetchedPool = Array.isArray(data) ? data : [];

        const merged = [...immediateSuggestions];
        for (const video of fetchedPool) {
          if (!video?.id || existingIds.has(video.id) || merged.some((item) => item.id === video.id)) continue;
          merged.push({
            ...video,
            sourceQuery: fallbackQuery,
            suggestionPool: fetchedPool,
          });
          if (merged.length >= 4) break;
        }

        setSuggestions(merged);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Suggestions MixParty indisponibles", error);
          setSuggestions([]);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }

    loadSuggestions();

    return () => controller.abort();
  }, [party?.currentSong?.videoId, queueSignature, historySignature]);

  async function joinParty() {
    if (!name.trim() || joining) return;

    setJoining(true);

    try {
      const response = await fetch(
      `${getApiBaseUrl()}/party/${code}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: participantId,
          name: name.trim(),
          avatar: participantAvatar || undefined,
        })
      }
    );

    const updated = await response.json();

    localStorage.setItem(
      "playerName",
      name.trim()
    );

    setPlayerName(name.trim());

    setParty(updated);

      setName("");
    } finally {
      setJoining(false);
    }
  }

  async function handleProfilePhotoUpload(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingAvatar(true);

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const next = new Image();
        next.onload = () => resolve(next);
        next.onerror = reject;
        next.src = source;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      if (!context) return;

      const side = Math.min(image.width, image.height);
      const sx = (image.width - side) / 2;
      const sy = (image.height - side) / 2;
      context.drawImage(image, sx, sy, side, side, 0, 0, 128, 128);
      const compressed = canvas.toDataURL("image/webp", 0.72);

      localStorage.setItem("mixparty.profile.photo.v1", compressed);
      setParticipantAvatar(compressed);
    } catch (error) {
      console.error("Impossible de préparer la photo de profil", error);
      window.alert("Impossible d’utiliser cette image. Essaie avec une autre photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function searchYoutube() {
    if (!search.trim() || searching) return;

    setSearching(true);

    try {
      const response = await fetch(
      `${getApiBaseUrl()}/search/youtube?q=${encodeURIComponent(search)}`
    );

    const data = await response.json();
    const pool = Array.isArray(data) ? data : [];

      setResults(
        pool.map((video) => ({
          ...video,
          sourceQuery: search.trim(),
          suggestionPool: pool,
        }))
      );
    } finally {
      setSearching(false);
    }
  }

  async function addYoutubeSong(video: any) {
    if (addingVideoId) return;

    setAddingVideoId(video.id);

    try {
      const response = await fetch(
      `${getApiBaseUrl()}/party/${code}/song`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          song: video.title,
          videoId: video.id,
          thumbnail: video.thumbnail,
          addedBy: playerName || "Inconnu",
          sourceQuery: video.sourceQuery || search.trim(),
          suggestionPool: Array.isArray(video.suggestionPool)
            ? video.suggestionPool.map((item: any) => ({
                id: item.id,
                title: item.title,
                thumbnail: item.thumbnail,
                channelTitle: item.channelTitle,
                durationSeconds: item.durationSeconds,
              }))
            : []
        })
      }
    );

    const updated = await response.json();

      setParty(updated);
      setResults((current) => current.filter((item) => item.id !== video.id));
      setSuggestions((current) => current.filter((item) => item.id !== video.id));
    } finally {
      setAddingVideoId(null);
    }
  }

  async function vote(index: number) {
    const votedSong = party?.songs[index];
    if (votedSong) {
      const burstId = `${votedSong.videoId}-${votedSong.addedAt}`;
      setVoteBurst(burstId);
      window.setTimeout(() => setVoteBurst((current) => current === burstId ? null : current), 700);
    }
    const response = await fetch(
      `${getApiBaseUrl()}/party/${code}/song/${index}/vote`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: playerName
        })
      }
    );

    const updated = await response.json();

    if (updated.error) {
      alert(updated.error);
      return;
    }

    setParty(updated);
  }

  async function playSong(index: number) {
    const response = await fetch(
      `${getApiBaseUrl()}/party/${code}/play/${index}`,
      {
        method: "POST"
      }
    );

    const updated = await response.json();

    setParty(updated);
  }

  async function nextSong() {
    if (changingSongRef.current) {
      return;
    }

    changingSongRef.current = true;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/party/${code}/next`,
        {
          method: "POST"
        }
      );

      const updated = await response.json();

      if (updated.error) {
        console.log(updated.error);

        changingSongRef.current = false;

        return;
      }

      setParty(updated);

      setTimeout(() => {
        changingSongRef.current = false;
      }, 3000);
    } catch (error) {
      console.error(error);

      changingSongRef.current = false;
    }
  }

  async function copyInvitation() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie ce lien", shareUrl);
    }
  }

  useEffect(() => {
    const videoId = party?.currentSong?.videoId;
    if (!videoId || !isPlaybackController) return;

    let cancelled = false;
    const host = playerHostRef.current;
    setYoutubeError(null);

    function clearPlayer() {
      const player = playerRef.current;
      playerRef.current = null;

      if (player) {
        try {
          player.destroy?.();
        } catch (error) {
          console.warn("Nettoyage du lecteur YouTube ignoré", error);
        }
      }

      // React ne gère que ce conteneur. L'API YouTube peut librement
      // remplacer son enfant sans provoquer de conflit removeChild.
      try {
        host?.replaceChildren();
      } catch {}
    }

    function createPlayer() {
      if (cancelled || !window.YT?.Player || !host) return;

      clearPlayer();

      const mount = document.createElement("div");
      mount.dataset.youtubeMount = videoId;
      host.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        host: "https://www.youtube.com",
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (cancelled) return;
            setYoutubeError(null);

            const iframe = event.target?.getIframe?.();
            if (iframe) {
              iframe.setAttribute(
                "allow",
                "autoplay; encrypted-media; picture-in-picture; fullscreen"
              );
              iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
            }

            socketRef.current?.emit("request_playback_sync", code);
          },

          onStateChange: (event: any) => {
            if (cancelled) return;

            if (!applyingRemotePlaybackRef.current && isPlaybackControllerRef.current) {
              socketRef.current?.emit("playback_sync", {
                code,
                videoId,
                state: event.data,
                time: playerRef.current?.getCurrentTime?.() ?? 0,
              });
            }

            if (event.data === 0 && isPlaybackControllerRef.current) {
              nextSong();
            }
          },

          onError: (event: any) => {
            if (cancelled) return;
            const errorCode = Number(event.data);
            // console.error déclenche l'écran rouge de Next.js en développement.
            console.warn("Erreur lecteur YouTube", { errorCode, videoId });
            setYoutubeError(Number.isFinite(errorCode) ? errorCode : -1);
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://www.youtube.com/iframe_api"]'
      );

      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") previousReady();
        createPlayer();
      };

      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        document.head.appendChild(tag);
      }
    }

    return () => {
      cancelled = true;
      clearPlayer();
    };
  }, [party?.currentSong?.videoId, isPlaybackController, code]);

  useEffect(() => {
    if (!party?.currentSong?.videoId) return;
    const interval = window.setInterval(() => {
      if (!isPlaybackControllerRef.current || !playerRef.current) return;
      socketRef.current?.emit("playback_sync", {
        code,
        videoId: party.currentSong!.videoId,
        state: playerRef.current.getPlayerState?.() ?? 2,
        time: playerRef.current.getCurrentTime?.() ?? 0,
      });
    }, 2000);
    return () => window.clearInterval(interval);
  }, [code, party?.currentSong?.videoId]);

  if (!party) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070711] font-[family:var(--font-geist-sans)] text-white">

        <div className="absolute left-1/4 top-1/4 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]" />

        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-orange-500/10 blur-[120px]" />

        <div className="relative flex flex-col items-center gap-5">

          <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-[26px] bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 shadow-[0_0_50px_rgba(192,38,211,0.35)]">

            <Music4 className="h-9 w-9 text-white" />

          </div>

          <div className="text-center">

            <p className="text-xl font-black tracking-[0.2em]">
              MIXPARTY
            </p>

            {loadError ? (
              <div className="mt-4 max-w-sm text-center">
                <p className="text-sm leading-6 text-red-200/80">{loadError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 overflow-hidden rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-bold transition hover:bg-white/15"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/45">
                Préparation de la soirée...
              </p>
            )}

          </div>

        </div>

      </main>
    );
  }

  const songs = party.songs ?? [];
  const queue = [...songs]
    .filter((song) => !song.played)
    .sort((a, b) => {
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }

      return a.addedAt - b.addedAt;
    });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070711] font-[family:var(--font-geist-sans)] text-white">

      {party.currentSong?.thumbnail && (
        <div
          className="pointer-events-none fixed inset-[-8%] scale-110 bg-cover bg-center opacity-[0.16] blur-[90px] saturate-150 transition-all duration-1000"
          style={{ backgroundImage: `url(${party.currentSong.thumbnail})` }}
        />
      )}

      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_bottom,rgba(7,7,17,0.48),rgba(7,7,17,0.9)_45%,#070711_85%)]" />

      <div className="pointer-events-none fixed inset-0">

        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-purple-700/20 blur-[150px]" />

        <div className="absolute right-[-180px] top-[250px] h-[520px] w-[520px] rounded-full bg-pink-600/10 blur-[160px]" />

        <div className="absolute bottom-[-200px] left-1/3 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[160px]" />

      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-4 pb-28 sm:px-6 sm:py-5 md:pb-5 lg:px-8 xl:px-10">

        <header className="mb-4 flex items-center justify-between rounded-[22px] border border-white/10 bg-black/25 px-3 py-3 backdrop-blur-xl md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/mixparty-logo-officiel.svg" alt="MixParty" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="-skew-x-6 font-[family:var(--font-exo-2)] text-lg font-black tracking-[0.12em]">
                <span className="text-white">MIX</span><span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">PARTY</span>
              </p>
              <p className="truncate text-[11px] font-semibold text-white/35">Soirée {party.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveMobileTab("guests")}
            className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
            {party.participants.length} en ligne
          </button>
        </header>

        <header className="desktop-topbar mb-6 hidden items-center justify-between gap-4 md:flex">

          <div className="group flex min-w-0 items-center gap-3 sm:gap-4">

            <div className="relative shrink-0">
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/25 to-orange-400/20 opacity-60 blur-xl transition duration-500 group-hover:scale-125 group-hover:opacity-90" />
              <img
                src="/mixparty-logo-officiel.svg"
                alt=""
                aria-hidden="true"
                className="relative h-20 w-20 object-contain transition duration-500 group-hover:rotate-2 group-hover:scale-105 sm:h-24 sm:w-24"
              />
            </div>

            <div className="min-w-0">
              <div
                aria-label="MixParty"
                className="-skew-x-6 font-[family:var(--font-exo-2)] text-[1.7rem] font-black leading-none tracking-[0.16em] transition-transform duration-300 group-hover:scale-[1.03] min-[420px]:text-[2rem] sm:text-[2.5rem]"
              >
                <span className="text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.16)]">MIX</span>
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(236,72,153,0.28)]">PARTY</span>
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-white/35 sm:text-sm">La musique appartient à tout le monde.</p>
            </div>

          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.045] px-3 py-2.5 shadow-[0_16px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-4 sm:py-3">

            <div className="hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Soirée</p>
              <p className="font-[family:var(--font-exo-2)] text-lg font-black tracking-[0.12em] text-white">{party.code}</p>
            </div>

            <div className="hidden h-8 w-px bg-white/10 sm:block" />

            <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
              <span>{party.participants.length}</span>
              <span className="hidden text-emerald-200/70 sm:inline">en ligne</span>
            </div>

          </div>

        </header>

        <section className="desktop-command-deck mb-6 hidden md:grid md:grid-cols-[1.2fr_0.8fr_0.8fr] md:gap-3">
          <div className="desktop-command-card desktop-command-card--hero">
            <div>
              <p className="desktop-command-label">Session en direct</p>
              <p className="desktop-command-title">La soirée est lancée</p>
            </div>
            <div className="desktop-live-wave" aria-hidden="true">
              {[34, 62, 45, 78, 54, 88, 48, 70, 40].map((height, index) => (
                <span key={index} style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }} />
              ))}
            </div>
          </div>
          <div className="desktop-command-card">
            <p className="desktop-command-label">Ambiance</p>
            <p className="desktop-command-value">{queue.length} titre{queue.length > 1 ? "s" : ""} en attente</p>
            <p className="desktop-command-meta">Classés automatiquement par votes</p>
          </div>
          <div className="desktop-command-card">
            <p className="desktop-command-label">Communauté</p>
            <p className="desktop-command-value">{party.participants.length} participant{party.participants.length > 1 ? "s" : ""}</p>
            <p className="desktop-command-meta">Connectés à la soirée {party.code}</p>
          </div>
        </section>

        <div className="desktop-party-grid grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px]">

          <div className="desktop-main-column space-y-6">

            <section className={`${activeMobileTab === "playback" ? "block" : "hidden"} now-playing-panel overflow-hidden rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-orange-500/[0.09] via-white/[0.045] to-purple-600/[0.08] p-3 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-6 md:block md:rounded-[30px]`}>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

                <div className="flex items-center gap-3">

                  <span className="relative flex h-3 w-3">

                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />

                    <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-400" />

                  </span>

                  <div>

                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                      En lecture
                    </p>

                    <h1 className="text-xl font-black sm:text-2xl">
                      Maintenant dans la soirée
                    </h1>

                  </div>

                </div>

                {isPlaybackController && <button
                  onClick={nextSong}
                  className="party-action party-action--orange group relative overflow-hidden rounded-2xl px-5 py-3 text-sm text-white"
                >
                  <span className="party-action__shine" aria-hidden="true" />
                  <span className="party-action__content flex items-center gap-2">
                    <span className="party-action__icon"><SkipForward className="h-4 w-4" /></span>
                    Titre suivant
                  </span>
                </button>}

              </div>

              {party.currentSong ? (
                <div className="grid gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(230px,0.7fr)]">

                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30 p-2">
                    {isPlaybackController ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-black">
                        <div
                          ref={playerHostRef}
                          className="absolute inset-0 h-full w-full"
                        />
                        {youtubeError !== null && (
                          <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-red-400/30 bg-red-950/90 p-3 text-sm shadow-2xl backdrop-blur">
                            <p className="font-black text-red-200">Erreur YouTube {youtubeError}</p>
                            <p className="mt-1 text-xs leading-5 text-red-100/75">
                              {youtubeError === 2 && "Identifiant vidéo ou paramètres invalides."}
                              {(youtubeError === 5 || youtubeError === 101 || youtubeError === 150) && "Cette vidéo refuse la lecture dans un lecteur intégré."}
                              {youtubeError === 100 && "Cette vidéo est privée, supprimée ou introuvable."}
                              {youtubeError === 153 && "YouTube ne reçoit pas correctement l’origine ou le référent de MixParty."}
                              {![-1, 2, 5, 100, 101, 150, 153].includes(youtubeError) && "Erreur inconnue du lecteur intégré."}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative aspect-video overflow-hidden rounded-[18px] bg-[#0d0d18]">
                        <img src={party.currentSong.thumbnail} alt="" className="h-full w-full object-cover opacity-45 blur-[1px]" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-6 text-center">
                          <Radio className="mb-3 h-9 w-9 text-orange-300" />
                          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-300">Lecture sur l’appareil DJ</p>
                          <p className="mt-2 text-sm text-white/65">Ton téléphone reste silencieux et suit la soirée en direct.</p>
                          <p className="mt-3 text-xs font-bold text-white/45">{remotePlayback.state === 1 ? "Lecture en cours" : "Lecture en pause"} · {Math.floor(remotePlayback.time / 60)}:{String(Math.floor(remotePlayback.time % 60)).padStart(2, "0")}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-black/20 p-5">

                    <div>

                      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-xs font-bold text-orange-300">

                        <Radio className="h-3.5 w-3.5" />

                        {isPlaybackController ? "Appareil DJ" : "Synchronisé avec le DJ"}

                      </div>

                      <h2 className="text-2xl font-black leading-tight">

                        {party.currentSong.title}

                      </h2>

                      <p className="mt-3 text-sm text-white/45">

                        Ajouté par{" "}

                        <span className="font-bold text-white/75">
                          {party.currentSong.addedBy}
                        </span>

                      </p>

                    </div>

                    <div className="mt-8">

                      <div className="mb-3 flex h-14 items-end gap-1">

                        {[40, 65, 35, 80, 50, 90, 55, 75, 42, 68, 30, 58].map(
                          (height, index) => (
                            <div
                              key={index}
                              className="flex-1 animate-pulse rounded-full bg-gradient-to-t from-purple-600 via-pink-500 to-orange-400"
                              style={{
                                height: `${height}%`,
                                animationDelay: `${index * 80}ms`
                              }}
                            />
                          )
                        )}

                      </div>

                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
                        MixParty Live
                      </p>

                    </div>

                  </div>

                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-white/15 bg-black/20 px-6 text-center">

                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/15 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                    <Music4 className="h-7 w-7 text-purple-300" />
                  </div>

                  <h2 className="text-xl font-black">
                    Aucun morceau en lecture
                  </h2>

                  <p className="mt-2 max-w-sm text-sm text-white/40">
                    Ajoute des musiques à la file puis lance le DJ.
                  </p>

                  <button
                    onClick={nextSong}
                    className="party-action party-action--purple group mt-5 rounded-2xl px-6 py-3"
                  >
                    <span className="party-action__shine" aria-hidden="true" />
                    <span className="party-action__content flex items-center justify-center gap-2">
                      <span className="party-action__icon"><Play className="h-4 w-4 fill-current" /></span>
                      Lancer le DJ
                    </span>
                  </button>

                </div>
              )}

            </section>

            <section className={`${activeMobileTab === "queue" ? "block" : "hidden"} rounded-[24px] border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl sm:p-6 md:block md:rounded-[30px]`}>

              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400">
                    Prochaine sélection
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    File d’attente DJ
                  </h2>

                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/55">

                  {queue.length} morceau{queue.length > 1 ? "x" : ""}

                </div>

              </div>

              {queue.length > 0 ? (
                <div className="space-y-3">

                  {queue.map((song, index) => {
                    const originalIndex = songs.findIndex(
                      (item) => item.addedAt === song.addedAt
                    );

                    return (
                      <div
                        key={`${song.videoId}-${song.addedAt}`}
                        className={`group grid grid-cols-[44px_64px_minmax(0,1fr)] items-center gap-3 rounded-[22px] border p-3 transition sm:grid-cols-[48px_72px_minmax(0,1fr)_auto] ${
                          index === 0
                            ? "border-purple-400/30 bg-gradient-to-r from-purple-600/15 via-pink-500/10 to-orange-400/10"
                            : "border-white/[0.07] bg-black/20 hover:border-white/15 hover:bg-white/[0.045]"
                        }`}
                      >

                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${
                            index === 0
                              ? "bg-gradient-to-br from-purple-600 to-pink-500 text-white"
                              : "bg-white/[0.06] text-white/45"
                          }`}
                        >
                          {index === 0 ? <Play className="h-4 w-4 fill-current" /> : index + 1}
                        </div>

                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="h-16 w-16 rounded-2xl object-cover sm:h-[72px] sm:w-[72px]"
                        />

                        <div className="min-w-0">

                          {index === 0 && (
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">
                              Prochaine musique
                            </p>
                          )}

                          <p className="truncate font-black">
                            {song.title}
                          </p>

                          <p className="mt-1 truncate text-sm text-white/40">
                            Ajouté par {song.addedBy}
                          </p>

                          <div className="mt-2 flex items-center gap-2 sm:hidden">

                            <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-bold text-purple-300">
                              <ArrowBigUp className="mr-1 inline h-3.5 w-3.5" />{song.votes}
                            </span>

                            <button
                              onClick={() => vote(originalIndex)}
                              className={`vote-button vote-button--compact ${voteBurst === `${song.videoId}-${song.addedAt}` ? "vote-button--burst" : ""}`}
                            >
                              <span className="vote-button__plus">+1</span>
                              <span className="flex items-center gap-1"><ArrowBigUp className="h-3.5 w-3.5" />Voter</span>
                            </button>

                          </div>

                        </div>

                        <div className="col-span-3 hidden items-center gap-3 sm:col-span-1 sm:flex">

                          <div className="rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-center">

                            <p className="text-lg font-black text-purple-300">
                              {song.votes}
                            </p>

                            <p className="text-[10px] uppercase tracking-wider text-white/35">
                              votes
                            </p>

                          </div>

                          <button
                            onClick={() => vote(originalIndex)}
                            className={`vote-button ${voteBurst === `${song.videoId}-${song.addedAt}` ? "vote-button--burst" : ""}`}
                          >
                            <span className="vote-button__glow" aria-hidden="true" />
                            <span className="vote-button__plus">+1</span>
                            <span className="relative z-10 flex items-center gap-1.5"><ArrowBigUp className="h-4 w-4" />Voter</span>
                          </button>

                        </div>

                      </div>
                    );
                  })}

                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center">

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/15 bg-purple-500/10">
                    <ListMusic className="h-6 w-6 text-purple-300" />
                  </div>

                  <p className="mt-3 font-black">
                    La file est vide
                  </p>

                  <p className="mt-1 text-sm text-white/40">
                    Recherche un titre pour lancer la soirée.
                  </p>

                </div>
              )}

            </section>

            <section className="hidden overflow-hidden rounded-[30px] border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.08] via-purple-500/[0.08] to-pink-500/[0.07] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6 md:block">

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="suggestion-orb flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                    <Bot className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">DJ MixParty</p>
                    <h2 className="mt-1 text-2xl font-black">Suggestions pour cette ambiance</h2>
                    <p className="mt-2 max-w-2xl text-sm text-white/42">Des titres inspirés du morceau en cours et de la couleur musicale de la soirée.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-white/55">
                  <TrendingUp className="h-4 w-4 text-pink-300" />
                  Ambiance détectée
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Énergie", party.currentSong ? "92%" : "—", Sparkles],
                  ["Style", party.currentSong ? "Dance • Pop" : "En attente", Disc3],
                  ["Sélection", `${suggestions.length} idées`, WandSparkles]
                ].map(([label, value, Icon]: any) => (
                  <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/30">
                      <Icon className="h-3.5 w-3.5 text-purple-300" />{label}
                    </div>
                    <p className="mt-2 font-[family:var(--font-exo-2)] text-lg font-black text-white/85">{value}</p>
                  </div>
                ))}
              </div>

              {loadingSuggestions ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="h-28 animate-pulse rounded-[22px] border border-white/[0.06] bg-white/[0.035]" />
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {suggestions.map((video, index) => (
                    <article key={video.id} className="suggestion-card group relative flex gap-3 overflow-hidden rounded-[22px] border border-white/[0.08] bg-black/25 p-3">
                      <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-200">Choix #{index + 1}</div>
                      <img src={video.thumbnail} alt={video.title} className="h-24 w-32 shrink-0 rounded-2xl object-cover" />
                      <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-1">
                        <p className="line-clamp-2 pr-16 text-sm font-black leading-snug">{video.title}</p>
                        <button
                          onClick={() => addYoutubeSong(video)}
                          disabled={addingVideoId === video.id}
                          className="suggestion-add mt-3 w-fit rounded-xl px-4 py-2 text-xs font-black"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {addingVideoId === video.id ? "Ajout…" : "Ajouter à la file"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center">
                  <WandSparkles className="mx-auto h-6 w-6 text-purple-300" />
                  <p className="mt-3 font-black">Lance un morceau pour réveiller le DJ MixParty.</p>
                  <p className="mt-1 text-sm text-white/35">Les recommandations apparaîtront automatiquement ici.</p>
                </div>
              )}

            </section>

            <section className={`${activeMobileTab === "add" ? "block" : "hidden"} rounded-[24px] border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl sm:p-6 md:block md:rounded-[30px]`}>

              <div className="mb-5">

                <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-400">
                  Ajouter un morceau
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Recherche YouTube
                </h2>

              </div>

              <div className="flex flex-col gap-3 sm:flex-row">

                <div className="relative flex-1">

                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        searchYoutube();
                      }
                    }}
                    placeholder="Titre, artiste..."
                    className="w-full rounded-2xl border border-white/10 bg-black/25 py-4 pl-12 pr-4 outline-none transition placeholder:text-white/25 focus:border-purple-400/50 focus:bg-black/35"
                  />

                </div>

                <button
                  onClick={searchYoutube}
                  className="party-action party-action--purple group rounded-2xl px-7 py-4"
                >
                  <span className="party-action__shine" aria-hidden="true" />
                  <span className="party-action__content flex items-center justify-center gap-2">
                    <span className={`party-action__icon ${searching ? "party-action__icon--spin" : ""}`}><Search className="h-4 w-4" /></span>
                    {searching ? "Recherche…" : "Rechercher"}
                  </span>
                </button>

              </div>

              {results.length > 0 && (
                <div className="mt-6 grid gap-3 md:grid-cols-2">

                  {results.map((video) => (
                    <div
                      key={video.id}
                      className="group flex gap-3 rounded-[22px] border border-white/[0.07] bg-black/20 p-3 transition hover:border-purple-400/25 hover:bg-white/[0.045]"
                    >

                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-24 w-32 shrink-0 rounded-2xl object-cover"
                      />

                      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">

                        <p className="line-clamp-2 text-sm font-black leading-snug">
                          {video.title}
                        </p>

                        <button
                          onClick={() => addYoutubeSong(video)}
                          className="mt-3 w-fit rounded-xl bg-white/[0.08] px-4 py-2 text-xs font-black transition group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-500"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            {addingVideoId === video.id ? "Ajout…" : "Ajouter"}
                          </span>
                        </button>

                      </div>

                    </div>
                  ))}

                </div>
              )}

            </section>

            {party.history?.length > 0 && (
              <section className={`${activeMobileTab === "queue" ? "block" : "hidden"} rounded-[24px] border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl sm:p-6 md:block md:rounded-[30px]`}>

                <div className="mb-5">

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                    Souvenirs de la soirée
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    Historique
                  </h2>

                </div>

                <div className="grid gap-3 sm:grid-cols-2">

                  {party.history.map((song, index) => (
                    <div
                      key={`${song.videoId}-${index}`}
                      className="flex items-center gap-3 rounded-[20px] border border-white/[0.07] bg-black/20 p-3"
                    >

                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="h-16 w-16 rounded-2xl object-cover opacity-80"
                      />

                      <div className="min-w-0">

                        <p className="truncate font-bold text-white/80">
                          {song.title}
                        </p>

                        <p className="mt-1 text-sm text-white/35">
                          Ajouté par {song.addedBy}
                        </p>

                      </div>

                    </div>
                  ))}

                </div>

              </section>
            )}

          </div>

          <aside className="desktop-side-column space-y-6 lg:sticky lg:top-5 lg:self-start">

            <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} rounded-[24px] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

              <div className="mb-4 flex items-center justify-between">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400">
                    Invitation
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Rejoins la soirée
                  </h2>

                </div>

                <div className="rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-sm font-black text-purple-300">
                  {party.code}
                </div>

              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-purple-300/25 bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-orange-400/15 p-[1px] shadow-[0_18px_60px_rgba(168,85,247,0.18)]">
                <div className="relative rounded-[27px] bg-[#0d0b18] p-5">
                  <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-purple-500/20 blur-3xl" />
                  <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-orange-400/15 blur-3xl" />
                  <div className="relative rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                    <QRCodeCanvas
                      value={shareUrl || `http://localhost:3000/party/${party.code}`}
                      size={280}
                      level="H"
                      bgColor="#ffffff"
                      fgColor="#171126"
                      className="h-auto w-full rounded-xl"
                    />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-[5px] border-white bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 shadow-lg">
                      <Music4 className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <div className="relative mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Code soirée</span>
                    <strong className="text-lg tracking-[0.18em] text-purple-200">{party.code}</strong>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-sm text-white/40">
                Scanne le QR code pour participer et voter.
              </p>

              <button
                onClick={copyInvitation}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black transition hover:border-purple-400/30 hover:bg-purple-500/10"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4 text-purple-300" />}
                {copied ? "Lien copié" : "Copier le lien"}
              </button>

            </section>

            {!playerName ? (
              <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} rounded-[24px] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 to-purple-600/10 p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-400/20 bg-pink-500/10 shadow-[0_0_28px_rgba(236,72,153,0.12)]">
                  <UserPlus className="h-5 w-5 text-pink-300" />
                </div>

                <h2 className="text-xl font-black">
                  Comment tu t’appelles ?
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-white/40">
                  Ton prénom apparaîtra sur les morceaux que tu ajoutes.
                </p>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      joinParty();
                    }
                  }}
                  placeholder="Ton prénom"
                  className="mt-5 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none transition placeholder:text-white/25 focus:border-pink-400/50"
                />

                <button
                  onClick={joinParty}
                  className="group mt-3 w-full rounded-2xl border border-white/20 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-5 py-4 font-black shadow-[0_14px_35px_rgba(168,85,247,0.2)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    {joining ? "Connexion…" : "Rejoindre la soirée"}
                  </span>
                </button>

              </section>
            ) : (
              <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 to-pink-500/[0.07] p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

                <div className="flex items-center gap-4">

                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-purple-300/30 bg-gradient-to-br from-purple-600 to-pink-500 shadow-[0_0_24px_rgba(168,85,247,0.22)]">
                    {participantAvatar ? (
                      <img src={participantAvatar} alt="Ton avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-black uppercase">{playerName.charAt(0)}</div>
                    )}
                  </div>

                  <div>

                    <p className="text-sm text-white/40">
                      Connecté en tant que
                    </p>

                    <p className="text-lg font-black">
                      {playerName}
                    </p>

                  </div>

                </div>

                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white/65 transition hover:border-purple-400/30 hover:bg-purple-500/10">
                  <UserPlus className="h-4 w-4 text-purple-300" />
                  {uploadingAvatar ? "Préparation de la photo…" : "Choisir ma photo de profil"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={(event) => handleProfilePhotoUpload(event.target.files?.[0] || null)}
                  />
                </label>

                <div className="mt-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white/50">
                  Sans photo personnelle, MixParty t’attribue automatiquement un avatar unique.
                </div>

              </section>
            )}

            <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} rounded-[24px] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

              <div className="mb-5 flex items-center justify-between">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                    Communauté
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Participants
                  </h2>

                </div>

                <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-sm font-black">
                  {party.participants.length}
                </span>

              </div>

              {party.participants.length > 0 ? (
                <div className="space-y-2">

                  {party.participants.map((participant, index) => (
                    <div
                      key={`${participant.id || participant.name}-${index}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-500/25 to-pink-500/20 shadow-[0_0_20px_rgba(168,85,247,0.18)]">
                        {participant.avatar ? (
                          <img src={participant.avatar} alt={`Avatar de ${participant.name}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-black uppercase">
                            {participant.name.trim().charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{participant.name}</p>
                        <p className="truncate text-xs text-white/35">Dans la soirée</p>
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
                    </div>
                  ))}

                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/35">
                  Aucun participant pour le moment.
                </p>
              )}

            </section>

            <section className={`${activeMobileTab === "playback" ? "block" : "hidden"} overflow-hidden rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-orange-500/15 via-pink-500/10 to-purple-600/10 p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 shadow-[0_0_28px_rgba(251,146,60,0.12)]">
                <Crown className="h-5 w-5 text-orange-300" />
              </div>

              <h2 className="mt-4 text-xl font-black">
                Mode DJ
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-white/45">
                Le DJ sélectionne automatiquement le morceau ayant le plus de votes.
              </p>

              <button
                onClick={nextSong}
                className="party-action party-action--orange group mt-5 w-full rounded-2xl px-5 py-4"
              >
                <span className="party-action__shine" aria-hidden="true" />
                <span className="party-action__content flex items-center justify-center gap-2">
                  <span className="party-action__icon"><Crown className="h-4 w-4" /></span>
                  Lancer le DJ
                </span>
              </button>

            </section>

          </aside>

        </div>

        <footer className="mt-8 hidden border-t border-white/[0.07] py-8 text-center md:block">

          <div className="flex items-center justify-center gap-3">

            <img src="/mixparty-logo-officiel.svg" alt="" aria-hidden="true" className="h-11 w-11 object-contain" />

            <span className="-skew-x-6 font-[family:var(--font-exo-2)] text-lg font-black tracking-[0.16em]">
              <span className="text-white">MIX</span><span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">PARTY</span>
            </span>

          </div>

          <p className="mt-3 text-sm text-white/30">
            La musique de la soirée appartient à tout le monde.
          </p>

        </footer>

        <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-[22px] border border-white/12 bg-[#11111d]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:hidden" aria-label="Navigation de la soirée">
          {[
            { id: "playback", label: "Lecture", Icon: Music4 },
            { id: "add", label: "Ajouter", Icon: Plus },
            { id: "queue", label: "File", Icon: ListMusic },
            { id: "guests", label: "Invités", Icon: UserPlus },
          ].map(({ id, label, Icon }) => {
            const active = activeMobileTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveMobileTab(id as "playback" | "add" | "queue" | "guests");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[17px] px-1 py-2.5 text-[10px] font-black transition ${active ? "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white shadow-[0_8px_24px_rgba(168,85,247,0.28)]" : "text-white/45 active:bg-white/[0.06]"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

      </div>

      <div className="pointer-events-none fixed inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:64px_64px]" />

      <style jsx>{`
        @keyframes mixpartyEqualizer {
          0%, 100% { transform: scaleY(0.35); opacity: 0.45; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        @keyframes partyButtonGlow {
          0%, 100% { filter: brightness(1); box-shadow: 0 16px 38px var(--action-shadow), inset 0 1px 0 rgba(255,255,255,.25); }
          50% { filter: brightness(1.14); box-shadow: 0 20px 52px var(--action-shadow), 0 0 28px var(--action-glow), inset 0 1px 0 rgba(255,255,255,.38); }
        }

        @keyframes partyButtonShine {
          0%, 62% { transform: translateX(-160%) skewX(-22deg); opacity: 0; }
          72% { opacity: .9; }
          100% { transform: translateX(260%) skewX(-22deg); opacity: 0; }
        }

        @keyframes partyIconFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(-4deg); }
        }

        @keyframes partySearchSpin {
          to { transform: rotate(360deg); }
        }

        .party-action {
          --action-shadow: rgba(168, 85, 247, .32);
          --action-glow: rgba(236, 72, 153, .28);
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.24);
          background-size: 180% 180%;
          font-family: var(--font-exo-2), sans-serif;
          font-weight: 900;
          letter-spacing: .035em;
          text-shadow: 0 1px 12px rgba(255,255,255,.22);
          transform: translateZ(0);
          animation: partyButtonGlow 3.2s ease-in-out infinite;
          transition: transform .22s ease, filter .22s ease, border-color .22s ease;
        }

        .party-action--purple {
          background-image: linear-gradient(115deg, #7c3aed 0%, #d946ef 45%, #f97316 100%);
        }

        .party-action--orange {
          --action-shadow: rgba(249, 115, 22, .34);
          --action-glow: rgba(244, 63, 94, .3);
          background-image: linear-gradient(115deg, #f97316 0%, #f43f5e 52%, #a855f7 100%);
        }

        .party-action::after {
          content: "";
          position: absolute;
          inset: 1px;
          z-index: -1;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,.16), transparent 42%);
          pointer-events: none;
        }

        .party-action:hover {
          transform: translateY(-3px) scale(1.025);
          filter: brightness(1.16) saturate(1.1);
          border-color: rgba(255,255,255,.42);
        }

        .party-action:active {
          transform: translateY(0) scale(.975);
        }

        .party-action__content {
          position: relative;
          z-index: 2;
        }

        .party-action__shine {
          position: absolute;
          top: -45%;
          bottom: -45%;
          left: -35%;
          width: 28%;
          z-index: 1;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent);
          filter: blur(2px);
          animation: partyButtonShine 4.1s ease-in-out infinite;
          pointer-events: none;
        }

        .party-action__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 0 7px rgba(255,255,255,.42));
          animation: partyIconFloat 1.7s ease-in-out infinite;
        }

        .party-action:hover .party-action__icon {
          transform: translateX(2px) scale(1.12);
        }

        .party-action__icon--spin {
          animation: partySearchSpin .8s linear infinite;
        }

        @keyframes votePop {
          0% { transform: translateY(0) scale(1); }
          38% { transform: translateY(-3px) scale(1.12) rotate(-1deg); }
          100% { transform: translateY(0) scale(1); }
        }

        @keyframes votePlus {
          0% { opacity: 0; transform: translate(-50%, 5px) scale(.65); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -34px) scale(1.15); }
        }

        @keyframes suggestionOrb {
          0%, 100% { transform: rotate(-3deg) scale(1); box-shadow: 0 0 22px rgba(34,211,238,.08); }
          50% { transform: rotate(3deg) scale(1.06); box-shadow: 0 0 34px rgba(168,85,247,.2); }
        }

        .vote-button {
          position: relative;
          overflow: visible;
          border-radius: 1rem;
          border: 1px solid rgba(216,180,254,.28);
          background: linear-gradient(115deg, rgba(124,58,237,.95), rgba(217,70,239,.92), rgba(244,63,94,.9));
          padding: .75rem 1rem;
          font-family: var(--font-exo-2), sans-serif;
          font-size: .875rem;
          font-weight: 900;
          box-shadow: 0 12px 28px rgba(168,85,247,.22), inset 0 1px 0 rgba(255,255,255,.2);
          transition: transform .2s ease, filter .2s ease, box-shadow .2s ease;
        }

        .vote-button:hover { transform: translateY(-2px) scale(1.04); filter: brightness(1.13); box-shadow: 0 16px 38px rgba(217,70,239,.32); }
        .vote-button:active { transform: scale(.94); }
        .vote-button--compact { padding: .3rem .75rem; border-radius: 999px; font-size: .75rem; }
        .vote-button--burst { animation: votePop .55s cubic-bezier(.2,.9,.2,1); }
        .vote-button__plus { position: absolute; left: 50%; top: 0; pointer-events: none; opacity: 0; font-size: .75rem; font-weight: 1000; color: #f0abfc; text-shadow: 0 0 12px rgba(236,72,153,.85); }
        .vote-button--burst .vote-button__plus { animation: votePlus .7s ease-out; }
        .vote-button__glow { position: absolute; inset: -8px; z-index: -1; border-radius: inherit; background: radial-gradient(circle, rgba(217,70,239,.3), transparent 65%); filter: blur(10px); }

        .suggestion-orb { animation: suggestionOrb 3.2s ease-in-out infinite; }
        .suggestion-card { transition: transform .25s ease, border-color .25s ease, background .25s ease; }
        .suggestion-card:hover { transform: translateY(-3px); border-color: rgba(103,232,249,.26); background: rgba(255,255,255,.055); }
        .suggestion-add { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid rgba(255,255,255,.13); background: linear-gradient(115deg, rgba(8,145,178,.45), rgba(124,58,237,.65), rgba(217,70,239,.58)); box-shadow: 0 10px 26px rgba(124,58,237,.16); transition: transform .2s ease, filter .2s ease; }
        .suggestion-add:hover { transform: translateY(-2px); filter: brightness(1.18); }
        .suggestion-add:disabled { opacity: .55; cursor: wait; }


        @keyframes desktopLiveWave {
          0%, 100% { transform: scaleY(.45); opacity: .45; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        @media (min-width: 768px) {
          .desktop-topbar {
            min-height: 104px;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255,255,255,.07);
          }

          .desktop-command-deck {
            position: relative;
          }

          .desktop-command-card {
            position: relative;
            min-height: 104px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 24px;
            padding: 1.15rem 1.25rem;
            background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.025));
            box-shadow: 0 20px 55px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.08);
            backdrop-filter: blur(22px);
          }

          .desktop-command-card::after {
            content: "";
            position: absolute;
            inset: auto -15% -65% 20%;
            height: 130px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(168,85,247,.18), transparent 68%);
            pointer-events: none;
          }

          .desktop-command-card--hero {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: linear-gradient(130deg, rgba(124,58,237,.2), rgba(236,72,153,.12) 54%, rgba(249,115,22,.15));
            border-color: rgba(216,180,254,.16);
          }

          .desktop-command-label {
            font-size: .65rem;
            font-weight: 900;
            letter-spacing: .2em;
            text-transform: uppercase;
            color: rgba(255,255,255,.34);
          }

          .desktop-command-title,
          .desktop-command-value {
            margin-top: .45rem;
            font-family: var(--font-exo-2), sans-serif;
            font-size: 1.1rem;
            line-height: 1.15;
            font-weight: 900;
            color: rgba(255,255,255,.94);
          }

          .desktop-command-title { font-size: 1.35rem; }
          .desktop-command-meta { margin-top: .42rem; font-size: .76rem; color: rgba(255,255,255,.34); }

          .desktop-live-wave {
            display: flex;
            align-items: center;
            gap: 4px;
            width: 122px;
            height: 48px;
          }

          .desktop-live-wave span {
            flex: 1;
            min-width: 4px;
            transform-origin: bottom;
            border-radius: 999px;
            background: linear-gradient(to top, #7c3aed, #ec4899, #fb923c);
            box-shadow: 0 0 14px rgba(236,72,153,.24);
            animation: desktopLiveWave 1.15s ease-in-out infinite;
          }

          .now-playing-panel {
            border-color: rgba(251,146,60,.22);
            box-shadow: 0 32px 100px rgba(0,0,0,.34), 0 0 80px rgba(124,58,237,.08), inset 0 1px 0 rgba(255,255,255,.08);
          }
        }

        @media (min-width: 1280px) {
          .desktop-party-grid { align-items: start; }
          .desktop-main-column > section { border-radius: 32px; }
          .desktop-side-column > section { border-radius: 28px; }
          .now-playing-panel { padding: 1.65rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .party-action, .party-action__shine, .party-action__icon, .suggestion-orb, .vote-button--burst, .vote-button--burst .vote-button__plus {
            animation: none !important;
          }
        }
      `}</style>

    </main>
  );
}
