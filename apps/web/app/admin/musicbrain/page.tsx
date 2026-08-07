"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, Database, KeyRound, Mic2, Music2, Network, RefreshCw, Search, ShieldCheck, Sparkles, ThumbsUp, Timer, Trash2, UsersRound, Wifi, type LucideIcon } from "lucide-react";
import { getApiBaseUrl } from "../../../lib/config";

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
  covers?: {
    downloaded: number;
    pending: number;
    active: number;
    exactMatches: number;
    artistFallback: number;
    notFound: number;
    errors: number;
    unrequested: number;
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



type LiveUsersData = {
  generatedAt: number;
  onlineWindowMs: number;
  totalUsers: number;
  activePartyCount: number;
  parties: Array<{
    code: string;
    userCount: number;
    currentSong: { title: string; artistName?: string } | null;
    users: Array<{
      id: string;
      name: string;
      avatar?: string;
      lastSeen: number;
    }>;
  }>;
};


type AttendanceHistoryData = {
  generatedAt: number;
  retentionDays: number;
  totalParties: number;
  totalParticipations: number;
  days: Array<{
    dateKey: string;
    dateAt: number;
    parties: Array<{
      code: string;
      createdAt: number;
      firstActivityAt: number;
      lastActivityAt: number;
      durationMinutes: number;
      participantCount: number;
      participants: Array<{
        id: string;
        name: string;
        avatar?: string;
        firstSeenAt: number;
        lastSeenAt: number;
      }>;
    }>;
  }>;
};

type KaraokeAuditData = {
  generatedAt: number;
  updatedAt: number;
  knownSongs: number;
  alreadyTopic: number;
  alreadyOfficialAudio: number;
  alreadyCompatible: number;
  discoveredTopic: number;
  discoveredOfficialAudio: number;
  noOfficialAudio: number;
  auditedMissing: number;
  checkedSongs: number;
  unchecked: number;
  confirmedCompatible: number;
  confirmedCoveragePercent: number;
  checkedPercent: number;
  note: string;
  youtubeSearchesPerBatchMax: number;
  localScan?: {
    scannedAt: number;
    scannedSongs: number;
    directTopic: number;
    directOfficialAudio: number;
    alternativeTopic: number;
    alternativeOfficialAudio: number;
    topic: number;
    officialAudio: number;
    compatible: number;
    probableClip: number;
    indeterminate: number;
    unclassified: number;
    coveragePercent: number;
  };
  youtubeAudit?: {
    tested: number;
    foundTopic: number;
    foundOfficialAudio: number;
    notFound: number;
  };
};


type KaraokeLyricsAuditData = {
  generatedAt: number;
  updatedAt: number;
  knownSongs: number;
  eligibleSongs: number;
  checked: number;
  unchecked: number;
  synced: number;
  plain: number;
  instrumental: number;
  notFound: number;
  syncedCoverageCheckedPercent: number;
  syncedCoverageEligiblePercent: number;
  batchSizeMax: number;
  delayMs: number;
  note: string;
  job?: {
    running: boolean;
    requested: number;
    selected: number;
    searched: number;
    synced: number;
    plain: number;
    instrumental: number;
    notFound: number;
    errors: number;
    rateLimited: boolean;
    retryAfterSeconds: number;
    startedAt: number;
    finishedAt: number;
    message: string;
  };
};

type CoverFilter =
  | "downloaded"
  | "pending"
  | "active"
  | "exact"
  | "artist_fallback"
  | "not_found"
  | "error"
  | "unrequested";

type CoverLibrarySong = {
  videoId: string;
  title: string;
  artistName: string;
  albumName?: string;
  thumbnail: string;
  coverStatus?: "pending" | "found" | "not_found" | "error";
  coverUrl?: string;
  coverSource?: "APPLE_ITUNES" | "MUSICBRAINZ_CAA" | "APPLE_ARTIST_FALLBACK" | "MANUAL";
  coverWidth?: number;
  coverHeight?: number;
  coverLastCheckedAt?: number;
  coverAttempts: number;
  category: string;
  active: boolean;
};

const coverFilterLabels: Record<CoverFilter, string> = {
  downloaded: "Jaquettes téléchargées",
  pending: "En attente",
  active: "Téléchargements actifs",
  exact: "Correspondances exactes",
  artist_fallback: "Secours artiste",
  not_found: "Introuvables",
  error: "Erreurs",
  unrequested: "Pas encore recherchées",
};

const number = new Intl.NumberFormat("fr-FR");

export default function MusicBrainAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [liveUsers, setLiveUsers] = useState<LiveUsersData | null>(null);
  const [liveUsersError, setLiveUsersError] = useState("");
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryData | null>(null);
  const [attendanceHistoryError, setAttendanceHistoryError] = useState("");
  const [karaokeAudit, setKaraokeAudit] = useState<KaraokeAuditData | null>(null);
  const [karaokeAuditLoading, setKaraokeAuditLoading] = useState(false);
  const [karaokeLocalScanLoading, setKaraokeLocalScanLoading] = useState(false);
  const [karaokeAuditError, setKaraokeAuditError] = useState("");
  const [karaokeAuditMessage, setKaraokeAuditMessage] = useState("");
  const [karaokeLyricsAudit, setKaraokeLyricsAudit] = useState<KaraokeLyricsAuditData | null>(null);
  const [karaokeLyricsLoading, setKaraokeLyricsLoading] = useState(false);
  const [karaokeLyricsMessage, setKaraokeLyricsMessage] = useState("");
  const [karaokeLyricsError, setKaraokeLyricsError] = useState("");
  const [academyTestLoading, setAcademyTestLoading] = useState(false);
  const [academyTestMessage, setAcademyTestMessage] = useState("");
  const [academyTestError, setAcademyTestError] = useState("");


  const [maintenanceError, setMaintenanceError] = useState("");
  const [cleanupPreviewLoading, setCleanupPreviewLoading] = useState(false);
  const [cleanupRunLoading, setCleanupRunLoading] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<any | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleanupError, setCleanupError] = useState("");
  const [cleanupReviewFilter, setCleanupReviewFilter] = useState("all");
  const [cleanupReviewSearch, setCleanupReviewSearch] = useState("");
  const [artistRepairLoading, setArtistRepairLoading] = useState(false);
  const [artistRepairRunning, setArtistRepairRunning] = useState(false);
  const [artistRepairReport, setArtistRepairReport] = useState<any | null>(null);
  const [artistRepairMessage, setArtistRepairMessage] = useState("");
  const [artistRepairError, setArtistRepairError] = useState("");
  const [selectedReviewRepairs, setSelectedReviewRepairs] = useState<Record<string, boolean>>({});
  const [selectedReviewApplyLoading, setSelectedReviewApplyLoading] = useState(false);

  const [activeCoverFilter, setActiveCoverFilter] = useState<CoverFilter | null>(null);
  const [coverLibrary, setCoverLibrary] = useState<CoverLibrarySong[]>([]);
  const [coverLibraryTotal, setCoverLibraryTotal] = useState(0);
  const [coverLibraryLoading, setCoverLibraryLoading] = useState(false);
  const [coverLibraryError, setCoverLibraryError] = useState("");
  const [coverSearch, setCoverSearch] = useState("");
  const [coverActionVideoId, setCoverActionVideoId] = useState("");
  const [manualCoverVideoId, setManualCoverVideoId] = useState("");
  const [manualCoverUrl, setManualCoverUrl] = useState("");
  const [coverActionMessage, setCoverActionMessage] = useState("");



  async function loadLiveUsers() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/live-users`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Présences MixParty indisponibles");
      }
      setLiveUsers(data);
      setLiveUsersError("");
    } catch (err) {
      setLiveUsersError(
        err instanceof Error ? err.message : "Présences MixParty indisponibles"
      );
    }
  }


  async function loadAttendanceHistory() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/attendance-history`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Historique des soirées indisponible");
      }
      setAttendanceHistory(data);
      setAttendanceHistoryError("");
    } catch (err) {
      setAttendanceHistoryError(
        err instanceof Error ? err.message : "Historique des soirées indisponible"
      );
    }
  }

  async function loadKaraokeLyricsAudit() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/karaoke-lyrics-audit`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Audit paroles Karaoké indisponible");
      setKaraokeLyricsAudit(data);
      setKaraokeLyricsError("");
    } catch (err) {
      setKaraokeLyricsError(
        err instanceof Error ? err.message : "Audit paroles Karaoké indisponible"
      );
    }
  }

  async function runKaraokeLyricsAudit() {
    if (!adminToken.trim()) {
      setKaraokeLyricsError("Entre le code administrateur Railway pour lancer l’audit LRCLIB.");
      return;
    }

    setKaraokeLyricsLoading(true);
    setKaraokeLyricsError("");
    setKaraokeLyricsMessage("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/karaoke-lyrics-audit/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
        body: JSON.stringify({ limit: 100 }),
      });

      const text = await response.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          response.ok
            ? "Réponse serveur illisible."
            : `Erreur serveur ${response.status}.`
        );
      }

      if (!response.ok) throw new Error(data?.error || "Audit LRCLIB impossible");

      if (data?.summary) {
        setKaraokeLyricsAudit({
          ...data.summary,
          job: data.job,
        });
      }

      setKaraokeLyricsMessage(
        "Audit lancé en arrière-plan. La progression va se mettre à jour automatiquement."
      );
    } catch (err) {
      setKaraokeLyricsError(err instanceof Error ? err.message : "Audit LRCLIB impossible");
      setKaraokeLyricsLoading(false);
    }
  }

  async function loadKaraokeAudit() {
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/karaoke-audit`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Audit Karaoké indisponible");
      setKaraokeAudit(data);
      setKaraokeAuditError("");
    } catch (err) {
      setKaraokeAuditError(err instanceof Error ? err.message : "Audit Karaoké indisponible");
    }
  }

  async function scanMusicBrainForKaraoke() {
    setKaraokeLocalScanLoading(true);
    setKaraokeAuditError("");
    setKaraokeAuditMessage("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/karaoke-audit/scan-musicbrain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de scanner MusicBrain");
      if (data?.summary) setKaraokeAudit(data.summary);
      const scan = data?.localScan;
      setKaraokeAuditMessage(
        scan
          ? `Scan MusicBrain terminé : ${number.format(scan.scannedSongs)} morceaux analysés • ${number.format(scan.directTopic)} Topic directs • ${number.format(scan.directOfficialAudio)} Official Audio directs • ${number.format(scan.alternativeTopic + scan.alternativeOfficialAudio)} versions audio alternatives déjà retrouvées dans MusicBrain • ${number.format(scan.probableClip)} clips probables • ${number.format(scan.indeterminate)} indéterminés. Aucun quota YouTube utilisé.`
          : (data?.message || "Scan MusicBrain terminé.")
      );
    } catch (err) {
      setKaraokeAuditError(err instanceof Error ? err.message : "Scan MusicBrain indisponible");
    } finally {
      setKaraokeLocalScanLoading(false);
    }
  }

  async function runKaraokeAudit() {
    if (!adminToken.trim()) {
      setKaraokeAuditError("Entre le code administrateur Railway pour lancer les recherches YouTube.");
      return;
    }

    setKaraokeAuditLoading(true);
    setKaraokeAuditError("");
    setKaraokeAuditMessage("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/karaoke-audit/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
        body: JSON.stringify({ limit: 10 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de lancer l’audit Karaoké");

      if (data?.summary) setKaraokeAudit(data.summary);
      const batch = data?.batch;
      setKaraokeAuditMessage(
        batch
          ? `${batch.searched} morceau(x) vérifié(s) • ${batch.foundTopic} Topic • ${batch.foundOfficialAudio} Official Audio • ${batch.notFound} sans version trouvée${batch.errors ? ` • ${batch.errors} erreur(s)` : ""}.`
          : "Audit Karaoké terminé."
      );
    } catch (err) {
      setKaraokeAuditError(err instanceof Error ? err.message : "Audit Karaoké indisponible");
    } finally {
      setKaraokeAuditLoading(false);
    }
  }

  async function runAcademyTestOne() {
    if (!adminToken.trim()) {
      setAcademyTestError("Entre le code administrateur Railway dans la zone Karaoké / Maintenance avant de lancer le test.");
      return;
    }

    setAcademyTestLoading(true);
    setAcademyTestMessage("");
    setAcademyTestError("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/academy/test-one`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Test Academy impossible");

      setAcademyTestMessage(
        `${data?.message || "Test Academy terminé."} • Quota Academy restant : ${number.format(Number(data?.remaining ?? 0))}`
      );
      await loadStats();
      await loadKaraokeAudit();
    } catch (err) {
      setAcademyTestError(err instanceof Error ? err.message : "Test Academy impossible");
    } finally {
      setAcademyTestLoading(false);
    }
  }

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
    void loadStats();
    void loadLiveUsers();
    void loadAttendanceHistory();
    void loadKaraokeAudit();
    void loadKaraokeLyricsAudit();

    const liveTimer = window.setInterval(() => {
      void loadLiveUsers();
    }, 5_000);

    const historyTimer = window.setInterval(() => {
      void loadAttendanceHistory();
    }, 60_000);

    return () => {
      window.clearInterval(liveTimer);
      window.clearInterval(historyTimer);
    };
  }, []);

  useEffect(() => {
    const running = Boolean(karaokeLyricsAudit?.job?.running);

    if (!running) {
      if (karaokeLyricsLoading) {
        setKaraokeLyricsLoading(false);

        const job = karaokeLyricsAudit?.job;
        if (job?.finishedAt) {
          const rateText = job.rateLimited
            ? ` • LRCLIB demande une pause (${job.retryAfterSeconds}s)`
            : "";

          setKaraokeLyricsMessage(
            `${number.format(job.searched)} morceau(x) testé(s) • ${number.format(job.synced)} synchronisé(s) • ${number.format(job.plain)} paroles simples • ${number.format(job.instrumental)} instrumental(aux) • ${number.format(job.notFound)} sans résultat${rateText}.`
          );
        }
      }
      return;
    }

    setKaraokeLyricsLoading(true);

    const timer = window.setInterval(() => {
      void loadKaraokeLyricsAudit();
    }, 1200);

    return () => window.clearInterval(timer);
  }, [
    karaokeLyricsAudit?.job?.running,
    karaokeLyricsAudit?.job?.searched,
    karaokeLyricsAudit?.job?.finishedAt,
    karaokeLyricsLoading,
  ]);


  function toggleReviewRepair(videoId: string) {
    setSelectedReviewRepairs((current) => ({
      ...current,
      [videoId]: !current[videoId],
    }));
  }

  function selectAllReviewRepairs() {
    const items = Array.isArray(artistRepairReport?.reviewProposals)
      ? artistRepairReport.reviewProposals
      : [];

    const allSelected =
      items.length > 0 &&
      items.every((item: any) => selectedReviewRepairs[item.videoId]);

    if (allSelected) {
      setSelectedReviewRepairs({});
      return;
    }

    const next: Record<string, boolean> = {};
    for (const item of items) {
      next[item.videoId] = true;
    }
    setSelectedReviewRepairs(next);
  }

  async function applySelectedReviewRepairs() {
    if (!adminToken.trim()) {
      setArtistRepairError("Entre le code administrateur Railway avant de valider les corrections.");
      return;
    }

    const proposals = Array.isArray(artistRepairReport?.reviewProposals)
      ? artistRepairReport.reviewProposals
      : [];

    const selections = proposals
      .filter((item: any) => selectedReviewRepairs[item.videoId])
      .map((item: any) => ({
        videoId: item.videoId,
        proposedArtistName: item.proposedArtistName,
      }));

    if (!selections.length) {
      setArtistRepairError("Sélectionne au moins une proposition à valider.");
      return;
    }

    const confirmed = window.confirm(
      `Valider ${selections.length} correction(s) sélectionnée(s) ? Aucun morceau ne sera supprimé.`
    );
    if (!confirmed) return;

    setSelectedReviewApplyLoading(true);
    setArtistRepairError("");
    setArtistRepairMessage("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/maintenance/musicbrain-artist-repair/apply-selected`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
        body: JSON.stringify({ selections }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Validation des corrections impossible.");

      setArtistRepairMessage(data?.message || "Corrections sélectionnées validées.");
      setArtistRepairReport(data?.report || null);
      setSelectedReviewRepairs({});
      await loadStats();
      await loadKaraokeAudit();
      await previewMusicBrainCleanup();
    } catch (err) {
      setArtistRepairError(
        err instanceof Error ? err.message : "Validation des corrections impossible."
      );
    } finally {
      setSelectedReviewApplyLoading(false);
    }
  }

  async function previewMusicBrainArtistRepair() {
    if (!adminToken.trim()) {
      setArtistRepairError("Entre le code administrateur Railway avant d’analyser les artistes.");
      return;
    }

    setArtistRepairLoading(true);
    setArtistRepairError("");
    setArtistRepairMessage("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/maintenance/musicbrain-artist-repair/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Analyse des artistes impossible.");
      setArtistRepairReport(data?.report || null);
    } catch (err) {
      setArtistRepairError(err instanceof Error ? err.message : "Analyse des artistes impossible.");
    } finally {
      setArtistRepairLoading(false);
    }
  }

  async function runMusicBrainArtistRepair() {
    if (!adminToken.trim()) {
      setArtistRepairError("Entre le code administrateur Railway avant de réparer les artistes.");
      return;
    }

    const repairable = Number(artistRepairReport?.safeRepairCount || 0);
    if (repairable <= 0) {
      setArtistRepairError("Aucun artiste réparable automatiquement.");
      return;
    }

    const confirmed = window.confirm(
      `Appliquer ${repairable} réparation(s) sûre(s) ? Seules les propositions où le titre ET la chaîne confirment le même artiste seront modifiées. Aucun morceau ne sera supprimé.`
    );
    if (!confirmed) return;

    setArtistRepairRunning(true);
    setArtistRepairError("");
    setArtistRepairMessage("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/maintenance/musicbrain-artist-repair/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Réparation des artistes impossible.");

      setArtistRepairMessage(data?.message || "Réparation terminée.");
      setArtistRepairReport(data?.after || null);
      await loadStats();
      await loadKaraokeAudit();
      await previewMusicBrainCleanup();
    } catch (err) {
      setArtistRepairError(err instanceof Error ? err.message : "Réparation des artistes impossible.");
    } finally {
      setArtistRepairRunning(false);
    }
  }

  async function previewMusicBrainCleanup() {
    if (!adminToken.trim()) {
      setCleanupError("Entre le code administrateur Railway avant d’analyser MusicBrain.");
      return;
    }

    setCleanupPreviewLoading(true);
    setCleanupError("");
    setCleanupMessage("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/maintenance/musicbrain-cleanup/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Analyse MusicBrain impossible.");
      setCleanupReport(data?.report || null);
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : "Analyse MusicBrain impossible.");
    } finally {
      setCleanupPreviewLoading(false);
    }
  }

  async function runMusicBrainCleanup() {
    if (!adminToken.trim()) {
      setCleanupError("Entre le code administrateur Railway avant de nettoyer MusicBrain.");
      return;
    }

    const removable = Number(cleanupReport?.removableCount || 0);
    if (removable <= 0) {
      setCleanupError("Aucune entrée clairement douteuse à supprimer.");
      return;
    }

    const confirmed = window.confirm(
      `Supprimer ${removable} morceau(x) clairement douteux de MusicBrain ? Les morceaux simplement incertains ne seront pas supprimés.`
    );
    if (!confirmed) return;

    setCleanupRunLoading(true);
    setCleanupError("");
    setCleanupMessage("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/maintenance/musicbrain-cleanup/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partybrain-admin-token": adminToken.trim(),
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Nettoyage MusicBrain impossible.");

      setCleanupMessage(data?.message || "MusicBrain nettoyé.");
      setCleanupReport(data?.after || null);
      await loadStats();
      await loadKaraokeAudit();
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : "Nettoyage MusicBrain impossible.");
    } finally {
      setCleanupRunLoading(false);
    }
  }

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


  async function loadCoverLibrary(filter: CoverFilter, searchValue = coverSearch) {
    setActiveCoverFilter(filter);
    setCoverLibraryLoading(true);
    setCoverLibraryError("");
    setCoverActionMessage("");

    try {
      const params = new URLSearchParams({
        status: filter,
        limit: "10000",
      });
      if (searchValue.trim()) params.set("q", searchValue.trim());

      const response = await fetch(`${getApiBaseUrl()}/partybrain/covers?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de charger les jaquettes.");

      setCoverLibrary(Array.isArray(data?.items) ? data.items : []);
      setCoverLibraryTotal(Number(data?.total || 0));
    } catch (err) {
      setCoverLibraryError(err instanceof Error ? err.message : "Impossible de charger les jaquettes.");
    } finally {
      setCoverLibraryLoading(false);
    }
  }

  function closeCoverLibrary() {
    setActiveCoverFilter(null);
    setCoverLibrary([]);
    setCoverLibraryError("");
    setCoverActionMessage("");
    setManualCoverVideoId("");
    setManualCoverUrl("");
    setCoverSearch("");
  }

  function coverAdminHeaders() {
    return {
      "Content-Type": "application/json",
      "x-partybrain-admin-token": adminToken.trim(),
    };
  }

  async function retryCover(song: CoverLibrarySong) {
    if (!adminToken.trim()) {
      setCoverLibraryError("Entre d’abord le code administrateur Railway dans la zone Maintenance sécurisée.");
      return;
    }

    setCoverActionVideoId(song.videoId);
    setCoverLibraryError("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/covers/${encodeURIComponent(song.videoId)}/retry`, {
        method: "POST",
        headers: coverAdminHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de relancer la recherche.");
      setCoverActionMessage(data?.message || "Recherche relancée.");
      if (activeCoverFilter) await loadCoverLibrary(activeCoverFilter);
      await loadStats();
    } catch (err) {
      setCoverLibraryError(err instanceof Error ? err.message : "Impossible de relancer la recherche.");
    } finally {
      setCoverActionVideoId("");
    }
  }

  async function saveManualCover(song: CoverLibrarySong) {
    if (!adminToken.trim()) {
      setCoverLibraryError("Entre d’abord le code administrateur Railway dans la zone Maintenance sécurisée.");
      return;
    }
    if (!manualCoverUrl.trim()) {
      setCoverLibraryError("Colle l’URL complète de la nouvelle jaquette.");
      return;
    }

    setCoverActionVideoId(song.videoId);
    setCoverLibraryError("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/covers/${encodeURIComponent(song.videoId)}`, {
        method: "PUT",
        headers: coverAdminHeaders(),
        body: JSON.stringify({ coverUrl: manualCoverUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible d’enregistrer la jaquette.");
      setCoverActionMessage(data?.message || "Jaquette enregistrée.");
      setManualCoverVideoId("");
      setManualCoverUrl("");
      if (activeCoverFilter) await loadCoverLibrary(activeCoverFilter);
      await loadStats();
    } catch (err) {
      setCoverLibraryError(err instanceof Error ? err.message : "Impossible d’enregistrer la jaquette.");
    } finally {
      setCoverActionVideoId("");
    }
  }

  async function deleteCover(song: CoverLibrarySong) {
    if (!adminToken.trim()) {
      setCoverLibraryError("Entre d’abord le code administrateur Railway dans la zone Maintenance sécurisée.");
      return;
    }
    if (!window.confirm(`Supprimer la jaquette de « ${song.title} » ?`)) return;

    setCoverActionVideoId(song.videoId);
    setCoverLibraryError("");
    try {
      const response = await fetch(`${getApiBaseUrl()}/partybrain/covers/${encodeURIComponent(song.videoId)}`, {
        method: "DELETE",
        headers: coverAdminHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Impossible de supprimer la jaquette.");
      setCoverActionMessage(data?.message || "Jaquette supprimée.");
      if (activeCoverFilter) await loadCoverLibrary(activeCoverFilter);
      await loadStats();
    } catch (err) {
      setCoverLibraryError(err instanceof Error ? err.message : "Impossible de supprimer la jaquette.");
    } finally {
      setCoverActionVideoId("");
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

  const coverStats = stats?.covers ?? {
    downloaded: 0,
    pending: 0,
    active: 0,
    exactMatches: 0,
    artistFallback: 0,
    notFound: 0,
    errors: 0,
    unrequested: stats?.totals.songs ?? 0,
  };

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

  const cleanupReviewItems = Array.isArray(cleanupReport?.reviewItems) ? cleanupReport.reviewItems : [];
  const visibleCleanupReviewItems = cleanupReviewItems.filter((item: any) => {
    if (cleanupReviewFilter !== "all" && item.category !== cleanupReviewFilter) return false;
    const query = cleanupReviewSearch.trim().toLowerCase();
    if (!query) return true;
    return `${item.artistName || ""} ${item.title || ""} ${item.rawTitle || ""} ${item.channelTitle || ""}`
      .toLowerCase()
      .includes(query);
  });

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

            <section className="mb-7 rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/[0.08] to-violet-500/10 p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                    <UsersRound className="h-6 w-6" />
                    <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">MixParty en direct</p>
                    <h2 className="mt-1 text-2xl font-black">
                      {liveUsers?.totalUsers ?? 0} personne{(liveUsers?.totalUsers ?? 0) > 1 ? "s" : ""} connectée{(liveUsers?.totalUsers ?? 0) > 1 ? "s" : ""}
                    </h2>
                    <p className="mt-1 text-sm text-white/45">
                      {liveUsers?.activePartyCount ?? 0} soirée{(liveUsers?.activePartyCount ?? 0) > 1 ? "s" : ""} active{(liveUsers?.activePartyCount ?? 0) > 1 ? "s" : ""} • actualisation toutes les 5 secondes
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => void loadLiveUsers()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/15">
                  <RefreshCw className="h-4 w-4" />
                  Actualiser les connexions
                </button>
              </div>

              {liveUsersError ? (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{liveUsersError}</div>
              ) : !liveUsers?.parties.length ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/45">Aucune personne connectée pour le moment.</div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {liveUsers.parties.map((liveParty) => (
                    <article key={liveParty.code} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-emerald-300" />
                            <h3 className="font-black">Soirée {liveParty.code}</h3>
                          </div>
                          <p className="mt-1 text-xs text-white/40">
                            {liveParty.currentSong
                              ? `En lecture : ${liveParty.currentSong.title}${liveParty.currentSong.artistName ? ` — ${liveParty.currentSong.artistName}` : ""}`
                              : "Aucun morceau en lecture"}
                          </p>
                        </div>
                        <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">{liveParty.userCount} en ligne</span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {liveParty.users.map((user) => (
                          <div key={`${liveParty.code}-${user.id}`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-3">
                            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-emerald-300/25 bg-white/10">
                              {user.avatar ? (
                                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-xs font-black">{user.name.charAt(0).toUpperCase()}</div>
                              )}
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#101018] bg-emerald-400" />
                            </div>
                            <span className="text-sm font-bold text-white/85">{user.name}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>


            <section className="mb-7 rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/[0.07] to-cyan-500/[0.07] p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-400/15 text-violet-200">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-violet-300">
                      Historique des connexions
                    </p>
                    <h2 className="mt-1 text-2xl font-black">Les 7 derniers jours</h2>
                    <p className="mt-1 text-sm text-white/45">
                      {attendanceHistory?.totalParties ?? 0} soirée{(attendanceHistory?.totalParties ?? 0) > 1 ? "s" : ""} • {attendanceHistory?.totalParticipations ?? 0} participation{(attendanceHistory?.totalParticipations ?? 0) > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAttendanceHistory()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/15 bg-violet-400/10 px-4 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-400/15"
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualiser l’historique
                </button>
              </div>

              {attendanceHistoryError ? (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  {attendanceHistoryError}
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {(attendanceHistory?.days || []).map((day) => {
                    const dayDate = new Date(day.dateAt);
                    const label = dayDate.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    });
                    const uniqueNames = new Set(
                      day.parties.flatMap((party) =>
                        party.participants.map((participant) => participant.name.trim().toLocaleLowerCase("fr-FR"))
                      )
                    ).size;

                    return (
                      <article key={day.dateKey} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-lg font-black capitalize">{label}</h3>
                            <p className="mt-1 text-xs text-white/40">
                              {day.parties.length} soirée{day.parties.length > 1 ? "s" : ""} • {uniqueNames} personne{uniqueNames > 1 ? "s" : ""} différente{uniqueNames > 1 ? "s" : ""}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black text-white/55">
                            {day.parties.reduce((total, party) => total + party.participantCount, 0)} participation{day.parties.reduce((total, party) => total + party.participantCount, 0) > 1 ? "s" : ""}
                          </span>
                        </div>

                        {!day.parties.length ? (
                          <p className="mt-4 text-sm text-white/35">Aucune soirée enregistrée ce jour-là.</p>
                        ) : (
                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {day.parties.map((historyParty) => (
                              <div key={`${day.dateKey}-${historyParty.code}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-black">Soirée {historyParty.code}</p>
                                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/40">
                                      <Clock3 className="h-3.5 w-3.5" />
                                      {new Date(historyParty.firstActivityAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                      {" → "}
                                      {new Date(historyParty.lastActivityAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                      {" • "}
                                      {historyParty.durationMinutes} min
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-xs font-black text-violet-200">
                                    {historyParty.participantCount} personne{historyParty.participantCount > 1 ? "s" : ""}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {historyParty.participants.map((participant) => (
                                    <div
                                      key={`${historyParty.code}-${participant.id}`}
                                      className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1.5 pl-1.5 pr-3"
                                    >
                                      <div className="h-7 w-7 overflow-hidden rounded-full border border-violet-300/20 bg-white/10">
                                        {participant.avatar ? (
                                          <img src={participant.avatar} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="grid h-full w-full place-items-center text-[11px] font-black">
                                            {participant.name.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-xs font-bold text-white/80">{participant.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

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

            <section className="mb-7 rounded-[28px] border border-orange-400/20 bg-gradient-to-br from-orange-500/10 via-fuchsia-500/8 to-violet-500/10 p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.22em] text-orange-300">HD Cover System</p>
                  <h2 className="mt-1 text-2xl font-black">Bibliothèque de jaquettes</h2>
                  <p className="mt-2 text-sm text-white/45">Correspondance exacte artiste + titre, puis secours fiable du même artiste.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-white/55">
                  {number.format(coverStats.downloaded)} téléchargée(s)
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { filter: "downloaded" as CoverFilter, label: "Jaquettes téléchargées", value: coverStats.downloaded, tone: "text-emerald-300" },
                  { filter: "pending" as CoverFilter, label: "En attente", value: coverStats.pending, tone: "text-amber-300" },
                  { filter: "active" as CoverFilter, label: "Téléchargements actifs", value: coverStats.active, tone: "text-cyan-300" },
                  { filter: "exact" as CoverFilter, label: "Correspondances exactes", value: coverStats.exactMatches, tone: "text-fuchsia-300" },
                  { filter: "artist_fallback" as CoverFilter, label: "Secours artiste", value: coverStats.artistFallback, tone: "text-violet-300" },
                  { filter: "not_found" as CoverFilter, label: "Introuvables", value: coverStats.notFound, tone: "text-white/55" },
                  { filter: "error" as CoverFilter, label: "Erreurs", value: coverStats.errors, tone: "text-red-300" },
                  { filter: "unrequested" as CoverFilter, label: "Pas encore recherchées", value: coverStats.unrequested, tone: "text-white/40" },
                ].map(({ filter, label, value, tone }) => (
                  <button
                    type="button"
                    key={filter}
                    onClick={() => void loadCoverLibrary(filter, "")}
                    className="group rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-300/30 hover:bg-white/[0.06]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[.15em] text-white/35">{label}</p>
                    <p className={`mt-3 text-2xl font-black ${tone}`}>{number.format(Number(value))}</p>
                    <p className="mt-2 text-[10px] font-bold text-orange-200/0 transition group-hover:text-orange-200/70">Voir le détail →</p>
                  </button>
                ))}
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

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void runAcademyTestOne()}
                      disabled={academyTestLoading || stats.academy.running || stats.academy.remaining <= 0}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Search className={`h-4 w-4 ${academyTestLoading ? "animate-pulse" : ""}`} />
                      {academyTestLoading ? "Test Academy en cours…" : "Tester Academy — 1 recherche"}
                    </button>
                    <p className="mt-2 text-xs text-white/35">
                      Lance exactement une seule recherche avec la nouvelle logique. Le test consomme au maximum 1 recherche Academy.
                    </p>
                    {academyTestMessage ? (
                      <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-100">
                        {academyTestMessage}
                      </div>
                    ) : null}
                    {academyTestError ? (
                      <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-bold text-red-100">
                        {academyTestError}
                      </div>
                    ) : null}
                  </div>
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

            <section className="mt-7 rounded-[28px] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-violet-500/[0.08] to-cyan-500/[0.06] p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-pink-400/15 text-pink-200">
                    <Mic2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-pink-300">Projet Karaoké</p>
                    <h2 className="mt-1 text-2xl font-black">Audit Topic / Official Audio</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                      Cet outil est totalement séparé de la recherche normale MixParty. Il mesure combien de morceaux connus par MusicBrain disposent d’une version audio officielle exploitable pour un futur mode karaoké.
                    </p>
                  </div>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/25 p-4">
                  <button
                    type="button"
                    onClick={() => void scanMusicBrainForKaraoke()}
                    disabled={karaokeLocalScanLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-wait disabled:opacity-45"
                  >
                    <Database className={`h-4 w-4 ${karaokeLocalScanLoading ? "animate-pulse" : ""}`} />
                    {karaokeLocalScanLoading ? "Scan MusicBrain…" : "Scanner toute la base MusicBrain"}
                  </button>
                  <p className="mt-2 text-xs leading-5 text-cyan-100/45">
                    Étape 1 : analyse locale de toute la base. Aucun appel YouTube et aucun quota consommé.
                  </p>

                  <div className="my-4 h-px bg-white/10" />
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                    <KeyRound className="h-4 w-4 text-pink-300" />
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
                    onClick={() => void runKaraokeAudit()}
                    disabled={karaokeAuditLoading || (karaokeAudit?.unchecked ?? 0) <= 0}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-300/20 bg-pink-500/12 px-4 py-3 text-sm font-black text-pink-100 transition hover:bg-pink-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Search className={`h-4 w-4 ${karaokeAuditLoading ? "animate-pulse" : ""}`} />
                    {karaokeAuditLoading ? "Recherche en cours…" : "Étape 2 — chercher 10 morceaux sur YouTube"}
                  </button>
                  <p className="mt-2 text-xs leading-5 text-white/35">
                    Cette seconde étape ne sert que pour les morceaux que MusicBrain ne sait pas identifier comme Topic / Art Track / Official Audio.
                  </p>
                </div>
              </div>

              {karaokeAuditError ? (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">{karaokeAuditError}</div>
              ) : null}
              {karaokeAuditMessage ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{karaokeAuditMessage}</div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-white/40">Morceaux connus</p>
                  <p className="mt-2 text-3xl font-black">{number.format(karaokeAudit?.knownSongs ?? stats.totals.songs)}</p>
                </article>
                <article className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] p-4">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200/65">Audio trouvé dans MusicBrain</p>
                  <p className="mt-2 text-3xl font-black text-cyan-100">{number.format(karaokeAudit?.localScan?.compatible ?? karaokeAudit?.alreadyCompatible ?? 0)}</p>
                </article>
                <article className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.07] p-4">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-violet-200/65">À chercher sur YouTube</p>
                  <p className="mt-2 text-3xl font-black text-violet-100">{number.format(karaokeAudit?.localScan?.unclassified ?? karaokeAudit?.unchecked ?? 0)}</p>
                </article>
                <article className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] p-4">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-200/65">Couverture confirmée</p>
                  <p className="mt-2 text-3xl font-black text-emerald-100">{karaokeAudit?.confirmedCoveragePercent ?? 0} %</p>
                </article>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-cyan-300/15 bg-black/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">MusicBrain uniquement</p>
                      <p className="mt-1 text-sm font-black">
                        {number.format(karaokeAudit?.localScan?.scannedSongs ?? karaokeAudit?.knownSongs ?? stats.totals.songs)} morceaux analysés localement
                      </p>
                    </div>
                    <p className="text-xs font-bold text-cyan-200/60">Quota YouTube : 0</p>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Topic directs</span>
                      <strong className="mt-1 block text-base text-cyan-100">{number.format(karaokeAudit?.localScan?.directTopic ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Official Audio directs</span>
                      <strong className="mt-1 block text-base text-violet-100">{number.format(karaokeAudit?.localScan?.directOfficialAudio ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Alternatives Topic déjà connues</span>
                      <strong className="mt-1 block text-base text-cyan-100">{number.format(karaokeAudit?.localScan?.alternativeTopic ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Alternatives Official Audio déjà connues</span>
                      <strong className="mt-1 block text-base text-violet-100">{number.format(karaokeAudit?.localScan?.alternativeOfficialAudio ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Clips probables</span>
                      <strong className="mt-1 block text-base text-amber-100">{number.format(karaokeAudit?.localScan?.probableClip ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Indéterminés</span>
                      <strong className="mt-1 block text-base text-white/80">{number.format(karaokeAudit?.localScan?.indeterminate ?? 0)}</strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-pink-300/15 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Recherche YouTube séparée</p>
                  <p className="mt-1 text-sm font-black">Uniquement après le scan MusicBrain</p>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Testés sur YouTube</span>
                      <strong className="mt-1 block text-base">{number.format(karaokeAudit?.youtubeAudit?.tested ?? karaokeAudit?.auditedMissing ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Topic trouvés</span>
                      <strong className="mt-1 block text-base text-cyan-100">{number.format(karaokeAudit?.youtubeAudit?.foundTopic ?? karaokeAudit?.discoveredTopic ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Official Audio trouvés</span>
                      <strong className="mt-1 block text-base text-violet-100">{number.format(karaokeAudit?.youtubeAudit?.foundOfficialAudio ?? karaokeAudit?.discoveredOfficialAudio ?? 0)}</strong>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                      <span className="text-white/45">Sans résultat</span>
                      <strong className="mt-1 block text-base text-red-100">{number.format(karaokeAudit?.youtubeAudit?.notFound ?? karaokeAudit?.noOfficialAudio ?? 0)}</strong>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-white/35">{karaokeAudit?.note || "Chargement de l’audit Karaoké…"}</p>
                </div>
              </div>
            </section>


            <section className="mt-7 rounded-[28px] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/[0.09] via-violet-500/[0.07] to-cyan-500/[0.06] p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-400/15 text-fuchsia-200">
                    <Mic2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-300">
                      Karaoké Audit V2
                    </p>
                    <h2 className="mt-1 text-2xl font-black">Paroles synchronisées LRCLIB</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                      On mesure combien de morceaux propres de MusicBrain disposent réellement de paroles synchronisées. Cet audit ne consomme aucun quota YouTube.
                    </p>
                  </div>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/25 p-4">
                  <button
                    type="button"
                    onClick={() => void runKaraokeLyricsAudit()}
                    disabled={
                      karaokeLyricsLoading ||
                      (karaokeLyricsAudit?.unchecked ?? 1) <= 0
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/12 px-4 py-3 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Search className={`h-4 w-4 ${karaokeLyricsLoading ? "animate-pulse" : ""}`} />
                    {karaokeLyricsAudit?.job?.running
                      ? `Audit ${number.format(karaokeLyricsAudit.job.searched)} / ${number.format(karaokeLyricsAudit.job.selected || karaokeLyricsAudit.job.requested)}…`
                      : "Tester 100 morceaux sur LRCLIB"}
                  </button>
                  <p className="mt-2 text-xs leading-5 text-white/35">
                    {karaokeLyricsAudit?.job?.running
                      ? karaokeLyricsAudit.job.message
                      : "100 morceaux maximum par clic • environ 300 ms entre chaque requête • résultats sauvegardés pour ne pas rescanner les mêmes titres."}
                  </p>
                </div>
              </div>

              {karaokeLyricsError ? (
                <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                  {karaokeLyricsError}
                </div>
              ) : null}

              {karaokeLyricsMessage ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                  {karaokeLyricsMessage}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-white/40">Testés</p>
                  <p className="mt-2 text-3xl font-black">{number.format(karaokeLyricsAudit?.checked ?? 0)}</p>
                </article>
                <article className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-200/65">Synchronisés</p>
                  <p className="mt-2 text-3xl font-black text-emerald-100">{number.format(karaokeLyricsAudit?.synced ?? 0)}</p>
                </article>
                <article className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.07] p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-amber-200/65">Paroles simples</p>
                  <p className="mt-2 text-3xl font-black text-amber-100">{number.format(karaokeLyricsAudit?.plain ?? 0)}</p>
                </article>
                <article className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-200/65">Instrumentaux</p>
                  <p className="mt-2 text-3xl font-black text-cyan-100">{number.format(karaokeLyricsAudit?.instrumental ?? 0)}</p>
                </article>
                <article className="rounded-2xl border border-red-300/15 bg-red-500/[0.06] p-4">
                  <p className="text-xs font-black uppercase tracking-[.14em] text-red-200/65">Sans résultat</p>
                  <p className="mt-2 text-3xl font-black text-red-100">{number.format(karaokeLyricsAudit?.notFound ?? 0)}</p>
                </article>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-300">
                    Couverture LRCLIB
                  </p>
                  <p className="mt-2 text-4xl font-black text-fuchsia-100">
                    {karaokeLyricsAudit?.syncedCoverageCheckedPercent ?? 0} %
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    des morceaux déjà testés ont des paroles synchronisées.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">
                    Reste à tester
                  </p>
                  <p className="mt-2 text-4xl font-black text-cyan-100">
                    {number.format(karaokeLyricsAudit?.unchecked ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    sur {number.format(karaokeLyricsAudit?.eligibleSongs ?? 0)} morceaux jugés exploitables pour cet audit.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-white/35">
                {karaokeLyricsAudit?.note || "Chargement de l’audit LRCLIB…"}
              </p>
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

                  <div className="my-4 h-px bg-white/10" />

                  <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.06] p-4">
                    <p className="text-xs font-black uppercase tracking-[.18em] text-fuchsia-200/70">Nettoyage MusicBrain</p>
                    <p className="mt-2 text-xs leading-5 text-white/40">
                      Le nettoyage automatique ne supprime que les erreurs évidentes. Une faible confiance, QUERY_FALLBACK ou une chaîne différente ne suffit jamais à classer un artiste comme douteux si le titre YouTube confirme déjà son nom.
                    </p>

                    <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.06] p-4">
                      <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-200/75">
                        Réparation des artistes mal attribués
                      </p>
                      <p className="mt-2 text-xs leading-5 text-white/40">
                        DA, ART et autres noms suspects ne sont jamais supprimés automatiquement. PartyBrain sépare maintenant les réparations sûres des simples propositions. Une réparation automatique exige maintenant deux signaux indépendants concordants : le titre YouTube doit identifier l’artiste ET la chaîne doit confirmer le même artiste. Une chaîne Topic seule reste à vérifier.
                      </p>

                      <button
                        type="button"
                        onClick={() => void previewMusicBrainArtistRepair()}
                        disabled={artistRepairLoading || artistRepairRunning}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2.5 text-xs font-black text-emerald-100 disabled:opacity-40"
                      >
                        <Search className={`h-3.5 w-3.5 ${artistRepairLoading ? "animate-pulse" : ""}`} />
                        {artistRepairLoading ? "Analyse des artistes…" : "Analyser les artistes mal attribués"}
                      </button>

                      {artistRepairReport ? (
                        <div className="mt-3">
                          <div className="grid gap-2 sm:grid-cols-4">
                            <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                              <p className="text-[10px] uppercase text-white/35">Suspects</p>
                              <p className="mt-1 text-xl font-black">{number.format(artistRepairReport.suspiciousCount || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-300/15 bg-emerald-500/[0.07] p-3">
                              <p className="text-[10px] uppercase text-emerald-200/55">Réparations sûres</p>
                              <p className="mt-1 text-xl font-black text-emerald-100">{number.format(artistRepairReport.safeRepairCount || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-amber-300/15 bg-amber-500/[0.06] p-3">
                              <p className="text-[10px] uppercase text-amber-200/55">Propositions à vérifier</p>
                              <p className="mt-1 text-xl font-black text-amber-100">{number.format(artistRepairReport.reviewProposalCount || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                              <p className="text-[10px] uppercase text-white/35">Non résolus</p>
                              <p className="mt-1 text-xl font-black">{number.format(artistRepairReport.unresolvedCount || 0)}</p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <p className="text-[11px] font-black uppercase tracking-[.15em] text-emerald-200/70">Réparations sûres — double confirmation</p>
                            <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                              {(artistRepairReport.safeRepairs || []).slice(0, 100).map((item: any) => (
                                <article key={item.videoId} className="rounded-xl border border-emerald-300/10 bg-emerald-500/[0.04] p-3">
                                  <p className="truncate text-xs font-black text-white">{item.rawTitle || item.title}</p>
                                  <p className="mt-1 text-xs">
                                    <span className="text-red-200/70">{item.currentArtistName}</span>
                                    <span className="mx-2 text-white/25">→</span>
                                    <strong className="text-emerald-200">{item.proposedArtistName}</strong>
                                  </p>
                                  <p className="mt-1 text-[10px] text-white/35">
                                    {item.sourceLabel} • confiance {Math.round(Number(item.confidence || 0))} %
                                  </p>
                                  <p className="mt-1 text-[10px] text-emerald-100/55">{item.reason}</p>
                                </article>
                              ))}
                              {!artistRepairReport.safeRepairs?.length ? (
                                <p className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-white/35">Aucune réparation sûre détectée.</p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[.15em] text-amber-200/70">
                                  Propositions à vérifier — validation manuelle
                                </p>
                                <p className="mt-1 text-[10px] text-white/35">
                                  Coche uniquement les corrections que tu confirmes toi-même.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => selectAllReviewRepairs()}
                                disabled={!artistRepairReport.reviewProposals?.length}
                                className="rounded-xl border border-amber-300/15 bg-amber-500/[0.06] px-3 py-2 text-[10px] font-black text-amber-100 disabled:opacity-40"
                              >
                                {(artistRepairReport.reviewProposals || []).length > 0 &&
                                (artistRepairReport.reviewProposals || []).every(
                                  (item: any) => selectedReviewRepairs[item.videoId]
                                )
                                  ? "Tout désélectionner"
                                  : "Tout sélectionner"}
                              </button>
                            </div>

                            <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
                              {(artistRepairReport.reviewProposals || []).map((item: any) => {
                                const selected = Boolean(selectedReviewRepairs[item.videoId]);
                                return (
                                  <article
                                    key={item.videoId}
                                    className={`rounded-xl border p-3 transition ${
                                      selected
                                        ? "border-amber-300/35 bg-amber-500/[0.10]"
                                        : "border-amber-300/10 bg-amber-500/[0.04]"
                                    }`}
                                  >
                                    <label className="flex cursor-pointer items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => toggleReviewRepair(item.videoId)}
                                        className="mt-1 h-4 w-4 shrink-0 accent-amber-400"
                                      />

                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-black text-white">
                                          {item.rawTitle || item.title}
                                        </p>
                                        <p className="mt-1 text-xs">
                                          <span className="text-red-200/70">{item.currentArtistName}</span>
                                          <span className="mx-2 text-white/25">→</span>
                                          <strong className="text-amber-200">{item.proposedArtistName}</strong>
                                        </p>
                                        <p className="mt-1 text-[10px] text-white/35">
                                          {item.sourceLabel} • confiance {Math.round(Number(item.confidence || 0))} %
                                        </p>
                                        <p className="mt-1 text-[10px] text-amber-100/55">{item.reason}</p>
                                      </div>
                                    </label>
                                  </article>
                                );
                              })}

                              {!artistRepairReport.reviewProposals?.length ? (
                                <p className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-white/35">
                                  Aucune proposition manuelle.
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-[11px] text-white/40">
                                {number.format(
                                  Object.values(selectedReviewRepairs).filter(Boolean).length
                                )} sélectionnée(s)
                              </p>

                              <button
                                type="button"
                                onClick={() => void applySelectedReviewRepairs()}
                                disabled={
                                  selectedReviewApplyLoading ||
                                  Object.values(selectedReviewRepairs).filter(Boolean).length <= 0
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-500/15 px-4 py-2.5 text-xs font-black text-amber-100 disabled:opacity-40"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {selectedReviewApplyLoading
                                  ? "Validation en cours…"
                                  : `Valider ${number.format(
                                      Object.values(selectedReviewRepairs).filter(Boolean).length
                                    )} sélectionnée(s)`}
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void runMusicBrainArtistRepair()}
                            disabled={artistRepairRunning || artistRepairLoading || Number(artistRepairReport.safeRepairCount || 0) <= 0}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/15 px-3 py-2.5 text-xs font-black text-emerald-100 disabled:opacity-40"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${artistRepairRunning ? "animate-spin" : ""}`} />
                            {artistRepairRunning
                              ? "Réparation en cours…"
                              : `Appliquer ${number.format(artistRepairReport.safeRepairCount || 0)} réparation(s) sûre(s)`}
                          </button>
                        </div>
                      ) : null}

                      {artistRepairMessage ? <p className="mt-3 text-xs font-bold text-emerald-300">{artistRepairMessage}</p> : null}
                      {artistRepairError ? <p className="mt-3 text-xs font-bold text-red-300">{artistRepairError}</p> : null}
                    </div>

                    <div className="my-4 h-px bg-white/10" />

                    <button
                      type="button"
                      onClick={() => void previewMusicBrainCleanup()}
                      disabled={cleanupPreviewLoading || cleanupRunLoading}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2.5 text-xs font-black text-cyan-100 disabled:opacity-40"
                    >
                      <Search className={`h-3.5 w-3.5 ${cleanupPreviewLoading ? "animate-pulse" : ""}`} />
                      {cleanupPreviewLoading ? "Analyse en cours…" : "Analyser avant nettoyage"}
                    </button>

                    {cleanupReport ? (
                      <>
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
                          <p><strong className="text-white">{number.format(cleanupReport.removableCount || 0)}</strong> morceau(x) supprimable(s) automatiquement</p>
                          <p className="mt-1"><strong className="text-white">{number.format(cleanupReport.reviewOnlyCount || 0)}</strong> entrée(s) incertaine(s) conservée(s)</p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-white/35">
                            <span>Inconnus : {number.format(cleanupReport.counts?.artiste_inconnu || 0)}</span>
                            <span>Génériques : {number.format(cleanupReport.counts?.artiste_generique || 0)}</span>
                            <span>Non musicaux : {number.format(cleanupReport.counts?.contenu_non_musical || 0)}</span>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-violet-300/15 bg-violet-500/[0.05] p-3">
                          <p className="text-[11px] font-black uppercase tracking-[.16em] text-violet-200/70">
                            Entrées réellement ambiguës — aucune suppression
                          </p>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                              ["artiste_probablement_mal_attribue", "Artiste probablement mal attribué"],
                              ["nom_artiste_tres_court", "Nom artiste très court"],
                              ["query_fallback", "Artiste déduit de la recherche"],
                              ["confiance_tres_faible", "Confiance très faible"],
                              ["confiance_faible", "Confiance faible"],
                              ["chaine_non_coherente", "Chaîne non cohérente"],
                              ["identite_non_confirmee", "Identité non confirmée"],
                            ].map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setCleanupReviewFilter(cleanupReviewFilter === key ? "all" : key)}
                                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                                  cleanupReviewFilter === key
                                    ? "border-violet-300/35 bg-violet-400/15 text-violet-100"
                                    : "border-white/8 bg-black/20 text-white/55 hover:bg-white/[0.05]"
                                }`}
                              >
                                <span>{label}</span>
                                <strong className="text-white">
                                  {number.format(cleanupReport.reviewCategoryCounts?.[key] || 0)}
                                </strong>
                              </button>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                              <Search className="h-3.5 w-3.5 text-cyan-300" />
                              <input
                                value={cleanupReviewSearch}
                                onChange={(event) => setCleanupReviewSearch(event.target.value)}
                                placeholder="Rechercher artiste, morceau ou chaîne…"
                                className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/25"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setCleanupReviewFilter("all");
                                setCleanupReviewSearch("");
                              }}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/55"
                            >
                              Tout afficher
                            </button>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-white/35">
                            <span>{number.format(visibleCleanupReviewItems.length)} entrée(s) affichée(s)</span>
                            <span>Ces morceaux restent dans MusicBrain</span>
                          </div>

                          <div className="mt-2 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                            {visibleCleanupReviewItems.map((item: any) => (
                              <article key={item.videoId} className="rounded-xl border border-white/8 bg-black/25 p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-white">{item.title || "Titre inconnu"}</p>
                                    <p className="mt-0.5 truncate text-xs font-bold text-cyan-200/80">
                                      Artiste détecté : {item.artistName || "—"}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full border border-violet-300/15 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black text-violet-100">
                                    {item.categoryLabel}
                                  </span>
                                </div>

                                <div className="mt-2 grid gap-1 text-[11px] text-white/40">
                                  <p><span className="text-white/60">Chaîne YouTube :</span> {item.channelTitle || "non enregistrée"}</p>
                                  <p>
                                    <span className="text-white/60">Source :</span> {item.metadataSource || "—"}
                                    {" • "}
                                    <span className="text-white/60">Confiance :</span> {Math.round(Number(item.metadataConfidence || 0))} %
                                  </p>
                                  {item.rawTitle && item.rawTitle !== item.title ? (
                                    <p className="truncate"><span className="text-white/60">Titre YouTube :</span> {item.rawTitle}</p>
                                  ) : null}
                                  <p className="text-amber-100/60">{item.explanation}</p>
                                  <p className="text-white/25">
                                    Recherches {number.format(item.searchCount || 0)} • Ajouts {number.format(item.addedCount || 0)} • Lectures {number.format(item.playedCount || 0)} • Votes {number.format(item.voteCount || 0)}
                                  </p>
                                </div>
                              </article>
                            ))}

                            {!visibleCleanupReviewItems.length ? (
                              <p className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-white/35">
                                Aucune entrée dans ce filtre.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void runMusicBrainCleanup()}
                      disabled={cleanupRunLoading || cleanupPreviewLoading || Number(cleanupReport?.removableCount || 0) <= 0}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-xs font-black text-red-100 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {cleanupRunLoading
                        ? "Nettoyage MusicBrain…"
                        : `Nettoyer ${number.format(cleanupReport?.removableCount || 0)} entrée(s)`}
                    </button>

                    {cleanupMessage ? <p className="mt-3 text-xs font-bold text-emerald-300">{cleanupMessage}</p> : null}
                    {cleanupError ? <p className="mt-3 text-xs font-bold text-red-300">{cleanupError}</p> : null}
                  </div>

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

      {activeCoverFilter ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
          <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-orange-300/20 bg-[#100817] shadow-[0_30px_100px_rgba(0,0,0,.65)]">
            <header className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[.22em] text-orange-300">Bibliothèque de jaquettes</p>
                <h2 className="mt-1 text-2xl font-black">{coverFilterLabels[activeCoverFilter]}</h2>
                <p className="mt-1 text-sm text-white/45">{number.format(coverLibraryTotal)} morceau(x) dans cette catégorie</p>
              </div>
              <button
                type="button"
                onClick={closeCoverLibrary}
                className="grid h-11 w-11 place-items-center self-end rounded-2xl border border-white/10 bg-white/5 text-xl font-black text-white/70 hover:bg-white/10 sm:self-auto"
                aria-label="Fermer"
              >
                ×
              </button>
            </header>

            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:p-5">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  value={coverSearch}
                  onChange={(event) => setCoverSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && activeCoverFilter) void loadCoverLibrary(activeCoverFilter, coverSearch);
                  }}
                  placeholder="Rechercher un titre ou un artiste…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
                />
              </label>
              <button
                type="button"
                onClick={() => activeCoverFilter && void loadCoverLibrary(activeCoverFilter, coverSearch)}
                className="rounded-2xl border border-orange-300/20 bg-orange-500/10 px-5 py-3 text-sm font-black text-orange-100 hover:bg-orange-500/15"
              >
                Rechercher
              </button>
            </div>

            {coverLibraryError ? <p className="mx-5 mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm font-bold text-red-200">{coverLibraryError}</p> : null}
            {coverActionMessage ? <p className="mx-5 mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200">{coverActionMessage}</p> : null}

            <div className="overflow-y-auto p-4 sm:p-5">
              {coverLibraryLoading ? (
                <div className="py-16 text-center text-white/50">
                  <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin" />
                  Chargement des morceaux…
                </div>
              ) : coverLibrary.length ? (
                <div className="space-y-3">
                  {coverLibrary.map((song) => {
                    const preview = song.coverUrl || song.thumbnail || "/branding/icon.png";
                    const isEditing = manualCoverVideoId === song.videoId;
                    const isWorking = coverActionVideoId === song.videoId;

                    return (
                      <article key={song.videoId} className="rounded-2xl border border-white/10 bg-black/25 p-3 sm:p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                          <img src={preview} alt="" className="h-24 w-24 shrink-0 rounded-2xl border border-white/10 object-cover" />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-black">{song.title}</h3>
                            <p className="mt-1 truncate text-sm text-fuchsia-200/75">{song.artistName || "Artiste inconnu"}</p>
                            {song.albumName ? <p className="mt-1 truncate text-xs text-cyan-200/50">Album : {song.albumName}</p> : null}
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.12em]">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/55">
                                {song.coverSource === "APPLE_ITUNES" ? "Apple exact" :
                                 song.coverSource === "MUSICBRAINZ_CAA" ? "MusicBrainz exact" :
                                 song.coverSource === "APPLE_ARTIST_FALLBACK" ? "Secours artiste" :
                                 song.coverSource === "MANUAL" ? "Ajout manuel" :
                                 song.active ? "Recherche active" :
                                 song.coverStatus || "Non recherchée"}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/40">
                                {song.coverAttempts} tentative(s)
                              </span>
                              {song.coverLastCheckedAt ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/40">
                                  {new Date(song.coverLastCheckedAt).toLocaleString("fr-FR")}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:max-w-[410px] lg:justify-end">
                            <button
                              type="button"
                              onClick={() => void retryCover(song)}
                              disabled={isWorking || song.active}
                              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-40"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isWorking ? "animate-spin" : ""}`} />
                              Relancer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setManualCoverVideoId(isEditing ? "" : song.videoId);
                                setManualCoverUrl(isEditing ? "" : song.coverUrl || "");
                              }}
                              disabled={isWorking}
                              className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-black text-fuchsia-100 disabled:opacity-40"
                            >
                              {song.coverUrl ? "Modifier l’URL" : "Ajouter une jaquette"}
                            </button>
                            {song.coverUrl ? (
                              <button
                                type="button"
                                onClick={() => void deleteCover(song)}
                                disabled={isWorking}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
                            <input
                              value={manualCoverUrl}
                              onChange={(event) => setManualCoverUrl(event.target.value)}
                              placeholder="https://adresse-de-la-jaquette.jpg"
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none placeholder:text-white/25"
                            />
                            <button
                              type="button"
                              onClick={() => void saveManualCover(song)}
                              disabled={isWorking}
                              className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
                            >
                              Enregistrer
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-white/40">Aucun morceau dans cette catégorie.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}

    </main>
  );
}
