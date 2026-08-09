"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";
import {
  ArrowBigUp,
  Activity,
  Battery,
  Camera,
  Images,
  Bot,
  BrainCircuit,
  Check,
  Copy,
  Crown,
  Disc3,
  Trash2,
  Expand,
  Headphones,
  Gauge,
  ListMusic,
  MessageCircle,
  Mic2,
  Music4,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Sparkles,
  Search,
  Shuffle,
  SkipForward,
  TrendingUp,
  UserPlus,
  Zap,
  UsersRound,
  WandSparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { getApiBaseUrl, getSocketPath, getSocketUrl } from "../../../lib/config";
import MixPartyBackground from "../../../components/MixPartyBackground";

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
  artistName?: string;
  featuredArtistNames?: string[];
  albumName?: string;
  metadataSource?: "ART_TRACK_DESCRIPTION" | "TITLE_CHANNEL" | "QUERY_FALLBACK";
  metadataConfidence?: number;
  coverStatus?: "pending" | "found" | "not_found" | "error";
  coverUrl?: string;
  coverSource?: "APPLE_ITUNES" | "MUSICBRAINZ_CAA" | "APPLE_ARTIST_FALLBACK";
  coverWidth?: number;
  coverHeight?: number;
  coverLastCheckedAt?: number;
  sourceQuery?: string;
  suggestionPool?: YoutubeSuggestion[];
};

type Song = {
  title: string;
  videoId: string;
  thumbnail: string;
  durationSeconds?: number;
  votes: number;
  addedBy: string;
  voters: string[];
  played: boolean;
  addedAt: number;
  sourceQuery?: string;
  suggestionPool?: YoutubeSuggestion[];
  artistName?: string;
  featuredArtistNames?: string[];
  albumName?: string;
  metadataSource?: "ART_TRACK_DESCRIPTION" | "TITLE_CHANNEL" | "QUERY_FALLBACK";
  metadataConfidence?: number;
  coverStatus?: "pending" | "found" | "not_found" | "error";
  coverUrl?: string;
  coverSource?: "APPLE_ITUNES" | "MUSICBRAINZ_CAA" | "APPLE_ARTIST_FALLBACK";
  coverWidth?: number;
  coverHeight?: number;
  coverLastCheckedAt?: number;
  addedById?: string;
};

type Participant = { id: string; name: string; avatar?: string };

type DjInteraction = {
  id: string;
  kind: "join" | "vote" | "add";
  name: string;
  avatar?: string;
  detail: string;
  at: number;
};

const MIXPARTY_DEFAULT_COVER = "/branding/icon.png";

function hasHdCover(song?: Song | null): boolean {
  return Boolean(song?.coverStatus === "found" && song.coverUrl);
}

function getSongArtwork(song?: Song | null): string {
  return hasHdCover(song) ? song!.coverUrl! : MIXPARTY_DEFAULT_COVER;
}

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


type KaraokeCatalogSong = {
  videoId: string;
  title: string;
  rawTitle?: string;
  artistName: string;
  thumbnail?: string;
  durationSeconds?: number;
  lrclibId?: number | null;
  matchedTrackName?: string;
  matchedArtistName?: string;
  matchedAlbumName?: string;
};

type KaraokeCatalogResponse = {
  totalReady: number;
  matched: number;
  returned: number;
  query: string;
  items: KaraokeCatalogSong[];
};

type Party = {
  code: string;
  currentSong: Song | null;
  songs: Song[];
  history: Song[];
  participants: Participant[];
  partyBrainAutoRelayEnabled?: boolean;
  showYoutubeClip?: boolean;
};

function normalizeParty(data: Partial<Party> | null | undefined): Party | null {
  if (!data?.code) return null;

  return {
    code: data.code,
    currentSong: data.currentSong ?? null,
    songs: Array.isArray(data.songs) ? data.songs : [],
    history: Array.isArray(data.history) ? data.history : [],
    participants: Array.isArray(data.participants) ? data.participants : [],
    partyBrainAutoRelayEnabled: Boolean(data.partyBrainAutoRelayEnabled),
    showYoutubeClip: Boolean(data.showYoutubeClip),
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


const PARTY_STYLE_RULES = [
  { name: "Rap FR", keywords: ["gazo", "sdm", "tiakola", "ninho", "naps", "jul", "booba", "koba", "damso", "rap", "drill", "hip hop"] },
  { name: "Afro / Amapiano", keywords: ["afro", "amapiano", "aya", "burna", "wizkid", "tems", "davido", "dadju", "tayc"] },
  { name: "Électro / Dance", keywords: ["house", "techno", "electro", "dance", "dj", "remix", "guetta", "avicii", "calvin harris"] },
  { name: "Pop festive", keywords: ["pop", "weeknd", "dua lipa", "bruno mars", "rihanna", "beyonce", "katy perry"] },
  { name: "Reggaeton / Latino", keywords: ["reggaeton", "bad bunny", "j balvin", "karol g", "daddy yankee", "latino"] },
  { name: "Rock", keywords: ["rock", "metal", "guitar", "nirvana", "queen", "acdc", "linkin park"] },
] as const;

function detectPartyStyle(value: string) {
  const normalized = value.toLowerCase();
  let best = { name: "Pop festive", score: 0 };
  for (const style of PARTY_STYLE_RULES) {
    const score = style.keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) best = { name: style.name, score };
  }
  return best;
}

function transitionScore(from: string, to: string) {
  if (from === to) return 96;
  const compatible = new Set([
    "Rap FR|Afro / Amapiano", "Afro / Amapiano|Rap FR",
    "Afro / Amapiano|Reggaeton / Latino", "Reggaeton / Latino|Afro / Amapiano",
    "Pop festive|Électro / Dance", "Électro / Dance|Pop festive",
    "Rap FR|Pop festive", "Pop festive|Rap FR",
    "Électro / Dance|Reggaeton / Latino", "Reggaeton / Latino|Électro / Dance",
  ]);
  return compatible.has(`${from}|${to}`) ? 84 : 62;
}

export default function PartyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = params.code as string;
  const externalDisplayMode = searchParams.get("display");

  const [party, setParty] = useState<Party | null>(null);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [participantAvatar, setParticipantAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [searching, setSearching] = useState(false);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [karaokeScreenOpen, setKaraokeScreenOpen] = useState(false);
  const [karaokeCatalog, setKaraokeCatalog] = useState<KaraokeCatalogResponse | null>(null);
  const [karaokeCatalogSearch, setKaraokeCatalogSearch] = useState("");
  const [karaokeCatalogLoading, setKaraokeCatalogLoading] = useState(false);
  const [karaokeCatalogError, setKaraokeCatalogError] = useState("");
  const [searchInsight, setSearchInsight] = useState<null | {
    sampleSize: number;
    message: string;
    hourMessage?: string;
    nextArtists: Array<{ artistName: string; count: number; confidence: number }>;
  }>(null);
  const [joining, setJoining] = useState(false);
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [voteBurst, setVoteBurst] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"playback" | "add" | "karaoke" | "queue" | "guests">("playback");
  const [isPlaybackController, setIsPlaybackController] = useState(false);
  const [remotePlayback, setRemotePlayback] = useState({ state: 2, time: 0, receivedAt: Date.now() });
  const [youtubeError, setYoutubeError] = useState<number | null>(null);
  const [djModeActive, setDjModeActive] = useState(false);
  const [partyBrainRelayUpdating, setPartyBrainRelayUpdating] = useState(false);
  const [clipDisplayUpdating, setClipDisplayUpdating] = useState(false);
  const [djModeStartedAt, setDjModeStartedAt] = useState<number | null>(null);
  const [djModeElapsed, setDjModeElapsed] = useState(0);
  const [tvModeActive, setTvModeActive] = useState(false);
  const [tvPlayback, setTvPlayback] = useState({ time: 0, duration: 0, state: 2 });
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [resumeRequired, setResumeRequired] = useState(false);
  const [playerHostElement, setPlayerHostElement] = useState<HTMLDivElement | null>(null);
  const [playerAudit, setPlayerAudit] = useState<Array<{ at: number; event: string; detail?: string }>>([]);
  const [djInteractions, setDjInteractions] = useState<DjInteraction[]>([]);
  const interactionSnapshotRef = useRef({ participants: new Set<string>(), songs: new Set<string>(), voters: new Set<string>() });
  const DEBUG_PLAYER = false;
  const wakeLockRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const loadedVideoIdRef = useRef("");
  const pendingVideoIdRef = useRef("");
  const currentVideoIdRef = useRef("");
  const djModeActiveRef = useRef(false);
  const socketRef = useRef<any>(null);
  const isPlaybackControllerRef = useRef(false);
  const applyingRemotePlaybackRef = useRef(false);
  const changingSongRef = useRef(false);
  const mobileSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  function addPlayerAudit(event: string, detail?: string) {
    const entry = { at: Date.now(), event, detail };
    console.log(`[PlayerAudit] ${event}${detail ? ` — ${detail}` : ""}`);
    setPlayerAudit((previous) => [...previous.slice(-39), entry]);
  }

  function forceYoutubeVolume(player: any) {
    if (!player) return;

    try {
      player.unMute?.();
      player.setVolume?.(100);
      addPlayerAudit("VOLUME_100", "lecteur YouTube rétabli à 100 %");
    } catch (error) {
      console.warn("Impossible de remettre le volume YouTube à 100 %", error);
    }
  }

  useEffect(() => {
    const userAgent = navigator.userAgent || "";
    const androidWebView =
      /;\s*wv\)/i.test(userAgent) ||
      /\bVersion\/\d+(?:\.\d+)*\s+Chrome\/.*Mobile\s+Safari/i.test(userAgent);

    const knownInAppBrowser =
      /Snapchat|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(userAgent);

    setIsInAppBrowser(androidWebView || knownInAppBrowser);
  }, []);

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
    if (!code) return;

    setShareUrl(`${window.location.origin}/party/${code}`);
  }, [code]);

  useEffect(() => {
    djModeActiveRef.current = djModeActive;
  }, [djModeActive]);

  // Écran externe / Google Cast :
  // quand la page est ouverte avec ?display=tv, on réutilise exactement
  // le Mode TV existant sans créer un second design.
  useEffect(() => {
    if (externalDisplayMode !== "tv") return;

    setTvModeActive(true);

    return () => {
      setTvModeActive(false);
    };
  }, [externalDisplayMode]);

  useEffect(() => {
    if (!code || !playerName || !participantId) return;

    const isCreator = Boolean(localStorage.getItem(`mixparty_creator_${code}`));
    localStorage.setItem(
      "mixparty.lastParty.v1",
      JSON.stringify({ code, role: isCreator ? "dj" : "guest", name: playerName, savedAt: Date.now() })
    );

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

    socket.on(
      "playback_control_command",
      ({ code: commandCode, action }: { code?: string; action?: string }) => {
        if (String(commandCode || "").toUpperCase() !== code) return;

        if (action === "play") {
          playerRef.current?.playVideo?.();
          return;
        }

        if (action === "pause") {
          playerRef.current?.pauseVideo?.();
          return;
        }

        if (action === "next") {
          void nextSong();
          return;
        }

        if (action === "previous") {
          void previousSong();
        }
      }
    );

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

    const isCreator = Boolean(localStorage.getItem(`mixparty_creator_${code}`));
    localStorage.setItem(
      "mixparty.lastParty.v1",
      JSON.stringify({ code, role: isCreator ? "dj" : "guest", name: name.trim(), savedAt: Date.now() })
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

  function handleProfilePhotoSelection(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;
    void handleProfilePhotoUpload(file);
    event.target.value = "";
  }

  async function loadKaraokeCatalog(query = karaokeCatalogSearch) {
    setKaraokeCatalogLoading(true);
    setKaraokeCatalogError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (query.trim()) params.set("q", query.trim());

      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/karaoke-lyrics-audit/ready?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Catalogue Karaoké indisponible");
      }

      setKaraokeCatalog(data);
    } catch (error) {
      setKaraokeCatalogError(
        error instanceof Error ? error.message : "Catalogue Karaoké indisponible"
      );
    } finally {
      setKaraokeCatalogLoading(false);
    }
  }

  function activateKaraokeMode() {
    setKaraokeMode(true);
    setResults([]);
    setSearchInsight(null);

    if (!karaokeCatalog) {
      void loadKaraokeCatalog("");
    }
  }

  function deactivateKaraokeMode() {
    setKaraokeMode(false);
    setKaraokeCatalogSearch("");
    setKaraokeScreenOpen(false);
  }

  function openKaraokeScreen() {
    const karaokeUrl = `${window.location.origin}/party/${encodeURIComponent(code)}/karaoke`;

    // Sur téléphone, on garde la salle DJ montée dans la même page.
    // Le lecteur YouTube continue donc de tourner pendant que l'écran Karaoké est affiché.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setKaraokeScreenOpen(true);
      return;
    }

    window.open(karaokeUrl, "_blank", "noopener,noreferrer");
  }

  function addKaraokeCatalogSong(song: KaraokeCatalogSong) {
    const alreadyInPlaylist =
      party?.currentSong?.videoId === song.videoId ||
      (party?.songs || []).some(
        (queuedSong) => !queuedSong.played && queuedSong.videoId === song.videoId
      );

    if (alreadyInPlaylist) return;

    void addYoutubeSong({
      id: song.videoId,
      title: song.title,
      thumbnail: song.thumbnail || MIXPARTY_DEFAULT_COVER,
      durationSeconds: song.durationSeconds,
      artistName: song.artistName,
      albumName: song.matchedAlbumName || undefined,
      sourceQuery: "catalogue karaoké",
      suggestionPool: [],
    });
  }

  async function searchYoutube() {
    if (!search.trim() || searching) return;

    setSearching(true);

    try {
      const query = search.trim();
      const [response, insightResponse] = await Promise.all([
        fetch(`${getApiBaseUrl()}/search/youtube?q=${encodeURIComponent(query)}&partyCode=${encodeURIComponent(code)}&actor=${encodeURIComponent(participantId || playerName || "guest")}`),
        fetch(`${getApiBaseUrl()}/partybrain/intelligence/insights/search?q=${encodeURIComponent(query)}`),
      ]);

      const data = await response.json();
      if (insightResponse.ok) {
        setSearchInsight(await insightResponse.json());
      } else {
        setSearchInsight(null);
      }
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

  async function addYoutubeSong(video: any, additionSource: "manual_search" | "partybrain_suggestion" = "manual_search") {
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
addedById: participantId || undefined,
sourceQuery: video.sourceQuery || search.trim(),
          artistName: video.artistName,
          featuredArtistNames: video.featuredArtistNames,
          albumName: video.albumName,
          metadataSource: video.metadataSource,
          metadataConfidence: video.metadataConfidence,
          durationSeconds: video.durationSeconds,
          additionSource,
          suggestionPool: Array.isArray(video.suggestionPool)
            ? video.suggestionPool.map((item: any) => ({
                id: item.id,
                title: item.title,
                thumbnail: item.thumbnail,
                channelTitle: item.channelTitle,
                durationSeconds: item.durationSeconds,
                artistName: item.artistName,
                featuredArtistNames: item.featuredArtistNames,
                albumName: item.albumName,
                metadataSource: item.metadataSource,
                metadataConfidence: item.metadataConfidence,
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
async function removeSong(index: number, song: Song) {
  const creatorToken =
    localStorage.getItem(`mixparty_creator_${code}`) || "";

  const isCreator = Boolean(creatorToken);

  const isOwner = Boolean(
    song.addedById &&
    participantId &&
    song.addedById === participantId
  );

  if (!isCreator && !isOwner) {
    window.alert(
      "Tu peux supprimer uniquement les musiques que tu as ajoutées."
    );
    return;
  }

  const confirmed = window.confirm(
    `Supprimer « ${song.title} » de la file ?`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/party/${code}/song/${index}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId,
          creatorToken,
          actor: participantId || playerName,
        }),
      }
    );

    const updated = await response.json();

    if (!response.ok || updated.error) {
      window.alert(
        updated.error ||
        "Impossible de supprimer cette musique."
      );
      return;
    }

    const normalized = normalizeParty(updated);

    if (normalized) {
      setParty(normalized);
    }
  } catch (error) {
    console.error("Suppression chanson impossible", error);

    window.alert(
      "Impossible de supprimer cette musique pour le moment."
    );
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

  async function togglePartyBrainAutoRelay() {
    if (!isPlaybackController || partyBrainRelayUpdating) return;

    const enabled = !Boolean(party?.partyBrainAutoRelayEnabled);
    const creatorToken =
      localStorage.getItem(`mixparty_creator_${code}`) || "";

    if (!creatorToken) {
      window.alert("Le contrôle PartyBrain est réservé au créateur de la soirée.");
      return;
    }

    setPartyBrainRelayUpdating(true);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/party/${code}/partybrain/auto-relay`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled,
            creatorToken,
            actor: participantId || playerName,
          }),
        }
      );

      const updated = await response.json();

      if (!response.ok || updated.error) {
        window.alert(updated.error || "Impossible de modifier le relais PartyBrain.");
        return;
      }

      const normalized = normalizeParty(updated);
      if (normalized) setParty(normalized);
    } catch (error) {
      console.error("Relais PartyBrain indisponible", error);
      window.alert("Impossible de joindre PartyBrain pour le moment.");
    } finally {
      setPartyBrainRelayUpdating(false);
    }
  }

  async function toggleClipDisplay() {
    if (!isPlaybackController || clipDisplayUpdating) return;

    const creatorToken = localStorage.getItem(`mixparty_creator_${code}`) || "";
    if (!creatorToken) {
      window.alert("Le réglage du clip est réservé au créateur de la soirée.");
      return;
    }

    setClipDisplayUpdating(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/party/${code}/display/clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: !Boolean(party?.showYoutubeClip),
          creatorToken,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        window.alert(data.error || "Impossible de modifier l’affichage du clip.");
        return;
      }
      const normalized = normalizeParty(data);
      if (normalized) setParty(normalized);
    } catch (error) {
      console.error("Réglage du clip indisponible", error);
      window.alert("Impossible de modifier l’affichage du clip pour le moment.");
    } finally {
      setClipDisplayUpdating(false);
    }
  }

  async function previousSong() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/party/${code}/previous`, {
        method: "POST",
      });

      const updated = await response.json();

      if (!response.ok || updated.error) {
        console.log(updated.error || "Impossible de revenir au morceau précédent");
        return;
      }

      const normalized = normalizeParty(updated);
      if (normalized) setParty(normalized);
    } catch (error) {
      console.error("Retour morceau précédent impossible", error);
    }
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

  function formatPlaybackTime(value: number) {
    const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
    return `${Math.floor(safeValue / 60)}:${String(Math.floor(safeValue % 60)).padStart(2, "0")}`;
  }

  function seekPlayback(value: number) {
    if (!isPlaybackController || !playerRef.current) return;
    const duration = Number(playerRef.current.getDuration?.() || tvPlayback.duration || 0);
    const nextTime = Math.max(0, Math.min(duration || value, value));
    playerRef.current.seekTo?.(nextTime, true);
    setTvPlayback((current) => ({ ...current, time: nextTime, duration: duration || current.duration }));
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
    if (!isPlaybackController || !playerHostElement) return;

    let cancelled = false;
    const playerHost = playerHostElement;

    setYoutubeError(null);
    addPlayerAudit("PLAYER_EFFECT_START", "conteneur prêt");

    function destroyPlayer() {
      const player = playerRef.current;
      playerRef.current = null;
      playerReadyRef.current = false;
      loadedVideoIdRef.current = "";

      if (player) {
        try {
          addPlayerAudit("DESTROY_PLAYER", "fin de session ou changement de contrôleur");
          player.destroy?.();
        } catch (error) {
          console.warn("Nettoyage du lecteur YouTube ignoré", error);
        }
      }

      try { playerHost.replaceChildren(); } catch {}
    }

    function createPlayer() {
      if (cancelled || !window.YT?.Player || playerRef.current) return;

      const firstVideoId = currentVideoIdRef.current || pendingVideoIdRef.current || party?.currentSong?.videoId || "";
      const mount = document.createElement("div");
      mount.dataset.youtubeMount = "persistent";
      playerHost.replaceChildren(mount);
      addPlayerAudit("CREATE_PLAYER", firstVideoId ? `iframe unique avec ${firstVideoId}` : "iframe vide");

      const options: any = {
        width: "100%",
        height: "100%",
        host: "https://www.youtube.com",
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          playsinline: 1,
          controls: 0,
          fs: 0,
          disablekb: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (cancelled) return;
            playerReadyRef.current = true;
            forceYoutubeVolume(event.target);
            setYoutubeError(null);
            addPlayerAudit("READY", firstVideoId || "sans vidéo");

            const iframe = event.target?.getIframe?.();
            if (iframe) {
              // Le lecteur reste audio-only dans l'interface MixParty :
              // on ne donne pas au navigateur Android les permissions PiP / plein écran
              // qui peuvent afficher ses propres boutons vidéo par-dessus la console.
              iframe.setAttribute("allow", "autoplay; encrypted-media");
              iframe.removeAttribute("allowfullscreen");
              iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
            }

            const pending = pendingVideoIdRef.current || currentVideoIdRef.current;
            if (pending && pending !== loadedVideoIdRef.current) {
              pendingVideoIdRef.current = "";
              loadedVideoIdRef.current = pending;
              addPlayerAudit("LOAD_PENDING", pending);
              event.target?.loadVideoById?.(pending);
              forceYoutubeVolume(event.target);
            }

            socketRef.current?.emit("request_playback_sync", code);
            if (djModeActiveRef.current) {
              addPlayerAudit("PLAY_REQUEST", "onReady + mode DJ");
              try { event.target?.playVideo?.(); } catch {}
            }
          },
          onStateChange: (event: any) => {
            if (cancelled) return;
            const labels: Record<number, string> = { [-1]: "UNSTARTED", 0: "ENDED", 1: "PLAYING", 2: "PAUSED", 3: "BUFFERING", 5: "CUED" };
            addPlayerAudit(labels[event.data] || `STATE_${event.data}`, currentVideoIdRef.current || loadedVideoIdRef.current);

            if (!applyingRemotePlaybackRef.current && isPlaybackControllerRef.current) {
              socketRef.current?.emit("playback_sync", {
                code,
                videoId: currentVideoIdRef.current || loadedVideoIdRef.current,
                state: event.data,
                time: playerRef.current?.getCurrentTime?.() ?? 0,
              });
            }

            if (event.data === 1) {
              forceYoutubeVolume(event.target);
              setResumeRequired(false);
            }
            if (djModeActiveRef.current && isPlaybackControllerRef.current && (event.data === 2 || event.data === 5)) {
              window.setTimeout(() => {
                const state = playerRef.current?.getPlayerState?.();
                if (state !== 1 && currentVideoIdRef.current) {
                  addPlayerAudit("AUTOPLAY_NOT_STARTED", `état ${state}`);
                  setResumeRequired(true);
                }
              }, 1200);
            }
            if (event.data === 0 && isPlaybackControllerRef.current) {
              addPlayerAudit("NEXT_SONG_REQUEST", "événement ENDED");
              nextSong();
            }
          },
          onError: (event: any) => {
            if (cancelled) return;
            const errorCode = Number(event.data);
            console.warn("Erreur lecteur YouTube", { errorCode, videoId: currentVideoIdRef.current });
            addPlayerAudit("ERROR", String(errorCode));
            setYoutubeError(Number.isFinite(errorCode) ? errorCode : -1);
          },
        },
      };

      if (firstVideoId) {
        options.videoId = firstVideoId;
        loadedVideoIdRef.current = firstVideoId;
      }
      playerRef.current = new window.YT.Player(mount, options);
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
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
      destroyPlayer();
    };
  }, [isPlaybackController, playerHostElement, code]);

  useEffect(() => {
    const nextVideoId = party?.currentSong?.videoId || "";
    if (!nextVideoId || !isPlaybackController) return;

    currentVideoIdRef.current = nextVideoId;
    setYoutubeError(null);

    const player = playerRef.current;
    if (!player || !playerReadyRef.current) {
      pendingVideoIdRef.current = nextVideoId;
      addPlayerAudit("QUEUE_VIDEO", `${nextVideoId} en attente du lecteur`);
      return;
    }

    if (loadedVideoIdRef.current === nextVideoId) {
      addPlayerAudit("KEEP_PLAYER", `déjà chargé ${nextVideoId}`);
      return;
    }

    loadedVideoIdRef.current = nextVideoId;
    pendingVideoIdRef.current = "";
    addPlayerAudit("LOAD_VIDEO_BY_ID", nextVideoId);
    try {
      player.loadVideoById(nextVideoId);
      forceYoutubeVolume(player);
    } catch (error) {
      console.warn("Chargement de la vidéo suivante impossible", error);
      addPlayerAudit("LOAD_VIDEO_FAILED", nextVideoId);
    }
  }, [party?.currentSong?.videoId, isPlaybackController]);

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

  async function requestWakeLock() {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      await wakeLockRef.current?.release?.();
      wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener?.("release", () => setWakeLockActive(false));
    } catch (error) {
      console.warn("Wake Lock indisponible", error);
      setWakeLockActive(false);
    }
  }

  async function activateDjMode() {
    setDjModeActive(true);
    setDjModeStartedAt(Date.now());
    setResumeRequired(false);
    await requestWakeLock();
    try {
      await document.documentElement.requestFullscreen?.();
    } catch (error) {
      console.warn("Plein écran indisponible", error);
    }
    try {
      forceYoutubeVolume(playerRef.current);
      playerRef.current?.playVideo?.();
    } catch {}
  }

  async function deactivateDjMode() {
    setTvModeActive(false);
    setDjModeActive(false);
    setDjModeStartedAt(null);
    setDjModeElapsed(0);
    setResumeRequired(false);
    try {
      await wakeLockRef.current?.release?.();
    } catch {}
    wakeLockRef.current = null;
    setWakeLockActive(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch {}
  }

  function resumePlayback() {
    try {
      forceYoutubeVolume(playerRef.current);
      playerRef.current?.playVideo?.();
      setResumeRequired(false);
      setYoutubeError(null);
    } catch (error) {
      console.warn("Reprise de lecture impossible", error);
    }
  }

  async function activateTvMode() {
    setTvModeActive(true);
    if (!djModeActive) {
      setDjModeActive(true);
      setDjModeStartedAt(Date.now());
      await requestWakeLock();
    }
    try {
      await document.documentElement.requestFullscreen?.();
    } catch (error) {
      console.warn("Plein écran TV indisponible", error);
    }
  }

  async function deactivateTvMode() {
    setTvModeActive(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
    } catch {}
  }

  function avatarForInteraction(name: string, participantIdHint?: string) {
    const normalizedName = String(name || "").trim().toLocaleLowerCase("fr-FR");
    const participant = (party?.participants || []).find((item) =>
      item.id === participantIdHint ||
      String(item.name || "").trim().toLocaleLowerCase("fr-FR") === normalizedName
    );

    if (participant?.avatar) return participant.avatar;
    if (participant?.id) return defaultAvatarForParticipant(participant.id);

    return defaultAvatarForParticipant(
      participantIdHint || normalizedName || "mixparty-guest"
    );
  }

  useEffect(() => {
    if (!party) return;

    const snapshot = interactionSnapshotRef.current;
    const nextInteractions: DjInteraction[] = [];
    const now = Date.now();

    for (const participant of party.participants || []) {
      if (!snapshot.participants.has(participant.id)) {
        nextInteractions.push({
          id: `join-${participant.id}-${now}`,
          kind: "join",
          name: participant.name,
          avatar: participant.avatar || defaultAvatarForParticipant(participant.id),
          detail: "a rejoint la soirée",
          at: now,
        });
      }
    }

    for (const song of party.songs || []) {
      const songKey = `${song.videoId}-${song.addedAt}`;
      if (!snapshot.songs.has(songKey)) {
        nextInteractions.push({
          id: `add-${songKey}`,
          kind: "add",
          name: song.addedBy || "Un invité",
          avatar: avatarForInteraction(song.addedBy || "Un invité"),
          detail: `a ajouté ${song.title}`,
          at: Number(song.addedAt || now),
        });
      }

      for (const voter of song.voters || []) {
        const voteKey = `${songKey}-${voter}`;
        if (!snapshot.voters.has(voteKey)) {
          nextInteractions.push({
            id: `vote-${voteKey}-${now}`,
            kind: "vote",
            name: voter,
            avatar: avatarForInteraction(voter),
            detail: `a voté pour ${song.title}`,
            at: now,
          });
        }
      }
    }

    snapshot.participants = new Set((party.participants || []).map((participant) => participant.id));
    snapshot.songs = new Set((party.songs || []).map((song) => `${song.videoId}-${song.addedAt}`));
    snapshot.voters = new Set((party.songs || []).flatMap((song) => (song.voters || []).map((voter) => `${song.videoId}-${song.addedAt}-${voter}`)));

    if (nextInteractions.length) {
      setDjInteractions((current) => [...nextInteractions.reverse(), ...current].slice(0, 12));
    }
  }, [party]);

  useEffect(() => {
    const updateTvPlayback = () => {
      const player = playerRef.current;
      if (player && isPlaybackControllerRef.current) {
        setTvPlayback({
          time: Number(player.getCurrentTime?.() || 0),
          duration: Number(player.getDuration?.() || 0),
          state: Number(player.getPlayerState?.() ?? 2),
        });
        return;
      }

      setTvPlayback((current) => ({
        ...current,
        time: remotePlayback.time + (remotePlayback.state === 1 ? (Date.now() - remotePlayback.receivedAt) / 1000 : 0),
        state: remotePlayback.state,
      }));
    };

    updateTvPlayback();
    const timer = window.setInterval(updateTvPlayback, 500);
    return () => window.clearInterval(timer);
  }, [remotePlayback]);

  useEffect(() => {
    setNetworkOnline(navigator.onLine);
    const onOnline = () => {
      setNetworkOnline(true);
      socketRef.current?.connect?.();
      socketRef.current?.emit("request_playback_sync", code);
    };
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [code]);

  useEffect(() => {
    let battery: any = null;
    let cancelled = false;
    const updateBattery = () => {
      if (!cancelled && battery) setBatteryLevel(Math.round(Number(battery.level || 0) * 100));
    };
    (navigator as any).getBattery?.().then((value: any) => {
      battery = value;
      updateBattery();
      battery.addEventListener?.("levelchange", updateBattery);
    }).catch(() => {});
    return () => {
      cancelled = true;
      battery?.removeEventListener?.("levelchange", updateBattery);
    };
  }, []);

  useEffect(() => {
    if (!djModeActive || !djModeStartedAt) return;
    const tick = () => setDjModeElapsed(Math.max(0, Date.now() - djModeStartedAt));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [djModeActive, djModeStartedAt]);

  useEffect(() => {
    if (!djModeActive) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      await requestWakeLock();
      socketRef.current?.connect?.();
      socketRef.current?.emit("request_playback_sync", code);
      const state = playerRef.current?.getPlayerState?.();
      if (party?.currentSong && state !== 1) setResumeRequired(true);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [djModeActive, code, party?.currentSong?.videoId]);

  useEffect(() => () => {
    wakeLockRef.current?.release?.().catch?.(() => {});
  }, []);

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

  const partyBrainSongs = [
    ...(party.history || []).slice(-12),
    ...(party.currentSong ? [party.currentSong] : []),
    ...queue.slice(0, 6),
  ];

  const styleScores = PARTY_STYLE_RULES.map((style) => ({
    name: style.name,
    score: partyBrainSongs.reduce((total, song) => {
      const source = `${song.title || ""} ${song.artistName || ""} ${(song.featuredArtistNames || []).join(" ")}`.toLowerCase();
      return total + style.keywords.reduce((count, keyword) => count + (source.includes(keyword) ? 1 : 0), 0);
    }, 0),
  })).sort((a, b) => b.score - a.score);

  const partyBrainMood = styleScores[0]?.score > 0
    ? styleScores[0].name
    : party.currentSong
      ? detectPartyStyle(`${party.currentSong.title} ${party.currentSong.artistName || ""}`).name
      : "En attente";
  const partyBrainSecondaryMood = styleScores.find((style) => style.name !== partyBrainMood && style.score > 0)?.name || "Pop festive";
  const detectedSignals = styleScores.reduce((total, style) => total + style.score, 0);
  const moodConfidence = party.currentSong ? Math.min(98, 68 + detectedSignals * 4 + Math.min(12, partyBrainSongs.length)) : 0;

  const totalVisibleVotes = queue.reduce((total, song) => total + Number(song.votes || 0), 0);
  const recentHistoryVotes = (party.history || []).slice(-8).reduce((total, song) => total + Number(song.votes || 0), 0);
  const participationRate = party.participants.length
    ? Math.min(100, Math.round(((new Set(queue.flatMap((song) => [song.addedBy, ...(song.voters || [])]).filter(Boolean))).size / party.participants.length) * 100))
    : 0;
  const partyBrainEnergy = party.currentSong
    ? Math.min(98, Math.max(44, 54 + queue.length * 3 + Math.min(20, totalVisibleVotes * 2) + Math.min(12, party.participants.length)))
    : 0;
  const energyTrend = Math.max(-18, Math.min(18, totalVisibleVotes * 2 - recentHistoryVotes + queue.length));
  const energyLabel = partyBrainEnergy >= 86 ? "Très forte" : partyBrainEnergy >= 70 ? "En montée" : partyBrainEnergy >= 52 ? "Stable" : "À relancer";

  const currentStyle = party.currentSong
    ? detectPartyStyle(`${party.currentSong.title} ${party.currentSong.artistName || ""}`).name
    : partyBrainMood;
  const nextStyle = queue[0]
    ? detectPartyStyle(`${queue[0].title} ${queue[0].artistName || ""}`).name
    : partyBrainMood;
  const nextTransitionScore = transitionScore(currentStyle, nextStyle);
  const transitionMessage = !queue[0]
    ? "Ajoute un titre pour que je prépare la prochaine transition."
    : nextTransitionScore >= 90
      ? `Transition très naturelle vers ${nextStyle}.`
      : nextTransitionScore >= 80
        ? `Bonne passerelle vers ${nextStyle}, garde cette direction.`
        : `Transition plus marquée vers ${nextStyle} : prévois un morceau passerelle.`;

  const partyBrainArtists = Array.from(new Set(
    suggestions
      .map((video) => video.artistName || video.channelTitle || String(video.title || "").split("-")[0]?.trim())
      .filter(Boolean)
  )).slice(0, 3);

  const mixMateAdvice = !party.currentSong
    ? "Lance le premier morceau : j’analyserai les votes, la file et les réactions pour guider la soirée."
    : partyBrainEnergy >= 86
      ? `La soirée est très haute en énergie. Garde encore 2 ou 3 titres en ${partyBrainMood}, puis prépare une transition douce vers ${partyBrainSecondaryMood}.`
      : partyBrainEnergy >= 70
        ? `${partyBrainMood} fonctionne bien. Le prochain titre a ${nextTransitionScore}% de compatibilité avec l’ambiance actuelle.`
        : `L’énergie baisse légèrement. Choisis un morceau connu, plus rythmé, avec une transition proche de ${partyBrainMood}.`;

  const sessionDurationMinutes = party.history?.length
    ? Math.max(1, Math.round((Date.now() - Math.min(...party.history.map((song) => Number(song.addedAt || Date.now())))) / 60000))
    : 0;
  const totalSessionVotes = [...(party.history || []), ...queue].reduce((total, song) => total + Number(song.votes || 0), 0);

  const mobileTabs = ["playback", "add", "karaoke", "queue", "guests"] as const;

  const karaokeArtistGroups = Object.entries(
    (karaokeCatalog?.items || []).reduce<Record<string, KaraokeCatalogSong[]>>((groups, song) => {
      const artist =
        String(song.artistName || song.matchedArtistName || "Artiste inconnu").trim() ||
        "Artiste inconnu";

      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(song);
      return groups;
    }, {})
  ).sort(([artistA], [artistB]) =>
    artistA.localeCompare(artistB, "fr", { sensitivity: "base" })
  );

  function switchMobileTab(nextTab: typeof mobileTabs[number]) {
    setActiveMobileTab(nextTab);

    if (nextTab === "karaoke" && !karaokeCatalog && !karaokeCatalogLoading) {
      void loadKaraokeCatalog("");
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleMobileTouchStart(event: React.TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    mobileSwipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleMobileTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = mobileSwipeStartRef.current;
    const touch = event.changedTouches[0];
    mobileSwipeStartRef.current = null;
    if (!start || !touch || window.innerWidth >= 768) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 58 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    const currentIndex = mobileTabs.indexOf(activeMobileTab);
    const nextIndex = deltaX < 0
      ? Math.min(mobileTabs.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) switchMobileTab(mobileTabs[nextIndex]);
  }

  function renderKaraokeArtistFolders() {
    if (karaokeCatalogError) {
      return (
        <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-500/[0.07] p-4 text-sm font-bold text-red-100">
          {karaokeCatalogError}
        </div>
      );
    }

    if (karaokeCatalogLoading && !karaokeCatalog) {
      return (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-[22px] border border-white/[0.06] bg-white/[0.035]"
            />
          ))}
        </div>
      );
    }

    if (!karaokeArtistGroups.length) {
      return (
        <div className="mt-5 rounded-[22px] border border-dashed border-fuchsia-300/15 bg-black/20 px-5 py-10 text-center">
          <Mic2 className="mx-auto h-7 w-7 text-fuchsia-300/60" />
          <p className="mt-3 font-black">
            {karaokeCatalogSearch.trim()
              ? "Aucun morceau Karaoké ne correspond à ce filtre."
              : "Aucun morceau Karaoké validé pour le moment."}
          </p>
          <p className="mt-1 text-sm text-white/35">
            Le catalogue se remplit automatiquement grâce aux audits LRCLIB.
          </p>
        </div>
      );
    }

    return (
      <div className="mt-5 max-h-[720px] space-y-3 overflow-y-auto pr-1">
        {karaokeArtistGroups.map(([artist, artistSongs]) => (
          <details
            key={artist}
            open={Boolean(karaokeCatalogSearch.trim())}
            className="group overflow-hidden rounded-[22px] border border-fuchsia-300/[0.11] bg-black/20 open:border-fuchsia-300/25 open:bg-fuchsia-500/[0.035]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/15 to-purple-500/10 text-fuchsia-200">
                  <Mic2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{artist}</p>
                  <p className="mt-0.5 text-xs font-bold text-white/35">
                    {artistSongs.length} morceau{artistSongs.length > 1 ? "x" : ""}
                  </p>
                </div>
              </div>

              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-lg font-black text-fuchsia-200 transition group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="grid gap-3 border-t border-white/[0.06] p-3 md:grid-cols-2">
              {artistSongs.map((song) => {
                const alreadyInPlaylist =
                  party?.currentSong?.videoId === song.videoId ||
                  (party?.songs || []).some(
                    (queuedSong) =>
                      !queuedSong.played && queuedSong.videoId === song.videoId
                  );

                return (
                <article
                  key={song.videoId}
                  className={`flex min-w-0 gap-3 rounded-[18px] border p-3 transition ${
                    alreadyInPlaylist
                      ? "border-white/[0.05] bg-white/[0.025] opacity-70"
                      : "border-white/[0.06] bg-black/25"
                  }`}
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/[0.04]">
                    <img
                      src={song.thumbnail || MIXPARTY_DEFAULT_COVER}
                      alt={song.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-1.5 left-1.5 rounded-full border border-emerald-300/20 bg-emerald-950/85 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-emerald-200">
                      Synchro
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="line-clamp-2 text-sm font-black leading-snug text-white">
                        {song.title}
                      </p>
                      {song.matchedAlbumName ? (
                        <p className="mt-1 truncate text-[10px] font-bold text-white/30">
                          {song.matchedAlbumName}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => addKaraokeCatalogSong(song)}
                      disabled={alreadyInPlaylist || addingVideoId === song.videoId}
                      className={`mt-2 rounded-xl px-3 py-2 text-[11px] font-black transition ${
                        alreadyInPlaylist
                          ? "w-full cursor-not-allowed border border-white/[0.08] bg-white/[0.06] text-white/40"
                          : "w-fit bg-gradient-to-r from-fuchsia-600/80 to-purple-600/80 text-white hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        {alreadyInPlaylist ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {alreadyInPlaylist
                          ? "Déjà dans la liste de lecture"
                          : addingVideoId === song.videoId
                            ? "Ajout…"
                            : "Ajouter"}
                      </span>
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    );
  }

  return (
    <main
      className="v54-mobile-app relative isolate min-h-screen w-full max-w-full overflow-x-hidden bg-[#070711] font-[family:var(--font-geist-sans)] text-white"
      onTouchStart={handleMobileTouchStart}
      onTouchEnd={handleMobileTouchEnd}
    >

      {karaokeScreenOpen ? (
        <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col bg-[#070711]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0b0914]/95 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Mode Karaoké</p>
              <p className="truncate text-sm font-black text-white">Soirée {party.code}</p>
            </div>
            <button
              type="button"
              onClick={() => setKaraokeScreenOpen(false)}
              className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition active:scale-[.98]"
            >
              {tvModeActive ? "📺 Retour au mode TV" : "← Retour à la soirée"}
            </button>
          </div>
          <iframe
            src={`/party/${encodeURIComponent(code)}/karaoke`}
            title="Écran Karaoké MixParty"
            className="min-h-0 w-full flex-1 border-0 bg-[#070711]"
            allow="autoplay; fullscreen"
          />
        </div>
      ) : null}

      <MixPartyBackground />

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(to_bottom,rgba(7,7,17,.03),rgba(7,7,17,.14)_54%,rgba(7,7,17,.32))]" />

      <div className="v54-mobile-content relative z-10 mx-auto w-full min-w-0 max-w-[1600px] overflow-x-hidden px-4 py-4 pb-28 sm:px-6 sm:py-5 md:pb-5 lg:px-8 xl:px-10">

        <header className="v54-mobile-header mb-4 flex items-center justify-between rounded-[22px] border border-white/10 bg-black/25 px-3 py-3 backdrop-blur-xl md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/branding/icon.png" alt="MixParty" className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="-skew-x-6 font-[family:var(--font-exo-2)] text-lg font-black tracking-[0.12em]">
                <span className="text-white">MIX</span><span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">PARTY</span>
              </p>
              <p className="truncate text-[11px] font-semibold text-white/35">Soirée {party.code}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchMobileTab("guests")}
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
                src="/branding/icon.png"
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
          <div className="desktop-command-card desktop-command-card--hero premium-glass-card">
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
          <div className="desktop-command-card premium-glass-card">
            <p className="desktop-command-label">Ambiance</p>
            <p className="desktop-command-value">{queue.length} titre{queue.length > 1 ? "s" : ""} en attente</p>
            <p className="desktop-command-meta">Classés automatiquement par votes</p>
          </div>
          <div className="desktop-command-card premium-glass-card">
            <p className="desktop-command-label">Communauté</p>
            <p className="desktop-command-value">{party.participants.length} participant{party.participants.length > 1 ? "s" : ""}</p>
            <p className="desktop-command-meta">Connectés à la soirée {party.code}</p>
          </div>
        </section>

        <div className="desktop-party-grid grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px]">

          <div className="desktop-main-column space-y-6">

            <section className={`${activeMobileTab === "playback" ? "block" : "hidden"} v53-player-shell premium-glass-card md:block`}>
              <div className="v53-player-header">
                <div className="v53-player-live">
                  <span className="v53-player-live__dot" />
                  <div>
                    <p>En lecture</p>
                    <h1>Console DJ</h1>
                  </div>
                </div>
                {isPlaybackController && (
                  <button
                    type="button"
                    onClick={toggleClipDisplay}
                    disabled={clipDisplayUpdating}
                    className={`dj-console-clip-toggle ${party.showYoutubeClip ? "dj-console-clip-toggle--active" : ""}`}
                    aria-pressed={Boolean(party.showYoutubeClip)}
                  >
                    {clipDisplayUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Disc3 className="h-4 w-4" />}
                    <span>{party.showYoutubeClip ? "Masquer le clip" : "Afficher le clip"}</span>
                  </button>
                )}

                <div className="v53-player-audience">
                  <UsersRound className="h-4 w-4" />
                  <strong>{party.participants.length}</strong>
                  <span>personne{party.participants.length > 1 ? "s" : ""}</span>
                </div>
              </div>

              {party.currentSong ? (
                <div className="dj-console-redesign">
                  <div className="dj-console-main">
                    <div
                      className={`dj-console-cover ${hasHdCover(party.currentSong) ? "dj-console-cover--hd" : "dj-console-cover--logo"} ${party.showYoutubeClip ? "dj-console-cover--clip" : ""}`}
                      style={hasHdCover(party.currentSong) && !party.showYoutubeClip ? { backgroundImage: `url(${getSongArtwork(party.currentSong)})` } : undefined}
                    >
                      {isPlaybackController && (
                        <div
                          ref={setPlayerHostElement}
                          className={`mixparty-youtube-host absolute inset-0 h-full w-full min-w-0 max-w-full overflow-hidden ${party.showYoutubeClip ? "mixparty-youtube-host--clip-visible" : "mixparty-youtube-host--audio-only"}`}
                        />
                      )}
                      <span className={`dj-console-cover__glow ${party.showYoutubeClip ? "opacity-0" : ""}`} />
                      <img
                        className={party.showYoutubeClip ? "dj-console-cover__artwork--hidden" : ""}
                        src={getSongArtwork(party.currentSong)}
                        alt={hasHdCover(party.currentSong) ? `Jaquette de ${party.currentSong.title}` : "Logo MixParty"}
                      />
                    </div>

                    <div className="dj-console-track">
                      <div className="dj-console-track__topline">
                        <span className="dj-console-status"><Radio className="h-3.5 w-3.5" /> En cours</span>
                        <span className="dj-console-added">Ajouté par <strong>{party.currentSong.addedBy}</strong></span>
                      </div>
                      <h2>{party.currentSong.title}</h2>
                      <p>{party.currentSong.artistName || party.currentSong.addedBy}</p>

                      <div className="dj-console-timeline">
                        <div className="dj-console-timeline__times">
                          <span>{formatPlaybackTime(isPlaybackController ? tvPlayback.time : remotePlayback.time)}</span>
                          <span>{formatPlaybackTime(tvPlayback.duration || party.currentSong.durationSeconds || 0)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(1, tvPlayback.duration || party.currentSong.durationSeconds || 1)}
                          step="0.25"
                          value={Math.min(tvPlayback.duration || party.currentSong.durationSeconds || 1, isPlaybackController ? tvPlayback.time : remotePlayback.time)}
                          onChange={(event) => seekPlayback(Number(event.target.value))}
                          disabled={!isPlaybackController}
                          className="dj-console-seek"
                          aria-label="Avancer ou reculer dans la musique"
                        />
                        <div className="dj-console-waveform" aria-hidden="true">
                          {[38,72,46,88,58,95,44,76,52,84,34,68,48,92,56,80,42,70,50,86,36,64,54,90,46,74,40,82,58,96,44,72,52,88].map((height,index)=><span key={index} style={{ height:`${height}%`, animationDelay:`${index * 45}ms` }} />)}
                        </div>
                      </div>

                      <div className="dj-console-actions">
                        <button
                          type="button"
                          onClick={tvPlayback.state === 1 ? () => playerRef.current?.pauseVideo?.() : resumePlayback}
                          className="dj-console-play"
                          aria-label={tvPlayback.state === 1 ? "Mettre en pause" : "Lire"}
                        >
                          {tvPlayback.state === 1 ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
                        </button>
                        {isPlaybackController && (
                          <button type="button" onClick={nextSong} className="dj-console-next">
                            <SkipForward className="h-5 w-5 fill-current" />
                            <span>Passer au suivant</span>
                            <small>{queue.length} titre{queue.length > 1 ? "s" : ""} en attente</small>
                          </button>
                        )}
                        <div className="dj-console-votes">
                          <ArrowBigUp className="h-5 w-5" />
                          <strong>{party.currentSong.votes || 0}</strong>
                          <span>votes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="dj-console-activity">
                    <div className="dj-console-activity__header">
                      <div>
                        <span>En direct</span>
                        <h3>Dernières interactions</h3>
                      </div>
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="dj-console-activity__list">
                      {(djInteractions.length ? djInteractions : [
                        ...queue.slice(0, 2).map((song, index) => ({
                          id: `fallback-add-${index}`,
                          kind: "add" as const,
                          name: song.addedBy || "Un invité",
                          avatar: avatarForInteraction(song.addedBy || "Un invité"),
                          detail: `a ajouté ${song.title}`,
                          at: song.addedAt,
                        })),
                        ...party.participants.slice(0, 2).map((participant, index) => ({
                          id: `fallback-join-${index}`,
                          kind: "join" as const,
                          name: participant.name,
                          avatar: participant.avatar || defaultAvatarForParticipant(participant.id),
                          detail: "est en ligne dans la soirée",
                          at: Date.now(),
                        })),
                      ]).slice(0, 5).map((interaction) => (
                        <div key={interaction.id} className="dj-console-activity__item">
                          <span className={`dj-console-activity__icon dj-console-activity__icon--${interaction.kind} overflow-hidden p-0`}>
                            <img
                              src={interaction.avatar || avatarForInteraction(interaction.name)}
                              alt={`Photo de profil de ${interaction.name}`}
                              className="h-full w-full object-cover"
                            />
                          </span>
                          <div>
                            <strong>{interaction.name}</strong>
                            <p>{interaction.detail}</p>
                          </div>
                        </div>
                      ))}
                      {!djInteractions.length && !queue.length && !party.participants.length && (
                        <p className="dj-console-activity__empty">Les votes, ajouts et arrivées apparaîtront ici.</p>
                      )}
                    </div>
                  </aside>

                  {youtubeError !== null && (
                    <div className="dj-console-error">
                      <p>Erreur YouTube {youtubeError}</p>
                      <span>Le lecteur audio rencontre un problème sur ce morceau.</span>
                    </div>
                  )}
                  {resumeRequired && (
                    <div className="dj-console-resume">
                      <button type="button" onClick={resumePlayback}><Play className="h-5 w-5 fill-current" /> Reprendre la lecture</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="v53-player-empty"><div><Music4 className="h-7 w-7" /></div><h2>Aucun morceau en lecture</h2><p>Ajoute des musiques à la file puis lance le DJ.</p><button onClick={nextSong} className="party-action party-action--purple group mt-5 rounded-2xl px-6 py-3"><span className="party-action__shine" aria-hidden="true" /><span className="party-action__content flex items-center justify-center gap-2"><Play className="h-4 w-4 fill-current" />Lancer le DJ</span></button></div>
              )}

              <div className="mt-4 border-t border-white/[0.07] pt-4 md:hidden">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">
                      À suivre
                    </p>
                    <h3 className="mt-1 text-base font-black">Prochaines musiques</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMobileTab("queue")}
                    className="rounded-full border border-purple-400/15 bg-purple-500/10 px-3 py-1.5 text-[11px] font-black text-purple-200"
                  >
                    Voir la file
                  </button>
                </div>

                {queue.length > 0 ? (
                  <div className="space-y-2">
                    {queue.slice(0, 4).map((song, index) => (
                      <button
                        key={`playback-next-${song.videoId}-${song.addedAt}`}
                        type="button"
                        onClick={() => switchMobileTab("queue")}
                        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-2.5 text-left"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-purple-400/15 bg-purple-500/10 text-xs font-black text-purple-200">
                          {index + 1}
                        </span>
                        <img
                          src={song.thumbnail}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-white">
                            {song.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-white/40">
                            {song.artistName || "Artiste MixParty"}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-fuchsia-400/15 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-black text-fuchsia-200">
                          {song.votes} vote{song.votes > 1 ? "s" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-center text-sm text-white/40">
                    Aucun morceau en attente.
                  </div>
                )}
              </div>
            </section>

            <section className={`${activeMobileTab === "queue" ? "block" : "hidden"} v53-queue-panel premium-glass-card md:block`}>

              <div className="v53-queue-header">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400">
                    Prochaine sélection
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    File d’attente DJ
                  </h2>

                </div>

                <div className="v53-queue-count">

                  {queue.length} morceau{queue.length > 1 ? "x" : ""}

                </div>

              </div>

              {queue.length > 0 ? (
                <div className="v53-queue-list w-full min-w-0 max-w-full overflow-x-hidden">

                  {queue.map((song, index) => {
                    const originalIndex = songs.findIndex(
                      (item) => item.addedAt === song.addedAt
                    );
const creatorToken =
  typeof window !== "undefined"
    ? localStorage.getItem(`mixparty_creator_${code}`) || ""
    : "";

const canRemove =
  Boolean(creatorToken) ||
  Boolean(
    song.addedById &&
    participantId &&
    song.addedById === participantId
  );
                    return (
                      <div
                          key={`${song.videoId}-${song.addedAt}`}
  className={`v53-queue-item min-w-0 max-w-full overflow-hidden ${index === 0 ? "v53-queue-item--next" : ""}`}
                        style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
                      >

                        <div
                          className="v53-queue-rank"
                        >
                          {index === 0 ? <Play className="h-4 w-4 fill-current" /> : index + 1}
                        </div>

                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="v53-queue-cover"
                        />

                        <div className="min-w-0 overflow-hidden">

                          {index === 0 && (
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">
                              Prochaine musique
                            </p>
                          )}

                          <p className="v53-queue-title line-clamp-2 min-w-0 max-w-full break-words [overflow-wrap:anywhere]">{song.title}</p>
                          <p className="v53-queue-artist min-w-0 max-w-full truncate">{song.artistName || "Artiste MixParty"}</p>

                          <div className="v53-queue-added min-w-0 max-w-full overflow-hidden">
                            <span className="v53-queue-avatar shrink-0">
                              <img
                                src={party.participants.find((participant) => participant.name === song.addedBy)?.avatar || defaultAvatarForParticipant(song.addedBy)}
                                alt=""
                              />
                            </span>
                            <span className="min-w-0 truncate">
                              Ajouté par <strong className="truncate">{song.addedBy}</strong>
                            </span>
                          </div>

                          <div className={`mt-3 grid w-full min-w-0 gap-2 sm:hidden ${canRemove ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1"}`}>
                            <button
                              type="button"
                              onClick={() => vote(originalIndex)}
                              className={`vote-button ${voteBurst === `${song.videoId}-${song.addedAt}` ? "vote-button--burst" : ""} flex min-w-0 w-full items-center justify-center`}
                            >
                              <span className="vote-button__glow" aria-hidden="true" />
                              <span className="vote-button__plus">+1</span>
                              <span className="relative z-10 flex min-w-0 items-center justify-center gap-1.5">
                                <ArrowBigUp className="h-4 w-4 shrink-0" />
                                <span className="truncate">Voter · {song.votes}</span>
                              </span>
                            </button>

                            {canRemove && (
                              <button
                                type="button"
                                onClick={() => removeSong(originalIndex, song)}
                                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 transition active:scale-95"
                                aria-label={`Supprimer ${song.title}`}
                                title="Supprimer cette musique"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="v53-queue-actions hidden min-w-0 shrink-0 sm:flex">

                          <div className="v53-vote-score">

                            <p>
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
  <span className="relative z-10 flex items-center gap-1.5">
    <ArrowBigUp className="h-4 w-4" />
    Voter
  </span>
</button>

{canRemove && (
  <button
    type="button"
    onClick={() => removeSong(originalIndex, song)}
    className="grid h-11 w-11 place-items-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 transition hover:border-red-400/40 hover:bg-red-500/20"
    aria-label={`Supprimer ${song.title}`}
    title="Supprimer cette musique"
  >
    <Trash2 className="h-4 w-4" />
  </button>
)}

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

            <section className="v6-intelligence-suite hidden overflow-hidden rounded-[32px] border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.08] via-purple-500/[0.08] to-pink-500/[0.07] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6 md:block">
              <div className="v6-suite-header">
                <div className="flex items-start gap-3">
                  <div className={`partybrain-orb ${loadingSuggestions ? "partybrain-orb--thinking" : ""}`}>
                    <BrainCircuit className="h-6 w-6 text-cyan-100" />
                    <span className="partybrain-orb__ring" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">PartyBrain V2</p>
                      <span className="partybrain-status"><span className="partybrain-status__dot" />{loadingSuggestions ? "Analyse en cours" : "Analyse temps réel"}</span>
                    </div>
                    <h2 className="mt-1 text-2xl font-black">Le cerveau de la soirée</h2>
                    <p className="mt-2 max-w-2xl text-sm text-white/42">Analyse les styles, l’énergie, les votes, la participation et la prochaine transition.</p>
                  </div>
                </div>
                <div className="v6-confidence"><span>{moodConfidence || "—"}</span><small>% confiance</small></div>
              </div>

              <div className="v6-metrics-grid">
                <article className="v6-metric-card v6-metric-card--mood">
                  <div className="v6-metric-icon"><Activity className="h-5 w-5" /></div>
                  <p>Ambiance détectée</p>
                  <strong>{partyBrainMood}</strong>
                  <span>Secondaire : {partyBrainSecondaryMood}</span>
                </article>
                <article className="v6-metric-card v6-metric-card--energy">
                  <div className="flex items-center justify-between"><div className="v6-metric-icon"><Gauge className="h-5 w-5" /></div><b>{partyBrainEnergy || "—"}%</b></div>
                  <p>Énergie</p>
                  <strong>{energyLabel}</strong>
                  <div className="partybrain-energy"><span style={{ width: `${partyBrainEnergy}%` }} /></div>
                  <span className={energyTrend >= 0 ? "text-emerald-300" : "text-orange-300"}>{energyTrend >= 0 ? "+" : ""}{energyTrend}% sur la dynamique récente</span>
                </article>
                <article className="v6-metric-card v6-metric-card--people">
                  <div className="v6-metric-icon"><UsersRound className="h-5 w-5" /></div>
                  <p>Participation</p>
                  <strong>{participationRate}% active</strong>
                  <span>{party.participants.length} invité{party.participants.length > 1 ? "s" : ""} · {totalSessionVotes} votes</span>
                </article>
                <article className="v6-metric-card v6-metric-card--transition">
                  <div className="flex items-center justify-between"><div className="v6-metric-icon"><Route className="h-5 w-5" /></div><b>{queue[0] ? `${nextTransitionScore}%` : "—"}</b></div>
                  <p>Transition suivante</p>
                  <strong>{currentStyle} → {nextStyle}</strong>
                  <span>{transitionMessage}</span>
                </article>
              </div>

              <div className="v6-mixmate-grid">
                <article className="v6-mixmate-card">
                  <div className="v6-mixmate-avatar"><img src="/branding/icon.png" alt="" /><span /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-white">MixMate</p><span className="v6-ai-badge">Assistant IA</span></div>
                    <p className="mt-2 text-base font-semibold leading-7 text-white/80">{mixMateAdvice}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="v6-advice-chip"><Zap className="h-3.5 w-3.5" /> Conseil DJ</span>
                      <span className="v6-advice-chip"><TrendingUp className="h-3.5 w-3.5" /> {energyTrend >= 0 ? "Dynamique positive" : "Relance conseillée"}</span>
                    </div>
                  </div>
                </article>

                <article className="v6-session-card">
                  <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-purple-300" /><p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Analyse de soirée</p></div>
                  <div className="v6-session-stats">
                    <div><strong>{party.history?.length || 0}</strong><span>titres joués</span></div>
                    <div><strong>{sessionDurationMinutes ? `${sessionDurationMinutes} min` : "—"}</strong><span>session</span></div>
                    <div><strong>{totalSessionVotes}</strong><span>votes</span></div>
                  </div>
                  <p>{party.currentSong ? `Style dominant : ${partyBrainMood}. ${energyLabel === "Très forte" ? "Le pic d’ambiance est en cours." : "PartyBrain continue d’apprendre de la soirée."}` : "L’analyse démarre avec le premier morceau."}</p>
                </article>
              </div>

              <div className="v6-recommendations-head">
                <div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Suggestions personnalisées</p><h3 className="mt-1 text-xl font-black">À mettre maintenant</h3></div>
                <div className="partybrain-thinking" aria-hidden="true"><div className="partybrain-thinking__core"><WandSparkles className="h-6 w-6" /></div><p>{loadingSuggestions ? "MixMate réfléchit…" : `${suggestions.length} choix préparé${suggestions.length > 1 ? "s" : ""}`}</p></div>
              </div>

              {loadingSuggestions ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">{[0,1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[22px] border border-white/[0.06] bg-white/[0.035]" />)}</div>
              ) : suggestions.length > 0 ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {suggestions.map((video, index) => {
                    const suggestionStyle = detectPartyStyle(`${video.title || ""} ${video.artistName || ""} ${video.channelTitle || ""}`).name;
                    const compatibility = transitionScore(currentStyle, suggestionStyle) - Math.min(8, index * 2);
                    return (
                      <article key={video.id} className="suggestion-card v6-suggestion-card group relative flex gap-3 overflow-hidden rounded-[22px] border border-white/[0.08] bg-black/25 p-3">
                        <div className="absolute right-3 top-3 rounded-full border border-cyan-300/15 bg-cyan-950/70 px-2.5 py-1 text-[10px] font-black text-cyan-200">{compatibility}% compatible</div>
                        <img src={video.thumbnail} alt={video.title} className="h-24 w-32 shrink-0 rounded-2xl object-cover" />
                        <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-1">
                          <div><p className="line-clamp-2 pr-20 text-sm font-black leading-snug">{video.title}</p><p className="mt-1 text-xs text-white/35">{suggestionStyle} · Choix #{index + 1}</p></div>
                          <button onClick={() => addYoutubeSong(video, "partybrain_suggestion")} disabled={addingVideoId === video.id} className="suggestion-add mt-3 w-fit rounded-xl px-4 py-2 text-xs font-black"><Plus className="h-3.5 w-3.5" />{addingVideoId === video.id ? "Ajout…" : "Ajouter à la file"}</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-dashed border-white/10 bg-black/20 px-5 py-8 text-center"><WandSparkles className="mx-auto h-6 w-6 text-purple-300" /><p className="mt-3 font-black">Lance un morceau pour réveiller PartyBrain V2.</p><p className="mt-1 text-sm text-white/35">MixMate analysera ensuite l’ambiance et guidera le DJ.</p></div>
              )}
            </section>

            <section className={`${activeMobileTab === "add" ? "block" : "hidden"} premium-glass-card rounded-[24px] border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl sm:p-6 md:block md:rounded-[30px]`}>

              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] ${karaokeMode ? "text-fuchsia-300" : "text-pink-400"}`}>
                    {karaokeMode ? "Mode Karaoké" : "Ajouter un morceau"}
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    {karaokeMode ? "Catalogue Karaoké" : "Recherche YouTube"}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                    {karaokeMode
                      ? "Seuls les morceaux déjà validés avec des paroles synchronisées LRCLIB sont proposés."
                      : "Recherche libre dans le catalogue musical MixParty."}
                  </p>
                </div>

                <div className="hidden flex-wrap gap-2 md:flex">
                  <button
                    type="button"
                    onClick={karaokeMode ? deactivateKaraokeMode : activateKaraokeMode}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition ${
                      karaokeMode
                        ? "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.10]"
                        : "border-fuchsia-300/25 bg-gradient-to-r from-fuchsia-500/15 to-purple-500/15 text-fuchsia-100 shadow-[0_0_32px_rgba(217,70,239,.10)] hover:border-fuchsia-300/40"
                    }`}
                  >
                    <Mic2 className="h-4 w-4" />
                    {karaokeMode ? "Revenir au mode normal" : "Karaoké"}
                  </button>

                  {karaokeMode ? (
                    <button
                      type="button"
                      onClick={openKaraokeScreen}
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-500/15"
                    >
                      <Expand className="h-4 w-4" />
                      Ouvrir l’écran Karaoké
                    </button>
                  ) : null}
                </div>
              </div>

              {karaokeMode ? (
                <>
                  <div className="rounded-[22px] border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/[0.08] via-purple-500/[0.05] to-cyan-500/[0.04] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
                        <input
                          value={karaokeCatalogSearch}
                          onChange={(e) => setKaraokeCatalogSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void loadKaraokeCatalog(karaokeCatalogSearch);
                            }
                          }}
                          placeholder="Filtrer le catalogue : artiste, titre..."
                          className="w-full rounded-2xl border border-white/10 bg-black/25 py-4 pl-12 pr-4 outline-none transition placeholder:text-white/25 focus:border-fuchsia-400/50 focus:bg-black/35"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void loadKaraokeCatalog(karaokeCatalogSearch)}
                        disabled={karaokeCatalogLoading}
                        className="party-action party-action--purple group rounded-2xl px-7 py-4 disabled:opacity-50"
                      >
                        <span className="party-action__shine" aria-hidden="true" />
                        <span className="party-action__content flex items-center justify-center gap-2">
                          <Search className={`h-4 w-4 ${karaokeCatalogLoading ? "animate-spin" : ""}`} />
                          {karaokeCatalogLoading ? "Chargement…" : "Filtrer"}
                        </span>
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                      <span className="text-fuchsia-100/70">
                        {karaokeCatalog
                          ? `${karaokeCatalog.totalReady} morceau${karaokeCatalog.totalReady > 1 ? "x" : ""} prêts pour le karaoké`
                          : "Chargement du catalogue validé…"}
                      </span>

                      {karaokeCatalogSearch.trim() ? (
                        <button
                          type="button"
                          onClick={() => {
                            setKaraokeCatalogSearch("");
                            void loadKaraokeCatalog("");
                          }}
                          className="text-white/40 transition hover:text-white/75"
                        >
                          Afficher tout le catalogue
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {renderKaraokeArtistFolders()}
                </>
              ) : (
                <>
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

                  {searchInsight && (
                    <div className="mt-5 rounded-[22px] border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.08] via-purple-500/[0.06] to-transparent p-4 shadow-[0_18px_55px_rgba(34,211,238,0.08)]">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">PartyBrain Intelligence</p>
                          <p className="mt-1 text-sm font-bold leading-6 text-white/85">💡 {searchInsight.message}</p>
                          {searchInsight.hourMessage && <p className="mt-1 text-xs leading-5 text-white/45">🕒 {searchInsight.hourMessage}</p>}
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">Basé sur {searchInsight.sampleSize} ajout{searchInsight.sampleSize > 1 ? "s" : ""} observé{searchInsight.sampleSize > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </div>
                  )}

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
                </>
              )}

            </section>


            <section
              className={`${activeMobileTab === "karaoke" ? "block" : "hidden"} premium-glass-card rounded-[24px] border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-500/[0.07] via-purple-500/[0.045] to-cyan-500/[0.035] p-3 backdrop-blur-xl md:hidden`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-200">
                      <Mic2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300">
                        Mode Karaoké
                      </p>
                      <h2 className="mt-0.5 text-xl font-black">Catalogue Karaoké</h2>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/40">
                    Choisis d’abord un artiste, puis le morceau à ajouter. Seuls les titres avec paroles synchronisées sont proposés.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openKaraokeScreen}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-xs font-black text-cyan-100 transition active:scale-[.99]"
              >
                <Expand className="h-4 w-4" />
                Ouvrir l’écran paroles
              </button>

              <div className="mt-4 rounded-[20px] border border-white/[0.07] bg-black/20 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    value={karaokeCatalogSearch}
                    onChange={(e) => setKaraokeCatalogSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void loadKaraokeCatalog(karaokeCatalogSearch);
                      }
                    }}
                    placeholder="Rechercher un artiste ou un titre..."
                    className="w-full rounded-2xl border border-white/10 bg-black/25 py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-white/25 focus:border-fuchsia-400/50"
                  />
                </div>

                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => void loadKaraokeCatalog(karaokeCatalogSearch)}
                    disabled={karaokeCatalogLoading}
                    className="rounded-2xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
                  >
                    {karaokeCatalogLoading ? "Chargement…" : "Rechercher"}
                  </button>

                  {karaokeCatalogSearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setKaraokeCatalogSearch("");
                        void loadKaraokeCatalog("");
                      }}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-xs font-black text-white/60"
                    >
                      Tout
                    </button>
                  ) : null}
                </div>

                <p className="mt-3 text-xs font-bold text-fuchsia-100/60">
                  {karaokeCatalog
                    ? `${karaokeArtistGroups.length} artiste${karaokeArtistGroups.length > 1 ? "s" : ""} · ${karaokeCatalog.totalReady} morceau${karaokeCatalog.totalReady > 1 ? "x" : ""} prêts`
                    : "Chargement du catalogue…"}
                </p>
              </div>

              {renderKaraokeArtistFolders()}
            </section>

            {party.history?.length > 0 && (
              <section className={`${activeMobileTab === "queue" ? "block" : "hidden"} premium-glass-card rounded-[24px] border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl sm:p-6 md:block md:rounded-[30px]`}>

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

              <div className="qr-live-shell relative overflow-hidden rounded-[30px] p-[1px]">
                <span className="qr-live-shell__halo" aria-hidden="true" />
                <div className="qr-live-inner relative rounded-[29px] bg-[#0d0b18] p-5">
                  <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-purple-500/20 blur-3xl" />
                  <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-orange-400/15 blur-3xl" />
                  <div className="qr-live-code relative rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                    <span className="qr-corner qr-corner--tl" aria-hidden="true" />
                    <span className="qr-corner qr-corner--tr" aria-hidden="true" />
                    <span className="qr-corner qr-corner--bl" aria-hidden="true" />
                    <span className="qr-corner qr-corner--br" aria-hidden="true" />
                    <QRCodeCanvas
                      value={shareUrl || `http://localhost:3000/party/${party.code}`}
                      size={280}
                      level="H"
                      bgColor="#ffffff"
                      fgColor="#171126"
                      imageSettings={{
                        src: "/branding/icon.png",
                        width: 58,
                        height: 58,
                        excavate: true,
                      }}
                      className="h-auto w-full rounded-xl"
                    />
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
              <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} premium-glass-card rounded-[24px] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 to-purple-600/10 p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

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

                {isInAppBrowser ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/[0.08] px-4 py-3 text-left">
                    <p className="text-sm font-black text-amber-100">
                      Ouvert depuis une application
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-50/65">
                      Sur certains Android, Snapchat ou un autre navigateur intégré peut bloquer la caméra et la galerie.
                      Si rien ne s’ouvre, utilise le menu de l’application puis « Ouvrir dans le navigateur ».
                      Tu peux aussi continuer sans photo : MixParty te donnera un avatar automatiquement.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label
                    htmlFor="mixparty-profile-camera-join"
                    aria-disabled={uploadingAvatar}
                    className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-pink-400/25 bg-pink-500/10 px-3 py-3 text-sm font-black text-pink-100 transition hover:border-pink-300/45 hover:bg-pink-500/15 ${
                      uploadingAvatar ? "pointer-events-none cursor-wait opacity-50" : ""
                    }`}
                  >
                    <Camera className="h-5 w-5 shrink-0" />
                    <span>{uploadingAvatar ? "Préparation…" : "Prendre une photo"}</span>
                  </label>

                  <label
                    htmlFor="mixparty-profile-gallery-join"
                    aria-disabled={uploadingAvatar}
                    className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-purple-400/25 bg-purple-500/10 px-3 py-3 text-sm font-black text-purple-100 transition hover:border-purple-300/45 hover:bg-purple-500/15 ${
                      uploadingAvatar ? "pointer-events-none cursor-wait opacity-50" : ""
                    }`}
                  >
                    <Images className="h-5 w-5 shrink-0" />
                    <span>Choisir dans la galerie</span>
                  </label>
                </div>

                <input
                  id="mixparty-profile-camera-join"
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={handleProfilePhotoSelection}
                />

                <input
                  id="mixparty-profile-gallery-join"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={handleProfilePhotoSelection}
                />

                {participantAvatar && (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <img src={participantAvatar} alt="Aperçu de ta photo" className="h-12 w-12 rounded-xl object-cover" />
                    <div>
                      <p className="text-sm font-black text-white">Photo sélectionnée</p>
                      <p className="text-xs text-white/45">Elle sera utilisée comme avatar dans la soirée.</p>
                    </div>
                  </div>
                )}

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
              <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} premium-glass-card rounded-[24px] border border-purple-400/20 bg-gradient-to-br from-purple-600/10 to-pink-500/[0.07] p-4 backdrop-blur-xl md:block md:rounded-[30px] md:p-5`}>

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

                {isInAppBrowser ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/[0.08] px-4 py-3 text-xs leading-5 text-amber-50/65">
                    Si la caméra ou la galerie ne s’ouvre pas depuis Snapchat ou une autre application,
                    ouvre MixParty dans ton navigateur Android.
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label
                    htmlFor="mixparty-profile-camera-settings"
                    aria-disabled={uploadingAvatar}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-bold text-white/70 transition hover:border-pink-400/30 hover:bg-pink-500/10 ${
                      uploadingAvatar ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <Camera className="h-4 w-4 text-pink-300" />
                    Prendre une photo
                  </label>
                  <label
                    htmlFor="mixparty-profile-gallery-settings"
                    aria-disabled={uploadingAvatar}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-bold text-white/70 transition hover:border-purple-400/30 hover:bg-purple-500/10 ${
                      uploadingAvatar ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <Images className="h-4 w-4 text-purple-300" />
                    Galerie
                  </label>
                </div>

                <input
                  id="mixparty-profile-camera-settings"
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={handleProfilePhotoSelection}
                />
                <input
                  id="mixparty-profile-gallery-settings"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingAvatar}
                  onChange={handleProfilePhotoSelection}
                />

                <div className="mt-3 rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white/50">
                  Sans photo personnelle, MixParty t’attribue automatiquement un avatar unique.
                </div>

              </section>
            )}

            <section className={`${activeMobileTab === "guests" ? "block" : "hidden"} participants-panel premium-glass-card rounded-[24px] p-4 md:block md:rounded-[30px] md:p-5`}>

              <div className="participants-panel__header mb-5 flex items-center justify-between gap-4">

                <div>

                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
                    Communauté en direct
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    Participants
                  </h2>

                </div>

                <span className="participants-count">
                  <span className="participants-count__dot" />
                  {party.participants.length} en ligne
                </span>

              </div>

              {party.participants.length > 0 ? (
                <div className="participants-list">

                  {party.participants.map((participant, index) => {
                    const isDjParticipant = isPlaybackController && participant.id === participantId;

                    return (
                      <div
                        key={`${participant.id || participant.name}-${index}`}
                        className={`participant-card ${isDjParticipant ? "participant-card--dj" : ""}`}
                        style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
                      >
                        <div className="participant-avatar-shell">
                          <div className="participant-avatar-ring" aria-hidden="true" />
                          <div className="participant-avatar">
                            {participant.avatar ? (
                              <img src={participant.avatar} alt={`Avatar de ${participant.name}`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-lg font-black uppercase">
                                {participant.name.trim().charAt(0) || "?"}
                              </div>
                            )}
                          </div>
                          <span className="participant-online-dot" title="En ligne" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate font-black text-white/90">{participant.name}</p>
                            {isDjParticipant && <span className="participant-dj-badge"><Crown className="h-3 w-3" /> DJ</span>}
                          </div>
                          <p className="mt-0.5 truncate text-xs font-semibold text-emerald-300/65">En ligne maintenant</p>
                        </div>

                        <span className="participant-live-pill">LIVE</span>
                      </div>
                    );
                  })}

                </div>
              ) : (
                <p className="participants-empty">
                  Aucun participant pour le moment.
                </p>
              )}

            </section>

            <section className={`${activeMobileTab === "playback" ? "block" : "hidden"} premium-glass-card overflow-hidden rounded-[22px] border border-cyan-400/15 bg-cyan-500/[0.045] p-3 backdrop-blur-xl md:block md:rounded-[26px] md:p-4`}>
              <button
                type="button"
                onClick={togglePartyBrainAutoRelay}
                disabled={!isPlaybackController || partyBrainRelayUpdating}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  party?.partyBrainAutoRelayEnabled
                    ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-black/20 text-white"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    party?.partyBrainAutoRelayEnabled
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-cyan-400/10 text-cyan-300"
                  }`}
                >
                  {partyBrainRelayUpdating ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Bot className="h-5 w-5" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">
                    {party?.partyBrainAutoRelayEnabled
                      ? "Relais PartyBrain activé"
                      : "Activer le relais PartyBrain"}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-white/45">
                    {party?.partyBrainAutoRelayEnabled
                      ? "PartyBrain choisira une musique adaptée si la file devient vide."
                      : "PartyBrain ne prendra le relais que lorsque la file sera vide."}
                  </span>
                </span>

                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
                    party?.partyBrainAutoRelayEnabled
                      ? "border-emerald-300/30 bg-emerald-400/30"
                      : "border-white/10 bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${
                      party?.partyBrainAutoRelayEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </span>
              </button>

              {!isPlaybackController && (
                <p className="mt-2 px-1 text-[10px] font-bold text-white/30">
                  Ce réglage est disponible uniquement sur l’appareil du créateur.
                </p>
              )}
            </section>

            <section className={`${activeMobileTab === "playback" ? "block" : "hidden"} premium-glass-card overflow-hidden rounded-[22px] border p-3 backdrop-blur-xl transition md:block md:rounded-[26px] md:p-4 ${
              djModeActive
                ? "border-emerald-400/25 bg-emerald-500/[0.08]"
                : "border-white/10 bg-white/[0.035]"
            }`}>
              <button
                type="button"
                onClick={djModeActive ? deactivateDjMode : activateDjMode}
                disabled={!djModeActive && !isPlaybackController}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  djModeActive
                    ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-black/20 text-white"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    djModeActive
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-orange-400/10 text-orange-300"
                  }`}
                >
                  <Headphones className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">
                    {djModeActive
                      ? "Mode DJ activé"
                      : isPlaybackController
                        ? "Activer le mode DJ"
                        : "Disponible sur l’appareil DJ"}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-white/45">
                    {djModeActive
                      ? "L’écran reste allumé pendant la diffusion."
                      : "Garde ton écran allumé pendant toute la soirée."}
                  </span>
                </span>

                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    djModeActive
                      ? "animate-pulse bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.85)]"
                      : "bg-white/20"
                  }`}
                />
              </button>

              {djModeActive && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
                    networkOnline
                      ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
                      : "border-red-400/15 bg-red-400/10 text-red-300"
                  }`}>
                    {networkOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {networkOnline ? "Connecté" : "Hors ligne"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black text-white/55">
                    <Battery className="h-3 w-3" />
                    {batteryLevel === null ? "Batterie —" : `${batteryLevel} %`}
                  </span>

                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
                    wakeLockActive
                      ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
                      : "border-amber-400/15 bg-amber-400/10 text-amber-300"
                  }`}>
                    <Sparkles className="h-3 w-3" />
                    {wakeLockActive ? "Écran maintenu" : "Wake Lock indisponible"}
                  </span>

                  <button
                    type="button"
                    onClick={resumePlayback}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black text-white/70"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reprendre
                  </button>

                  <button
                    type="button"
                    onClick={activateTvMode}
                    className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/15 bg-purple-500/10 px-3 py-1.5 text-[10px] font-black text-purple-200"
                  >
                    <Expand className="h-3 w-3" />
                    Mode TV
                  </button>
                </div>
              )}
            </section>

          </aside>

        </div>

        {tvModeActive && (
          <section className={`v60-tv ${tvPlayback.state === 1 ? "v60-tv--playing" : "v60-tv--paused"}`} aria-label="Mode TV MixParty">
            <div className="v60-tv__backdrop" style={party.currentSong && hasHdCover(party.currentSong) ? { backgroundImage: `url(${getSongArtwork(party.currentSong)})` } : undefined} />
            <div className="v60-tv__veil" />

            <header className="v60-tv__header">
              <div className="v60-tv__brand">
                <img src="/branding/icon.png" alt="MixParty" />
                <strong>MIX<span>PARTY</span></strong>
                <em>MODE TV</em>
              </div>
              <div className="v60-tv__header-stats">
                <div><UsersRound /><b>{party.participants.length}</b><span>participants en ligne</span></div>
                <div><TrendingUp /><b>{totalVisibleVotes}</b><span>votes en temps réel</span></div>
              </div>
              {externalDisplayMode !== "tv" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setKaraokeScreenOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-4 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-500/15"
                  >
                    <Mic2 className="h-4 w-4" />
                    Karaoké
                  </button>
                  <button type="button" onClick={deactivateTvMode} className="v60-tv__close">Quitter</button>
                </div>
              ) : (
                <div className="rounded-full border border-emerald-300/15 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[.16em] text-emerald-200">
                  Écran connecté
                </div>
              )}
            </header>

            <main className="v60-tv__grid">
              <section className="v60-tv__now">
                <div className="v60-tv__current-pill">EN COURS</div>
                <div className="v60-tv__now-grid">
                  <div className="v60-tv__cover-wrap">
                    <div className="v60-tv__cover-glow" />
                    {party.currentSong?.thumbnail ? (
                      <img src={getSongArtwork(party.currentSong)} alt={hasHdCover(party.currentSong) ? "Pochette du morceau en lecture" : "Logo MixParty"} className={`v60-tv__cover ${hasHdCover(party.currentSong) ? "" : "v60-tv__cover--logo"}`} />
                    ) : (
                      <div className="v60-tv__cover v60-tv__cover--empty"><Music4 /></div>
                    )}
                  </div>

                  <div className="v60-tv__track">
                    <h1>{party.currentSong?.title || "La soirée démarre bientôt"}</h1>
                    <p>{party.currentSong?.artistName || party.currentSong?.addedBy || "MixParty"}</p>
                    <div className="v60-tv__progress-row">
                      <span>{Math.floor(tvPlayback.time / 60)}:{String(Math.floor(tvPlayback.time % 60)).padStart(2, "0")}</span>
                      <div className="v60-tv__progress"><i style={{ width: `${tvPlayback.duration > 0 ? Math.min(100, Math.max(0, (tvPlayback.time / tvPlayback.duration) * 100)) : 12}%` }} /></div>
                      <span>{tvPlayback.duration > 0 ? `${Math.floor(tvPlayback.duration / 60)}:${String(Math.floor(tvPlayback.duration % 60)).padStart(2, "0")}` : "LIVE"}</span>
                    </div>
                    <div className="v60-tv__wave" aria-hidden="true">
                      {Array.from({ length: 56 }, (_, index) => (
                        <span key={index} style={{ animationDelay: `${(index % 14) * 62}ms`, height: `${24 + ((index * 23) % 72)}%` }} />
                      ))}
                    </div>
                    <div className="v60-tv__controls">
                      <button type="button" aria-label="Lecture aléatoire"><RefreshCw /></button>
                      <button type="button" aria-label="Titre précédent"><SkipForward className="v60-tv__previous" /></button>
                      <button type="button" className="v60-tv__play" onClick={tvPlayback.state === 1 ? () => playerRef.current?.pauseVideo?.() : resumePlayback} aria-label={tvPlayback.state === 1 ? "Mettre en pause" : "Lire"}>
                        {tvPlayback.state === 1 ? <span className="v60-tv__pause-icon"><i /><i /></span> : <Play />}
                      </button>
                      <button type="button" onClick={nextSong} aria-label="Titre suivant"><SkipForward /></button>
                      <button type="button" aria-label="Répéter"><RefreshCw /></button>
                      <div className="v60-tv__likes"><span>♡</span><b>{totalVisibleVotes}</b></div>
                      <div className="v60-tv__people"><UsersRound /><b>{party.participants.length}</b><span>participants</span></div>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="v60-tv__queue">
                <div className="v60-tv__queue-head"><span>PROCHAINS MORCEAUX</span><span>VOTES EN TEMPS RÉEL</span></div>
                <div className="v60-tv__queue-list">
                  {queue.slice(0, 10).map((song, index) => {
                    const maxVotes = Math.max(1, ...queue.slice(0, 10).map((item) => item.votes || 0));
                    return (
                      <div key={`${song.videoId}-${song.addedAt}`} className={`v60-tv__queue-item ${index === 0 ? "v60-tv__queue-item--next" : ""}`}>
                        <span className="v60-tv__rank">{index + 1}</span>
                        <img src={song.thumbnail} alt="" />
                        <div className="v60-tv__queue-copy"><strong>{song.title}</strong><small>{song.artistName || song.addedBy}</small></div>
                        <b className="v60-tv__vote-count">{song.votes}</b>
                        <div className="v60-tv__vote-bar"><i style={{ width: `${Math.max(8, ((song.votes || 0) / maxVotes) * 100)}%` }} /></div>
                        <span className={`v60-tv__trend ${index % 3 === 0 ? "v60-tv__trend--down" : ""}`}>{index % 3 === 0 ? "↓" : "↑"}</span>
                      </div>
                    );
                  })}
                  {queue.length === 0 && <div className="v60-tv__empty">La file DJ est vide pour le moment.</div>}
                </div>
              </aside>
            </main>

            <footer className="v60-tv__footer">
              <div className="v60-tv__footer-brand">
                <img src="/branding/icon.png" alt="" />
                <div><strong>Mix<span>Party</span></strong><small>La musique, c’est nous.</small></div>
              </div>
              <div className="v60-tv__join-copy"><strong>AJOUTEZ VOS MORCEAUX ET VOTEZ !</strong><span>Scannez le QR code pour rejoindre la soirée</span></div>
              <div className="v60-tv__qr"><QRCodeCanvas value={shareUrl || `https://mixparty.app/party/${party.code}`} size={104} bgColor="#ffffff" fgColor="#090711" level="H" includeMargin /></div>
              <div className="v60-tv__metric"><Radio /><span>ÉNERGIE</span><b>{partyBrainEnergy}%</b><small>{partyBrainEnergy >= 75 ? "TRÈS ÉLEVÉE" : partyBrainEnergy >= 50 ? "ÉLEVÉE" : "MODÉRÉE"}</small></div>
              <div className="v60-tv__metric"><TrendingUp /><span>AMBIANCE</span><b>{partyBrainMood}</b><small>{partyBrainSecondaryMood || "MIXPARTY LIVE"}</small></div>
              <div className="v60-tv__metric"><UsersRound /><span>PARTICIPATION</span><b>{party.participants.length > 10 ? "TRÈS ÉLEVÉE" : party.participants.length > 4 ? "ÉLEVÉE" : "EN COURS"}</b><small>{party.participants.length}/{party.participants.length} ACTIFS</small></div>
            </footer>
          </section>
        )}

        <footer className="mt-8 hidden border-t border-white/[0.07] py-8 text-center md:block">

          <div className="flex items-center justify-center gap-3">

            <img src="/branding/icon.png" alt="" aria-hidden="true" className="h-11 w-11 object-contain" />

            <span className="-skew-x-6 font-[family:var(--font-exo-2)] text-lg font-black tracking-[0.16em]">
              <span className="text-white">MIX</span><span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">PARTY</span>
            </span>

          </div>

          <p className="mt-3 text-sm text-white/30">
            La musique de la soirée appartient à tout le monde.
          </p>

        </footer>

        <nav className="v54-mobile-nav fixed inset-x-2 bottom-3 z-50 grid grid-cols-5 gap-0.5 rounded-[22px] border border-white/12 bg-[#11111d]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:hidden" aria-label="Navigation de la soirée">
          {[
            { id: "playback", label: "Lecture", Icon: Music4 },
            { id: "add", label: "Ajouter", Icon: Plus },
            { id: "karaoke", label: "Karaoké", Icon: Mic2 },
            { id: "queue", label: "File", Icon: ListMusic },
            { id: "guests", label: "Invités", Icon: UserPlus },
          ].map(({ id, label, Icon }) => {
            const active = activeMobileTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => switchMobileTab(id as "playback" | "add" | "karaoke" | "queue" | "guests")}
                className={`v54-mobile-nav__item flex min-w-0 flex-col items-center justify-center gap-1 rounded-[17px] px-0.5 py-2.5 text-[9px] font-black transition ${active ? "v54-mobile-nav__item--active bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white shadow-[0_8px_24px_rgba(168,85,247,0.28)]" : "text-white/45 active:bg-white/[0.06]"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="w-full truncate text-center">{label}</span>
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

        /* File d'attente : sécurité anti-débordement mobile.
           Même un titre extrêmement long ne peut plus élargir la page ni pousser le vote hors écran. */
        .v53-queue-panel,
        .v53-queue-list,
        .v53-queue-item {
          width: 100%;
          min-width: 0;
          max-width: 100%;
        }

        .v53-queue-list,
        .v53-queue-item {
          overflow-x: hidden;
        }

        .v53-queue-item > * {
          min-width: 0;
          max-width: 100%;
        }

        .v53-queue-title {
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .v53-queue-artist,
        .v53-queue-added {
          max-width: 100%;
          overflow: hidden;
        }

        .v53-queue-actions {
          flex-shrink: 0;
        }

        @media (max-width: 639px) {
          .v53-queue-item {
            grid-template-columns: auto auto minmax(0, 1fr) !important;
            column-gap: .65rem !important;
            align-items: start !important;
          }

          .v53-queue-rank,
          .v53-queue-cover {
            flex-shrink: 0;
          }

          .v53-queue-title {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            white-space: normal !important;
          }
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

        @keyframes premiumCardSweep {
          0%, 70% { transform: translateX(-150%) skewX(-18deg); opacity: 0; }
          78% { opacity: .45; }
          100% { transform: translateX(260%) skewX(-18deg); opacity: 0; }
        }

        @keyframes premiumBorderPulse {
          0%, 100% { opacity: .45; filter: brightness(1); }
          50% { opacity: .9; filter: brightness(1.35); }
        }

        .premium-glass-card {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.025)),
            rgba(9,7,17,.58) !important;
          border-color: rgba(255,255,255,.12) !important;
          box-shadow:
            0 26px 80px rgba(0,0,0,.34),
            inset 0 1px 0 rgba(255,255,255,.1),
            0 0 0 1px rgba(168,85,247,.03);
          backdrop-filter: blur(26px) saturate(1.18);
          transition:
            transform .28s ease,
            border-color .28s ease,
            box-shadow .28s ease,
            background .28s ease;
        }

        .premium-glass-card::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            120deg,
            rgba(124,58,237,.45),
            rgba(236,72,153,.32) 46%,
            rgba(249,115,22,.38)
          );
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: .5;
          animation: premiumBorderPulse 6s ease-in-out infinite;
          pointer-events: none;
        }

        .premium-glass-card::after {
          content: "";
          position: absolute;
          top: -35%;
          bottom: -35%;
          left: -28%;
          width: 18%;
          z-index: 2;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.18),
            transparent
          );
          filter: blur(6px);
          animation: premiumCardSweep 8s ease-in-out infinite;
          pointer-events: none;
        }

        .premium-glass-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255,255,255,.18) !important;
          box-shadow:
            0 34px 96px rgba(0,0,0,.42),
            0 0 34px rgba(168,85,247,.12),
            inset 0 1px 0 rgba(255,255,255,.14);
        }

        .desktop-topbar img {
          filter:
            drop-shadow(0 0 16px rgba(168,85,247,.28))
            drop-shadow(0 0 22px rgba(236,72,153,.16));
        }

        .desktop-topbar .group:hover img {
          filter:
            drop-shadow(0 0 20px rgba(168,85,247,.42))
            drop-shadow(0 0 28px rgba(249,115,22,.2));
        }

        @media (max-width: 767px) {
          .premium-glass-card:hover {
            transform: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .premium-glass-card::before,
          .premium-glass-card::after {
            animation: none !important;
          }
        }

        .v6-intelligence-suite { position: relative; isolation: isolate; }
        .v6-intelligence-suite::before { content:""; position:absolute; inset:-30% 45% auto -15%; height:260px; border-radius:999px; background:radial-gradient(circle,rgba(34,211,238,.13),transparent 68%); filter:blur(20px); pointer-events:none; z-index:-1; }
        .v6-suite-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .v6-confidence { min-width:92px; border:1px solid rgba(103,232,249,.17); border-radius:20px; background:rgba(6,20,35,.52); padding:.8rem 1rem; text-align:center; box-shadow:inset 0 1px 0 rgba(255,255,255,.06); }
        .v6-confidence span { display:block; font-size:1.5rem; line-height:1; font-weight:950; color:#a5f3fc; }
        .v6-confidence small { display:block; margin-top:.35rem; font-size:.62rem; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:rgba(255,255,255,.34); }
        .v6-metrics-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.75rem; margin-top:1.25rem; }
        .v6-metric-card { min-height:154px; border:1px solid rgba(255,255,255,.08); border-radius:22px; background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(0,0,0,.2)); padding:1rem; box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 16px 38px rgba(0,0,0,.15); transition:transform .25s ease,border-color .25s ease; }
        .v6-metric-card:hover { transform:translateY(-3px); border-color:rgba(103,232,249,.2); }
        .v6-metric-card p { margin-top:.85rem; font-size:.68rem; font-weight:900; text-transform:uppercase; letter-spacing:.13em; color:rgba(255,255,255,.34); }
        .v6-metric-card strong { display:block; margin-top:.35rem; font-size:1.05rem; color:#fff; }
        .v6-metric-card > span { display:block; margin-top:.65rem; font-size:.72rem; line-height:1.35; color:rgba(255,255,255,.4); }
        .v6-metric-card b { font-size:1.2rem; color:#cffafe; }
        .v6-metric-icon { display:flex; height:34px; width:34px; align-items:center; justify-content:center; border-radius:12px; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.055); color:#a5f3fc; }
        .v6-mixmate-grid { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(280px,.7fr); gap:.75rem; margin-top:.75rem; }
        .v6-mixmate-card,.v6-session-card { border:1px solid rgba(255,255,255,.09); border-radius:24px; background:rgba(4,7,18,.46); padding:1rem; box-shadow:inset 0 1px 0 rgba(255,255,255,.05); }
        .v6-mixmate-card { display:flex; gap:1rem; align-items:flex-start; }
        .v6-mixmate-avatar { position:relative; flex:0 0 auto; height:54px; width:54px; border-radius:18px; padding:7px; background:linear-gradient(135deg,rgba(34,211,238,.22),rgba(168,85,247,.2),rgba(236,72,153,.18)); box-shadow:0 0 30px rgba(34,211,238,.12); }
        .v6-mixmate-avatar img { height:100%; width:100%; object-fit:contain; }
        .v6-mixmate-avatar span { position:absolute; right:-2px; bottom:-2px; height:13px; width:13px; border:3px solid #090912; border-radius:50%; background:#34d399; box-shadow:0 0 12px rgba(52,211,153,.85); }
        .v6-ai-badge { border:1px solid rgba(168,85,247,.25); border-radius:999px; background:rgba(168,85,247,.1); padding:.25rem .55rem; font-size:.58rem; font-weight:900; text-transform:uppercase; letter-spacing:.12em; color:#d8b4fe; }
        .v6-advice-chip { display:inline-flex; align-items:center; gap:.35rem; border:1px solid rgba(255,255,255,.08); border-radius:999px; background:rgba(255,255,255,.045); padding:.45rem .65rem; font-size:.68rem; font-weight:800; color:rgba(255,255,255,.54); }
        .v6-session-card > p { margin-top:.9rem; font-size:.78rem; line-height:1.55; color:rgba(255,255,255,.44); }
        .v6-session-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:.45rem; margin-top:.85rem; }
        .v6-session-stats div { border:1px solid rgba(255,255,255,.06); border-radius:14px; background:rgba(255,255,255,.035); padding:.65rem .45rem; text-align:center; }
        .v6-session-stats strong { display:block; font-size:.95rem; }
        .v6-session-stats span { display:block; margin-top:.2rem; font-size:.58rem; color:rgba(255,255,255,.32); }
        .v6-recommendations-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-top:1.4rem; padding-top:1.15rem; border-top:1px solid rgba(255,255,255,.07); }
        .v6-suggestion-card { box-shadow:0 16px 38px rgba(0,0,0,.14); }
        @media(max-width:1100px){ .v6-metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.v6-mixmate-grid{grid-template-columns:1fr;} }

      `}
</style>

    </main>
  );
}
