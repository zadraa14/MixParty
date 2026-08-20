"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, Database, KeyRound, Mic2, Music2, Network, PencilLine, RefreshCw, Search, ShieldCheck, Sparkles, ThumbsUp, Timer, Trash2, Upload, UserRound, UsersRound, Wifi, type LucideIcon } from "lucide-react";
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



type PublicationQualitySummary = {
  generatedAt: number;
  ready: number;
  review: number;
  blocked: number;
  total: number;
  karaokeSyncedReady: number;
  karaokeSyncedReview: number;
  karaokeSyncedBlocked: number;
  karaokeSyncedTotal: number;
  autoValidated: number;
  autoFixable: number;
  manualReview: number;
  secondPassValidated: number;
  thirdPassResolved: number;
  karaokeAutoFixable: number;
  karaokeManualReview: number;
};

type PublicationQualityItem = {
  videoId: string;
  title: string;
  rawTitle: string;
  artistName: string;
  channelTitle: string;
  thumbnail: string;
  metadataSource?: string | null;
  metadataConfidence: number;
  searchCount: number;
  addedCount: number;
  playedCount: number;
  voteCount: number;
  publicationStatus: "ready" | "review" | "blocked";
  publicationReason: string;
  proposedArtistName?: string;
  consensusResolution: "auto_validated" | "auto_fixable" | "manual_review" | "blocked";
  consensusConfidence: number;
  consensusSignals: string[];
  automaticAction?: "none" | "validate" | "correct";
  manualReviewCategory?: string | null;
  thirdPassResolution?: "auto_validated" | "auto_fixable" | "manual_review" | "blocked";
  karaokeSynced: boolean;
  lrclibArtistName?: string;
  lrclibTrackName?: string;
};

type PublicationQualityResponse = {
  generatedAt: number;
  status: "ready" | "review" | "blocked" | "all";
  query: string;
  total: number;
  returned: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset?: number | null;
  summary: PublicationQualitySummary;
  items: PublicationQualityItem[];
};

type MusicBrainDiagnosticData = {
  generatedAt: number;
  thirdPassAutoFixable: number;
  thirdPassAutoValidated: number;
  thirdPassResolved: number;
  stillManual: number;
  categories: Array<{
    key: string;
    label: string;
    count: number;
    examples: Array<{
      videoId: string;
      title: string;
      artistName: string;
      channelTitle: string;
      metadataSource: string;
      metadataConfidence: number;
      proposedArtistName?: string;
      confidence: number;
      karaokeSynced: boolean;
      lrclibArtistName?: string;
    }>;
  }>;
};

type MusicBrainAutoAcceptV35Preview = {
  generatedAt: number;
  validateCurrent: number;
  correctArtist: number;
  autoAcceptable: number;
  stillManual: number;
  totalReviewed: number;
  policy: {
    minimumProposalConfidence: number;
    note: string;
  };
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



type KaraokeReadySong = {
  videoId: string;
  title: string;
  rawTitle: string;
  artistName: string;
  thumbnail: string;
  durationSeconds: number;
  lrclibId: number | null;
  checkedAt: number;
  matchedTrackName: string;
  matchedArtistName: string;
  matchedAlbumName: string;
};

type KaraokeReadySongsResponse = {
  totalReady: number;
  matched: number;
  returned: number;
  query: string;
  items: KaraokeReadySong[];
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



type MusicBrainArtistAdminItem = {
  key: string;
  name: string;
  aliases: string[];
  songCount: number;
  searchCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
  suspicious: boolean;
  tier: "trash" | "high" | "review" | "valid";
  suspicionScore: number;
  reasons: string[];
  positiveSignals: string[];
  lowConfidenceSongs: number;
  highConfidenceSongs: number;
  fallbackSongs: number;
  strongMetadataSongs: number;
  playedSongs: number;
  addedSongs: number;
  totalActivity: number;
  examples: Array<{
    videoId: string;
    title: string;
    rawTitle: string;
    thumbnail: string;
    metadataConfidence: number;
    metadataSource?: string | null;
    playedCount: number;
    addedCount: number;
    voteCount: number;
  }>;
};

type MusicBrainArtistsResponse = {
  generatedAt: number;
  filter: "trash" | "high" | "review" | "valid" | "all";
  query: string;
  total: number;
  returned: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset?: number | null;
  summary: {
    totalArtists: number;
    trashArtists: number;
    highRiskArtists: number;
    reviewArtists: number;
    validArtists: number;
    blockedArtists: number;
  };
  items: MusicBrainArtistAdminItem[];
};

type MusicBrainRenameIssue =
  | "titre_youtube_brut"
  | "titre_avec_balise_video"
  | "artiste_dans_le_titre"
  | "artiste_suspect"
  | "metadata_faible"
  | "query_fallback"
  | "correction_suggeree";

type MusicBrainRenameItem = {
  videoId: string;
  title: string;
  rawTitle: string;
  artistName: string;
  channelTitle: string;
  thumbnail: string;
  youtubeThumbnail: string;
  albumName?: string;
  metadataSource?: string | null;
  metadataConfidence: number;
  searchCount: number;
  addedCount: number;
  playedCount: number;
  voteCount: number;
  issues: MusicBrainRenameIssue[];
  proposedTitle: string;
  proposedArtistName: string;
  artistProposalConfidence: number;
  artistProposalSource: string;
  manuallyRenamed: boolean;
  manualRenamedAt: number;
};

type MusicBrainRenameResponse = {
  generatedAt: number;
  filter: "issues" | "all" | "renamed";
  query: string;
  total: number;
  returned: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset?: number | null;
  summary: {
    totalSongs: number;
    issues: number;
    renamed: number;
    safeAutoRename: number;
  };
  items: MusicBrainRenameItem[];
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

// Karaoké is intentionally paused. Keep the code below intact for later.
const KARAOKE_ENABLED = false;


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
  const [karaokeReadySongs, setKaraokeReadySongs] = useState<KaraokeReadySongsResponse | null>(null);
  const [karaokeReadySearch, setKaraokeReadySearch] = useState("");
  const [karaokeReadyLoading, setKaraokeReadyLoading] = useState(false);
  const [academyTestLoading, setAcademyTestLoading] = useState(false);
  const [academyTestMessage, setAcademyTestMessage] = useState("");
  const [academyTestError, setAcademyTestError] = useState("");
  const [syncEngineTestVideoId, setSyncEngineTestVideoId] = useState("");
  const [syncEngineTestMessage, setSyncEngineTestMessage] = useState("");
  const [syncEngineTestError, setSyncEngineTestError] = useState("");
  const [syncEngineResults, setSyncEngineResults] = useState<Record<string, any>>({});
  const [syncEngineDiagnosticOpen, setSyncEngineDiagnosticOpen] = useState<Record<string, boolean>>({});
  const [benchmarkConfig, setBenchmarkConfig] = useState<any>(null);
  const [benchmarkCampaign, setBenchmarkCampaign] = useState<any>(null);
  const [benchmarkCampaignId, setBenchmarkCampaignId] = useState("");
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");




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
  const [publicationQuality, setPublicationQuality] =
    useState<PublicationQualityResponse | null>(null);
  const [publicationQualityLoading, setPublicationQualityLoading] = useState(false);
  const [publicationQualityError, setPublicationQualityError] = useState("");
  const [publicationQualityFilter, setPublicationQualityFilter] =
    useState<"review" | "ready" | "blocked" | "all">("review");
  const [publicationQualitySearch, setPublicationQualitySearch] = useState("");

  const [qualityDiagnostic, setQualityDiagnostic] =
    useState<MusicBrainDiagnosticData | null>(null);
  const [qualityDiagnosticLoading, setQualityDiagnosticLoading] = useState(false);
  const [qualityDiagnosticError, setQualityDiagnosticError] = useState("");
  const [selectedDiagnosticCategory, setSelectedDiagnosticCategory] = useState<string | null>(null);
  const [selectedDiagnosticItems, setSelectedDiagnosticItems] = useState<Record<string, boolean>>({});
  const [diagnosticValidationLoading, setDiagnosticValidationLoading] = useState(false);
  const [diagnosticValidationMessage, setDiagnosticValidationMessage] = useState("");
  const [diagnosticValidationError, setDiagnosticValidationError] = useState("");

  const [autoFixLoading, setAutoFixLoading] = useState(false);
  const [autoFixMessage, setAutoFixMessage] = useState("");
  const [autoFixError, setAutoFixError] = useState("");
  const [autoAcceptV35, setAutoAcceptV35] = useState<MusicBrainAutoAcceptV35Preview | null>(null);
  const [autoAcceptV35Loading, setAutoAcceptV35Loading] = useState(false);
  const [autoAcceptV35Message, setAutoAcceptV35Message] = useState("");
  const [autoAcceptV35Error, setAutoAcceptV35Error] = useState("");

  const [artistAdminData, setArtistAdminData] = useState<MusicBrainArtistsResponse | null>(null);
  const [artistAdminLoading, setArtistAdminLoading] = useState(false);
  const [artistAdminError, setArtistAdminError] = useState("");
  const [artistAdminMessage, setArtistAdminMessage] = useState("");
  const [artistAdminFilter, setArtistAdminFilter] = useState<"trash" | "high" | "review" | "valid" | "all">("trash");
  const [artistAdminSearch, setArtistAdminSearch] = useState("");
  const [artistDeleteKey, setArtistDeleteKey] = useState("");
  const [selectedArtistKeys, setSelectedArtistKeys] = useState<Record<string, boolean>>({});
  const [artistBulkDeleteLoading, setArtistBulkDeleteLoading] = useState(false);

  const [renameData, setRenameData] = useState<MusicBrainRenameResponse | null>(null);
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [renameMessage, setRenameMessage] = useState("");
  const [renameFilter, setRenameFilter] = useState<"issues" | "all" | "renamed">("issues");
  const [renameSearch, setRenameSearch] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<
    Record<string, { title: string; artistName: string }>
  >({});
  const [renameSavingVideoId, setRenameSavingVideoId] = useState("");
  const [renameAutoLoading, setRenameAutoLoading] = useState(false);

  const [activeAdminTab, setActiveAdminTab] = useState<
    | "overview"
    | "catalog"
    | "quality"
    | "artists"
    | "rename"
    | "karaoke"
    | "covers"
    | "academy"
    | "activity"
    | "maintenance"
  >("overview");



  async function loadMusicBrainQualityDiagnostic() {
    setQualityDiagnosticLoading(true);
    setQualityDiagnosticError("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/musicbrain-quality/diagnostic`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Diagnostic MusicBrain indisponible");
      }

      setQualityDiagnostic(data);
    } catch (err) {
      setQualityDiagnosticError(
        err instanceof Error ? err.message : "Diagnostic MusicBrain indisponible"
      );
    } finally {
      setQualityDiagnosticLoading(false);
    }
  }

  function toggleDiagnosticItem(videoId: string) {
    setSelectedDiagnosticItems((current) => ({
      ...current,
      [videoId]: !current[videoId],
    }));
  }

  function toggleAllVisibleDiagnosticItems() {
    const items = publicationQuality?.items || [];
    if (!items.length) return;

    const allSelected = items.every(
      (item) => selectedDiagnosticItems[item.videoId]
    );

    if (allSelected) {
      setSelectedDiagnosticItems({});
      return;
    }

    const next: Record<string, boolean> = {};
    for (const item of items) next[item.videoId] = true;
    setSelectedDiagnosticItems(next);
  }

  async function validateDiagnosticCategory(mode: "selected" | "all") {
    if (!adminToken.trim()) {
      setDiagnosticValidationError(
        "Entre le code administrateur Railway avant de valider."
      );
      return;
    }

    if (!selectedDiagnosticCategory) {
      setDiagnosticValidationError("Choisis d’abord une catégorie.");
      return;
    }

    const selectedIds = Object.entries(selectedDiagnosticItems)
      .filter(([, checked]) => checked)
      .map(([videoId]) => videoId);

    if (mode === "selected" && !selectedIds.length) {
      setDiagnosticValidationError("Sélectionne au moins un morceau.");
      return;
    }

    const categoryLabel =
      qualityDiagnostic?.categories.find(
        (category) => category.key === selectedDiagnosticCategory
      )?.label || selectedDiagnosticCategory;

    const count =
      mode === "all"
        ? Number(publicationQuality?.total || 0)
        : selectedIds.length;

    const confirmed = window.confirm(
      mode === "all"
        ? `Valider les ${count} morceau(x) de « ${categoryLabel} » ?`
        : `Valider les ${count} morceau(x) sélectionné(s) dans « ${categoryLabel} » ?`
    );

    if (!confirmed) return;

    setDiagnosticValidationLoading(true);
    setDiagnosticValidationMessage("");
    setDiagnosticValidationError("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-category-validation/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
          body: JSON.stringify({
            category: selectedDiagnosticCategory,
            mode,
            videoIds: selectedIds,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Validation impossible.");
      }

      setDiagnosticValidationMessage(
        data?.message || "Validation terminée."
      );
      setSelectedDiagnosticItems({});

      await loadPublicationQuality(
        "review",
        "",
        selectedDiagnosticCategory
      );
      await loadMusicBrainQualityDiagnostic();
      await loadStats();
    } catch (err) {
      setDiagnosticValidationError(
        err instanceof Error ? err.message : "Validation impossible."
      );
    } finally {
      setDiagnosticValidationLoading(false);
    }
  }

  async function loadAutoAcceptV35Preview() {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/musicbrain-auto-accept-v35/preview`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Analyse Auto-Accept V3.5 indisponible");
      }
      setAutoAcceptV35(data);
      setAutoAcceptV35Error("");
    } catch (err) {
      setAutoAcceptV35Error(
        err instanceof Error
          ? err.message
          : "Analyse Auto-Accept V3.5 indisponible"
      );
    }
  }

  async function runAutoAcceptV35() {
    if (!adminToken.trim()) {
      setAutoAcceptV35Error(
        "Entre le code administrateur Railway avant de lancer Auto-Accept."
      );
      return;
    }

    const count = Number(autoAcceptV35?.autoAcceptable || 0);
    if (count <= 0) {
      setAutoAcceptV35Error("Aucun cas supplémentaire n’est auto-acceptable.");
      return;
    }

    const confirmed = window.confirm(
      `Lancer Auto-Accept V3.5 sur ${count} morceau(x) ? Les conflits forts LRCLIB resteront volontairement manuels.`
    );
    if (!confirmed) return;

    setAutoAcceptV35Loading(true);
    setAutoAcceptV35Message("");
    setAutoAcceptV35Error("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-auto-accept-v35/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Auto-Accept V3.5 impossible");
      }

      setAutoAcceptV35Message(data?.message || "Auto-Accept V3.5 terminé.");
      await loadAutoAcceptV35Preview();
      await loadPublicationQuality("review", "", selectedDiagnosticCategory || "");
      await loadMusicBrainQualityDiagnostic();
      await loadStats();
      if (KARAOKE_ENABLED) await loadKaraokeReadySongs("");
    } catch (err) {
      setAutoAcceptV35Error(
        err instanceof Error ? err.message : "Auto-Accept V3.5 impossible"
      );
    } finally {
      setAutoAcceptV35Loading(false);
    }
  }

  async function runMusicBrainAutoFix() {
    if (!adminToken.trim()) {
      setAutoFixError("Entre le code administrateur Railway avant de lancer Auto-Fix.");
      return;
    }

    const autoFixable = Number(publicationQuality?.summary.autoFixable || 0);
    if (autoFixable <= 0) {
      setAutoFixError("Aucune correction automatique sûre à appliquer.");
      return;
    }

    const confirmed = window.confirm(
      `Lancer Auto-Fix sur ${autoFixable} morceau(x) ? MusicBrain ne corrigera que les cas avec au moins deux preuves indépendantes concordantes.`
    );
    if (!confirmed) return;

    setAutoFixLoading(true);
    setAutoFixMessage("");
    setAutoFixError("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-autofix/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Auto-Fix MusicBrain impossible.");
      }

      setAutoFixMessage(data?.message || "Auto-Fix terminé.");
      await loadPublicationQuality("review", "", selectedDiagnosticCategory || "");
      await loadMusicBrainQualityDiagnostic();
      await loadStats();
      if (KARAOKE_ENABLED) await loadKaraokeReadySongs("");
    } catch (err) {
      setAutoFixError(
        err instanceof Error ? err.message : "Auto-Fix MusicBrain impossible."
      );
    } finally {
      setAutoFixLoading(false);
    }
  }

  async function loadMusicBrainArtists(
    nextFilter = artistAdminFilter,
    nextSearch = artistAdminSearch
  ) {
    setArtistAdminLoading(true);
    setArtistAdminError("");

    try {
      const params = new URLSearchParams({
        filter: nextFilter,
        limit: "300",
      });
      if (nextSearch.trim()) params.set("q", nextSearch.trim());

      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/musicbrain-artists?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Catalogue artistes MusicBrain indisponible.");
      }

      setArtistAdminData(data);
    } catch (err) {
      setArtistAdminError(
        err instanceof Error ? err.message : "Catalogue artistes MusicBrain indisponible."
      );
    } finally {
      setArtistAdminLoading(false);
    }
  }

  async function deleteMusicBrainArtist(item: MusicBrainArtistAdminItem) {
    if (!adminToken.trim()) {
      setArtistAdminError(
        "Entre le code administrateur Railway dans Maintenance avant de supprimer un artiste."
      );
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement « ${item.name} » de MusicBrain ?\n\n${item.songCount} morceau(x) lié(s) seront également retirés du catalogue MusicBrain.\n\nL’artiste sera aussi placé en liste noire et ne pourra plus revenir automatiquement.\n\nUtilise ce bouton uniquement si cet artiste est faux / inexistant.`
    );
    if (!confirmed) return;

    setArtistDeleteKey(item.key);
    setArtistAdminError("");
    setArtistAdminMessage("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-artists/${encodeURIComponent(item.key)}`,
        {
          method: "DELETE",
          headers: {
            "x-partybrain-admin-token": adminToken.trim(),
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Suppression impossible.");
      }

      setArtistAdminMessage(data?.message || "Artiste supprimé.");
      await loadMusicBrainArtists(artistAdminFilter, artistAdminSearch);
      await loadStats();
      await loadRenameItems(renameFilter, renameSearch);
    } catch (err) {
      setArtistAdminError(
        err instanceof Error ? err.message : "Suppression impossible."
      );
    } finally {
      setArtistDeleteKey("");
    }
  }


  function toggleArtistSelection(artistKey: string) {
    setSelectedArtistKeys((current) => ({
      ...current,
      [artistKey]: !current[artistKey],
    }));
  }

  function toggleAllVisibleArtists() {
    const items = artistAdminData?.items || [];
    if (!items.length) return;

    const allSelected = items.every((item) => selectedArtistKeys[item.key]);

    if (allSelected) {
      setSelectedArtistKeys((current) => {
        const next = { ...current };
        for (const item of items) delete next[item.key];
        return next;
      });
      return;
    }

    setSelectedArtistKeys((current) => {
      const next = { ...current };
      for (const item of items) next[item.key] = true;
      return next;
    });
  }

  async function deleteSelectedMusicBrainArtists() {
    if (!adminToken.trim()) {
      setArtistAdminError(
        "Entre le code administrateur Railway dans Maintenance avant de supprimer des artistes."
      );
      return;
    }

    const artistKeys = Object.entries(selectedArtistKeys)
      .filter(([, selected]) => selected)
      .map(([key]) => key);

    if (!artistKeys.length) {
      setArtistAdminError("Sélectionne au moins un artiste.");
      return;
    }

    const selectedItems = (artistAdminData?.items || []).filter((item) =>
      artistKeys.includes(item.key)
    );
    const songCount = selectedItems.reduce(
      (total, item) => total + Number(item.songCount || 0),
      0
    );

    const confirmed = window.confirm(
      `Supprimer ${artistKeys.length} artiste(s) sélectionné(s) ?\n\nEnviron ${songCount} morceau(x) lié(s) seront retirés de MusicBrain.\n\nTous les artistes supprimés seront ajoutés à la liste noire et ne pourront plus revenir automatiquement.`
    );
    if (!confirmed) return;

    setArtistBulkDeleteLoading(true);
    setArtistAdminError("");
    setArtistAdminMessage("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-artists/bulk-delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
          body: JSON.stringify({ artistKeys }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Suppression multiple impossible.");
      }

      setArtistAdminMessage(data?.message || "Suppression multiple terminée.");
      setSelectedArtistKeys({});
      await loadMusicBrainArtists(artistAdminFilter, artistAdminSearch);
      await loadStats();
      await loadRenameItems(renameFilter, renameSearch);
    } catch (err) {
      setArtistAdminError(
        err instanceof Error ? err.message : "Suppression multiple impossible."
      );
    } finally {
      setArtistBulkDeleteLoading(false);
    }
  }


  async function loadRenameItems(
    nextFilter = renameFilter,
    nextSearch = renameSearch
  ) {
    setRenameLoading(true);
    setRenameError("");

    try {
      const params = new URLSearchParams({
        filter: nextFilter,
        limit: "300",
      });
      if (nextSearch.trim()) params.set("q", nextSearch.trim());

      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/musicbrain-renaming/items?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Outil de renommage MusicBrain indisponible.");
      }

      setRenameData(data);
      setRenameDrafts((current) => {
        const next = { ...current };
        for (const item of data?.items || []) {
          if (!next[item.videoId]) {
            next[item.videoId] = {
              title: item.proposedTitle || item.title,
              artistName: item.proposedArtistName || item.artistName,
            };
          }
        }
        return next;
      });
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Outil de renommage MusicBrain indisponible."
      );
    } finally {
      setRenameLoading(false);
    }
  }

  function updateRenameDraft(
    videoId: string,
    field: "title" | "artistName",
    value: string
  ) {
    setRenameDrafts((current) => ({
      ...current,
      [videoId]: {
        title: current[videoId]?.title || "",
        artistName: current[videoId]?.artistName || "",
        [field]: value,
      },
    }));
  }

  function useRenameSuggestion(item: MusicBrainRenameItem) {
    setRenameDrafts((current) => ({
      ...current,
      [item.videoId]: {
        title: item.proposedTitle || item.title,
        artistName: item.proposedArtistName || item.artistName,
      },
    }));
  }

  async function saveRenameItem(item: MusicBrainRenameItem) {
    if (!adminToken.trim()) {
      setRenameError(
        "Entre le code administrateur Railway dans Maintenance avant d’enregistrer une correction."
      );
      return;
    }

    const draft = renameDrafts[item.videoId] || {
      title: item.title,
      artistName: item.artistName,
    };

    if (!draft.title.trim() || !draft.artistName.trim()) {
      setRenameError("Le titre et l’artiste sont obligatoires.");
      return;
    }

    setRenameSavingVideoId(item.videoId);
    setRenameError("");
    setRenameMessage("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-renaming/${encodeURIComponent(item.videoId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
          body: JSON.stringify({
            title: draft.title.trim(),
            artistName: draft.artistName.trim(),
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Impossible d’enregistrer cette correction.");
      }

      setRenameMessage(data?.message || "Correction enregistrée.");
      setRenameDrafts((current) => {
        const next = { ...current };
        delete next[item.videoId];
        return next;
      });

      await loadRenameItems(renameFilter, renameSearch);
      await loadStats();
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Impossible d’enregistrer cette correction."
      );
    } finally {
      setRenameSavingVideoId("");
    }
  }


  async function runSafeAutoRename() {
    if (!adminToken.trim()) {
      setRenameError(
        "Entre le code administrateur Railway dans Maintenance avant de lancer la correction automatique."
      );
      return;
    }

    const count = Number(renameData?.summary.safeAutoRename || 0);
    if (count <= 0) {
      setRenameError("Aucun titre sûr à corriger automatiquement.");
      return;
    }

    const confirmed = window.confirm(
      `Corriger automatiquement ${count} titre(s) sûr(s) ?\n\nCette action nettoie uniquement les titres évidents (Clip officiel, Official Video, artiste répété, etc.). Aucun nom d’artiste ne sera modifié automatiquement.`
    );
    if (!confirmed) return;

    setRenameAutoLoading(true);
    setRenameError("");
    setRenameMessage("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/maintenance/musicbrain-renaming/auto-safe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Correction automatique impossible.");
      }

      setRenameMessage(data?.message || "Correction automatique terminée.");
      setRenameDrafts({});
      await loadRenameItems(renameFilter, renameSearch);
      await loadStats();
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Correction automatique impossible."
      );
    } finally {
      setRenameAutoLoading(false);
    }
  }


  async function loadPublicationQuality(
    status = publicationQualityFilter,
    search = publicationQualitySearch,
    category = selectedDiagnosticCategory || ""
  ) {
    setPublicationQualityLoading(true);
    setPublicationQualityError("");

    try {
      const params = new URLSearchParams({
        status,
        limit: "300",
      });

      if (search.trim()) params.set("q", search.trim());
      if (category.trim()) params.set("category", category.trim());

      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/musicbrain-publication/items?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Contrôle qualité MusicBrain indisponible");
      }

      setPublicationQuality(data);
    } catch (err) {
      setPublicationQualityError(
        err instanceof Error
          ? err.message
          : "Contrôle qualité MusicBrain indisponible"
      );
    } finally {
      setPublicationQualityLoading(false);
    }
  }

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


  async function loadKaraokeBenchmarkConfig() {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/karaoke-benchmark/config`,
        { cache: "no-store" }
      );
      const data = await response.json();
      setBenchmarkConfig(data);
    } catch {
      setBenchmarkConfig(null);
    }
  }

  async function startKaraokeBenchmark() {
    if (!adminToken.trim()) {
      setBenchmarkError("Entre d'abord le code administrateur.");
      return;
    }

    setBenchmarkBusy(true);
    setBenchmarkError("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/karaoke-benchmark/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-partybrain-admin-token": adminToken.trim(),
          },
          body: JSON.stringify({ limit: 50 }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Impossible de lancer le benchmark.");
      }

      setBenchmarkCampaignId(String(data?.campaignId || ""));
      setBenchmarkCampaign(data?.campaign || null);
    } catch (err) {
      setBenchmarkError(
        err instanceof Error ? err.message : "Benchmark impossible."
      );
    } finally {
      setBenchmarkBusy(false);
    }
  }

  async function testKaraokeSyncEngineWithFile(song: KaraokeReadySong, file: File) {
    if (!adminToken.trim()) {
      setSyncEngineTestError("Entre le code administrateur Railway avant le test.");
      return;
    }

    setSyncEngineTestVideoId(song.videoId);
    setSyncEngineTestError("");
    setSyncEngineTestMessage(
      `Faster-Whisper analyse ${song.artistName} — ${song.title}… Cela peut prendre quelques minutes sur CPU.`
    );

    try {
      const contentType =
        file.type ||
        (file.name.toLowerCase().endsWith(".mp3")
          ? "audio/mpeg"
          : "application/octet-stream");

      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/karaoke-sync-engine/test-upload/${encodeURIComponent(song.videoId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": contentType,
            "x-partybrain-admin-token": adminToken.trim(),
            "x-mixparty-audio-filename": encodeURIComponent(file.name),
          },
          body: file,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Analyse Sync Engine impossible.");
      }

      const entry = data?.entry;
      setSyncEngineResults((current) => ({
        ...current,
        [song.videoId]: entry,
      }));

      const label =
        entry?.status === "certified"
          ? "🟢 CERTIFIÉ"
          : entry?.status === "needs_review"
            ? "🟠 À vérifier"
            : "🔴 Échec";

      setSyncEngineTestMessage(
        `${song.artistName} — ${song.title} : ${label}` +
        (Number.isFinite(Number(entry?.confidence))
          ? ` • confiance ${Math.round(Number(entry.confidence))}%`
          : "") +
        (entry?.reason ? ` • ${entry.reason}` : "")
      );
    } catch (err) {
      setSyncEngineTestError(
        err instanceof Error ? err.message : "Analyse Sync Engine impossible."
      );
    } finally {
      setSyncEngineTestVideoId("");
    }
  }

  async function loadKaraokeReadySongs(search = karaokeReadySearch) {
    setKaraokeReadyLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (search.trim()) params.set("q", search.trim());

      const response = await fetch(
        `${getApiBaseUrl()}/partybrain/karaoke-lyrics-audit/ready?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Liste Karaoké indisponible");
      }

      setKaraokeReadySongs(data);
    } catch (err) {
      setKaraokeLyricsError(
        err instanceof Error ? err.message : "Liste Karaoké indisponible"
      );
    } finally {
      setKaraokeReadyLoading(false);
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


  useEffect(() => {
    if (!KARAOKE_ENABLED) return;
    if (!karaokeLyricsAudit?.job?.running) {
      void loadKaraokeReadySongs(karaokeReadySearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karaokeLyricsAudit?.synced, karaokeLyricsAudit?.job?.running]);


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
      if (KARAOKE_ENABLED) await loadKaraokeAudit();
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
    if (KARAOKE_ENABLED) {
      void loadKaraokeAudit();
      void loadKaraokeLyricsAudit();
      void loadKaraokeReadySongs("");
    }

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
    if (!KARAOKE_ENABLED) return;
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
      if (KARAOKE_ENABLED) await loadKaraokeAudit();
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
      if (KARAOKE_ENABLED) await loadKaraokeAudit();
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
      if (KARAOKE_ENABLED) await loadKaraokeAudit();
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
    if (activeAdminTab === "quality") {
      void loadPublicationQuality(publicationQualityFilter, publicationQualitySearch);
      void loadMusicBrainQualityDiagnostic();
      void loadAutoAcceptV35Preview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAdminTab, publicationQualityFilter, selectedDiagnosticCategory]);

  useEffect(() => {
    if (activeAdminTab === "rename") {
      void loadRenameItems(renameFilter, renameSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAdminTab, renameFilter]);

  useEffect(() => {
    if (activeAdminTab === "artists") {
      void loadMusicBrainArtists(artistAdminFilter, artistAdminSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAdminTab, artistAdminFilter]);

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

  const adminTabs: Array<{
    key:
      | "overview"
      | "catalog"
      | "quality"
      | "artists"
      | "rename"
      | "karaoke"
      | "covers"
      | "academy"
      | "activity"
      | "maintenance";
    label: string;
    icon: LucideIcon;
    description: string;
  }> = [
    { key: "overview", label: "Vue d’ensemble", icon: BrainCircuit, description: "Santé générale de MusicBrain" },
    { key: "catalog", label: "Catalogue", icon: Database, description: "Artistes et morceaux appris" },
    { key: "quality", label: "Qualité", icon: ShieldCheck, description: "Entrées incertaines et réparations" },
    { key: "artists", label: "Artistes", icon: UserRound, description: "Trier les artistes suspects ou inexistants" },
    { key: "rename", label: "Renommage", icon: PencilLine, description: "Corriger proprement les titres et artistes" },
    { key: "covers", label: "Jaquettes", icon: Sparkles, description: "Bibliothèque HD Covers" },
    { key: "academy", label: "Academy", icon: BookOpen, description: "Apprentissage automatique" },
    { key: "activity", label: "Activité", icon: Activity, description: "Utilisateurs et soirées" },
    { key: "maintenance", label: "Maintenance", icon: KeyRound, description: "Actions sensibles" },
  ];

  const publicationReasonLabels: Record<string, string> = {
    musicbrain_validated: "Identité validée",
    musicbrain_requires_review: "Métadonnées à vérifier",
    safe_repair_available: "Réparation sûre disponible",
    artist_repair_requires_validation: "Correction artiste à valider",
    artist_conflicts_with_youtube_title: "Conflit artiste / titre YouTube",
    suspicious_artist_identity: "Identité artiste suspecte",
    contenu_non_musical: "Contenu non musical",
    artiste_inconnu: "Artiste inconnu",
    artiste_generique: "Artiste générique",
    musicbrain_rejected: "Refusé par MusicBrain",
    autofix_available: "Nettoyage automatique sûr disponible",
    autovalidated_consensus: "Validé automatiquement par consensus",
    manual_artist_review: "Artiste réellement ambigu",
    manual_metadata_review: "Métadonnées encore ambiguës",
  };

  const cleanupReviewItems = Array.isArray(cleanupReport?.reviewItems) ? cleanupReport.reviewItems : [];
  const visibleCleanupReviewItems = cleanupReviewItems.filter((item: any) => {
    if (cleanupReviewFilter !== "all" && item.category !== cleanupReviewFilter) return false;
    const query = cleanupReviewSearch.trim().toLowerCase();
    if (!query) return true;
    return `${item.artistName || ""} ${item.title || ""} ${item.rawTitle || ""} ${item.channelTitle || ""}`
      .toLowerCase()
      .includes(query);
  });

  useEffect(() => {
    if (!KARAOKE_ENABLED) return;
    void loadKaraokeBenchmarkConfig();
  }, []);

  useEffect(() => {
    if (!KARAOKE_ENABLED) return;
    if (!benchmarkCampaignId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/partybrain/karaoke-benchmark/${encodeURIComponent(benchmarkCampaignId)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!cancelled && response.ok) {
          setBenchmarkCampaign(data?.campaign || null);

          const status = String(data?.campaign?.status || "");
          if (status === "finished" || status === "failed") return;
        }
      } catch {}

      if (!cancelled) window.setTimeout(poll, 2500);
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [benchmarkCampaignId]);


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
            <nav className="sticky top-3 z-40 mb-7 rounded-[24px] border border-white/10 bg-[#0b0714]/90 p-2 shadow-[0_18px_50px_rgba(0,0,0,.35)] backdrop-blur-2xl">
              <div className="flex gap-2 overflow-x-auto">
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = activeAdminTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveAdminTab(tab.key)}
                      className={`group flex min-w-[150px] shrink-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-fuchsia-300/25 bg-gradient-to-r from-fuchsia-500/15 via-violet-500/12 to-cyan-500/10 text-white shadow-[0_0_28px_rgba(168,85,247,.12)]"
                          : "border-transparent bg-white/[0.025] text-white/45 hover:border-white/10 hover:bg-white/[0.05] hover:text-white/80"
                      }`}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        selected ? "bg-white/10 text-fuchsia-200" : "bg-white/[0.04] text-white/35"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black">{tab.label}</p>
                        <p className="mt-0.5 truncate text-[9px] font-bold text-white/30">{tab.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">
                {adminTabs.find((tab) => tab.key === activeAdminTab)?.label}
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {adminTabs.find((tab) => tab.key === activeAdminTab)?.description}
              </h2>
            </div>

{activeAdminTab === "activity" ? (
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


              </>
            ) : null}

{activeAdminTab === "overview" ? (
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


              </>
            ) : null}

{activeAdminTab === "covers" ? (
              <>
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


              </>
            ) : null}

{activeAdminTab === "academy" ? (
              <>
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


              </>
            ) : null}

{activeAdminTab === "overview" ? (
              <>
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


              </>
            ) : null}

{KARAOKE_ENABLED && activeAdminTab === "karaoke" ? (
              <>
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


            <section className="mt-7 rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] via-cyan-500/[0.05] to-transparent p-5 backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">
                    Morceaux prêts pour le karaoké
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {number.format(karaokeReadySongs?.totalReady ?? karaokeLyricsAudit?.synced ?? 0)} morceaux synchronisés
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                    Recherche un artiste ou un titre ici avant de tester le mode Karaoké. Cette liste contient uniquement les morceaux déjà confirmés avec des paroles synchronisées LRCLIB.
                  </p>
                </div>

                <form
                  className="flex w-full max-w-xl gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadKaraokeReadySongs(karaokeReadySearch);
                  }}
                >
                  <input
                    value={karaokeReadySearch}
                    onChange={(event) => setKaraokeReadySearch(event.target.value)}
                    placeholder="Ex : Soprano, GIMS, Vianney…"
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-emerald-300/30"
                  />
                  <button
                    type="submit"
                    disabled={karaokeReadyLoading}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/12 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-45"
                  >
                    <Search className="h-4 w-4" />
                    {karaokeReadyLoading ? "Recherche…" : "Rechercher"}
                  </button>
                </form>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 text-xs font-bold text-white/35">
                <span>
                  {karaokeReadySearch.trim()
                    ? `${number.format(karaokeReadySongs?.matched ?? 0)} résultat(s) correspondant(s)`
                    : `${number.format(karaokeReadySongs?.returned ?? 0)} affiché(s)`}
                </span>
                {karaokeReadySearch.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setKaraokeReadySearch("");
                      void loadKaraokeReadySongs("");
                    }}
                    className="text-emerald-200/70 hover:text-emerald-100"
                  >
                    Effacer la recherche
                  </button>
                ) : null}
              </div>

              {syncEngineTestMessage ? (
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] px-4 py-3 text-xs font-bold leading-5 text-cyan-100/85">
                  {syncEngineTestMessage}
                </div>
              ) : null}
              {syncEngineTestError ? (
                <div className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-500/[0.07] px-4 py-3 text-xs font-bold leading-5 text-rose-100/85">
                  {syncEngineTestError}
                </div>
              ) : null}


              <div className="mt-4 rounded-3xl border border-violet-300/15 bg-violet-500/[0.06] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-violet-200/70">
                      Benchmark Sync Engine
                    </p>
                    <h3 className="mt-1 text-lg font-black text-white">
                      Test automatique sur 50 morceaux
                    </h3>
                    <p className="mt-1 max-w-2xl text-[11px] font-bold leading-5 text-white/40">
                      MusicBrain récupère automatiquement 50 morceaux Jamendo avec audio
                      téléchargeable et paroles, puis les teste un par un. Aucun MP3 à fournir.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void startKaraokeBenchmark()}
                    disabled={
                      benchmarkBusy ||
                      benchmarkCampaign?.status === "running" ||
                      benchmarkCampaign?.status === "preparing" ||
                      benchmarkConfig?.jamendoConfigured === false
                    }
                    className="rounded-2xl border border-violet-300/20 bg-violet-500/15 px-4 py-2.5 text-xs font-black text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {benchmarkBusy
                      ? "Préparation…"
                      : benchmarkCampaign?.status === "running" ||
                          benchmarkCampaign?.status === "preparing"
                        ? "Benchmark en cours…"
                        : "Lancer 50 morceaux"}
                  </button>
                </div>

                {benchmarkConfig?.jamendoConfigured === false ? (
                  <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-500/[0.08] px-3 py-2 text-[11px] font-bold text-amber-100/80">
                    Il manque la variable Railway <b>JAMENDO_CLIENT_ID</b>.
                  </div>
                ) : null}

                {benchmarkError ? (
                  <div className="mt-3 rounded-2xl border border-rose-300/15 bg-rose-500/[0.08] px-3 py-2 text-[11px] font-bold text-rose-100/80">
                    {benchmarkError}
                  </div>
                ) : null}

                {benchmarkCampaign ? (
                  <div className="mt-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Progression", `${benchmarkCampaign.completed || 0} / ${benchmarkCampaign.total || benchmarkCampaign.requested || 50}`],
                        ["Passés", String(benchmarkCampaign.passed || 0)],
                        ["Refusés", String(benchmarkCampaign.failed || 0)],
                        ["Erreurs", String(benchmarkCampaign.errors || 0)],
                        [
                          "Taux",
                          benchmarkCampaign.completed
                            ? `${Math.round(((benchmarkCampaign.passed || 0) / benchmarkCampaign.completed) * 100)}%`
                            : "—",
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2"
                        >
                          <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/30">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-black text-white/85">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {benchmarkCampaign.currentTrack ? (
                      <p className="mt-3 text-[11px] font-bold text-violet-100/65">
                        Analyse : {benchmarkCampaign.currentTrack}
                      </p>
                    ) : null}

                    {Array.isArray(benchmarkCampaign.tracks) &&
                    benchmarkCampaign.tracks.length ? (
                      <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                        {benchmarkCampaign.tracks.map((track: any) => (
                          <div
                            key={track.jamendoId}
                            className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/20 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-black text-white/80">
                                {track.artistName} — {track.title}
                              </p>
                              <p className="mt-0.5 text-[9px] font-bold text-white/30">
                                {Number.isFinite(Number(track.benchmarkScore))
                                  ? `Score ${Math.round(Number(track.benchmarkScore) * 10) / 10}%`
                                  : track.status}
                                {Number.isFinite(Number(track.coverage))
                                  ? ` • couverture ${Math.round(Number(track.coverage) * 1000) / 10}%`
                                  : ""}
                              </p>
                            </div>
                            <span className="text-xs">
                              {track.status === "passed"
                                ? "✅"
                                : track.status === "failed"
                                  ? "❌"
                                  : track.status === "error"
                                    ? "⚠️"
                                    : track.status === "analyzing"
                                      ? "⏳"
                                      : "•"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <p className="mt-3 text-[9px] leading-4 text-white/25">
                      Benchmark technique : Jamendo fournit l'audio et les paroles,
                      mais pas un minutage karaoké de référence. Ce test sert à mesurer
                      la robustesse générale du moteur.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {(karaokeReadySongs?.items || []).map((song) => (
                  <article
                    key={song.videoId}
                    className="rounded-2xl border border-white/8 bg-black/20 p-3"
                  >
                    <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]">
                      {song.thumbnail ? (
                        <img
                          src={song.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <Mic2 className="h-5 w-5 text-white/25" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {song.title}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-white/45">
                        {song.artistName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-white/30">
                        <span className="rounded-full border border-emerald-300/15 bg-emerald-500/10 px-2 py-0.5 text-emerald-200/80">
                          ✓ Synchronisé
                        </span>
                        {song.durationSeconds > 0 ? (
                          <span>
                            {Math.floor(song.durationSeconds / 60)}:{String(Math.floor(song.durationSeconds % 60)).padStart(2, "0")}
                          </span>
                        ) : null}
                        {song.lrclibId ? <span>LRCLIB #{song.lrclibId}</span> : null}
                        {syncEngineResults[song.videoId] ? (
                          <>
                            <span
                              className={`rounded-full border px-2 py-0.5 ${
                                syncEngineResults[song.videoId]?.status === "certified"
                                  ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-200"
                                  : syncEngineResults[song.videoId]?.status === "needs_review"
                                    ? "border-amber-300/20 bg-amber-500/10 text-amber-200"
                                    : "border-rose-300/20 bg-rose-500/10 text-rose-200"
                              }`}
                            >
                              Sync Engine : {syncEngineResults[song.videoId]?.status}
                              {Number.isFinite(Number(syncEngineResults[song.videoId]?.confidence))
                                ? ` • ${Math.round(Number(syncEngineResults[song.videoId].confidence))}%`
                                : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSyncEngineDiagnosticOpen((current) => ({
                                  ...current,
                                  [song.videoId]: !current[song.videoId],
                                }))
                              }
                              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-white/55 transition hover:bg-white/[0.08] hover:text-white/80"
                            >
                              {syncEngineDiagnosticOpen[song.videoId]
                                ? "Masquer diagnostic"
                                : "Voir diagnostic"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <label
                      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black transition ${
                        syncEngineTestVideoId === song.videoId
                          ? "pointer-events-none border-cyan-300/20 bg-cyan-500/10 text-cyan-100 opacity-60"
                          : "border-cyan-300/15 bg-cyan-500/[0.08] text-cyan-100 hover:bg-cyan-500/15"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {syncEngineTestVideoId === song.videoId ? "Analyse…" : "Tester Sync Engine"}
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.flac,.m4a,.aac"
                        className="hidden"
                        disabled={Boolean(syncEngineTestVideoId)}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = "";
                          if (file) void testKaraokeSyncEngineWithFile(song, file);
                        }}
                      />
                    </label>
                    </div>

                    {syncEngineResults[song.videoId] &&
                    syncEngineDiagnosticOpen[song.videoId] ? (
                      <div className="mt-3 border-t border-white/8 pt-3">
                        {(() => {
                          const result = syncEngineResults[song.videoId];
                          const diagnostics = result?.diagnostics || {};
                          const alignedLines = Array.isArray(result?.alignedLines)
                            ? result.alignedLines
                            : [];

                          const coveragePercent = Number.isFinite(
                            Number(diagnostics.coverage)
                          )
                            ? Math.round(Number(diagnostics.coverage) * 1000) / 10
                            : null;

                          const similarityPercent = Number.isFinite(
                            Number(diagnostics.averageSimilarity)
                          )
                            ? Math.round(
                                Number(diagnostics.averageSimilarity) * 1000
                              ) / 10
                            : null;

                          const wordProbabilityPercent = Number.isFinite(
                            Number(diagnostics.averageWordProbability)
                          )
                            ? Math.round(
                                Number(diagnostics.averageWordProbability) * 1000
                              ) / 10
                            : null;

                          const lrclibDelta = diagnostics.lrclibDelta || {};
                          const lrclibDeltaBefore =
                            diagnostics.lrclibDeltaBeforeRefinement || {};
                          const localRefinement =
                            diagnostics.localRefinement || {};
                          const duplicateLines = diagnostics.duplicateLines || {};

                          const formatPercent01 = (value: unknown) =>
                            Number.isFinite(Number(value))
                              ? `${Math.round(Number(value) * 1000) / 10}%`
                              : "—";

                          const cards = [
                            [
                              "Confiance",
                              Number.isFinite(Number(result?.confidence))
                                ? `${Math.round(Number(result.confidence) * 10) / 10}%`
                                : "—",
                            ],
                            [
                              "Couverture",
                              coveragePercent !== null
                                ? `${coveragePercent}%`
                                : "—",
                            ],
                            [
                              "Lignes alignées",
                              Number.isFinite(
                                Number(diagnostics.alignedLineCount)
                              ) &&
                              Number.isFinite(Number(diagnostics.lyricLineCount))
                                ? `${diagnostics.alignedLineCount} / ${diagnostics.lyricLineCount}`
                                : alignedLines.length
                                  ? String(alignedLines.length)
                                  : "—",
                            ],
                            [
                              "Similarité moyenne",
                              similarityPercent !== null
                                ? `${similarityPercent}%`
                                : "—",
                            ],
                            [
                              "Timestamps",
                              diagnostics.monotonic === true
                                ? "✅ Croissants"
                                : diagnostics.monotonic === false
                                  ? "❌ Incohérents"
                                  : "—",
                            ],
                            [
                              "Probabilité mots",
                              wordProbabilityPercent !== null
                                ? `${wordProbabilityPercent}%`
                                : "—",
                            ],
                            [
                              "Delta médian LRCLIB",
                              Number.isFinite(
                                Number(lrclibDelta.medianAbsoluteDeltaSeconds)
                              )
                                ? `${Number(lrclibDelta.medianAbsoluteDeltaSeconds).toFixed(2)} s`
                                : "—",
                            ],
                            [
                              "À ±0,50 s",
                              formatPercent01(lrclibDelta.within050),
                            ],
                            [
                              "À ±0,75 s",
                              formatPercent01(lrclibDelta.within075),
                            ],
                            [
                              "Doublons suspects",
                              duplicateLines.suspect
                                ? `⚠️ ${Number(duplicateLines.count || 0)}`
                                : duplicateLines.suspect === false
                                  ? "✅ Aucun"
                                  : "—",
                            ],
                            [
                              "Correction locale",
                              localRefinement.enabled
                                ? localRefinement.applied
                                  ? `✅ ${Number(localRefinement.refinedCount || 0)} ligne(s)`
                                  : `— ${Number(localRefinement.attemptedCount || 0)} testée(s)`
                                : "—",
                            ],
                            [
                              "Offset global",
                              Number.isFinite(
                                Number(localRefinement.globalOffsetSeconds)
                              )
                                ? `${Number(localRefinement.globalOffsetSeconds) >= 0 ? "+" : ""}${Number(localRefinement.globalOffsetSeconds).toFixed(2)} s`
                                : "—",
                            ],
                            [
                              "Delta médian avant",
                              Number.isFinite(
                                Number(lrclibDeltaBefore.medianAbsoluteDeltaSeconds)
                              )
                                ? `${Number(lrclibDeltaBefore.medianAbsoluteDeltaSeconds).toFixed(2)} s`
                                : "—",
                            ],
                            [
                              "Moteur",
                              String(result?.engine || "faster-whisper"),
                            ],
                            [
                              "Modèle",
                              String(diagnostics.model || "—"),
                            ],
                          ];

                          return (
                            <>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {cards.map(([label, value]) => (
                                  <div
                                    key={label}
                                    className="rounded-xl border border-white/8 bg-black/25 px-3 py-2"
                                  >
                                    <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/30">
                                      {label}
                                    </p>
                                    <p className="mt-1 text-xs font-black text-white/80">
                                      {value}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-white/35">
                                {diagnostics.language ? (
                                  <span>Langue : {String(diagnostics.language)}</span>
                                ) : null}
                                {Number.isFinite(Number(diagnostics.wordCount)) ? (
                                  <span>• {diagnostics.wordCount} mots détectés</span>
                                ) : null}
                                {Number.isFinite(Number(diagnostics.durationSeconds)) ? (
                                  <span>
                                    • audio {Math.round(Number(diagnostics.durationSeconds))} s
                                  </span>
                                ) : null}
                                {diagnostics.computeType ? (
                                  <span>• {String(diagnostics.computeType)}</span>
                                ) : null}
                                {diagnostics.device ? (
                                  <span>• {String(diagnostics.device)}</span>
                                ) : null}
                              </div>

                              {alignedLines.length ? (
                                <div className="mt-3 rounded-xl border border-cyan-300/10 bg-cyan-500/[0.04] p-3">
                                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-200/60">
                                    Aperçu timings recalculés
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    {alignedLines.slice(0, 8).map(
                                      (line: any, index: number) => (
                                        <div
                                          key={`${line?.time}-${index}`}
                                          className="flex gap-3 text-[10px]"
                                        >
                                          <span className="w-14 shrink-0 font-mono font-black text-cyan-200/70">
                                            {Number.isFinite(Number(line?.time))
                                              ? `${Number(line.time).toFixed(2)}s`
                                              : "—"}
                                          </span>
                                          <span className="min-w-0 flex-1 truncate text-white/55">
                                            {String(line?.text || "")}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                  {alignedLines.length > 8 ? (
                                    <p className="mt-2 text-[9px] font-bold text-white/25">
                                      + {alignedLines.length - 8} ligne(s) alignée(s)
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {Array.isArray(localRefinement.details) &&
                              localRefinement.details.length ? (
                                <div className="mt-3 rounded-xl border border-amber-300/10 bg-amber-500/[0.04] p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[9px] font-black uppercase tracking-[.16em] text-amber-200/65">
                                      Correction locale V1.7
                                    </p>
                                    <span className="text-[9px] font-bold text-white/35">
                                      {Number(localRefinement.refinedCount || 0)} corrigée(s) /
                                      {" "}
                                      {Number(localRefinement.attemptedCount || 0)} testée(s)
                                    </span>
                                  </div>

                                  <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                                    {localRefinement.details
                                      .slice(0, 16)
                                      .map((item: any, index: number) => (
                                        <div
                                          key={`${item?.text}-${index}`}
                                          className="grid grid-cols-[42px_58px_58px_70px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-[9px]"
                                        >
                                          <span>
                                            {item?.changed ? "✅" : "—"}
                                          </span>
                                          <span className="font-mono text-white/40">
                                            {Number.isFinite(Number(item?.oldTime))
                                              ? `${Number(item.oldTime).toFixed(2)}s`
                                              : "—"}
                                          </span>
                                          <span className="font-mono text-cyan-200/65">
                                            {Number.isFinite(Number(item?.newTime))
                                              ? `${Number(item.newTime).toFixed(2)}s`
                                              : Number.isFinite(Number(item?.candidateTime))
                                                ? `${Number(item.candidateTime).toFixed(2)}s`
                                                : "—"}
                                          </span>
                                          <span className="font-mono text-amber-200/65">
                                            {Number.isFinite(Number(item?.improvementSeconds))
                                              ? `gain ${Number(item.improvementSeconds).toFixed(2)}s`
                                              : String(item?.reason || "")}
                                          </span>
                                          <span className="truncate text-white/45">
                                            {String(item?.text || "")}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              ) : null}

                              {Array.isArray(lrclibDelta.comparisons) &&
                              lrclibDelta.comparisons.length ? (
                                <div className="mt-3 rounded-xl border border-violet-300/10 bg-violet-500/[0.04] p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[9px] font-black uppercase tracking-[.16em] text-violet-200/65">
                                      Comparaison LRCLIB ↔ Engine
                                    </p>
                                    <div className="flex flex-wrap gap-2 text-[9px] font-bold text-white/35">
                                      <span>
                                        ±0,25s : {formatPercent01(lrclibDelta.within025)}
                                      </span>
                                      <span>
                                        ±0,50s : {formatPercent01(lrclibDelta.within050)}
                                      </span>
                                      <span>
                                        ±0,75s : {formatPercent01(lrclibDelta.within075)}
                                      </span>
                                      <span>
                                        ±1,00s : {formatPercent01(lrclibDelta.within100)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                                    {lrclibDelta.comparisons
                                      .slice(0, 24)
                                      .map((item: any, index: number) => {
                                        const delta = Number(item?.deltaSeconds);
                                        const absDelta = Math.abs(delta);
                                        const status =
                                          absDelta <= 0.25
                                            ? "✅"
                                            : absDelta <= 0.5
                                              ? "🟢"
                                              : absDelta <= 0.75
                                                ? "🟠"
                                                : "🔴";

                                        return (
                                          <div
                                            key={`${item?.engineTime}-${index}`}
                                            className="grid grid-cols-[48px_58px_58px_64px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-[9px]"
                                          >
                                            <span>{status}</span>
                                            <span className="font-mono text-white/45">
                                              L {Number(item?.lrclibTime).toFixed(2)}s
                                            </span>
                                            <span className="font-mono text-cyan-200/65">
                                              E {Number(item?.engineTime).toFixed(2)}s
                                            </span>
                                            <span
                                              className={`font-mono font-black ${
                                                absDelta <= 0.5
                                                  ? "text-emerald-200/75"
                                                  : absDelta <= 0.75
                                                    ? "text-amber-200/75"
                                                    : "text-rose-200/75"
                                              }`}
                                            >
                                              {delta >= 0 ? "+" : ""}
                                              {Number.isFinite(delta)
                                                ? delta.toFixed(2)
                                                : "—"}s
                                            </span>
                                            <span className="truncate text-white/45">
                                              {String(item?.text || "")}
                                            </span>
                                          </div>
                                        );
                                      })}
                                  </div>

                                  <p className="mt-2 text-[9px] leading-4 text-white/25">
                                    LRCLIB sert ici de référence comparative, pas de vérité absolue.
                                    Un écart peut aussi venir d'un timestamp LRCLIB imparfait.
                                  </p>
                                </div>
                              ) : null}

                              <p className="mt-3 text-[10px] leading-4 text-white/30">
                                Shadow Mode : ces timings sont uniquement diagnostiqués.
                                Ils ne remplacent pas encore les paroles du Karaoké public.
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </article>
                ))}

                {!karaokeReadyLoading && !(karaokeReadySongs?.items || []).length ? (
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-6 text-center text-sm text-white/40">
                    {karaokeReadySearch.trim()
                      ? "Aucun morceau synchronisé ne correspond à cette recherche."
                      : "Aucun morceau synchronisé enregistré pour le moment."}
                  </div>
                ) : null}
              </div>

              {(karaokeReadySongs?.matched ?? 0) > (karaokeReadySongs?.returned ?? 0) ? (
                <p className="mt-3 text-xs text-white/30">
                  La liste est limitée à {number.format(karaokeReadySongs?.returned ?? 0)} résultats affichés. Utilise la recherche pour retrouver un titre précis.
                </p>
              ) : null}
            </section>


              </>
            ) : null}



{activeAdminTab === "artists" ? (
  <>
    <section className="mb-7 overflow-hidden rounded-[30px] border border-cyan-300/15 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,.13),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(168,85,247,.10),transparent_30%),linear-gradient(145deg,rgba(10,18,28,.97),rgba(8,7,15,.99))] p-5 shadow-[0_26px_80px_rgba(0,0,0,.30)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10 text-cyan-200">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-cyan-300">
                MusicBrain Artists
              </p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                Nettoyer les artistes
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">
            MusicBrain calcule maintenant un score de suspicion avec des signaux négatifs
            et positifs. Un fallback ou une absence d’activité ne suffit plus à condamner un artiste.
            Les artistes supprimés restent mémorisés en liste noire pour empêcher leur retour.
          </p>
        </div>

        <div className="grid min-w-[520px] grid-cols-5 gap-2">
          {[
            ["Quasi faux", artistAdminData?.summary.trashArtists ?? 0, "text-red-300"],
            ["Très suspects", artistAdminData?.summary.highRiskArtists ?? 0, "text-orange-300"],
            ["À vérifier", artistAdminData?.summary.reviewArtists ?? 0, "text-amber-300"],
            ["Probables valides", artistAdminData?.summary.validArtists ?? 0, "text-emerald-300"],
            ["Bloqués", artistAdminData?.summary.blockedArtists ?? 0, "text-fuchsia-300"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-4 text-center">
              <p className={`text-lg font-black ${tone}`}>{number.format(Number(value))}</p>
              <p className="mt-1 text-[8px] font-black uppercase tracking-[.09em] text-white/35">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "trash" as const, label: "🗑️ Quasi certains faux" },
            { key: "high" as const, label: "🔴 Très suspects" },
            { key: "review" as const, label: "🟠 À vérifier" },
            { key: "valid" as const, label: "✅ Probablement valides" },
            { key: "all" as const, label: "Tous les artistes" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setArtistAdminFilter(item.key);
                setArtistAdminMessage("");
                setSelectedArtistKeys({});
              }}
              className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
                artistAdminFilter === item.key
                  ? "border-cyan-300/30 bg-cyan-500/12 text-cyan-100"
                  : "border-white/8 bg-black/20 text-white/45 hover:border-white/15 hover:text-white/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="flex min-w-0 flex-1 gap-2 lg:max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            void loadMusicBrainArtists(artistAdminFilter, artistAdminSearch);
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-white/35" />
            <input
              value={artistAdminSearch}
              onChange={(event) => setArtistAdminSearch(event.target.value)}
              placeholder="Chercher un artiste ou un morceau…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
            />
          </label>
          <button
            type="submit"
            disabled={artistAdminLoading}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-50"
            aria-label="Rechercher"
          >
            <RefreshCw className={`h-4 w-4 ${artistAdminLoading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      {artistAdminError ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          {artistAdminError}
        </div>
      ) : null}

      {artistAdminMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
          {artistAdminMessage}
        </div>
      ) : null}
    </section>

    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">
            Tri des artistes
          </p>
          <h3 className="mt-1 text-2xl font-black">
            {artistAdminLoading
              ? "Analyse du catalogue…"
              : `${number.format(artistAdminData?.total ?? 0)} artiste(s)`}
          </h3>
        </div>
        <p className="max-w-md text-right text-xs leading-5 text-white/35">
          Supprimer un artiste retire également ses morceaux de MusicBrain. À utiliser uniquement
          quand l’identité est réellement fausse ou inexistante.
        </p>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-[22px] border border-white/8 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleAllVisibleArtists}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white/65 transition hover:bg-white/[0.07]"
          >
            {(artistAdminData?.items || []).length > 0 &&
            (artistAdminData?.items || []).every((item) => selectedArtistKeys[item.key])
              ? "Tout désélectionner"
              : "Tout sélectionner"}
          </button>

          <span className="rounded-full border border-cyan-300/10 bg-cyan-500/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.10em] text-cyan-200">
            {Object.values(selectedArtistKeys).filter(Boolean).length} sélectionné(s)
          </span>
          {artistAdminFilter === "trash" ? (
            <span className="rounded-full border border-red-300/10 bg-red-500/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.10em] text-red-200">
              score ≥ 80
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void deleteSelectedMusicBrainArtists()}
          disabled={
            artistBulkDeleteLoading ||
            Object.values(selectedArtistKeys).filter(Boolean).length === 0
          }
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-5 py-3 text-xs font-black text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 className="h-4 w-4" />
          {artistBulkDeleteLoading
            ? "Suppression en cours…"
            : `Supprimer la sélection (${Object.values(selectedArtistKeys).filter(Boolean).length})`}
        </button>
      </div>

      <div className="space-y-4">
        {(artistAdminData?.items || []).map((item) => {
          const reasonLabels: Record<string, string> = {
            identite_suspecte: "Identité suspecte",
            nom_tres_court: "Nom très court",
            nom_de_chaine: "Nom de chaîne",
            nom_non_artistique: "Nom non artistique",
            tous_morceaux_faible_confiance: "Faible confiance",
            faible_confiance_majoritaire: "Confiance faible majoritaire",
            tous_morceaux_fallback: "Fallback uniquement",
            fallback_majoritaire: "Fallback majoritaire",
            un_seul_morceau: "Un seul morceau",
            aucune_activite: "Aucune activité",
          };

          return (
            <article
              key={item.key}
              className={`rounded-[26px] border p-4 shadow-[0_16px_44px_rgba(0,0,0,.18)] transition ${
                selectedArtistKeys[item.key]
                  ? "border-cyan-300/25 bg-cyan-500/[0.055]"
                  : "border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))]"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedArtistKeys[item.key])}
                    onChange={() => toggleArtistSelection(item.key)}
                    className="h-4 w-4 accent-cyan-400"
                  />
                  <span className="text-[10px] font-black uppercase tracking-[.10em] text-white/50">
                    Sélectionner
                  </span>
                </label>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(220px,.72fr)_minmax(0,1.6fr)_180px] xl:items-start">
                <div>
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/12 bg-cyan-500/[0.07] text-cyan-200">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/30">
                        Artiste
                      </p>
                      <h4 className="mt-1 truncate text-xl font-black text-white">{item.name}</h4>
                      <p className="mt-1 text-xs text-white/35">
                        {number.format(item.songCount)} morceau(x) · activité {number.format(item.totalActivity)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                    <span className="text-[9px] font-black uppercase tracking-[.11em] text-white/35">
                      Score suspicion
                    </span>
                    <span className={`text-sm font-black ${
                      item.tier === "trash"
                        ? "text-red-300"
                        : item.tier === "high"
                          ? "text-orange-300"
                          : item.tier === "review"
                            ? "text-amber-300"
                            : "text-emerald-300"
                    }`}>
                      {item.suspicionScore}/100
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-amber-300/10 bg-amber-500/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-amber-200/75"
                      >
                        {reasonLabels[reason] || reason}
                      </span>
                    ))}
                  </div>
                  {item.positiveSignals.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.positiveSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-emerald-300/10 bg-emerald-500/[0.055] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-emerald-200/65"
                        >
                          {signal.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-white/30">
                    Exemples de morceaux
                  </p>

                  <div className="grid gap-2 md:grid-cols-2">
                    {item.examples.map((song) => (
                      <div
                        key={song.videoId}
                        className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/7 bg-black/20 p-2.5"
                      >
                        {song.thumbnail ? (
                          <img
                            src={song.thumbnail}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.05]">
                            <Music2 className="h-4 w-4 text-white/25" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-white/80">{song.title}</p>
                          <p className="mt-0.5 text-[10px] text-white/30">
                            confiance {song.metadataConfidence}% · {song.playedCount} lecture(s)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[22px] border border-red-300/10 bg-red-500/[0.04] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-red-200/60">
                    Suppression
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/40">
                    Supprime cet artiste seulement si tu es certain qu’il n’existe pas ou que c’est une mauvaise identité.
                  </p>
                  <button
                    type="button"
                    onClick={() => void deleteMusicBrainArtist(item)}
                    disabled={artistDeleteKey === item.key}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100 transition hover:bg-red-500/15 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                    {artistDeleteKey === item.key ? "Suppression…" : "Supprimer l’artiste"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!artistAdminLoading && !(artistAdminData?.items || []).length ? (
          <div className="rounded-[24px] border border-emerald-300/10 bg-emerald-500/[0.05] p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
            <p className="mt-3 font-black text-emerald-100">
              {artistAdminSearch.trim()
                ? "Aucun artiste ne correspond à cette recherche."
                : artistAdminFilter === "trash"
                  ? "Aucun artiste quasi certain faux détecté."
                  : "Aucun artiste dans cette vue."}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  </>
) : null}

{activeAdminTab === "rename" ? (
  <>
    <section className="mb-7 overflow-hidden rounded-[30px] border border-violet-300/15 bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,.14),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(34,211,238,.10),transparent_30%),linear-gradient(145deg,rgba(18,11,31,.97),rgba(8,7,15,.99))] p-5 shadow-[0_26px_80px_rgba(0,0,0,.30)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/15 bg-violet-500/10 text-violet-200">
              <PencilLine className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.24em] text-violet-300">
                MusicBrain Renaming
              </p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                Nettoyer les noms de morceaux
              </h2>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">
            Corrige ici les titres et artistes mal nommés sans toucher au videoId, aux votes,
            aux statistiques ni aux jaquettes. MusicBrain propose une correction, mais c’est toi qui la valides.
          </p>
        </div>

        <div className="grid min-w-[300px] grid-cols-3 gap-2">
          {[
            ["À corriger", renameData?.summary.issues ?? 0, "text-amber-300"],
            ["Corrigés", renameData?.summary.renamed ?? 0, "text-emerald-300"],
            ["Catalogue", renameData?.summary.totalSongs ?? stats.totals.songs, "text-cyan-300"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-4 text-center">
              <p className={`text-xl font-black ${tone}`}>{number.format(Number(value))}</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[.12em] text-white/35">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-emerald-300/12 bg-emerald-500/[0.055] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-200">
                Correction automatique sûre
              </p>
            </div>
            <p className="mt-1 text-sm font-bold text-white/70">
              {number.format(renameData?.summary.safeAutoRename ?? 0)} titre(s) peuvent encore être nettoyés automatiquement.
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/35">
              Le moteur nettoie maintenant aussi les variantes entre parenthèses/crochets, les hashtags et les préfixes « ARTISTE - TITRE » quand l’identité du morceau reste sûre. Les noms d’artistes ne sont jamais modifiés par ce bouton.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void runSafeAutoRename()}
            disabled={renameAutoLoading || Number(renameData?.summary.safeAutoRename || 0) <= 0}
            className="shrink-0 rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-600/70 to-cyan-600/70 px-5 py-3 text-xs font-black text-white shadow-[0_12px_30px_rgba(16,185,129,.14)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {renameAutoLoading
              ? "Correction en cours…"
              : `Corriger les ${number.format(renameData?.summary.safeAutoRename ?? 0)} titres sûrs`}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "issues" as const, label: "À corriger" },
            { key: "all" as const, label: "Tous les morceaux" },
            { key: "renamed" as const, label: "Déjà corrigés" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setRenameFilter(item.key);
                setRenameMessage("");
              }}
              className={`rounded-2xl border px-4 py-2.5 text-xs font-black transition ${
                renameFilter === item.key
                  ? "border-violet-300/30 bg-violet-500/15 text-violet-100"
                  : "border-white/8 bg-black/20 text-white/45 hover:border-white/15 hover:text-white/70"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="flex min-w-0 flex-1 gap-2 lg:max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            void loadRenameItems(renameFilter, renameSearch);
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-white/35" />
            <input
              value={renameSearch}
              onChange={(event) => setRenameSearch(event.target.value)}
              placeholder="Chercher un titre, artiste ou chaîne…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
            />
          </label>
          <button
            type="submit"
            disabled={renameLoading}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/20 bg-violet-500/12 text-violet-100 transition hover:bg-violet-500/18 disabled:opacity-50"
            aria-label="Rechercher"
          >
            <RefreshCw className={`h-4 w-4 ${renameLoading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      {renameError ? (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          {renameError}
        </div>
      ) : null}
      {renameMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
          {renameMessage}
        </div>
      ) : null}
    </section>

    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">File de correction</p>
          <h3 className="mt-1 text-2xl font-black">
            {renameLoading
              ? "Analyse du catalogue…"
              : `${number.format(renameData?.total ?? 0)} morceau(x)`}
          </h3>
        </div>
        <p className="text-xs text-white/35">
          Les suggestions ne sont jamais enregistrées sans ton clic.
        </p>
      </div>

      <div className="space-y-4">
        {(renameData?.items || []).map((item) => {
          const draft = renameDrafts[item.videoId] || {
            title: item.proposedTitle || item.title,
            artistName: item.proposedArtistName || item.artistName,
          };
          const titleChanged = draft.title.trim() !== item.title.trim();
          const artistChanged = draft.artistName.trim() !== item.artistName.trim();
          const hasChange = titleChanged || artistChanged;
          const suggestionDiffers =
            item.proposedTitle.trim() !== item.title.trim() ||
            item.proposedArtistName.trim() !== item.artistName.trim();

          const issueLabels: Record<MusicBrainRenameIssue, string> = {
            titre_youtube_brut: "Titre YouTube brut",
            titre_avec_balise_video: "Balise vidéo",
            artiste_dans_le_titre: "Artiste répété",
            artiste_suspect: "Artiste suspect",
            metadata_faible: "Confiance faible",
            query_fallback: "Fallback recherche",
            correction_suggeree: "Suggestion disponible",
          };

          return (
            <article
              key={item.videoId}
              className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))] p-4 shadow-[0_16px_44px_rgba(0,0,0,.18)]"
            >
              <div className="grid gap-5 xl:grid-cols-[180px_minmax(0,.9fr)_minmax(0,1.25fr)]">
                <div>
                  <img
                    src={item.thumbnail || item.youtubeThumbnail}
                    alt=""
                    className="aspect-square w-full rounded-[22px] border border-white/8 object-cover shadow-[0_16px_34px_rgba(0,0,0,.30)]"
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.issues.map((issue) => (
                      <span
                        key={issue}
                        className="rounded-full border border-amber-300/10 bg-amber-500/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-amber-200/75"
                      >
                        {issueLabels[issue]}
                      </span>
                    ))}
                    {item.manuallyRenamed ? (
                      <span className="rounded-full border border-emerald-300/10 bg-emerald-500/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.08em] text-emerald-200/80">
                        Corrigé manuellement
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-white/30">Actuellement</p>
                  <h4 className="mt-2 text-lg font-black leading-snug text-white">{item.title}</h4>
                  <p className="mt-1 text-sm font-bold text-fuchsia-200/75">{item.artistName}</p>

                  <div className="mt-4 space-y-2 rounded-2xl border border-white/7 bg-black/20 p-3 text-xs leading-5">
                    <div>
                      <span className="font-black text-white/35">Titre YouTube : </span>
                      <span className="text-white/55">{item.rawTitle}</span>
                    </div>
                    {item.channelTitle ? (
                      <div>
                        <span className="font-black text-white/35">Chaîne : </span>
                        <span className="text-white/55">{item.channelTitle}</span>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/30">
                      <span>Confiance {item.metadataConfidence}%</span>
                      <span>{item.playedCount} lectures</span>
                      <span>{item.addedCount} ajouts</span>
                      <span>{item.voteCount} votes</span>
                    </div>
                  </div>

                  {suggestionDiffers ? (
                    <button
                      type="button"
                      onClick={() => useRenameSuggestion(item)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.07] px-3 py-2 text-[11px] font-black text-cyan-100 transition hover:bg-cyan-500/[0.12]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Utiliser la suggestion MusicBrain
                    </button>
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-violet-300/10 bg-violet-500/[0.045] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">
                    Correction
                  </p>

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.12em] text-white/35">
                      Titre
                    </span>
                    <input
                      value={draft.title}
                      onChange={(event) => updateRenameDraft(item.videoId, "title", event.target.value)}
                      className={`h-12 w-full rounded-2xl border bg-black/25 px-4 text-sm font-bold outline-none transition ${
                        titleChanged
                          ? "border-violet-300/30 text-violet-100"
                          : "border-white/10 text-white"
                      }`}
                    />
                  </label>

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.12em] text-white/35">
                      Artiste
                    </span>
                    <input
                      value={draft.artistName}
                      onChange={(event) => updateRenameDraft(item.videoId, "artistName", event.target.value)}
                      className={`h-12 w-full rounded-2xl border bg-black/25 px-4 text-sm font-bold outline-none transition ${
                        artistChanged
                          ? "border-fuchsia-300/30 text-fuchsia-100"
                          : "border-white/10 text-white"
                      }`}
                    />
                  </label>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() =>
                        setRenameDrafts((current) => ({
                          ...current,
                          [item.videoId]: {
                            title: item.title,
                            artistName: item.artistName,
                          },
                        }))
                      }
                      disabled={!hasChange || renameSavingVideoId === item.videoId}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-white/55 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveRenameItem(item)}
                      disabled={!hasChange || renameSavingVideoId === item.videoId}
                      className="flex-[1.35] rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 px-4 py-3 text-xs font-black text-white shadow-[0_10px_30px_rgba(168,85,247,.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {renameSavingVideoId === item.videoId ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {!renameLoading && !(renameData?.items || []).length ? (
          <div className="rounded-[24px] border border-emerald-300/10 bg-emerald-500/[0.05] p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
            <p className="mt-3 font-black text-emerald-100">
              {renameSearch.trim()
                ? "Aucun morceau ne correspond à cette recherche."
                : renameFilter === "issues"
                  ? "Aucun morceau suspect à corriger."
                  : "Aucun morceau dans cette vue."}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  </>
) : null}

{activeAdminTab === "catalog" ? (
              <>
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


              </>
            ) : null}

{activeAdminTab === "quality" ? (
              <section className="mt-7 rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-500/[0.10] via-fuchsia-500/[0.06] to-cyan-500/[0.05] p-5 backdrop-blur-xl sm:p-7">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex items-start gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-400/15 text-violet-200">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[.22em] text-violet-300">
                          MusicBrain Quality V3.5
                        </p>
                        <h2 className="mt-1 text-2xl font-black">
                          MusicBrain applique ses décisions sûres, toi seulement en dernier
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-white/50">
                          Première passe : titre YouTube, chaîne, Art Track et LRCLIB. Deuxième passe : alias déjà appris, QUERY_FALLBACK confirmé, artiste principal dans les featuring et concordance LRCLIB. Un morceau n’arrive dans « À vérifier par toi » qu’après l’échec des deux passes automatiques.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadPublicationQuality(
                        publicationQualityFilter,
                        publicationQualitySearch,
                        selectedDiagnosticCategory || ""
                      )
                    }
                    disabled={publicationQualityLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-500/15 disabled:opacity-40"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        publicationQualityLoading ? "animate-spin" : ""
                      }`}
                    />
                    Actualiser
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-200/60">
                      Auto-validés
                    </p>
                    <p className="mt-2 text-3xl font-black text-emerald-100">
                      {number.format(publicationQuality?.summary.autoValidated || 0)}
                    </p>
                    <p className="mt-1 text-xs text-emerald-100/45">
                      {number.format(publicationQuality?.summary.secondPassValidated || 0)} validé(s) spécifiquement par la 2e passe
                    </p>
                  </article>

                  <article className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200/60">
                      Auto-corrigeables
                    </p>
                    <p className="mt-2 text-3xl font-black text-cyan-100">
                      {number.format(publicationQuality?.summary.autoFixable || 0)}
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/45">
                      MusicBrain sait déjà quoi corriger
                    </p>
                  </article>

                  <article className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.07] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-200/60">
                      Vraiment à vérifier
                    </p>
                    <p className="mt-2 text-3xl font-black text-amber-100">
                      {number.format(publicationQuality?.summary.manualReview || 0)}
                    </p>
                    <p className="mt-1 text-xs text-amber-100/45">
                      uniquement après les 2 passes automatiques
                    </p>
                  </article>

                  <article className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.07] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-fuchsia-200/60">
                      Karaoké publiable
                    </p>
                    <p className="mt-2 text-3xl font-black text-fuchsia-100">
                      {number.format(publicationQuality?.summary.karaokeSyncedReady || 0)}
                    </p>
                    <p className="mt-1 text-xs text-fuchsia-100/45">
                      {number.format(publicationQuality?.summary.karaokeAutoFixable || 0)} correction(s) auto en attente
                    </p>
                  </article>
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.055] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">
                        Auto-Fix
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {number.format(publicationQuality?.summary.autoFixable || 0)} correction(s) peuvent être appliquées sans validation morceau par morceau.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/40">
                        Exemple : chaîne 7clouds + titre « Ariana Grande - … » + LRCLIB « Ariana Grande » → correction automatique vers Ariana Grande.
                      </p>
                    </div>

                    <div className="w-full max-w-md">
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                        <KeyRound className="h-4 w-4 text-cyan-300" />
                        <input
                          type="password"
                          value={adminToken}
                          onChange={(event) => setAdminToken(event.target.value)}
                          placeholder="Code administrateur Railway"
                          autoComplete="off"
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void runMusicBrainAutoFix()}
                        disabled={
                          autoFixLoading ||
                          Number(publicationQuality?.summary.autoFixable || 0) <= 0
                        }
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-40"
                      >
                        <Sparkles className="h-4 w-4" />
                        {autoFixLoading
                          ? "Application des décisions…"
                          : `Appliquer les ${number.format(
                              publicationQuality?.summary.autoFixable || 0
                            )} décisions sûres`}
                      </button>
                    </div>
                  </div>

                  {autoFixMessage ? (
                    <p className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-500/[0.08] p-3 text-xs font-bold text-emerald-200">
                      {autoFixMessage}
                    </p>
                  ) : null}

                  {autoFixError ? (
                    <p className="mt-3 rounded-xl border border-red-300/15 bg-red-500/[0.08] p-3 text-xs font-bold text-red-200">
                      {autoFixError}
                    </p>
                  ) : null}
                </div>

                
                                <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.055] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-200">
                        Auto-Accept V3.5
                      </p>
                      <p className="mt-1 text-sm font-black">
                        MusicBrain peut encore accepter automatiquement{" "}
                        {number.format(autoAcceptV35?.autoAcceptable || 0)} cas.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/40">
                        {number.format(autoAcceptV35?.validateCurrent || 0)} identité(s) déjà cohérente(s) seront validées •{" "}
                        {number.format(autoAcceptV35?.correctArtist || 0)} artiste(s) seront corrigé(s) •{" "}
                        {number.format(autoAcceptV35?.stillManual || 0)} conflit(s) fort(s) resteront pour toi.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void runAutoAcceptV35()}
                      disabled={
                        autoAcceptV35Loading ||
                        Number(autoAcceptV35?.autoAcceptable || 0) <= 0
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
                    >
                      <Sparkles className="h-4 w-4" />
                      {autoAcceptV35Loading
                        ? "Auto-Accept en cours…"
                        : `Accepter automatiquement ${number.format(
                            autoAcceptV35?.autoAcceptable || 0
                          )} cas`}
                    </button>
                  </div>

                  {autoAcceptV35Message ? (
                    <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.08] p-3 text-xs font-bold text-emerald-200">
                      {autoAcceptV35Message}
                    </p>
                  ) : null}

                  {autoAcceptV35Error ? (
                    <p className="mt-3 rounded-xl border border-red-300/20 bg-red-500/[0.08] p-3 text-xs font-bold text-red-200">
                      {autoAcceptV35Error}
                    </p>
                  ) : null}
                </div>

<div className="mt-5 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.045] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.16em] text-fuchsia-200">
                        Diagnostic des cas restants
                      </p>
                      <p className="mt-1 text-sm font-black">
                        MusicBrain classe les morceaux encore ambigus avant de créer de nouvelles règles.
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        3e passe sûre : {number.format(qualityDiagnostic?.thirdPassResolved || 0)} cas supplémentaire(s) résolu(s) automatiquement • {number.format(qualityDiagnostic?.stillManual || 0)} restent réellement ambigus.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void loadMusicBrainQualityDiagnostic()}
                      disabled={qualityDiagnosticLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-2.5 text-xs font-black text-fuchsia-100 disabled:opacity-40"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${qualityDiagnosticLoading ? "animate-spin" : ""}`} />
                      Analyser les cas restants
                    </button>
                  </div>

                  {qualityDiagnosticError ? (
                    <p className="mt-3 rounded-xl border border-red-300/15 bg-red-500/[0.08] p-3 text-xs font-bold text-red-200">
                      {qualityDiagnosticError}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {(qualityDiagnostic?.categories || []).map((category) => {
                      const selected = selectedDiagnosticCategory === category.key;

                      return (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => {
                            const nextCategory = selected ? null : category.key;
                            setSelectedDiagnosticCategory(nextCategory);
                            setSelectedDiagnosticItems({});
                            setDiagnosticValidationMessage("");
                            setDiagnosticValidationError("");
                            setPublicationQualityFilter("review");
                            setPublicationQualitySearch("");
                            void loadPublicationQuality("review", "", nextCategory || "");
                          }}
                          className={`rounded-xl border p-3 text-left transition ${
                            selected
                              ? "border-fuchsia-300/45 bg-fuchsia-500/15"
                              : "border-white/8 bg-black/20 hover:border-fuchsia-300/25 hover:bg-fuchsia-500/[0.07]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p
                                className={`text-[10px] font-black uppercase tracking-[.13em] ${
                                  selected ? "text-fuchsia-200" : "text-white/40"
                                }`}
                              >
                                {category.label}
                              </p>
                              <p className="mt-2 text-2xl font-black">
                                {number.format(category.count)}
                              </p>
                            </div>

                            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-black uppercase text-white/45">
                              {selected ? "Affiché" : "Voir"}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {!qualityDiagnosticLoading &&
                    !(qualityDiagnostic?.categories || []).length ? (
                      <p className="text-xs text-white/35">
                        Aucun diagnostic chargé.
                      </p>
                    ) : null}
                  </div>
                </div>

                {selectedDiagnosticCategory ? (
                  <div className="mt-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/[0.07] p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.15em] text-fuchsia-200">
                          Filtre diagnostic actif
                        </p>
                        <p className="mt-1 text-sm font-black">
                          {qualityDiagnostic?.categories.find(
                            (category) => category.key === selectedDiagnosticCategory
                          )?.label || selectedDiagnosticCategory}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          Tu peux valider morceau par morceau, sélectionner les 300 affichés, ou valider toute la catégorie.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAllVisibleDiagnosticItems()}
                          disabled={
                            diagnosticValidationLoading ||
                            !(publicationQuality?.items || []).length
                          }
                          className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-40"
                        >
                          {(publicationQuality?.items || []).length > 0 &&
                          (publicationQuality?.items || []).every(
                            (item) => selectedDiagnosticItems[item.videoId]
                          )
                            ? "Tout désélectionner"
                            : `Tout sélectionner (${number.format(
                                publicationQuality?.returned || 0
                              )})`}
                        </button>

                        <button
                          type="button"
                          onClick={() => void validateDiagnosticCategory("selected")}
                          disabled={
                            diagnosticValidationLoading ||
                            Object.values(selectedDiagnosticItems).filter(Boolean)
                              .length <= 0
                          }
                          className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                        >
                          Valider{" "}
                          {number.format(
                            Object.values(selectedDiagnosticItems).filter(Boolean)
                              .length
                          )}{" "}
                          sélectionné(s)
                        </button>

                        <button
                          type="button"
                          onClick={() => void validateDiagnosticCategory("all")}
                          disabled={
                            diagnosticValidationLoading ||
                            Number(publicationQuality?.total || 0) <= 0
                          }
                          className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-black text-fuchsia-100 disabled:opacity-40"
                        >
                          Valider toute la catégorie (
                          {number.format(publicationQuality?.total || 0)})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDiagnosticCategory(null);
                            setSelectedDiagnosticItems({});
                            setDiagnosticValidationMessage("");
                            setDiagnosticValidationError("");
                            void loadPublicationQuality("review", "", "");
                          }}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/70"
                        >
                          Afficher tous les cas
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {diagnosticValidationMessage ? (
                  <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.08] p-3 text-xs font-bold text-emerald-200">
                    {diagnosticValidationMessage}
                  </div>
                ) : null}

                {diagnosticValidationError ? (
                  <div className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/[0.08] p-3 text-xs font-bold text-red-200">
                    {diagnosticValidationError}
                  </div>
                ) : null}

<div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["review", "À traiter"],
                        ["ready", "Validés"],
                        ["blocked", "Bloqués"],
                        ["all", "Tout"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedDiagnosticCategory(null);
                            setPublicationQualityFilter(
                              key as "review" | "ready" | "blocked" | "all"
                            );
                          }}
                          className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                            publicationQualityFilter === key
                              ? "border-violet-300/30 bg-violet-500/15 text-violet-100"
                              : "border-white/10 bg-white/[0.035] text-white/45 hover:text-white/80"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <form
                      className="flex min-w-0 gap-2 lg:w-[420px]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void loadPublicationQuality(
                          publicationQualityFilter,
                          publicationQualitySearch,
                          selectedDiagnosticCategory || ""
                        );
                      }}
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 text-white/35" />
                        <input
                          value={publicationQualitySearch}
                          onChange={(event) =>
                            setPublicationQualitySearch(event.target.value)
                          }
                          placeholder="Artiste, titre, chaîne…"
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/25"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-2 text-xs font-black text-violet-100"
                      >
                        Filtrer
                      </button>
                    </form>
                  </div>

                  {publicationQualityError ? (
                    <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm font-bold text-red-100">
                      {publicationQualityError}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-bold text-white/35">
                    <span>
                      {number.format(publicationQuality?.total || 0)} entrée(s)
                    </span>
                    <span>
                      les morceaux Karaoké synchronisés restent prioritaires
                    </span>
                  </div>

                  <div className="mt-3 max-h-[720px] space-y-2 overflow-y-auto pr-1">
                    {(publicationQuality?.items || []).map((item) => (
                      <article
                        key={item.videoId}
                        className={`rounded-2xl border p-3 sm:p-4 ${
                          selectedDiagnosticCategory &&
                          selectedDiagnosticItems[item.videoId]
                            ? "border-emerald-300/30 bg-emerald-500/[0.06]"
                            : "border-white/8 bg-black/25"
                        }`}
                      >
                        <div className="flex gap-3">
                          {selectedDiagnosticCategory ? (
                            <label className="mt-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  selectedDiagnosticItems[item.videoId]
                                )}
                                onChange={() => toggleDiagnosticItem(item.videoId)}
                                className="h-4 w-4 accent-emerald-400"
                              />
                            </label>
                          ) : null}
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center">
                                <Music2 className="h-5 w-5 text-white/20" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-white">
                                  {item.title}
                                </p>
                                <p className="mt-1 truncate text-xs font-bold text-fuchsia-200/80">
                                  {item.artistName || "Artiste inconnu"}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                {item.karaokeSynced ? (
                                  <span className="rounded-full border border-cyan-300/15 bg-cyan-500/10 px-2 py-1 text-[9px] font-black text-cyan-200">
                                    🎤 Synchronisé
                                  </span>
                                ) : null}

                                <span
                                  className={`rounded-full border px-2 py-1 text-[9px] font-black ${
                                    item.consensusResolution === "auto_validated"
                                      ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-200"
                                      : item.consensusResolution === "auto_fixable"
                                        ? "border-cyan-300/15 bg-cyan-500/10 text-cyan-200"
                                        : item.consensusResolution === "manual_review"
                                          ? "border-amber-300/15 bg-amber-500/10 text-amber-200"
                                          : "border-red-300/15 bg-red-500/10 text-red-200"
                                  }`}
                                >
                                  {item.consensusResolution === "auto_validated"
                                    ? "Auto-validé"
                                    : item.consensusResolution === "auto_fixable"
                                      ? "Sera corrigé par Auto-Fix"
                                      : item.consensusResolution === "manual_review"
                                        ? "À vérifier"
                                        : "Bloqué"}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 grid gap-1 text-[10px] text-white/35">
                              <p>
                                <span className="text-white/55">Décision :</span>{" "}
                                {publicationReasonLabels[item.publicationReason] ||
                                  item.publicationReason}
                              </p>

                              <p>
                                <span className="text-white/55">Preuves :</span>{" "}
                                {(item.consensusSignals || []).length
                                  ? item.consensusSignals.join(" + ")
                                  : "aucune preuve forte"}
                                {" • "}
                                <span className="text-white/55">Confiance :</span>{" "}
                                {Math.round(item.consensusConfidence || 0)} %
                              </p>

                              {item.automaticAction === "correct" ? (
                                <p className="font-black text-cyan-200/80">
                                  ✓ Cette correction utilise exactement la logique qu’Auto-Fix appliquera.
                                </p>
                              ) : null}

                              {item.proposedArtistName ? (
                                <p className={`font-bold ${
                                  item.consensusResolution === "auto_fixable"
                                    ? "text-cyan-100/75"
                                    : "text-amber-100/70"
                                }`}>
                                  {item.artistName} →{" "}
                                  <strong>
                                    {item.proposedArtistName}
                                  </strong>
                                </p>
                              ) : null}

                              {item.lrclibArtistName &&
                              item.lrclibArtistName !== item.artistName ? (
                                <p className="text-fuchsia-100/55">
                                  LRCLIB : {item.lrclibArtistName}
                                </p>
                              ) : null}

                              <p className="text-white/25">
                                Chaîne {item.channelTitle || "—"} • Recherches{" "}
                                {number.format(item.searchCount)} • Ajouts{" "}
                                {number.format(item.addedCount)} • Lectures{" "}
                                {number.format(item.playedCount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}

                    {!publicationQualityLoading &&
                    !(publicationQuality?.items || []).length ? (
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-6 text-center text-sm text-white/35">
                        Rien à afficher dans ce filtre.
                      </div>
                    ) : null}
                  </div>

                  {(publicationQuality?.total || 0) >
                  (publicationQuality?.returned || 0) ? (
                    <p className="mt-3 text-xs text-white/30">
                      Les {number.format(publicationQuality?.returned ?? 0)} premières entrées sont affichées. Utilise la recherche pour cibler un cas précis.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

{activeAdminTab === "maintenance" ? (
              <>
            <section className="mt-7 rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-fuchsia-500/5 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-amber-200">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">"Maintenance sécurisée"</p>
                      <h2 className="mt-1 text-2xl font-black">"Cache et opérations administrateur"</h2>
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


              </>
            ) : null}

{activeAdminTab === "activity" ? (
              <>
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


              </>
            ) : null}

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
