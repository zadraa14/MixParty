import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { createAccountsStore } from "./accounts";
import {
  cleanArtist as coreCleanArtist,
  cleanTitle as coreCleanTitle,
  decodeHtmlEntities as coreDecodeHtmlEntities,
  normalizeKey as coreNormalizeKey,
  isPlausibleArtist,
} from "./music-intelligence/text";
import {
  cleanTrackTitle as coreCleanTrackTitle,
  extractMusicMetadata as coreExtractMusicMetadata,
  parseArtistCredits as coreParseArtistCredits,
  parseProvidedToYoutube as coreParseProvidedToYoutube,
} from "./music-intelligence/engine";
dotenv.config();



const app = express();
const port = Number(process.env.PORT ?? 4000);

// KARAOKÉ PAUSED — 2026-08-12
// Default OFF on purpose. All code/data are preserved for a future reactivation.
const karaokeFeatureEnabled =
  String(process.env.KARAOKE_ENABLED || "false").toLowerCase() === "true";

const persistentDataDir = path.resolve(
  process.env.PERSISTENT_DATA_DIR?.trim() || process.cwd()
);
fs.mkdirSync(persistentDataDir, { recursive: true });
const dataFilePath = path.resolve(persistentDataDir, "data.json");
const partyEventsFilePath = path.resolve(persistentDataDir, "party-intelligence-events.jsonl");
const attendanceHistoryFilePath = path.resolve(persistentDataDir, "party-attendance-history.json");
const accountsFilePath = path.resolve(persistentDataDir, "accounts.json");
const karaokeAuditFilePath = path.resolve(persistentDataDir, "karaoke-audit.json");
const karaokeLyricsAuditFilePath = path.resolve(persistentDataDir, "karaoke-lyrics-audit.json");
const karaokeSyncEngineFilePath = path.resolve(persistentDataDir, "karaoke-sync-engine.json");
const configuredOrigins = process.env.CORS_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = configuredOrigins?.length ? configuredOrigins : true;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
  },
});

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "2mb" }));

const accountsStore = createAccountsStore(accountsFilePath);

// Public/admin Karaoké endpoints are frozen while the feature is paused.
// Nothing is deleted; KARAOKE_ENABLED=true will reactivate them later.
app.use((req, res, next) => {
  if (
    !karaokeFeatureEnabled &&
    String(req.path || "").startsWith("/partybrain/karaoke")
  ) {
    return res.status(503).json({
      error: "KARAOKE_PAUSED",
      message: "Le Karaoké MixParty est temporairement désactivé.",
    });
  }
  next();
});



type YoutubeSuggestion = {
  id:string;
  title:string;
  thumbnail:string;
  channelTitle?:string;
  durationSeconds?:number;
  artistName?:string;
  featuredArtistNames?:string[];
  albumName?:string;
  metadataSource?:MusicMetadataSource;
  metadataConfidence?:number;
  coverStatus?:CoverStatus;
  coverUrl?:string;
  coverSource?:CoverSource;
  coverWidth?:number;
  coverHeight?:number;
  coverLastCheckedAt?:number;
};

type CoverStatus = "pending" | "found" | "not_found" | "error";
type CoverSource = "APPLE_ITUNES" | "MUSICBRAINZ_CAA" | "APPLE_ARTIST_FALLBACK" | "MANUAL";

type Song = {
  title:string;
  videoId:string;
  thumbnail:string;
  durationSeconds?:number;
  votes:number;
addedBy:string;
addedById?:string;
addedByAccountId?:string;
voters:string[];
  played:boolean;
  addedAt:number;
  sourceQuery?:string;
  suggestionPool?:YoutubeSuggestion[];
  artistName?:string;
  featuredArtistNames?:string[];
  albumName?:string;
  metadataSource?:MusicMetadataSource;
  metadataConfidence?:number;
};




type MusicMetadataSource = "ART_TRACK_DESCRIPTION" | "TITLE_CHANNEL" | "QUERY_FALLBACK";

type MusicBrainSong = {
  videoId: string;
  title: string;
  rawTitle?: string;
  thumbnail: string;
  channelTitle?: string;
  durationSeconds?: number;
  artistKey: string;
  artistName: string;
  featuredArtistKeys?: string[];
  featuredArtistNames?: string[];
  albumName?: string;
  metadataSource?: MusicMetadataSource;
  metadataConfidence?: number;
  firstSeenAt: number;
  lastSeenAt: number;
  searchCount: number;
  addedCount: number;
  playedCount: number;
  voteCount: number;
  coverStatus?: CoverStatus;
  coverUrl?: string;
  coverSource?: CoverSource;
  coverWidth?: number;
  coverHeight?: number;
  coverLastCheckedAt?: number;
  coverAttempts?: number;
  manualValidatedAt?: number;
  manualValidationCategory?: string;
  autoAcceptedAt?: number;
  autoAcceptReason?: string;

  // Karaoké Sync Certified V5
  // Ne sert jamais à supprimer le morceau de PartyBrain.
  karaokeSyncOffsetSeconds?: number;
  karaokeSyncCertifiedAt?: number;
  karaokeSyncCertifiedReason?: string;
};

type MusicBrainArtistLink = {
  key: string;
  name: string;
  count: number;
  lastSeenAt: number;
};

type MusicBrainArtist = {
  key: string;
  name: string;
  aliases: string[];
  collaborators: Record<string, MusicBrainArtistLink>;
  firstSeenAt: number;
  lastSeenAt: number;
  searchCount: number;
  songs: Record<string, MusicBrainSong>;
};

type MusicBrainTransition = {
  fromVideoId: string;
  toVideoId: string;
  count: number;
  lastSeenAt: number;
};

type MusicBrainArtistRelation = {
  fromKey: string;
  toKey: string;
  count: number;
  lastSeenAt: number;
};

type MusicBrainDatabase = {
  version: 2;
  createdAt: number;
  updatedAt: number;
  totals: {
    searches: number;
    additions: number;
    plays: number;
    votes: number;
  };
  artists: Record<string, MusicBrainArtist>;
  songs: Record<string, MusicBrainSong>;
  transitions: Record<string, MusicBrainTransition>;
  artistRelations: Record<string, MusicBrainArtistRelation>;
};


type AcademyLogEntry = {
  at: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
  artist?: string;
  query?: string;
  songsAdded?: number;
};

type AcademySession = {
  id: string;
  startedAt: number;
  finishedAt?: number;
  cycleKey: string;
  callsPlanned: number;
  callsUsed: number;
  songsAdded: number;
  artistsTouched: string[];
  status: "running" | "completed" | "stopped" | "quota_exhausted" | "failed";
  reason?: string;
};

type AcademyArtistProgress = {
  attempts: number;
  lastAttemptAt?: number;
  lastQueryVariant?: number;
  totalSongsAdded?: number;
  successfulAttempts?: number;
  consecutiveZeroAdds?: number;
  lastSongsAdded?: number;
  recentAdds?: number[];
  cooldownUntil?: number;
};

type AcademyState = {
  version: 1;
  updatedAt: number;
  quota: {
    cycleKey: string;
    used: number;
    lastResetAt: number;
  };
  running: boolean;
  lastCheckAt?: number;
  lastSessionAt?: number;
  artistProgress: Record<string, AcademyArtistProgress>;
  logs: AcademyLogEntry[];
  sessions: AcademySession[];
};



type PartyIntelligenceEventType =
  | "PARTY_CREATED"
  | "PARTICIPANT_JOINED"
  | "PARTICIPANT_LEFT"
  | "SONG_SEARCHED"
  | "SONG_ADDED"
  | "SONG_VOTED"
  | "SONG_DOWNVOTED"
  | "SONG_PLAY_STARTED"
  | "SONG_PROGRESS"
  | "SONG_PLAY_COMPLETED"
  | "SONG_SKIPPED"
  | "SONG_REMOVED"
  | "QUEUE_REORDERED"
  | "PARTY_ENDED";

type PartyIntelligenceEvent = {
  id: string;
  version: 1;
  event: PartyIntelligenceEventType;
  at: number;
  partyCode: string;
  partyAgeSeconds: number;
  localHour: number;
  participantCount: number;
  song?: {
    videoId: string;
    title: string;
    artistName?: string;
    durationSeconds?: number;
    votes?: number;
    queuePosition?: number;
  };
  actorHash?: string;
  source?: "manual_search" | "partybrain_suggestion" | "unknown";
  playback?: {
    elapsedSeconds: number;
    completionRatio?: number;
    reason?: "ended" | "dj_skip" | "dj_previous" | "song_change";
  };
  context?: Record<string, string | number | boolean | null>;
};

type PlaybackTelemetry = {
  videoId: string;
  startedAt: number;
  lastTime: number;
  lastState: number;
  lastProgressBucket: number;
  finalized: boolean;
};

const playbackTelemetry = new Map<string, PlaybackTelemetry>();

function anonymizeActor(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(`mixparty:${normalized}`).digest("hex").slice(0, 20);
}

function queuePositionForSong(party: Party, song: Song) {
  const queue = party.songs
    .filter((item) => !item.played)
    .sort((a, b) => b.votes !== a.votes ? b.votes - a.votes : a.addedAt - b.addedAt);
  const index = queue.findIndex((item) => item.videoId === song.videoId && item.addedAt === song.addedAt);
  return index >= 0 ? index + 1 : undefined;
}

function recordPartyEvent(
  party: Party,
  event: PartyIntelligenceEventType,
  details: Partial<Omit<PartyIntelligenceEvent, "id" | "version" | "event" | "at" | "partyCode" | "partyAgeSeconds" | "localHour" | "participantCount">> = {}
) {
  const at = Date.now();
  const payload: PartyIntelligenceEvent = {
    id: randomUUID(),
    version: 1,
    event,
    at,
    partyCode: party.code,
    partyAgeSeconds: Math.max(0, Math.round((at - party.createdAt) / 1000)),
    localHour: new Date(at).getHours(),
    participantCount: party.participants.length,
    ...details,
  };

  try {
    fs.appendFileSync(partyEventsFilePath, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    console.error("PartyBrain Intelligence: événement non enregistré", error);
  }
}

function songEventSnapshot(party: Party, song: Song) {
  return {
    videoId: song.videoId,
    title: song.title,
    artistName: song.artistName,
    durationSeconds: song.durationSeconds,
    votes: song.votes,
    queuePosition: queuePositionForSong(party, song),
  };
}

function finalizePlayback(party: Party, reason: "ended" | "dj_skip" | "dj_previous" | "song_change") {
  const telemetry = playbackTelemetry.get(party.code);
  const song = party.currentSong;
  if (!telemetry || !song || telemetry.finalized || telemetry.videoId !== song.videoId) return;

  telemetry.finalized = true;
  const duration = Number(song.durationSeconds || 0);
  const completionRatio = duration > 0 ? Math.min(1, telemetry.lastTime / duration) : undefined;
  const completed = reason === "ended" || (completionRatio !== undefined && completionRatio >= 0.9);

  recordPartyEvent(party, completed ? "SONG_PLAY_COMPLETED" : "SONG_SKIPPED", {
    song: songEventSnapshot(party, song),
    playback: {
      elapsedSeconds: Math.max(0, Math.round(telemetry.lastTime)),
      completionRatio,
      reason,
    },
  });
}

function startPlaybackTelemetry(party: Party, song: Song) {
  const previous = playbackTelemetry.get(party.code);
  if (previous && previous.videoId === song.videoId && !previous.finalized) return;
  playbackTelemetry.set(party.code, {
    videoId: song.videoId,
    startedAt: Date.now(),
    lastTime: 0,
    lastState: -1,
    lastProgressBucket: 0,
    finalized: false,
  });
  recordPartyEvent(party, "SONG_PLAY_STARTED", { song: songEventSnapshot(party, song) });
}

function readPartyEvents(limit = 5000): PartyIntelligenceEvent[] {
  if (!fs.existsSync(partyEventsFilePath)) return [];
  const lines = fs.readFileSync(partyEventsFilePath, "utf8").trim().split("\n").filter(Boolean);
  return lines.slice(-Math.max(1, Math.min(limit, 50000))).flatMap((line) => {
    try { return [JSON.parse(line) as PartyIntelligenceEvent]; } catch { return []; }
  });
}



type PartyBrainSearchInsight = {
  query: string;
  normalizedQuery: string;
  sampleSize: number;
  nextArtists: Array<{ artistName: string; count: number; confidence: number }>;
  popularHours: Array<{ hour: number; additions: number; votes: number; score: number }>;
  message: string;
  hourMessage?: string;
};

function partyBrainSearchInsight(query: string): PartyBrainSearchInsight {
  const normalizedQuery = normalizeMusicQuery(query);
  const events = readPartyEvents(50000).sort((a, b) => a.at - b.at);
  const matchingAdds = events.filter((entry) => {
    if (entry.event !== "SONG_ADDED" || !entry.song) return false;
    const artist = normalizeMusicQuery(entry.song.artistName || "");
    const title = normalizeMusicQuery(entry.song.title || "");
    return artist.includes(normalizedQuery) || normalizedQuery.includes(artist) || title.includes(normalizedQuery);
  });

  const nextArtistCounts = new Map<string, { artistName: string; count: number }>();
  const hourCounts = new Map<number, { additions: number; votes: number }>();

  for (const match of matchingAdds) {
    const samePartyAdds = events.filter((entry) =>
      entry.partyCode === match.partyCode &&
      entry.event === "SONG_ADDED" &&
      entry.at > match.at &&
      entry.at <= match.at + 45 * 60 * 1000 &&
      entry.song?.artistName
    ).slice(0, 5);

    const seen = new Set<string>();
    for (const next of samePartyAdds) {
      const artistName = String(next.song?.artistName || "").trim();
      const key = normalizeMusicQuery(artistName);
      if (!key || key === normalizedQuery || seen.has(key)) continue;
      seen.add(key);
      const current = nextArtistCounts.get(key) || { artistName, count: 0 };
      current.count += 1;
      nextArtistCounts.set(key, current);
    }

    const bucket = hourCounts.get(match.localHour) || { additions: 0, votes: 0 };
    bucket.additions += 1;
    hourCounts.set(match.localHour, bucket);
  }

  for (const vote of events) {
    if (vote.event !== "SONG_VOTED" || !vote.song) continue;
    const artist = normalizeMusicQuery(vote.song.artistName || "");
    const title = normalizeMusicQuery(vote.song.title || "");
    if (!(artist.includes(normalizedQuery) || normalizedQuery.includes(artist) || title.includes(normalizedQuery))) continue;
    const bucket = hourCounts.get(vote.localHour) || { additions: 0, votes: 0 };
    bucket.votes += 1;
    hourCounts.set(vote.localHour, bucket);
  }

  const nextArtists = [...nextArtistCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      confidence: matchingAdds.length ? Math.round((item.count / matchingAdds.length) * 100) : 0,
    }));

  const popularHours = [...hourCounts.entries()]
    .map(([hour, values]) => ({ hour, ...values, score: values.additions * 2 + values.votes }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const artistNames = nextArtists.slice(0, 3).map((item) => item.artistName);
  const message = artistNames.length
    ? `Les utilisateurs qui ajoutent ${query} ajoutent ensuite souvent ${artistNames.join(", ")}.`
    : `PartyBrain commence à apprendre les enchaînements après ${query}. Davantage de soirées amélioreront cette recommandation.`;
  const bestHour = popularHours[0];
  const hourMessage = bestHour
    ? `${query} reçoit le plus d’ajouts et de votes autour de ${String(bestHour.hour).padStart(2, "0")} h.`
    : undefined;

  return { query, normalizedQuery, sampleSize: matchingAdds.length, nextArtists, popularHours, message, hourMessage };
}

function partyIntelligenceStats() {
  const events = readPartyEvents(50000).sort((a, b) => a.at - b.at);
  const counts: Record<string, number> = {};
  const songVotes: Record<string, { videoId: string; title: string; artistName?: string; votes: number; partyCount: number; parties: Set<string> }> = {};
  const playedArtists: Record<string, { artistName: string; plays: number; completed: number; skipped: number }> = {};
  const removedSongs: Record<string, { videoId: string; title: string; artistName?: string; removals: number }> = {};
  const parties = new Map<string, { createdAt?: number; endedAt?: number; maxAgeSeconds: number; peakParticipants: number; participantSamples: number[] }>();
  const playSequence = new Map<string, PartyIntelligenceEvent[]>();
  let completed = 0;
  let skipped = 0;

  const normalizeArtist = (entry: PartyIntelligenceEvent) => {
    const raw = String(entry.song?.artistName || "Artiste inconnu").trim();
    return raw || "Artiste inconnu";
  };

  for (const entry of events) {
    counts[entry.event] = (counts[entry.event] || 0) + 1;

    const partyStats = parties.get(entry.partyCode) || {
      maxAgeSeconds: 0,
      peakParticipants: 0,
      participantSamples: [],
    };
    if (entry.event === "PARTY_CREATED") partyStats.createdAt = entry.at;
    if (entry.event === "PARTY_ENDED") partyStats.endedAt = entry.at;
    partyStats.maxAgeSeconds = Math.max(partyStats.maxAgeSeconds, Number(entry.partyAgeSeconds || 0));
    partyStats.peakParticipants = Math.max(partyStats.peakParticipants, Number(entry.participantCount || 0));
    partyStats.participantSamples.push(Number(entry.participantCount || 0));
    parties.set(entry.partyCode, partyStats);

    if (entry.event === "SONG_VOTED" && entry.song) {
      const current = songVotes[entry.song.videoId] || {
        videoId: entry.song.videoId,
        title: entry.song.title,
        artistName: entry.song.artistName,
        votes: 0,
        partyCount: 0,
        parties: new Set<string>(),
      };
      current.votes += 1;
      current.parties.add(entry.partyCode);
      current.partyCount = current.parties.size;
      songVotes[entry.song.videoId] = current;
    }

    if (entry.event === "SONG_PLAY_STARTED" && entry.song) {
      const artistName = normalizeArtist(entry);
      const key = artistName.toLocaleLowerCase("fr-FR");
      const current = playedArtists[key] || { artistName, plays: 0, completed: 0, skipped: 0 };
      current.plays += 1;
      playedArtists[key] = current;
      const sequence = playSequence.get(entry.partyCode) || [];
      sequence.push(entry);
      playSequence.set(entry.partyCode, sequence);
    }

    if ((entry.event === "SONG_PLAY_COMPLETED" || entry.event === "SONG_SKIPPED") && entry.song) {
      const artistName = normalizeArtist(entry);
      const key = artistName.toLocaleLowerCase("fr-FR");
      const current = playedArtists[key] || { artistName, plays: 0, completed: 0, skipped: 0 };
      if (entry.event === "SONG_PLAY_COMPLETED") current.completed += 1;
      if (entry.event === "SONG_SKIPPED") current.skipped += 1;
      playedArtists[key] = current;
    }

    if (entry.event === "SONG_REMOVED" && entry.song) {
      const current = removedSongs[entry.song.videoId] || {
        videoId: entry.song.videoId,
        title: entry.song.title,
        artistName: entry.song.artistName,
        removals: 0,
      };
      current.removals += 1;
      removedSongs[entry.song.videoId] = current;
    }

    if (entry.event === "SONG_PLAY_COMPLETED") completed += 1;
    if (entry.event === "SONG_SKIPPED") skipped += 1;
  }

  const transitions: Record<string, {
    from: { videoId: string; title: string; artistName?: string };
    to: { videoId: string; title: string; artistName?: string };
    count: number;
    partyCount: number;
    parties: Set<string>;
  }> = {};

  for (const [partyCode, sequence] of playSequence.entries()) {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const from = sequence[index].song;
      const to = sequence[index + 1].song;
      if (!from || !to || from.videoId === to.videoId) continue;
      const key = `${from.videoId}=>${to.videoId}`;
      const current = transitions[key] || {
        from: { videoId: from.videoId, title: from.title, artistName: from.artistName },
        to: { videoId: to.videoId, title: to.title, artistName: to.artistName },
        count: 0,
        partyCount: 0,
        parties: new Set<string>(),
      };
      current.count += 1;
      current.parties.add(partyCode);
      current.partyCount = current.parties.size;
      transitions[key] = current;
    }
  }

  const partyValues = [...parties.values()];
  const durations = partyValues
    .map((party) => party.endedAt && party.createdAt
      ? Math.max(0, Math.round((party.endedAt - party.createdAt) / 1000))
      : party.maxAgeSeconds)
    .filter((duration) => duration > 0);
  const participantPeaks = partyValues.map((party) => party.peakParticipants);
  const average = (values: number[]) => values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;

  return {
    version: 2,
    generatedAt: Date.now(),
    totalEvents: events.length,
    analyzedParties: parties.size,
    counts,
    completionRate: completed + skipped > 0 ? completed / (completed + skipped) : null,
    topVotedSongs: Object.values(songVotes)
      .map(({ parties: _parties, ...song }) => song)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 20),
    topPlayedArtists: Object.values(playedArtists)
      .sort((a, b) => b.plays - a.plays || b.completed - a.completed)
      .slice(0, 20),
    averagePartyDurationSeconds: average(durations),
    averagePartyDurationMinutes: average(durations) === null ? null : Math.round((average(durations)! / 60) * 10) / 10,
    durationMethod: counts.PARTY_ENDED
      ? "party_created_to_party_ended"
      : "last_observed_event_per_party",
    averageParticipants: average(participantPeaks) === null ? null : Math.round(average(participantPeaks)! * 10) / 10,
    participantMethod: "average_peak_participants_per_party",
    topRemovedSongs: Object.values(removedSongs)
      .sort((a, b) => b.removals - a.removals)
      .slice(0, 20),
    commonSongTransitions: Object.values(transitions)
      .map(({ parties: _parties, ...transition }) => transition)
      .sort((a, b) => b.count - a.count || b.partyCount - a.partyCount)
      .slice(0, 30),
    dataCoverage: {
      partyEndedEvents: counts.PARTY_ENDED || 0,
      songRemovedEvents: counts.SONG_REMOVED || 0,
      note: "Les statistiques de durée et de suppression gagnent en précision à mesure que PARTY_ENDED et SONG_REMOVED sont enregistrés.",
    },
    storage: { format: "jsonl", file: path.basename(partyEventsFilePath) },
  };
}

type Participant = { id:string; name:string; avatar?:string; accountId?:string; lastSeen:number };

type Party = {
  code: string;
  songs: Song[];
  history: Song[];
  participants: Participant[];
  currentSong: Song | null;
  createdAt: number;
  lastActivityAt: number;
  creatorToken: string;
  partyBrainAutoRelayEnabled: boolean;
};

let parties: Party[] = [];

if(fs.existsSync(dataFilePath)){

  const data = fs.readFileSync(
    dataFilePath,
    "utf-8"
  );

  parties = JSON.parse(data);
  parties.forEach((party:any) => {
    party.participants = (party.participants || []).map((participant:any, index:number) =>
      typeof participant === "string"
        ? { id: `legacy-${index}-${participant}`, name: participant, lastSeen: 0 }
        : { ...participant, lastSeen: Number(participant.lastSeen || 0) }
    );
    party.lastActivityAt = Number(party.lastActivityAt || party.createdAt || Date.now());
    party.creatorToken = typeof party.creatorToken === "string" && party.creatorToken ? party.creatorToken : randomUUID();
    party.partyBrainAutoRelayEnabled = Boolean(party.partyBrainAutoRelayEnabled);
  });

  cleanOldParties();

}



function generateCode() {

  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

}



function partyLastActivityAt(party: Party) {
  return Number(party.lastActivityAt || party.createdAt || 0);
}

function partyIsExpired(party: Party) {
  return Date.now() - partyLastActivityAt(party) >= 6 * 60 * 60 * 1000;
}

function findParty(code:string) {

  const party = parties.find(
    (party) => party.code === code
  );

  if (party && partyIsExpired(party)) {
    cleanOldParties();
    return undefined;
  }

  return party;

}


function saveParties(){

  fs.writeFileSync(
    dataFilePath,
    JSON.stringify(parties, null, 2)
  );

}





type AttendanceParticipant = {
  id: string;
  name: string;
  avatar?: string;
  firstSeenAt: number;
  lastSeenAt: number;
};

type AttendanceParty = {
  code: string;
  createdAt: number;
  firstActivityAt: number;
  lastActivityAt: number;
  participants: Record<string, AttendanceParticipant>;
};

type AttendanceHistory = {
  version: 1;
  updatedAt: number;
  parties: Record<string, AttendanceParty>;
};

function createEmptyAttendanceHistory(): AttendanceHistory {
  return {
    version: 1,
    updatedAt: Date.now(),
    parties: {},
  };
}

let attendanceHistory: AttendanceHistory = createEmptyAttendanceHistory();

function cleanupAttendanceHistory() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [code, attendanceParty] of Object.entries(attendanceHistory.parties)) {
    if (Number(attendanceParty.lastActivityAt || 0) < cutoff) {
      delete attendanceHistory.parties[code];
    }
  }
}

function saveAttendanceHistory() {
  cleanupAttendanceHistory();
  attendanceHistory.updatedAt = Date.now();
  fs.writeFileSync(
    attendanceHistoryFilePath,
    JSON.stringify(attendanceHistory, null, 2),
    "utf-8"
  );
}

function loadAttendanceHistory() {
  if (!fs.existsSync(attendanceHistoryFilePath)) {
    saveAttendanceHistory();
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(attendanceHistoryFilePath, "utf-8"));
    attendanceHistory = {
      version: 1,
      updatedAt: Number(parsed?.updatedAt || Date.now()),
      parties: parsed?.parties && typeof parsed.parties === "object" ? parsed.parties : {},
    };
    cleanupAttendanceHistory();
    saveAttendanceHistory();
  } catch (error) {
    console.warn("Historique des présences illisible, nouvelle base créée :", error);
    attendanceHistory = createEmptyAttendanceHistory();
    saveAttendanceHistory();
  }
}

function recordAttendance(party: Party, participant: Participant) {
  const now = Date.now();
  const historyParty = attendanceHistory.parties[party.code] || {
    code: party.code,
    createdAt: Number(party.createdAt || now),
    firstActivityAt: now,
    lastActivityAt: now,
    participants: {},
  };

  const historyParticipant = historyParty.participants[participant.id] || {
    id: participant.id,
    name: participant.name,
    avatar: participant.avatar,
    firstSeenAt: now,
    lastSeenAt: now,
  };

  historyParticipant.name = participant.name;
  historyParticipant.avatar = participant.avatar || historyParticipant.avatar;
  historyParticipant.lastSeenAt = now;

  historyParty.lastActivityAt = now;
  historyParty.participants[participant.id] = historyParticipant;
  attendanceHistory.parties[party.code] = historyParty;
  saveAttendanceHistory();
}

loadAttendanceHistory();


const musicBrainFilePath = path.resolve(persistentDataDir, "musicbrain.json");

function createEmptyMusicBrain(): MusicBrainDatabase {
  const now = Date.now();
  return {
    version: 2,
    createdAt: now,
    updatedAt: now,
    totals: { searches: 0, additions: 0, plays: 0, votes: 0 },
    artists: {},
    songs: {},
    transitions: {},
    artistRelations: {},
  };
}

let musicBrain: MusicBrainDatabase = createEmptyMusicBrain();

function loadMusicBrain() {
  if (!fs.existsSync(musicBrainFilePath)) {
    saveMusicBrain();
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(musicBrainFilePath, "utf-8"));
    if ((parsed?.version === 1 || parsed?.version === 2) && parsed?.artists && parsed?.songs) {
      const defaults = createEmptyMusicBrain();
      musicBrain = {
        ...defaults,
        ...parsed,
        createdAt: Number(parsed.createdAt || defaults.createdAt),
        updatedAt: Number(parsed.updatedAt || defaults.updatedAt),
        totals: { ...defaults.totals, ...(parsed.totals || {}) },
        artists: parsed.artists || {},
        songs: parsed.songs || {},
        version: 2,
        transitions: parsed.transitions || {},
        artistRelations: parsed.artistRelations || {},
      };
      mergeMusicBrainArtists();
    }
  } catch (error) {
    console.warn("MusicBrain illisible, nouvelle base créée :", error);
    musicBrain = createEmptyMusicBrain();
    saveMusicBrain();
  }
}

function mergeMusicBrainArtists() {
  const previousArtists = musicBrain.artists || {};
  const rebuilt: Record<string, MusicBrainArtist> = {};
  musicBrain.artistRelations = {};

  for (const song of Object.values(musicBrain.songs || {})) {
    const previousArtist = previousArtists[song.artistKey];
    const sourceHint = (previousArtist?.aliases || [])
      .map(cleanArtistName)
      .filter(Boolean)
      .sort((a, b) => a.length - b.length)[0] || previousArtist?.name || song.artistName || "";
    const credits = inferArtistCredits(song, sourceHint);
    const artistName = credits.main;
    const artistKey = normalizeMusicQuery(artistName) || "unknown";
    const now = Date.now();

    song.title = cleanDisplayTitle(song.title || "");
    song.artistKey = artistKey;
    song.artistName = artistName;
    song.featuredArtistNames = credits.collaborators;
    song.featuredArtistKeys = credits.collaborators.map(normalizeMusicQuery).filter(Boolean);

    const target = rebuilt[artistKey] || {
      key: artistKey,
      name: artistName,
      aliases: [],
      collaborators: {},
      firstSeenAt: Number(song.firstSeenAt || now),
      lastSeenAt: Number(song.lastSeenAt || now),
      searchCount: 0,
      songs: {},
    };
    target.firstSeenAt = Math.min(target.firstSeenAt, Number(song.firstSeenAt || target.firstSeenAt));
    target.lastSeenAt = Math.max(target.lastSeenAt, Number(song.lastSeenAt || target.lastSeenAt));
    target.searchCount += Number(song.searchCount || 0);
    target.aliases = [...new Set([
      ...target.aliases,
      cleanArtistName(previousArtist?.name || ""),
      ...(previousArtist?.aliases || []).map(cleanArtistName),
    ].filter(Boolean))].slice(-30);
    target.songs[song.videoId] = song;
    rebuilt[artistKey] = target;
  }

  musicBrain.artists = rebuilt;
  for (const song of Object.values(musicBrain.songs || {})) {
    for (const collaborator of song.featuredArtistNames || []) {
      recordArtistRelation(song.artistName, collaborator);
    }
  }
  saveMusicBrain();
}

let musicBrainSaveTimer: NodeJS.Timeout | null = null;
function saveMusicBrain() {
  musicBrain.updatedAt = Date.now();
  if (musicBrainSaveTimer) clearTimeout(musicBrainSaveTimer);
  musicBrainSaveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(musicBrainFilePath, JSON.stringify(musicBrain, null, 2), "utf-8");
    } catch (error) {
      console.warn("MusicBrain non sauvegardé :", error);
    }
  }, 120);
}

function decodeHtmlEntities(value: string) {
  return coreDecodeHtmlEntities(value);
}

function cleanDisplayTitle(value: string) {
  return coreCleanTitle(value);
}

function cleanArtistName(value: string) {
  return coreCleanArtist(value);
}

function normalizeArtistToken(value: string) {
  return cleanArtistName(value)
    .replace(/^[\s([\]{},:;.!+\-]+|[\s)\]\]{},:;.!+\-]+$/g, "")
    .replace(/^(?:feat(?:uring)?|ft|avec)\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitGuestList(value: string) {
  return value
    .split(/\s*(?:,|;|\+|\bx\b|\bavec\b|\bfeat(?:uring)?\.?\b|\bft\.?\b)\s*/i)
    .map(normalizeArtistToken)
    .filter((name) => name.length >= 2 && !/^(?:official|music|topic)$/i.test(name));
}

function splitArtistCredits(value: string, sourceQuery = "") {
  return coreParseArtistCredits(value, sourceQuery);
}

function inferArtistCredits(result: { title?: string; channelTitle?: string }, fallbackQuery: string) {
  const metadata = coreExtractMusicMetadata({
    rawTitle: String(result.title || ""),
    channelTitle: String(result.channelTitle || ""),
    query: fallbackQuery,
  });
  return { main: metadata.artistName, collaborators: metadata.featuredArtistNames };
}

function relationKey(a: string, b: string) {
  return [a, b].sort().join(">>");
}

function recordArtistRelation(mainName: string, collaboratorName: string) {
  const mainKey = normalizeMusicQuery(mainName);
  const collaboratorKey = normalizeMusicQuery(collaboratorName);
  if (!mainKey || !collaboratorKey || mainKey === collaboratorKey) return;
  const now = Date.now();
  const collaborator = musicBrain.artists[collaboratorKey] || {
    key: collaboratorKey, name: cleanArtistName(collaboratorName), aliases: [], collaborators: {},
    firstSeenAt: now, lastSeenAt: now, searchCount: 0, songs: {},
  };
  musicBrain.artists[collaboratorKey] = collaborator;
  const main = musicBrain.artists[mainKey];
  if (main) {
    const link = main.collaborators[collaboratorKey] || { key: collaboratorKey, name: collaborator.name, count: 0, lastSeenAt: now };
    link.count += 1; link.lastSeenAt = now; main.collaborators[collaboratorKey] = link;
  }
  const reverse = collaborator.collaborators[mainKey] || { key: mainKey, name: main?.name || mainName, count: 0, lastSeenAt: now };
  reverse.count += 1; reverse.lastSeenAt = now; collaborator.collaborators[mainKey] = reverse;
  const key = relationKey(mainKey, collaboratorKey);
  const relation = musicBrain.artistRelations[key] || { fromKey: mainKey, toKey: collaboratorKey, count: 0, lastSeenAt: now };
  relation.count += 1; relation.lastSeenAt = now; musicBrain.artistRelations[key] = relation;
}


type CoverLookupResult = {
  url: string;
  source: CoverSource;
  width: number;
  height: number;
  confidence: number;
};

const coverLookupsInFlight = new Set<string>();
let musicBrainzCoverQueue: Promise<void> = Promise.resolve();

function normalizeCoverText(value: unknown) {
  return normalizeMusicQuery(String(value || ""))
    .replace(/\b(remaster(?:ed)?|radio edit|official audio|official video|lyrics?|clip officiel|audio officiel)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coverTextSimilarity(expected: string, candidate: string) {
  const left = new Set(normalizeCoverText(expected).split(" ").filter((token) => token.length > 1));
  const right = new Set(normalizeCoverText(candidate).split(" ").filter((token) => token.length > 1));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function appleHdArtworkUrl(url: string) {
  if (!url) return "";
  return url
    .replace(/\/\d+x\d+bb(?:-\d+)?\.(jpg|png)$/i, "/1200x1200bb.$1")
    .replace(/\/\d+x\d+bb\.(jpg|png)(\?.*)?$/i, "/1200x1200bb.$1$2");
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchAppleCover(song: MusicBrainSong): Promise<CoverLookupResult | null> {
  const term = encodeURIComponent(`${song.artistName} ${song.title}`.trim());
  const country = encodeURIComponent(process.env.ITUNES_STOREFRONT || "FR");
  const url = `https://itunes.apple.com/search?term=${term}&country=${country}&media=music&entity=song&limit=12`;
  const data = await fetchJsonWithTimeout<{ results?: Array<Record<string, any>> }>(url);
  const results = Array.isArray(data?.results) ? data!.results! : [];

  let best: { item: Record<string, any>; score: number } | null = null;
  for (const item of results) {
    const titleScore = coverTextSimilarity(song.title, String(item.trackName || ""));
    const artistScore = coverTextSimilarity(song.artistName, String(item.artistName || ""));
    const albumBonus = song.albumName && coverTextSimilarity(song.albumName, String(item.collectionName || "")) >= 0.6 ? 0.08 : 0;
    const score = titleScore * 0.62 + artistScore * 0.38 + albumBonus;
    if (!best || score > best.score) best = { item, score };
  }

  if (!best || best.score < 0.68) return null;
  const artwork = appleHdArtworkUrl(String(best.item.artworkUrl100 || best.item.artworkUrl60 || ""));
  if (!artwork) return null;
  return {
    url: artwork,
    source: "APPLE_ITUNES",
    width: 1200,
    height: 1200,
    confidence: Math.round(Math.min(100, best.score * 100)),
  };
}

async function searchAppleArtistFallback(song: MusicBrainSong): Promise<CoverLookupResult | null> {
  const artistName = String(song.artistName || "").trim();
  if (!artistName) return null;

  const term = encodeURIComponent(artistName);
  const country = encodeURIComponent(process.env.ITUNES_STOREFRONT || "FR");
  const url = `https://itunes.apple.com/search?term=${term}&country=${country}&media=music&entity=song&limit=25`;
  const data = await fetchJsonWithTimeout<{ results?: Array<Record<string, any>> }>(url);
  const results = Array.isArray(data?.results) ? data!.results! : [];

  let best: { item: Record<string, any>; score: number } | null = null;

  for (const item of results) {
    const candidateArtist = String(item.artistName || "");
    const artistScore = coverTextSimilarity(artistName, candidateArtist);

    // Le secours artiste doit rester strict : on refuse les artistes seulement proches.
    if (artistScore < 0.82) continue;

    const artwork = String(item.artworkUrl100 || item.artworkUrl60 || "");
    if (!artwork) continue;

    const candidateTitle = String(item.trackName || "");
    const titleScore = coverTextSimilarity(song.title, candidateTitle);
    const collectionName = String(item.collectionName || "");
    const albumScore = song.albumName
      ? coverTextSimilarity(song.albumName, collectionName)
      : 0;

    // Une correspondance d’album connue est préférable. Sinon, on choisit
    // simplement une pochette fiable appartenant exactement au même artiste.
    const score = artistScore * 0.8 + albumScore * 0.15 + Math.min(titleScore, 0.25) * 0.05;

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  if (!best || best.score < 0.7) return null;

  const artwork = appleHdArtworkUrl(
    String(best.item.artworkUrl100 || best.item.artworkUrl60 || "")
  );
  if (!artwork) return null;

  return {
    url: artwork,
    source: "APPLE_ARTIST_FALLBACK",
    width: 1200,
    height: 1200,
    confidence: Math.round(Math.min(79, Math.max(55, best.score * 100))),
  };
}

async function searchMusicBrainzCover(song: MusicBrainSong): Promise<CoverLookupResult | null> {
  const query = encodeURIComponent(`recording:"${song.title}" AND artist:"${song.artistName}"`);
  const userAgent = process.env.MUSICBRAINZ_USER_AGENT || "MixParty/1.0 (contact: admin@mixparty.app)";
  const data = await fetchJsonWithTimeout<{ recordings?: Array<Record<string, any>> }>(
    `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=5`,
    { headers: { "User-Agent": userAgent, Accept: "application/json" } },
    9000
  );
  const recordings = Array.isArray(data?.recordings) ? data!.recordings! : [];

  for (const recording of recordings) {
    const score = Number(recording.score || 0);
    if (score < 80) continue;
    const releases = Array.isArray(recording.releases) ? recording.releases : [];
    for (const release of releases.slice(0, 4)) {
      const releaseId = String(release.id || "");
      if (!releaseId) continue;
      const coverData = await fetchJsonWithTimeout<{ images?: Array<Record<string, any>> }>(
        `https://coverartarchive.org/release/${encodeURIComponent(releaseId)}`,
        { headers: { "User-Agent": userAgent, Accept: "application/json" } },
        8000
      );
      const images = Array.isArray(coverData?.images) ? coverData!.images! : [];
      const front = images.find((image) => image.front === true) || images[0];
      const thumbnails = front?.thumbnails || {};
      const url = String(thumbnails["1200"] || thumbnails.large || front?.image || "");
      if (!url) continue;
      return {
        url,
        source: "MUSICBRAINZ_CAA",
        width: thumbnails["1200"] ? 1200 : 1000,
        height: thumbnails["1200"] ? 1200 : 1000,
        confidence: Math.min(100, score),
      };
    }
  }
  return null;
}

function persistCoverResult(videoId: string, result: CoverLookupResult | null, failed = false) {
  const learnedSong = musicBrain.songs[videoId];
  if (!learnedSong) return;
  learnedSong.coverLastCheckedAt = Date.now();
  learnedSong.coverAttempts = Number(learnedSong.coverAttempts || 0) + 1;
  if (result) {
    learnedSong.coverStatus = "found";
    learnedSong.coverUrl = result.url;
    learnedSong.coverSource = result.source;
    learnedSong.coverWidth = result.width;
    learnedSong.coverHeight = result.height;
  } else {
    learnedSong.coverStatus = failed ? "error" : "not_found";
    learnedSong.coverUrl = undefined;
    learnedSong.coverSource = undefined;
    learnedSong.coverWidth = undefined;
    learnedSong.coverHeight = undefined;
  }
  saveMusicBrain();
}

function queueHdCoverLookup(videoId: string) {
  const learnedSong = musicBrain.songs[videoId];
  if (!learnedSong || coverLookupsInFlight.has(videoId)) return;

  const retryDelay = learnedSong.coverStatus === "not_found" ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  if (learnedSong.coverStatus === "found" && learnedSong.coverUrl) return;
  if (learnedSong.coverLastCheckedAt && Date.now() - learnedSong.coverLastCheckedAt < retryDelay) return;

  learnedSong.coverStatus = "pending";
  learnedSong.coverLastCheckedAt = Date.now();
  saveMusicBrain();
  coverLookupsInFlight.add(videoId);

  void (async () => {
    try {
      const apple = await searchAppleCover(learnedSong);
      if (apple) {
        persistCoverResult(videoId, apple);
        return;
      }

      let musicBrainzResult: CoverLookupResult | null = null;
      musicBrainzCoverQueue = musicBrainzCoverQueue.then(async () => {
        musicBrainzResult = await searchMusicBrainzCover(learnedSong);
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });
      await musicBrainzCoverQueue;

      if (musicBrainzResult) {
        persistCoverResult(videoId, musicBrainzResult, false);
        return;
      }

      // Dernier secours visuel : une pochette fiable appartenant au même artiste.
      // Elle est clairement identifiée comme fallback artiste pour l’administration.
      const artistFallback = await searchAppleArtistFallback(learnedSong);
      persistCoverResult(videoId, artistFallback, false);
    } catch (error) {
      console.error("HD COVER LOOKUP ERROR", videoId, error);
      persistCoverResult(videoId, null, true);
    } finally {
      coverLookupsInFlight.delete(videoId);
    }
  })();
}

/* =========================================================
   PARTYBRAIN — RECHERCHE AUTONOME DES JAQUETTES CONNUES
   Réutilise exactement le moteur de jaquettes existant.
   ========================================================= */

function knownCoverLookupPriority(song: MusicBrainSong) {
  return (
    Number(song.playedCount || 0) * 8 +
    Number(song.addedCount || 0) * 6 +
    Number(song.voteCount || 0) * 5 +
    Number(song.searchCount || 0) * 2
  );
}

function nextKnownSongNeedingCover(): MusicBrainSong | null {
  const now = Date.now();
  const candidates = Object.values(musicBrain.songs)
    .filter((song) => {
      if (!song.videoId || !song.title || !song.artistName) return false;
      if (song.coverStatus === "found" && song.coverUrl) return false;
      if (song.coverStatus === "pending") return false;
      if (coverLookupsInFlight.has(song.videoId)) return false;
      const lastCheckedAt = Number(song.coverLastCheckedAt || 0);
      const retryDelay =
        song.coverStatus === "not_found"
          ? 7 * 24 * 60 * 60 * 1000
          : song.coverStatus === "error"
            ? 6 * 60 * 60 * 1000
            : 0;
      return !lastCheckedAt || now - lastCheckedAt >= retryDelay;
    })
    .sort((a, b) => {
      const priorityDifference = knownCoverLookupPriority(b) - knownCoverLookupPriority(a);
      if (priorityDifference !== 0) return priorityDifference;
      return Number(a.coverLastCheckedAt || 0) - Number(b.coverLastCheckedAt || 0);
    });
  return candidates[0] || null;
}

function runKnownCoverDiscoveryBatch(batchSize = 1) {
  const safeBatchSize = Math.max(1, Math.min(3, Number(batchSize) || 1));
  let queued = 0;
  while (queued < safeBatchSize) {
    const song = nextKnownSongNeedingCover();
    if (!song) break;
    queueHdCoverLookup(song.videoId);
    queued += 1;
  }
  return queued;
}

const coverDiscoveryEnabled =
  String(process.env.PARTYBRAIN_COVER_DISCOVERY_ENABLED || "true").toLowerCase() !== "false";
const coverDiscoveryIntervalMs = Math.max(
  20_000,
  Number(process.env.PARTYBRAIN_COVER_DISCOVERY_INTERVAL_MS || 45_000)
);
const coverDiscoveryBatchSize = Math.max(
  1,
  Math.min(3, Number(process.env.PARTYBRAIN_COVER_DISCOVERY_BATCH_SIZE || 1))
);

if (coverDiscoveryEnabled) {
  setTimeout(() => {
    runKnownCoverDiscoveryBatch(coverDiscoveryBatchSize);
  }, 8_000);
  setInterval(() => {
    runKnownCoverDiscoveryBatch(coverDiscoveryBatchSize);
  }, coverDiscoveryIntervalMs);
}

function learnedCoverFor(videoId: string) {
  const learnedSong = musicBrain.songs[videoId];
  if (!learnedSong || learnedSong.coverStatus !== "found" || !learnedSong.coverUrl) {
    return {
      coverStatus: learnedSong?.coverStatus || undefined,
      coverLastCheckedAt: learnedSong?.coverLastCheckedAt,
    };
  }
  return {
    coverStatus: learnedSong.coverStatus,
    coverUrl: learnedSong.coverUrl,
    coverSource: learnedSong.coverSource,
    coverWidth: learnedSong.coverWidth,
    coverHeight: learnedSong.coverHeight,
    coverLastCheckedAt: learnedSong.coverLastCheckedAt,
  };
}

function upsertMusicBrainSong(params: {
  videoId: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  durationSeconds?: number;
  artistName?: string;
  sourceQuery?: string;
  collaborators?: string[];
  albumName?: string;
  metadataSource?: MusicMetadataSource;
  metadataConfidence?: number;
  rawTitle?: string;
}) {
  const now = Date.now();
  const inferred = inferArtistCredits(params, params.sourceQuery || params.title);
  const credits = params.artistName ? splitArtistCredits(params.artistName, params.sourceQuery || "") : inferred;
  const artistName = cleanArtistName(credits.main);
  const artistKey = normalizeMusicQuery(artistName) || normalizeMusicQuery(params.sourceQuery || "") || "unknown";
  const existing = musicBrain.songs[params.videoId];
  const song: MusicBrainSong = existing || {
    videoId: params.videoId,
    title: params.title,
    thumbnail: params.thumbnail || "",
    channelTitle: params.channelTitle,
    durationSeconds: params.durationSeconds,
    artistKey,
    artistName,
    firstSeenAt: now,
    lastSeenAt: now,
    searchCount: 0,
    addedCount: 0,
    playedCount: 0,
    voteCount: 0,
  };

  song.rawTitle = params.rawTitle || song.rawTitle || params.title;
  song.title = cleanTrackTitle(params.title || song.title, artistName);
  song.thumbnail = params.thumbnail || song.thumbnail;
  song.channelTitle = params.channelTitle || song.channelTitle;
  song.durationSeconds = params.durationSeconds ?? song.durationSeconds;
  song.artistKey = artistKey;
  song.artistName = artistName;
  song.featuredArtistNames = [...new Set([...credits.collaborators, ...(params.collaborators || [])].map(normalizeArtistToken).filter(Boolean))];
  song.featuredArtistKeys = song.featuredArtistNames.map(normalizeMusicQuery).filter(Boolean);
  song.albumName = params.albumName || song.albumName;
  song.metadataSource = params.metadataSource || song.metadataSource;
  song.metadataConfidence = params.metadataConfidence ?? song.metadataConfidence;
  song.lastSeenAt = now;
  musicBrain.songs[params.videoId] = song;

  const artist = musicBrain.artists[artistKey] || {
    key: artistKey,
    name: artistName,
    aliases: [],
    collaborators: {},
    firstSeenAt: now,
    lastSeenAt: now,
    searchCount: 0,
    songs: {},
  };
  artist.name = artistName || artist.name;
  artist.lastSeenAt = now;
  const alias = cleanArtistName(params.sourceQuery || "");
  if (alias && normalizeMusicQuery(alias) !== artistKey && !artist.aliases.includes(alias)) {
    artist.aliases.push(alias);
    artist.aliases = artist.aliases.slice(-20);
  }
  artist.songs[params.videoId] = song;
  musicBrain.artists[artistKey] = artist;
  for (const collaborator of song.featuredArtistNames || []) {
    recordArtistRelation(artistName, collaborator);
  }
  return song;
}

function musicBrainLearningDecision(params: {
  artistName?: string;
  channelTitle?: string;
  title?: string;
  rawTitle?: string;
  metadataSource?: MusicMetadataSource;
  metadataConfidence?: number;
  sourceQuery?: string;
}) {
  const artistName = cleanArtistName(params.artistName || "");
  const artistKey = normalizeMusicQuery(artistName);
  const channelKey = normalizeMusicQuery(params.channelTitle || "");
  const titleText = `${params.rawTitle || ""} ${params.title || ""}`.toLowerCase();
  const confidence = Number(params.metadataConfidence || 0);

  const clearlyUnknown =
    !artistKey ||
    /^(unknown|inconnu|artiste inconnu|unknown artist|various artists?|divers)$/i.test(artistName);

  const genericArtist =
    /^(art|music|musique|official|officiel|topic|audio|video|records?|recordings?|channel|youtube)$/i.test(artistName);

  const junkContent =
    /(reaction|reacts?|podcast|interview|documentary|documentaire|making of|behind the scenes|#shorts|\bshorts?\b|audition|the voice|incroyable talent|concours|talent show)/i.test(
      `${titleText} ${params.channelTitle || ""}`
    );

  const strongMetadata =
    params.metadataSource === "ART_TRACK_DESCRIPTION" ||
    confidence >= 72;

  const officialChannel =
    /\b(topic|vevo|official|officiel)\b/i.test(String(params.channelTitle || ""));

  const artistChannelMatch =
    Boolean(
      artistKey &&
      channelKey &&
      (channelKey.includes(artistKey) || artistKey.includes(channelKey))
    );

  // Un nom générique peut exceptionnellement être un vrai artiste.
  // On ne l'accepte que si YouTube fournit un signal très fort.
  const genericButStrong =
    genericArtist &&
    (
      params.metadataSource === "ART_TRACK_DESCRIPTION" ||
      (confidence >= 85 && officialChannel && artistChannelMatch)
    );

  if (junkContent) return { learn: false, reason: "contenu_non_musical" };
  if (clearlyUnknown) return { learn: false, reason: "artiste_inconnu" };
  if (genericArtist && !genericButStrong) return { learn: false, reason: "artiste_generique" };

  // IMPORTANT :
  // QUERY_FALLBACK ou une confiance faible ne suffisent PAS à rejeter un morceau.
  // De vrais artistes peuvent être mal décrits par YouTube (ex. Aznavour, Big Ali).
  // On ne bloque automatiquement que les erreurs évidentes : inconnu, artiste
  // générique non confirmé ou contenu clairement non musical.
  //
  // Les métadonnées faibles restent apprises, mais elles apparaissent dans
  // l'outil "Entrées incertaines" pour contrôle manuel.

  return {
    learn: true,
    reason:
      params.metadataSource === "QUERY_FALLBACK" || (!strongMetadata && !officialChannel && !artistChannelMatch)
        ? "fiable_a_verifier"
        : "fiable",
  };
}

function shouldLearnSearchResult(result: YoutubeSearchResult, query: string) {
  return musicBrainLearningDecision({
    artistName: result.artistName,
    channelTitle: result.channelTitle,
    title: result.title,
    rawTitle: result.rawTitle,
    metadataSource: result.metadataSource,
    metadataConfidence: result.metadataConfidence,
    sourceQuery: query,
  });
}

function shouldLearnPartySong(song: Song) {
  const existing = song.videoId ? musicBrain.songs[song.videoId] : undefined;
  if (existing) {
    const existingDecision = musicBrainLearningDecision({
      artistName: existing.artistName,
      channelTitle: existing.channelTitle,
      title: existing.title,
      rawTitle: existing.rawTitle,
      metadataSource: existing.metadataSource,
      metadataConfidence: existing.metadataConfidence,
    });
    if (existingDecision.learn) return existingDecision;
  }

  return musicBrainLearningDecision({
    artistName: song.artistName,
    title: song.title,
    metadataSource: song.metadataSource,
    metadataConfidence: song.metadataConfidence,
    sourceQuery: song.sourceQuery,
  });
}

function recordMusicBrainSearch(query: string, results: YoutubeSearchResult[]) {
  // Important : les résultats restent affichés à l'utilisateur.
  // Ce filtre agit uniquement sur ce que PartyBrain apprend.
  musicBrain.totals.searches += 1;
  const touchedArtists = new Set<string>();
  const learnedVideoIds = new Set<string>();

  for (const result of results) {
    const decision = shouldLearnSearchResult(result, query);
    if (!decision.learn) continue;

    const song = upsertMusicBrainSong({
      videoId: result.id,
      title: result.title,
      thumbnail: result.thumbnail,
      channelTitle: result.channelTitle,
      durationSeconds: result.durationSeconds,
      artistName: result.artistName,
      collaborators: result.featuredArtistNames,
      albumName: result.albumName,
      metadataSource: result.metadataSource,
      metadataConfidence: result.metadataConfidence,
      rawTitle: result.rawTitle,
      sourceQuery: query,
    });
    song.searchCount += 1;
    touchedArtists.add(song.artistKey);
    learnedVideoIds.add(song.videoId);
  }

  for (const artistKey of touchedArtists) {
    const artist = musicBrain.artists[artistKey];
    if (artist) artist.searchCount += 1;
  }

  saveMusicBrain();

  // Dès qu'un morceau fiable entre dans MusicBrain, LRCLIB est vérifié
  // automatiquement en arrière-plan. Academy utilise aussi cette fonction.
  for (const videoId of learnedVideoIds) {
    enqueueAutomaticLrclibCheck(videoId, "musicbrain-search");
  }
}

function recordMusicBrainAddition(song: Song) {
  if (!song.videoId) return;
  musicBrain.totals.additions += 1;

  const decision = shouldLearnPartySong(song);
  if (!decision.learn) {
    saveMusicBrain();
    return;
  }

  const item = upsertMusicBrainSong({
    videoId: song.videoId,
    title: song.title,
    thumbnail: song.thumbnail,
    artistName: song.artistName,
    collaborators: song.featuredArtistNames,
    albumName: song.albumName,
    metadataSource: song.metadataSource,
    metadataConfidence: song.metadataConfidence,
    sourceQuery: song.sourceQuery,
  });
  item.addedCount += 1;
  saveMusicBrain();

  // Filet de sécurité : un morceau ajouté est également vérifié s'il ne
  // possède pas encore de statut LRCLIB exploitable.
  enqueueAutomaticLrclibCheck(item.videoId, "party-addition");
}

function recordMusicBrainVote(song: Song) {
  if (!song.videoId) return;
  musicBrain.totals.votes += 1;

  const decision = shouldLearnPartySong(song);
  if (!decision.learn) {
    saveMusicBrain();
    return;
  }

  const item = upsertMusicBrainSong({
    videoId: song.videoId,
    title: song.title,
    thumbnail: song.thumbnail,
    artistName: song.artistName,
    collaborators: song.featuredArtistNames,
    albumName: song.albumName,
    metadataSource: song.metadataSource,
    metadataConfidence: song.metadataConfidence,
    sourceQuery: song.sourceQuery,
  });
  item.voteCount += 1;
  saveMusicBrain();
}

function recordMusicBrainPlay(song: Song, previous?: Song | null) {
  if (!song.videoId) return;
  musicBrain.totals.plays += 1;

  const decision = shouldLearnPartySong(song);
  if (!decision.learn) {
    saveMusicBrain();
    return;
  }

  const item = upsertMusicBrainSong({
    videoId: song.videoId,
    title: song.title,
    thumbnail: song.thumbnail,
    artistName: song.artistName,
    collaborators: song.featuredArtistNames,
    albumName: song.albumName,
    metadataSource: song.metadataSource,
    metadataConfidence: song.metadataConfidence,
    sourceQuery: song.sourceQuery,
  });
  item.playedCount += 1;

  // First playback stays on the MixParty logo. The HD cover is fetched asynchronously
  // and will be attached the next time this videoId is added to a party.
  if (item.coverStatus !== "found" || !item.coverUrl) {
    queueHdCoverLookup(item.videoId);
  }

  if (previous?.videoId && previous.videoId !== song.videoId) {
    const key = `${previous.videoId}>>${song.videoId}`;
    const transition = musicBrain.transitions[key] || {
      fromVideoId: previous.videoId,
      toVideoId: song.videoId,
      count: 0,
      lastSeenAt: Date.now(),
    };
    transition.count += 1;
    transition.lastSeenAt = Date.now();
    musicBrain.transitions[key] = transition;
  }
  saveMusicBrain();
}

function musicBrainStats() {
  const songs = Object.values(musicBrain.songs);
  const artists = Object.values(musicBrain.artists);
  const scoreSong = (song: MusicBrainSong) =>
    Number(song.searchCount || 0) + Number(song.addedCount || 0) * 3 +
    Number(song.playedCount || 0) * 2 + Number(song.voteCount || 0) * 2;
  const topSongs = [...songs]
    .sort((a, b) => scoreSong(b) - scoreSong(a))
    .slice(0, 20)
    .map((song) => ({ ...song, score: scoreSong(song) }));
  const topArtists = [...artists]
    .map((artist) => ({
      key: artist.key,
      name: artist.name,
      searchCount: artist.searchCount,
      songCount: Object.keys(artist.songs || {}).length,
      totalAdds: Object.values(artist.songs || {}).reduce((sum, song) => sum + Number(song.addedCount || 0), 0),
      totalVotes: Object.values(artist.songs || {}).reduce((sum, song) => sum + Number(song.voteCount || 0), 0),
    }))
    .sort((a, b) => (b.searchCount + b.totalAdds * 2 + b.totalVotes) - (a.searchCount + a.totalAdds * 2 + a.totalVotes))
    .slice(0, 20);

  const coverStats = songs.reduce(
    (stats, song) => {
      const status = song.coverStatus;
      const source = String(song.coverSource || "");

      if (status === "found" && song.coverUrl) {
        stats.downloaded += 1;

        if (source === "APPLE_ARTIST_FALLBACK") {
          stats.artistFallback += 1;
        } else if (
          source === "APPLE_ITUNES" ||
          source === "MUSICBRAINZ_CAA" ||
          source === "MANUAL"
        ) {
          stats.exactMatches += 1;
        }
      } else if (status === "pending") {
        stats.pending += 1;
      } else if (status === "not_found") {
        stats.notFound += 1;
      } else if (status === "error") {
        stats.errors += 1;
      } else {
        stats.unrequested += 1;
      }

      return stats;
    },
    {
      downloaded: 0,
      pending: 0,
      active: coverLookupsInFlight.size,
      exactMatches: 0,
      artistFallback: 0,
      notFound: 0,
      errors: 0,
      unrequested: 0,
    }
  );

  const topTransitions = Object.values(musicBrain.transitions)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((transition) => ({
      ...transition,
      fromTitle: musicBrain.songs[transition.fromVideoId]?.title || transition.fromVideoId,
      toTitle: musicBrain.songs[transition.toVideoId]?.title || transition.toVideoId,
    }));

  const artistRelations = Object.values(musicBrain.artistRelations || {});
  const topArtistRelations = artistRelations
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)
    .map((relation) => ({ ...relation, fromName: musicBrain.artists[relation.fromKey]?.name || relation.fromKey, toName: musicBrain.artists[relation.toKey]?.name || relation.toKey }));

  const knowledgePoints =
    artists.length * 25 + songs.length * 5 + Object.keys(musicBrain.transitions).length * 10 + artistRelations.length * 8 +
    musicBrain.totals.searches + musicBrain.totals.additions * 2 + musicBrain.totals.votes;
  const level = Math.max(1, Math.floor(Math.sqrt(knowledgePoints / 100)) + 1);
  const currentLevelStart = Math.pow(level - 1, 2) * 100;
  const nextLevelStart = Math.pow(level, 2) * 100;
  const levelProgress = Math.max(0, Math.min(100,
    Math.round(((knowledgePoints - currentLevelStart) / Math.max(1, nextLevelStart - currentLevelStart)) * 100)
  ));

  return {
    version: musicBrain.version,
    brain: { name: "PartyBrain", level, levelProgress, knowledgePoints },
    storage: {
      mode: process.env.PERSISTENT_DATA_DIR ? "railway-volume" : "local-json",
      path: persistentDataDir,
      persistent: Boolean(process.env.PERSISTENT_DATA_DIR),
    },
    createdAt: musicBrain.createdAt,
    updatedAt: musicBrain.updatedAt,
    totals: {
      ...musicBrain.totals,
      artists: artists.length,
      songs: songs.length,
      transitions: Object.keys(musicBrain.transitions).length,
      artistRelations: artistRelations.length,
      youtubeCalls: youtubeSearchStats.youtubeCalls,
      quotaSaved: youtubeSearchStats.quotaSaved,
    },
    covers: coverStats,
    academy: academyDashboard(),
    topArtists,
    topSongs,
    topTransitions,
    topArtistRelations,
  };
}



type PartyBrainRecommendationBreakdown = {
  transition: number;
  artistAffinity: number;
  popularity: number;
  completion: number;
  votes: number;
  hourFit: number;
  freshness: number;
  penalties: number;
};

type PartyBrainRecommendation = {
  videoId: string;
  title: string;
  thumbnail: string;
  artistName: string;
  durationSeconds?: number;
  score: number;
  confidence: number;
  breakdown: PartyBrainRecommendationBreakdown;
  reasons: string[];
  evidence: {
    searches: number;
    additions: number;
    plays: number;
    votes: number;
    completed: number;
    skipped: number;
    removed: number;
    directTransitions: number;
    artistTransitions: number;
    hourSamples: number;
  };
};

function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function logarithmicRatio(value: number, reference: number) {
  if (value <= 0) return 0;
  return clampScore(Math.log1p(value) / Math.log1p(Math.max(1, reference)), 0, 1);
}


type PartyBrainGenreTag =
  | "rap_fr"
  | "rap_us"
  | "afro"
  | "dance_electro"
  | "pop"
  | "rock"
  | "latin"
  | "disco_funk"
  | "chanson_fr"
  | "unknown";

function inferPartyBrainGenre(title: string, artistName: string): PartyBrainGenreTag {
  const value = normalizeMusicQuery(`${artistName} ${title}`);
  const contains = (...terms: string[]) => terms.some((term) => value.includes(term));

  if (contains("jul", "ninho", "gazo", "sdm", "tiakola", "sch", "booba", "damso", "nekfeu", "orelsan", "pnl", "koba", "naps", "soprano", "gims", "maitre gims", "rap francais", "rap fr")) return "rap_fr";
  if (contains("drake", "travis scott", "eminem", "kanye", "kendrick", "50 cent", "lil ", "hip hop", "rap us")) return "rap_us";
  if (contains("aya nakamura", "burna boy", "wizkid", "afrobeat", "afro", "amapiano", "dadju", "tayc")) return "afro";
  if (contains("david guetta", "calvin harris", "avicii", "dj snake", "martin garrix", "house", "techno", "electro", "dance")) return "dance_electro";
  if (contains("reggaeton", "bad bunny", "j balvin", "daddy yankee", "latin", "bachata", "salsa")) return "latin";
  if (contains("disco", "funk", "earth wind", "kool and the gang", "nuit de folie")) return "disco_funk";
  if (contains("rock", "metallica", "nirvana", "ac dc", "queen", "linkin park")) return "rock";
  if (contains("stromae", "indila", "louane", "vianney", "chanson francaise")) return "chanson_fr";
  if (contains("pop", "dua lipa", "the weeknd", "rihanna", "lady gaga", "katy perry", "bruno mars")) return "pop";
  return "unknown";
}

function partyBrainGenreCompatibility(from: PartyBrainGenreTag, to: PartyBrainGenreTag) {
  if (from === "unknown" || to === "unknown") return 0;
  if (from === to) return 1;
  const compatible: Record<PartyBrainGenreTag, PartyBrainGenreTag[]> = {
    rap_fr: ["afro", "rap_us", "pop"],
    rap_us: ["rap_fr", "afro", "pop"],
    afro: ["rap_fr", "rap_us", "latin", "pop", "dance_electro"],
    dance_electro: ["pop", "disco_funk", "afro", "latin"],
    pop: ["dance_electro", "afro", "disco_funk", "rock", "chanson_fr"],
    rock: ["pop"],
    latin: ["afro", "dance_electro", "pop"],
    disco_funk: ["dance_electro", "pop"],
    chanson_fr: ["pop"],
    unknown: [],
  };
  return compatible[from].includes(to) ? 0.55 : -0.35;
}


function inferPartyBrainContextGenre(party: Party): PartyBrainGenreTag {
  const recentSongs = [
    ...(party.history || []).slice(-8),
    ...(party.currentSong ? [party.currentSong] : []),
  ];

  const scores = new Map<PartyBrainGenreTag, number>();

  recentSongs.forEach((song, index) => {
    const genre = inferPartyBrainGenre(song.title || "", song.artistName || "");
    if (genre === "unknown") return;

    const recencyWeight = 1 + index / Math.max(1, recentSongs.length);
    const isPartyBrain = String(song.addedBy || "").toLowerCase().includes("partybrain");
    const sourceWeight = isPartyBrain ? 0.8 : 2.4;
    const currentWeight = party.currentSong?.videoId === song.videoId ? 1.6 : 1;

    scores.set(
      genre,
      (scores.get(genre) || 0) + recencyWeight * sourceWeight * currentWeight
    );
  });

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0]) return ranked[0][0];

  return inferPartyBrainGenre(
    party.currentSong?.title || "",
    party.currentSong?.artistName || ""
  );
}

function recentPartyBrainSelectionStats(events: PartyIntelligenceEvent[]) {
  const now = Date.now();
  const stats = new Map<string, { count: number; lastAt: number }>();
  for (const event of events) {
    if (event.event !== "SONG_ADDED" || event.source !== "partybrain_suggestion" || !event.song?.videoId) continue;
    const relayMode = String(event.context?.relayMode || "");
    if (!relayMode) continue;
    const current = stats.get(event.song.videoId) || { count: 0, lastAt: 0 };
    current.count += 1;
    current.lastAt = Math.max(current.lastAt, event.at);
    stats.set(event.song.videoId, current);
  }
  return { now, stats };
}


function isPartyBrainRelaySafeSong(song: MusicBrainSong) {
  const titleText = `${song.rawTitle || ""} ${song.title || ""}`.toLowerCase();
  const channelText = String(song.channelTitle || "").toLowerCase();
  const combined = `${titleText} ${channelText}`;

  // PartyBrain Relay doit éviter les reprises amateurs, karaokés, parodies,
  // auditions et autres vidéos qui ne correspondent pas à la version officielle.
  if (/(karaoke|instrumental|cover|reprise|tribute|hommage|parodie|fanmade|fan made|amateur|audition|the voice|incroyable talent|chorale|choir|school|école|concours|talent show)/i.test(combined)) {
    return false;
  }

  if (/(reaction|reacts?|interview|podcast|documentary|documentaire|making of|behind the scenes|shorts?|#shorts)/i.test(combined)) {
    return false;
  }

  const artistKey = normalizeMusicQuery(song.artistName || "");
  const channelKey = normalizeMusicQuery(song.channelTitle || "");
  const officialChannel = /(official|vevo|topic|provided to youtube)/i.test(channelText);
  const artistChannel = Boolean(artistKey && channelKey && (channelKey.includes(artistKey) || artistKey.includes(channelKey)));
  const trustedMetadata =
    song.metadataSource === "ART_TRACK_DESCRIPTION" ||
    Number(song.metadataConfidence || 0) >= 65;

  return officialChannel || artistChannel || trustedMetadata;
}

function chooseDiversifiedPartyBrainRecommendation(
  recommendations: PartyBrainRecommendation[],
  party: Party
): PartyBrainRecommendation | null {
  if (!recommendations.length) return null;

  const current = party.currentSong || party.history?.[party.history.length - 1] || null;
  const currentArtistKey = normalizeMusicQuery(current?.artistName || "");
  const currentGenre = inferPartyBrainContextGenre(party);

  const enriched = recommendations.map((item, index) => {
    const candidateArtistKey = normalizeMusicQuery(item.artistName || "");
    const candidateGenre = inferPartyBrainGenre(item.title, item.artistName);
    const compatibility = partyBrainGenreCompatibility(currentGenre, candidateGenre);
    const sameArtist = Boolean(currentArtistKey && candidateArtistKey === currentArtistKey);
    const learnedEvidence =
      Number(item.evidence.directTransitions || 0) * 2 +
      Number(item.evidence.artistTransitions || 0);

    return {
      item,
      index,
      compatibility,
      sameArtist,
      learnedEvidence,
    };
  });

  // 1. Même artiste : idéal pour prolonger naturellement une série Gims, Jul, etc.
  const sameArtistPool = enriched.filter((entry) => entry.sameArtist);

  // 2. Style compatible reconnu.
  const compatiblePool = enriched.filter((entry) => entry.compatibility >= 0.55);

  // 3. Transition réellement apprise, même lorsque le genre est encore inconnu.
  const learnedPool = enriched.filter((entry) => entry.learnedEvidence > 0);

  // 4. Démarrage à froid : les morceaux sont déjà filtrés contre les contenus amateurs.
  // On autorise donc le meilleur candidat sûr lorsque PartyBrain ne connaît pas encore le genre.
  const sourcePool = sameArtistPool.length
    ? sameArtistPool
    : compatiblePool.length
      ? compatiblePool
      : learnedPool.length
        ? learnedPool
        : currentGenre === "unknown"
          ? enriched
          : [];

  if (!sourcePool.length) return null;

  return sourcePool
    .slice(0, Math.min(12, sourcePool.length))
    .map((entry) => {
      const sameArtistBonus = entry.sameArtist ? 30 : 0;
      const compatibilityBonus = entry.compatibility >= 0.55 ? entry.compatibility * 16 : 0;
      const learnedTransitionBonus = Math.min(22, entry.learnedEvidence * 4);
      const rankPenalty = entry.index * 1.1;

      return {
        item: entry.item,
        value:
          entry.item.score +
          sameArtistBonus +
          compatibilityBonus +
          learnedTransitionBonus -
          rankPenalty,
      };
    })
    .sort((a, b) => b.value - a.value)[0]?.item || null;
}

function buildPartyBrainRecommendationScores(
  party: Party,
  requestedLimit = 10
): PartyBrainRecommendation[] {
  const events = readPartyEvents(50000).sort((a, b) => a.at - b.at);
  const relaySelections = recentPartyBrainSelectionStats(events);
  const currentHour = new Date().getHours();

  const songOutcomes = new Map<string, {
    completed: number;
    skipped: number;
    removed: number;
    votes: number;
    additions: number;
    hourSamples: number;
    hourPositive: number;
    hourNegative: number;
  }>();

  const artistOutcomes = new Map<string, {
    completed: number;
    skipped: number;
    removed: number;
    votes: number;
    additions: number;
    hourSamples: number;
    hourPositive: number;
    hourNegative: number;
  }>();

  const artistTransitionCounts = new Map<string, number>();
  let maxDirectTransitionCount = 1;
  let maxArtistTransitionCount = 1;

  const playStartsByParty = new Map<string, PartyIntelligenceEvent[]>();

  for (const event of events) {
    if (event.event === "SONG_PLAY_STARTED" && event.song) {
      const sequence = playStartsByParty.get(event.partyCode) || [];
      sequence.push(event);
      playStartsByParty.set(event.partyCode, sequence);
    }

    if (!event.song?.videoId) continue;

    const videoId = event.song.videoId;
    const artistName = String(event.song.artistName || "").trim();
    const artistKey = normalizeMusicQuery(artistName);

    const songStats = songOutcomes.get(videoId) || {
      completed: 0,
      skipped: 0,
      removed: 0,
      votes: 0,
      additions: 0,
      hourSamples: 0,
      hourPositive: 0,
      hourNegative: 0,
    };

    const artistStats = artistOutcomes.get(artistKey) || {
      completed: 0,
      skipped: 0,
      removed: 0,
      votes: 0,
      additions: 0,
      hourSamples: 0,
      hourPositive: 0,
      hourNegative: 0,
    };

    const hourDistance = Math.min(
      Math.abs(event.localHour - currentHour),
      24 - Math.abs(event.localHour - currentHour)
    );
    const closeToCurrentHour = hourDistance <= 2;

    if (event.event === "SONG_ADDED") {
      songStats.additions += 1;
      artistStats.additions += 1;
      if (closeToCurrentHour) {
        songStats.hourSamples += 1;
        songStats.hourPositive += 1;
        artistStats.hourSamples += 1;
        artistStats.hourPositive += 1;
      }
    }

    if (event.event === "SONG_VOTED") {
      songStats.votes += 1;
      artistStats.votes += 1;
      if (closeToCurrentHour) {
        songStats.hourSamples += 1;
        songStats.hourPositive += 1;
        artistStats.hourSamples += 1;
        artistStats.hourPositive += 1;
      }
    }

    if (event.event === "SONG_PLAY_COMPLETED") {
      songStats.completed += 1;
      artistStats.completed += 1;
      if (closeToCurrentHour) {
        songStats.hourSamples += 1;
        songStats.hourPositive += 2;
        artistStats.hourSamples += 1;
        artistStats.hourPositive += 2;
      }
    }

    if (event.event === "SONG_SKIPPED") {
      songStats.skipped += 1;
      artistStats.skipped += 1;
      if (closeToCurrentHour) {
        songStats.hourSamples += 1;
        songStats.hourNegative += 2;
        artistStats.hourSamples += 1;
        artistStats.hourNegative += 2;
      }
    }

    if (event.event === "SONG_REMOVED") {
      songStats.removed += 1;
      artistStats.removed += 1;
      if (closeToCurrentHour) {
        songStats.hourSamples += 1;
        songStats.hourNegative += 2;
        artistStats.hourSamples += 1;
        artistStats.hourNegative += 2;
      }
    }

    songOutcomes.set(videoId, songStats);
    if (artistKey) artistOutcomes.set(artistKey, artistStats);
  }

  for (const sequence of playStartsByParty.values()) {
    sequence.sort((a, b) => a.at - b.at);

    for (let index = 1; index < sequence.length; index += 1) {
      const previous = sequence[index - 1];
      const next = sequence[index];
      const fromArtist = normalizeMusicQuery(previous.song?.artistName || "");
      const toArtist = normalizeMusicQuery(next.song?.artistName || "");

      if (!fromArtist || !toArtist) continue;
      const key = `${fromArtist}>>${toArtist}`;
      const count = (artistTransitionCounts.get(key) || 0) + 1;
      artistTransitionCounts.set(key, count);
      maxArtistTransitionCount = Math.max(maxArtistTransitionCount, count);
    }
  }

  for (const transition of Object.values(musicBrain.transitions)) {
    maxDirectTransitionCount = Math.max(maxDirectTransitionCount, Number(transition.count || 0));
  }

  const recentSongs = [
    ...(party.history || []).slice(-8),
    ...(party.currentSong ? [party.currentSong] : []),
  ];

  const currentSong = party.currentSong || recentSongs[recentSongs.length - 1] || null;
  const currentArtistKey = normalizeMusicQuery(currentSong?.artistName || "");
  const recentVideoIds = new Set([
    ...recentSongs.map((song) => song.videoId),
    ...(party.songs || []).map((song) => song.videoId),
  ]);
  const lastTwoArtistKeys = recentSongs
    .slice(-2)
    .map((song) => normalizeMusicQuery(song.artistName || ""))
    .filter(Boolean);

  const maxSearches = Math.max(1, ...Object.values(musicBrain.songs).map((song) => Number(song.searchCount || 0)));
  const maxAdds = Math.max(1, ...Object.values(musicBrain.songs).map((song) => Number(song.addedCount || 0)));
  const maxPlays = Math.max(1, ...Object.values(musicBrain.songs).map((song) => Number(song.playedCount || 0)));
  const maxVotes = Math.max(1, ...Object.values(musicBrain.songs).map((song) => Number(song.voteCount || 0)));

  const recommendations: PartyBrainRecommendation[] = [];

  for (const candidate of Object.values(musicBrain.songs)) {
    if (!candidate.videoId || !candidate.title || recentVideoIds.has(candidate.videoId)) continue;
    if (!isPartyBrainRelaySafeSong(candidate)) continue;

    const candidateArtistKey = normalizeMusicQuery(candidate.artistName || "");
    const outcomes = songOutcomes.get(candidate.videoId) || {
      completed: 0,
      skipped: 0,
      removed: 0,
      votes: 0,
      additions: 0,
      hourSamples: 0,
      hourPositive: 0,
      hourNegative: 0,
    };
    const artistStats = artistOutcomes.get(candidateArtistKey) || {
      completed: 0,
      skipped: 0,
      removed: 0,
      votes: 0,
      additions: 0,
      hourSamples: 0,
      hourPositive: 0,
      hourNegative: 0,
    };

    const directTransition = currentSong
      ? musicBrain.transitions[`${currentSong.videoId}>>${candidate.videoId}`]
      : undefined;
    const directTransitionCount = Number(directTransition?.count || 0);

    const artistTransitionCount = currentArtistKey && candidateArtistKey
      ? Number(artistTransitionCounts.get(`${currentArtistKey}>>${candidateArtistKey}`) || 0)
      : 0;

    const knownArtistRelation = currentArtistKey && candidateArtistKey
      ? Number(musicBrain.artistRelations[`${currentArtistKey}>>${candidateArtistKey}`]?.count || 0)
      : 0;

    const transitionEvidence = directTransitionCount * 2 + artistTransitionCount + knownArtistRelation;
    const transitionPart = clampScore(
      (
        logarithmicRatio(directTransitionCount, maxDirectTransitionCount) * 0.62 +
        logarithmicRatio(artistTransitionCount + knownArtistRelation, maxArtistTransitionCount) * 0.38
      ) * 28,
      0,
      28
    );

    let recentAffinity = 0;
    const recentArtists = recentSongs
      .slice(-6)
      .map((song) => normalizeMusicQuery(song.artistName || ""))
      .filter(Boolean);

    recentArtists.forEach((artistKey, index) => {
      const recencyWeight = (index + 1) / Math.max(1, recentArtists.length);
      if (artistKey === candidateArtistKey) {
        recentAffinity += 0.9 * recencyWeight;
      }

      const relation = musicBrain.artistRelations[`${artistKey}>>${candidateArtistKey}`];
      if (relation) {
        recentAffinity += Math.min(1, Number(relation.count || 0) / 5) * recencyWeight;
      }
    });

    const artistAffinityPart = clampScore((recentAffinity / Math.max(1, recentArtists.length * 0.7)) * 18, 0, 18);

    const currentGenre = inferPartyBrainContextGenre(party);
    const candidateGenre = inferPartyBrainGenre(candidate.title, candidate.artistName || "");
    const genreCompatibility = partyBrainGenreCompatibility(currentGenre, candidateGenre);
    const coldStartGenreBonus = genreCompatibility > 0 ? genreCompatibility * 12 : 0;
    const coldStartGenrePenalty = genreCompatibility < 0 ? Math.abs(genreCompatibility) * 9 : 0;

    const popularityRatio =
      logarithmicRatio(candidate.searchCount, maxSearches) * 0.15 +
      logarithmicRatio(candidate.addedCount, maxAdds) * 0.35 +
      logarithmicRatio(candidate.playedCount, maxPlays) * 0.2 +
      logarithmicRatio(candidate.voteCount, maxVotes) * 0.3;
    const popularityPart = clampScore(popularityRatio * 15, 0, 15);

    const completed = outcomes.completed;
    const skipped = outcomes.skipped;
    const observedFinishes = completed + skipped;
    const smoothedCompletionRate = (completed + 3) / (observedFinishes + 5);
    const completionPart = clampScore(smoothedCompletionRate * 14, 0, 14);

    const voteDenominator = Math.max(1, candidate.addedCount + candidate.playedCount);
    const voteRate = candidate.voteCount / voteDenominator;
    const votesPart = clampScore((1 - Math.exp(-voteRate)) * 10, 0, 10);

    const combinedHourSamples = outcomes.hourSamples + artistStats.hourSamples;
    const hourPositive = outcomes.hourPositive + artistStats.hourPositive * 0.45;
    const hourNegative = outcomes.hourNegative + artistStats.hourNegative * 0.45;
    const hourRate = combinedHourSamples
      ? (hourPositive + 1.5) / (hourPositive + hourNegative + 3)
      : 0.5;
    const hourFitPart = clampScore(hourRate * 7, 0, 7);

    const ageDays = Math.max(0, (Date.now() - Number(candidate.lastSeenAt || candidate.firstSeenAt || Date.now())) / 86400000);
    const recencySignal = Math.exp(-ageDays / 180);
    const metadataSignal = clampScore(Number(candidate.metadataConfidence || 45) / 100, 0, 1);
    const freshnessPart = clampScore((recencySignal * 0.55 + metadataSignal * 0.45) * 8, 0, 8);

    let penalties = 0;
    const totalNegativeOutcomes = outcomes.skipped + outcomes.removed;
    const negativeRate = totalNegativeOutcomes / Math.max(1, outcomes.completed + totalNegativeOutcomes);

    penalties += clampScore(negativeRate * 18, 0, 18);
    penalties += clampScore((outcomes.removed / Math.max(1, outcomes.additions)) * 12, 0, 12);

    if (lastTwoArtistKeys.includes(candidateArtistKey)) penalties += 7;
    if (candidate.durationSeconds && (candidate.durationSeconds < 90 || candidate.durationSeconds > 480)) penalties += 4;
    if (Number(candidate.metadataConfidence || 0) < 30) penalties += 3;

    const relaySelection = relaySelections.stats.get(candidate.videoId);
    if (relaySelection) {
      const hoursSinceSelection = (relaySelections.now - relaySelection.lastAt) / 3600000;
      penalties += Math.min(24, relaySelection.count * 4);
      if (hoursSinceSelection < 6) penalties += 20;
      else if (hoursSinceSelection < 24) penalties += 12;
      else if (hoursSinceSelection < 72) penalties += 6;
    }
    penalties += coldStartGenrePenalty;

    const rawScore =
      transitionPart +
      artistAffinityPart +
      popularityPart +
      completionPart +
      votesPart +
      hourFitPart +
      freshnessPart +
      coldStartGenreBonus -
      penalties;

    const score = Math.round(clampScore(rawScore));
    const evidenceVolume =
      Number(candidate.searchCount || 0) +
      Number(candidate.addedCount || 0) * 2 +
      Number(candidate.playedCount || 0) * 2 +
      Number(candidate.voteCount || 0) +
      completed +
      skipped +
      outcomes.removed +
      transitionEvidence * 2;

    const confidence = Math.round(
      clampScore(
        20 +
        logarithmicRatio(evidenceVolume, 80) * 55 +
        logarithmicRatio(transitionEvidence, 12) * 20 +
        (combinedHourSamples > 2 ? 5 : 0)
      )
    );

    const reasons: string[] = [];
    if (directTransitionCount > 0) reasons.push(`déjà joué ${directTransitionCount} fois après le morceau actuel`);
    if (genreCompatibility >= 0.55) reasons.push("style compatible avec le morceau précédent");
    else if (artistTransitionCount + knownArtistRelation > 0) reasons.push("enchaînement d’artistes déjà validé");
    if (smoothedCompletionRate >= 0.72) reasons.push("bon taux de lecture jusqu’au bout");
    if (candidate.voteCount >= 2) reasons.push("reçoit régulièrement des votes");
    if (hourRate >= 0.62 && combinedHourSamples > 0) reasons.push(`fonctionne bien autour de ${String(currentHour).padStart(2, "0")} h`);
    if (popularityPart >= 10) reasons.push("titre populaire dans l’historique MixParty");
    if (relaySelection?.count) reasons.push("rotation appliquée pour éviter les répétitions PartyBrain");
    if (!reasons.length) reasons.push("meilleur équilibre disponible avec les données actuelles");

    recommendations.push({
      videoId: candidate.videoId,
      title: candidate.title,
      thumbnail: candidate.thumbnail,
      artistName: candidate.artistName || "Artiste inconnu",
      durationSeconds: candidate.durationSeconds,
      score,
      confidence,
      breakdown: {
        transition: Math.round(transitionPart),
        artistAffinity: Math.round(artistAffinityPart),
        popularity: Math.round(popularityPart),
        completion: Math.round(completionPart),
        votes: Math.round(votesPart),
        hourFit: Math.round(hourFitPart),
        freshness: Math.round(freshnessPart),
        penalties: Math.round(penalties),
      },
      reasons: reasons.slice(0, 4),
      evidence: {
        searches: Number(candidate.searchCount || 0),
        additions: Number(candidate.addedCount || 0),
        plays: Number(candidate.playedCount || 0),
        votes: Number(candidate.voteCount || 0),
        completed,
        skipped,
        removed: outcomes.removed,
        directTransitions: directTransitionCount,
        artistTransitions: artistTransitionCount + knownArtistRelation,
        hourSamples: combinedHourSamples,
      },
    });
  }

  return recommendations
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.evidence.plays + b.evidence.votes - (a.evidence.plays + a.evidence.votes);
    })
    .slice(0, Math.max(1, Math.min(Number(requestedLimit) || 10, 25)));
}


type PartyBrainFallbackSong = {
  videoId: string;
  title: string;
  thumbnail: string;
  artistName: string;
  durationSeconds?: number;
  metadataSource?: MusicMetadataSource;
  metadataConfidence?: number;
  fallbackScore: number;
  reason: string;
};

function selectPartyBrainFallbackSong(party: Party): PartyBrainFallbackSong | null {
  const allEvents = readPartyEvents(50000);
  const relaySelections = recentPartyBrainSelectionStats(allEvents);
  const currentSong = party.currentSong || party.history?.[party.history.length - 1] || null;
  const currentGenre = inferPartyBrainGenre(currentSong?.title || "", currentSong?.artistName || "");
  const excludedVideoIds = new Set([
    ...(party.history || []).map((song) => song.videoId),
    ...(party.currentSong ? [party.currentSong.videoId] : []),
    ...(party.songs || []).map((song) => song.videoId),
  ]);

  const recentArtistKeys = new Set(
    [
      ...(party.history || []).slice(-5),
      ...(party.currentSong ? [party.currentSong] : []),
    ]
      .map((song) => normalizeMusicQuery(song.artistName || ""))
      .filter(Boolean)
  );

  const eventStats = new Map<string, {
    completed: number;
    skipped: number;
    removed: number;
  }>();

  for (const event of allEvents) {
    const videoId = event.song?.videoId;
    if (!videoId) continue;

    const stats = eventStats.get(videoId) || {
      completed: 0,
      skipped: 0,
      removed: 0,
    };

    if (event.event === "SONG_PLAY_COMPLETED") stats.completed += 1;
    if (event.event === "SONG_SKIPPED") stats.skipped += 1;
    if (event.event === "SONG_REMOVED") stats.removed += 1;

    eventStats.set(videoId, stats);
  }

  const candidates = Object.values(musicBrain.songs)
    .filter((song) => {
      if (!song.videoId || !song.title || excludedVideoIds.has(song.videoId)) return false;
      if (!isPartyBrainRelaySafeSong(song)) return false;

      const confidence = Number(song.metadataConfidence || 0);
      const duration = Number(song.durationSeconds || 0);

      if (confidence > 0 && confidence < 25) return false;
      if (duration > 0 && (duration < 90 || duration > 480)) return false;

      const outcomes = eventStats.get(song.videoId);
      const negatives = Number(outcomes?.skipped || 0) + Number(outcomes?.removed || 0);
      const positives = Number(outcomes?.completed || 0);

      if (negatives >= 3 && negatives > positives * 1.5) return false;

      return true;
    })
    .map((song) => {
      const outcomes = eventStats.get(song.videoId) || {
        completed: 0,
        skipped: 0,
        removed: 0,
      };

      const artistKey = normalizeMusicQuery(song.artistName || "");
      const repeatedArtistPenalty = recentArtistKeys.has(artistKey) ? 18 : 0;
      const negativePenalty = outcomes.skipped * 8 + outcomes.removed * 12;
      const positiveSignal =
        Number(song.addedCount || 0) * 5 +
        Number(song.playedCount || 0) * 4 +
        Number(song.voteCount || 0) * 6 +
        Number(song.searchCount || 0) * 2 +
        outcomes.completed * 8;

      const metadataBonus = Math.round(Number(song.metadataConfidence || 40) / 10);
      const candidateGenre = inferPartyBrainGenre(song.title, song.artistName || "");
      const genreCompatibility = partyBrainGenreCompatibility(currentGenre, candidateGenre);
      const genreBonus = genreCompatibility > 0 ? genreCompatibility * 30 : genreCompatibility * 18;
      const relaySelection = relaySelections.stats.get(song.videoId);
      let recentRelayPenalty = relaySelection ? Math.min(35, relaySelection.count * 7) : 0;
      if (relaySelection) {
        const hoursSinceSelection = (relaySelections.now - relaySelection.lastAt) / 3600000;
        if (hoursSinceSelection < 6) recentRelayPenalty += 30;
        else if (hoursSinceSelection < 24) recentRelayPenalty += 18;
        else if (hoursSinceSelection < 72) recentRelayPenalty += 8;
      }
      const fallbackScore = positiveSignal + metadataBonus + genreBonus - repeatedArtistPenalty - negativePenalty - recentRelayPenalty;

      return {
        videoId: song.videoId,
        title: song.title,
        thumbnail: song.thumbnail || "",
        artistName: song.artistName || "Artiste inconnu",
        durationSeconds: song.durationSeconds,
        metadataSource: song.metadataSource,
        metadataConfidence: song.metadataConfidence,
        fallbackScore,
        reason:
          genreCompatibility >= 0.55
            ? "Titre de secours compatible avec le style du morceau précédent."
            : positiveSignal > 0
              ? "Titre de secours populaire, diversifié et peu risqué dans l’historique MixParty."
              : "Titre de secours disponible avec des métadonnées valides.",
      } satisfies PartyBrainFallbackSong;
    })
    .sort((a, b) => {
      const aGenre = inferPartyBrainGenre(a.title, a.artistName);
      const bGenre = inferPartyBrainGenre(b.title, b.artistName);
      const aCompatibility = partyBrainGenreCompatibility(currentGenre, aGenre);
      const bCompatibility = partyBrainGenreCompatibility(currentGenre, bGenre);
      const aTier = aCompatibility >= 0.55 ? 2 : aCompatibility >= 0 ? 1 : 0;
      const bTier = bCompatibility >= 0.55 ? 2 : bCompatibility >= 0 ? 1 : 0;

      if (bTier !== aTier) return bTier - aTier;
      return b.fallbackScore - a.fallbackScore;
    });

  return candidates[0] || null;
}

function cleanOldParties(){

  const now = Date.now();
  const keptParties: Party[] = [];

  for (const party of parties) {
    if (!party.createdAt) {
      party.createdAt = now;
    }

    if (!party.lastActivityAt) {
      party.lastActivityAt = party.createdAt;
    }

    const expired = now - party.lastActivityAt >= 6 * 60 * 60 * 1000;
    if (!expired) {
      keptParties.push(party);
      continue;
    }

    if (party.currentSong) {
      finalizePlayback(party, "song_change");
    }

    recordPartyEvent(party, "PARTY_ENDED", {
      context: {
        reason: "expired_6h_inactivity",
        songsPlayed: party.history?.length || 0,
        songsQueued: party.songs?.filter((song) => !song.played).length || 0,
      },
    });

    playbackTelemetry.delete(party.code);
  }

  parties = keptParties;
  saveParties();

}

setInterval(cleanOldParties, 10 * 60 * 1000);

function pruneOfflineParticipants(party: Party) {
  const cutoff = Date.now() - 30_000;
  const currentParticipants = party.participants || [];
  const offlineParticipants = currentParticipants.filter(
    (participant) => Number(participant.lastSeen || 0) < cutoff
  );

  party.participants = currentParticipants.filter(
    (participant) => Number(participant.lastSeen || 0) >= cutoff
  );

  for (const participant of offlineParticipants) {
    recordPartyEvent(party, "PARTICIPANT_LEFT", {
      actorHash: anonymizeActor(participant.id),
      context: { reason: "presence_timeout" },
    });
  }
}

function toPublicParty(party: Party) {
  const { creatorToken: _creatorToken, ...publicParty } = party;
  return publicParty;
}

function updateParty(party:Party) {
  party.lastActivityAt = Date.now();
  pruneOfflineParticipants(party);
  saveParties();
  io.emit("party_updated", toPublicParty(party));
}


function accountSongKey(song: Song) {
  return `${song.videoId}:${Number(song.addedAt || 0)}`;
}

function recordAccountSongPlay(party: Party, song: Song) {
  if (!song.addedByAccountId) return;
  accountsStore.recordSongPlayedByAccountId(
    song.addedByAccountId,
    party.code,
    accountSongKey(song),
    song.votes,
  );
}



loadMusicBrain();

function readBearerToken(req: express.Request) {
  const authorization = String(req.headers.authorization || "");
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : "";
}

function accountErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";

  if (code === "EMAIL_INVALID") {
    return { status: 400, body: { error: "Entre une adresse e-mail valide." } };
  }
  if (code === "PASSWORD_INVALID") {
    return { status: 400, body: { error: "Le mot de passe doit contenir au moins 8 caractères." } };
  }
  if (code === "NAME_INVALID") {
    return { status: 400, body: { error: "Le pseudo doit contenir au moins 2 caractères." } };
  }
  if (code === "EMAIL_ALREADY_USED") {
    return { status: 409, body: { error: "Un compte MixParty existe déjà avec cette adresse e-mail." } };
  }
  if (code === "INVALID_CREDENTIALS") {
    return { status: 401, body: { error: "E-mail ou mot de passe incorrect." } };
  }
  if (code === "AVATAR_TOO_LARGE") {
    return { status: 413, body: { error: "La photo de profil est trop volumineuse." } };
  }
  if (code === "UNAUTHORIZED") {
    return { status: 401, body: { error: "Session MixParty expirée ou invalide." } };
  }

  console.error("MixParty Accounts:", error);
  return { status: 500, body: { error: "Une erreur MixParty est survenue." } };
}

app.post("/account/register", (req, res) => {
  try {
    const result = accountsStore.register({
      email: req.body?.email,
      password: req.body?.password,
      name: req.body?.name,
      avatar: req.body?.avatar,
    });
    return res.status(201).json(result);
  } catch (error) {
    const response = accountErrorResponse(error);
    return res.status(response.status).json(response.body);
  }
});

app.post("/account/login", (req, res) => {
  try {
    const result = accountsStore.login({
      email: req.body?.email,
      password: req.body?.password,
    });
    return res.json(result);
  } catch (error) {
    const response = accountErrorResponse(error);
    return res.status(response.status).json(response.body);
  }
});

app.get("/account/me", (req, res) => {
  const token = readBearerToken(req);
  const account = token ? accountsStore.authenticate(token) : null;

  if (!account) {
    return res.status(401).json({ error: "Session MixParty expirée ou invalide." });
  }

  return res.json({ account });
});

app.patch("/account/me", (req, res) => {
  const token = readBearerToken(req);

  try {
    const account = accountsStore.updateProfile(token, {
      name: req.body?.name,
      avatar: req.body?.avatar,
    });
    return res.json({ account });
  } catch (error) {
    const response = accountErrorResponse(error);
    return res.status(response.status).json(response.body);
  }
});

app.post("/account/logout", (req, res) => {
  const token = readBearerToken(req);
  if (token) accountsStore.logout(token);
  return res.json({ ok: true });
});


// Test API
app.get("/", (req, res) => {

  res.json({
    message:"MixParty API fonctionne 🎉"
  });

});



// Test téléphone
app.get("/party", (req,res)=>{

  res.json({
    message:"API OK depuis le téléphone"
  });

});



// Créer une soirée
app.post("/party",(req,res)=>{


const party:Party = {
  code: generateCode(),
  songs: [],
  history: [],
  participants: [],
  currentSong: null,
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  creatorToken: randomUUID(),
  partyBrainAutoRelayEnabled: false
};


parties.push(party);
recordPartyEvent(party, "PARTY_CREATED");

const creatorAccountToken = readBearerToken(req);
if (creatorAccountToken) {
  accountsStore.recordPartyHosted(creatorAccountToken, party.code);
}

saveParties();

res.json({ ...toPublicParty(party), creatorToken: party.creatorToken });

});



// Voir une soirée
app.get("/party/:code",(req,res)=>{


  const party = findParty(
    req.params.code
  );


  if(!party){

    return res.status(404).json({
      error:"Soirée introuvable"
    });

  }


  pruneOfflineParticipants(party);
  res.json(toPublicParty(party));


});



// Rejoindre une soirée
app.post("/party/:code/join",(req,res)=>{


  const party = findParty(
    req.params.code
  );


  if(!party){

    return res.status(404).json({
      error:"Soirée introuvable"
    });

  }



  const name = req.body.name?.trim();



  if(!name){

    return res.status(400).json({
      error:"Nom obligatoire"
    });

  }



  const participantId = req.body.id || `guest-${name.toLowerCase()}`;
  const avatar = typeof req.body.avatar === "string" ? req.body.avatar : undefined;
  const accountToken = readBearerToken(req);
  const authenticatedAccount = accountToken ? accountsStore.authenticate(accountToken) : null;
  const existingParticipant = party.participants.find((participant) => participant.id === participantId);
  const isNewParticipant = !existingParticipant;

  if(existingParticipant){
    existingParticipant.name = name;
    existingParticipant.avatar = avatar || existingParticipant.avatar;
    existingParticipant.accountId = authenticatedAccount?.id || existingParticipant.accountId;
    existingParticipant.lastSeen = Date.now();
  } else {
    party.participants.push({ id: participantId, name, avatar, accountId: authenticatedAccount?.id, lastSeen: Date.now() });
  }

  if (accountToken && authenticatedAccount) {
    accountsStore.recordPartyJoined(accountToken, party.code);
  }



  if (isNewParticipant) {
    recordPartyEvent(party, "PARTICIPANT_JOINED", { actorHash: anonymizeActor(participantId) });
  }
  const joinedParticipant = party.participants.find((participant) => participant.id === participantId);
  if (joinedParticipant) recordAttendance(party, joinedParticipant);
  updateParty(party);


  res.json(toPublicParty(party));


});





// Maintenir un participant en ligne
app.post("/party/:code/presence", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });

  const id = String(req.body.id || "").trim();
  const name = String(req.body.name || "").trim();
  const avatar = typeof req.body.avatar === "string" ? req.body.avatar : undefined;
  const accountToken = readBearerToken(req);
  const authenticatedAccount = accountToken ? accountsStore.authenticate(accountToken) : null;
  if (!id || !name) return res.status(400).json({ error: "Participant invalide" });

  const participant = party.participants.find((item) => item.id === id);
  const isNewParticipant = !participant;

  if (participant) {
    participant.name = name;
    participant.avatar = avatar || participant.avatar;
    participant.accountId = authenticatedAccount?.id || participant.accountId;
    participant.lastSeen = Date.now();
  } else {
    party.participants.push({ id, name, avatar, accountId: authenticatedAccount?.id, lastSeen: Date.now() });
  }

  if (accountToken && authenticatedAccount) {
    accountsStore.recordPartyJoined(accountToken, party.code);
    accountsStore.recordPresence(accountToken, party.code);
  }

  if (isNewParticipant) {
    recordPartyEvent(party, "PARTICIPANT_JOINED", {
      actorHash: anonymizeActor(id),
      context: { entryPoint: "presence" },
    });
  }

  const presentParticipant = party.participants.find((item) => item.id === id);
  if (presentParticipant) recordAttendance(party, presentParticipant);
  updateParty(party);
  res.json(toPublicParty(party));
});

app.post("/party/:code/leave", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });
  const id = String(req.body.id || "").trim();
  const existed = party.participants.some((participant) => participant.id === id);
  party.participants = party.participants.filter((participant) => participant.id !== id);
  if (existed) recordPartyEvent(party, "PARTICIPANT_LEFT", { actorHash: anonymizeActor(id) });
  updateParty(party);
  res.json(toPublicParty(party));
});

// Ajouter une chanson
app.post("/party/:code/song",(req,res)=>{


  const party = findParty(
    req.params.code
  );


  if(!party){

    return res.status(404).json({
      error:"Soirée introuvable"
    });

  }



  const {
  song,
  videoId,
 thumbnail,
addedBy,
addedById,
sourceQuery,
  suggestionPool,
  artistName,
  featuredArtistNames,
  albumName,
  metadataSource,
  metadataConfidence,
  durationSeconds,
  additionSource
} = req.body;



  if(!song){

    return res.status(400).json({
      error:"Chanson obligatoire"
    });

  }


console.log("CHANSON RECUE API :", req.body);
const accountToken = readBearerToken(req);
const authenticatedAccount = accountToken ? accountsStore.authenticate(accountToken) : null;
const learnedCover = learnedCoverFor(String(videoId || ""));
party.songs.push({

  title: song,

  videoId: videoId || "",

  thumbnail: thumbnail || "",

  durationSeconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : undefined,

  votes: 0,

  addedBy: addedBy || "Inconnu",
addedById: typeof addedById === "string" && addedById.trim()
  ? addedById.trim()
  : undefined,
  addedByAccountId: authenticatedAccount?.id,
  voters: [],

  played:false,

  addedAt: Date.now(),

  sourceQuery: typeof sourceQuery === "string" ? sourceQuery.trim() : undefined,
  artistName: typeof artistName === "string" ? artistName.trim() : undefined,
  featuredArtistNames: Array.isArray(featuredArtistNames) ? featuredArtistNames.map(String).filter(Boolean) : undefined,
  albumName: typeof albumName === "string" ? albumName.trim() : undefined,
  metadataSource: ["ART_TRACK_DESCRIPTION", "TITLE_CHANNEL", "QUERY_FALLBACK"].includes(String(metadataSource)) ? metadataSource : undefined,
  metadataConfidence: Number.isFinite(Number(metadataConfidence)) ? Number(metadataConfidence) : undefined,
  ...learnedCover,

  suggestionPool: Array.isArray(suggestionPool)
    ? suggestionPool
        .filter((item:any) => item && typeof item.id === "string" && typeof item.title === "string")
        .slice(0, 12)
        .map((item:any) => ({
          id: item.id,
          title: item.title,
          thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : "",
          channelTitle: typeof item.channelTitle === "string" ? item.channelTitle : undefined,
          durationSeconds: Number.isFinite(Number(item.durationSeconds))
            ? Number(item.durationSeconds)
            : undefined,
          artistName: typeof item.artistName === "string" ? item.artistName : undefined,
          featuredArtistNames: Array.isArray(item.featuredArtistNames) ? item.featuredArtistNames.map(String).filter(Boolean) : undefined,
          albumName: typeof item.albumName === "string" ? item.albumName : undefined,
          metadataSource: item.metadataSource,
          metadataConfidence: Number.isFinite(Number(item.metadataConfidence)) ? Number(item.metadataConfidence) : undefined,
        }))
    : []

});

  const addedSong = party.songs[party.songs.length - 1];
  if (accountToken && authenticatedAccount) accountsStore.recordSongAdded(accountToken);
  recordMusicBrainAddition(addedSong);
  recordPartyEvent(party, "SONG_ADDED", {
    song: songEventSnapshot(party, addedSong),
    actorHash: anonymizeActor(addedBy),
    source: additionSource === "partybrain_suggestion"
      ? "partybrain_suggestion"
      : additionSource === "manual_search"
        ? "manual_search"
        : "unknown",
    context: { sourceQuery: typeof sourceQuery === "string" ? sourceQuery.trim() : "" },
  });

  updateParty(party);



  res.json(toPublicParty(party));


});



// Voter pour une chanson
app.post("/party/:code/song/:index/vote",(req,res)=>{

  console.log("========== ROUTE VOTE ==========");

  const party = findParty(
    req.params.code
  );


  if(!party){

    return res.status(404).json({
      error:"Soirée introuvable"
    });

  }



  const index = Number(
    req.params.index
  );



  const song = party.songs[index];



  if(!song){

    return res.status(404).json({
      error:"Chanson introuvable"
    });

  }



  const name = req.body.name?.trim().toLowerCase();
console.log("Vote reçu de :", name);
console.log("Votants actuels :", song.voters);
console.log("Nom reçu :", JSON.stringify(name));
console.log("Résultat includes :", song.voters.includes(name));

  if(!name){

    return res.status(400).json({
      error:"Nom obligatoire"
    });

  }



  if(song.voters.includes(name)){

    return res.status(400).json({
      error:"Tu as déjà voté pour cette chanson"
    });

  }



  song.voters.push(name);

  song.votes++;
  const accountToken = readBearerToken(req);
  const authenticatedAccount = accountToken ? accountsStore.authenticate(accountToken) : null;
  if (accountToken && authenticatedAccount) {
    accountsStore.recordVoteGiven(accountToken, song.addedByAccountId);
  }

  if (song.addedByAccountId) {
    accountsStore.recordVoteReceivedByAccountId(song.addedByAccountId);
  }

  if (song.votes >= 5 && song.addedByAccountId) {
    accountsStore.recordSongReachedFiveVotesByAccountId(
      song.addedByAccountId,
      party.code,
      accountSongKey(song),
    );
  }

  recordMusicBrainVote(song);
  recordPartyEvent(party, "SONG_VOTED", {
    song: songEventSnapshot(party, song),
    actorHash: anonymizeActor(name),
    context: { voteDelta: 1 },
  });

  updateParty(party);



  res.json(toPublicParty(party));


});





// Retirer son vote d'une chanson
app.post("/party/:code/song/:index/downvote", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });

  const index = Number(req.params.index);
  const song = party.songs[index];
  if (!song) return res.status(404).json({ error: "Chanson introuvable" });

  const name = String(req.body.name || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "Nom obligatoire" });

  const voterIndex = song.voters.indexOf(name);
  if (voterIndex < 0) {
    return res.status(400).json({ error: "Tu n’as pas encore voté pour cette chanson" });
  }

  song.voters.splice(voterIndex, 1);
  song.votes = Math.max(0, Number(song.votes || 0) - 1);

  const accountToken = readBearerToken(req);
  const authenticatedAccount = accountToken ? accountsStore.authenticate(accountToken) : null;
  if (accountToken && authenticatedAccount) {
    accountsStore.recordVoteRemoved(accountToken, song.addedByAccountId);
  }

  if (song.addedByAccountId) {
    accountsStore.recordVoteReceivedRemovedByAccountId(song.addedByAccountId);
  }

  recordPartyEvent(party, "SONG_DOWNVOTED", {
    song: songEventSnapshot(party, song),
    actorHash: anonymizeActor(name),
    context: { voteDelta: -1 },
  });

  updateParty(party);
  return res.json(toPublicParty(party));
});

// Supprimer une chanson de la file
app.delete("/party/:code/song/:index", (req, res) => {
  const party = findParty(req.params.code);

  if (!party) {
    return res.status(404).json({ error: "Soirée introuvable" });
  }

  const index = Number(req.params.index);
  const song = party.songs[index];

  if (!song) {
    return res.status(404).json({ error: "Chanson introuvable" });
  }

  const creatorToken = String(
    req.body?.creatorToken ||
    req.headers["x-mixparty-creator-token"] ||
    ""
  ).trim();

  const participantId = String(
    req.body?.participantId ||
    req.query.participantId ||
    ""
  ).trim();

  const isCreator = Boolean(
    creatorToken &&
    creatorToken === party.creatorToken
  );

  const isOwner = Boolean(
    participantId &&
    song.addedById &&
    participantId === song.addedById
  );

  if (!isCreator && !isOwner) {
    return res.status(403).json({
      error: "Tu peux supprimer uniquement les musiques que tu as ajoutées."
    });
  }

  if (
    party.currentSong?.videoId === song.videoId &&
    party.currentSong?.addedAt === song.addedAt
  ) {
    finalizePlayback(party, "song_change");
    party.currentSong = null;
  }

  const snapshot = songEventSnapshot(party, song);

  party.songs.splice(index, 1);

  recordPartyEvent(party, "SONG_REMOVED", {
    song: snapshot,
    actorHash: anonymizeActor(
      participantId || (isCreator ? "dj" : "")
    ),
    context: {
      reason: isCreator ? "dj_remove" : "owner_remove",
      wasPlayed: Boolean(song.played),
    },
  });

  updateParty(party);

  return res.json(toPublicParty(party));
});

// Réordonner manuellement la file
app.post("/party/:code/reorder", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });

  const orderedIds = Array.isArray(req.body.videoIds)
    ? req.body.videoIds.map(String)
    : [];

  if (!orderedIds.length) {
    return res.status(400).json({ error: "Ordre de file obligatoire" });
  }

  const unplayed = party.songs.filter((song) => !song.played);
  const played = party.songs.filter((song) => song.played);
  const byId = new Map(unplayed.map((song) => [song.videoId, song]));
  const reordered: Song[] = [];

  for (const videoId of orderedIds) {
    const song = byId.get(videoId);
    if (!song) continue;
    reordered.push(song);
    byId.delete(videoId);
  }

  reordered.push(...byId.values());

  const baseTime = Date.now();
  reordered.forEach((song, position) => {
    song.addedAt = baseTime + position;
  });

  party.songs = [...played, ...reordered];

  recordPartyEvent(party, "QUEUE_REORDERED", {
    actorHash: anonymizeActor(req.body.actor),
    context: {
      queueLength: reordered.length,
      orderedVideoIds: reordered.map((song) => song.videoId).join(","),
    },
  });

  updateParty(party);
  return res.json(toPublicParty(party));
});

// Terminer explicitement une soirée
app.post("/party/:code/end", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });

  const providedCreatorToken = String(
    req.body.creatorToken ||
    req.headers["x-mixparty-creator-token"] ||
    ""
  );

  if (!providedCreatorToken || providedCreatorToken !== party.creatorToken) {
    return res.status(403).json({ error: "Seul le créateur peut terminer la soirée" });
  }

  if (party.currentSong) {
    finalizePlayback(party, "song_change");
  }

  recordPartyEvent(party, "PARTY_ENDED", {
    actorHash: anonymizeActor(req.body.actor),
    context: {
      reason: "creator_ended",
      songsPlayed: party.history?.length || 0,
      songsQueued: party.songs?.filter((song) => !song.played).length || 0,
      totalParticipants: party.participants?.length || 0,
    },
  });

  playbackTelemetry.delete(party.code);
  parties = parties.filter((item) => item.code !== party.code);
  saveParties();
  io.emit("party_ended", { code: party.code });

  return res.json({ ok: true, code: party.code });
});


// Lire une chanson
app.post("/party/:code/play/:index",(req,res)=>{

  console.log("========== PLAY ==========");
  console.log("CODE :", req.params.code);
  console.log("INDEX :", req.params.index);

  const party = findParty(req.params.code);


  if(!party){

    return res.status(404).json({
      error:"Soirée introuvable"
    });

  }


  const index = Number(
    req.params.index
  );


  const song = party.songs[index];


  if(!song){

    return res.status(404).json({
      error:"Chanson introuvable"
    });

  }


  const previousSong = party.currentSong;
  if (previousSong && previousSong.videoId !== song.videoId) finalizePlayback(party, "song_change");
  song.played = true;
  party.currentSong = song;
  recordMusicBrainPlay(song, previousSong);
  recordAccountSongPlay(party, song);
  startPlaybackTelemetry(party, song);

  updateParty(party);


  res.json(toPublicParty(party));


});

// Activer ou désactiver le relais automatique PartyBrain
app.post("/party/:code/partybrain/auto-relay", (req, res) => {
  const party = findParty(req.params.code);

  if (!party) {
    return res.status(404).json({
      error: "Soirée introuvable",
    });
  }

  const providedCreatorToken = String(
    req.body.creatorToken ||
    req.headers["x-mixparty-creator-token"] ||
    ""
  );

  if (!providedCreatorToken || providedCreatorToken !== party.creatorToken) {
    return res.status(403).json({
      error: "Seul le créateur peut modifier le relais PartyBrain",
    });
  }

  const enabled = req.body.enabled === true;
  party.partyBrainAutoRelayEnabled = enabled;

  recordPartyEvent(party, "QUEUE_REORDERED", {
    actorHash: anonymizeActor(req.body.actor),
    context: {
      action: "partybrain_auto_relay_toggle",
      enabled,
    },
  });

  updateParty(party);

  return res.json({
    ...toPublicParty(party),
    partyBrain: {
      autoRelayEnabled: enabled,
    },
  });
});


// Lancer DJ automatique
app.post("/party/:code/next",(req,res)=>{

  console.log("========== DJ NEXT ==========");

  const party = findParty(req.params.code);


  if(!party){

    return res.status(404).json({
      error:"Soirée introuvable"
    });

  }


  if(!party.history){
    party.history = [];
  }


  const previousSong = party.currentSong;
  if (previousSong) finalizePlayback(party, "dj_skip");

  if(party.currentSong){

    party.history.push(
      party.currentSong
    );

  }



  let nextSong = party.songs
.filter(song=>!song.played)
.sort((a,b)=>{

  if(b.votes !== a.votes){

    return b.votes - a.votes;

  }


  return a.addedAt - b.addedAt;

})[0];



  let partyBrainRelayUsed = false;

  if(!nextSong){
    if (!party.partyBrainAutoRelayEnabled) {
      return res.status(400).json({
        error: "Plus de chansons disponibles",
        partyBrain: {
          relayAttempted: false,
          relayUsed: false,
          autoRelayEnabled: false,
          reason: "Le relais automatique PartyBrain est désactivé."
        }
      });
    }

    const recommendationPool = buildPartyBrainRecommendationScores(party, 20);
    const bestRecommendation = chooseDiversifiedPartyBrainRecommendation(recommendationPool, party);

    const minimumScore = Number(
      process.env.PARTYBRAIN_RELAY_MIN_SCORE || 45
    );

    const minimumConfidence = Number(
      process.env.PARTYBRAIN_RELAY_MIN_CONFIDENCE || 20
    );

    const recommendationAccepted = Boolean(
      bestRecommendation &&
      bestRecommendation.score >= minimumScore &&
      bestRecommendation.confidence >= minimumConfidence
    );

    const fallbackEnabled =
      String(process.env.PARTYBRAIN_RELAY_FALLBACK_ENABLED || "false").toLowerCase() === "true";

    const fallbackSong =
      !recommendationAccepted && fallbackEnabled
        ? selectPartyBrainFallbackSong(party)
        : null;

    if (!recommendationAccepted && !fallbackSong) {
      return res.status(400).json({
        error:"Plus de chansons disponibles",
        partyBrain: {
          relayAttempted: true,
          relayUsed: false,
          fallbackAttempted: fallbackEnabled,
          reason: bestRecommendation
            ? "Aucune transition musicale suffisamment sûre n’est disponible."
            : "PartyBrain ne possède encore aucune transition musicale compatible.",
          thresholds: {
            minimumScore,
            minimumConfidence
          },
          recommendation: bestRecommendation || null
        }
      });
    }

    const selectedVideoId = recommendationAccepted
      ? bestRecommendation!.videoId
      : fallbackSong!.videoId;

    const learnedSong = musicBrain.songs[selectedVideoId];
    const selectedTitle = recommendationAccepted
      ? bestRecommendation!.title
      : fallbackSong!.title;
    const selectedArtist = recommendationAccepted
      ? bestRecommendation!.artistName
      : fallbackSong!.artistName;
    const selectedThumbnail = recommendationAccepted
      ? bestRecommendation!.thumbnail
      : fallbackSong!.thumbnail;
    const selectedDuration = recommendationAccepted
      ? bestRecommendation!.durationSeconds
      : fallbackSong!.durationSeconds;
    const relaySourceQuery = recommendationAccepted
      ? "partybrain-auto-relay"
      : "partybrain-safe-fallback";

    nextSong = {
      title: selectedTitle,
      videoId: selectedVideoId,
      thumbnail: selectedThumbnail || learnedSong?.thumbnail || "",
      durationSeconds: selectedDuration || learnedSong?.durationSeconds,
      votes: 0,
      addedBy: recommendationAccepted ? "PartyBrain" : "PartyBrain Secours",
      voters: [],
      played: false,
      addedAt: Date.now(),
      sourceQuery: relaySourceQuery,
      artistName: selectedArtist,
      featuredArtistNames: [],
      albumName: undefined,
      metadataSource: learnedSong?.metadataSource,
      metadataConfidence: learnedSong?.metadataConfidence,
      ...learnedCoverFor(selectedVideoId),
      suggestionPool: []
    };

    party.songs.push(nextSong);
    partyBrainRelayUsed = true;

    recordMusicBrainAddition(nextSong);
    recordPartyEvent(party, "SONG_ADDED", {
      song: songEventSnapshot(party, nextSong),
      source: "partybrain_suggestion",
      context: {
        sourceQuery: relaySourceQuery,
        relayMode: recommendationAccepted ? "scored_recommendation" : "safe_fallback",
        recommendationScore: bestRecommendation?.score || 0,
        recommendationConfidence: bestRecommendation?.confidence || 0,
        recommendationReasons: recommendationAccepted
          ? bestRecommendation!.reasons.join(" | ")
          : fallbackSong!.reason,
        fallbackScore: fallbackSong?.fallbackScore || 0
      }
    });
  }



  nextSong.played = true;

  party.currentSong = nextSong;
  recordMusicBrainPlay(nextSong, previousSong);
  recordAccountSongPlay(party, nextSong);
  startPlaybackTelemetry(party, nextSong);

  updateParty(party);


  res.json({
    ...toPublicParty(party),
    partyBrain: {
      relayUsed: partyBrainRelayUsed,
      autoRelayEnabled: party.partyBrainAutoRelayEnabled,
      source: partyBrainRelayUsed
        ? nextSong.addedBy === "PartyBrain Secours"
          ? "partybrain_safe_fallback"
          : "partybrain_suggestion"
        : "user_queue"
    }
  });

});

app.post("/party/:code/previous", (req, res) => {
  const party = findParty(req.params.code);

  if (!party) {
    return res.status(404).json({ error: "Soirée introuvable" });
  }

  if (!party.history?.length) {
    return res.status(400).json({ error: "Aucun morceau précédent" });
  }

  const currentSong = party.currentSong;

  if (currentSong) {
    finalizePlayback(party, "dj_previous");
    currentSong.played = false;
  }

  const previousSong = party.history.pop();

  if (!previousSong) {
    return res.status(400).json({ error: "Aucun morceau précédent" });
  }

  previousSong.played = true;
  party.currentSong = previousSong;

  startPlaybackTelemetry(party, previousSong);
  updateParty(party);

  return res.json(toPublicParty(party));
});

// Socket connexion
const playbackControllers = new Map<string, string>();

io.on("connection",(socket)=>{

  socket.on("join_party_room", (payload: string | { code?: string; creatorToken?: string }) => {
    const rawCode = typeof payload === "string" ? payload : payload?.code;
    const providedCreatorToken = typeof payload === "object" ? String(payload?.creatorToken || "") : "";
    const code = String(rawCode || "").toUpperCase();
    if (!code) return;

    socket.join(`party:${code}`);

    const party = findParty(code);
    const isCreator = Boolean(
      party && providedCreatorToken && providedCreatorToken === party.creatorToken
    );

    if (isCreator) {
      playbackControllers.set(code, socket.id);
    }

    socket.emit("playback_role", {
      controller: isCreator && playbackControllers.get(code) === socket.id,
    });
  });

  socket.on("request_playback_sync", (rawCode: string) => {
    const code = String(rawCode || "").toUpperCase();
    const controllerId = playbackControllers.get(code);
    if (controllerId) io.to(controllerId).emit("provide_playback_sync");
  });

  socket.on("playback_control_request", (payload: any) => {
    const code = String(payload?.code || "").toUpperCase();
    const creatorToken = String(payload?.creatorToken || "");
    const action = String(payload?.action || "");

    if (!code || !creatorToken) return;
    if (!["play", "pause", "next", "previous"].includes(action)) return;

    const party = findParty(code);
    if (!party || creatorToken !== party.creatorToken) return;

    const controllerId = playbackControllers.get(code);
    if (!controllerId) return;

    io.to(controllerId).emit("playback_control_command", {
      code,
      action,
    });
  });

  socket.on("playback_sync", (payload: any) => {
    const code = String(payload?.code || "").toUpperCase();
    if (!code || playbackControllers.get(code) !== socket.id) return;

    const videoId = String(payload.videoId || "");
    const state = Number(payload.state);
    const time = Math.max(0, Number(payload.time || 0));
    const party = findParty(code);
    if (party?.currentSong && party.currentSong.videoId === videoId) {
      let telemetry = playbackTelemetry.get(code);
      if (!telemetry || telemetry.videoId !== videoId || telemetry.finalized) {
        startPlaybackTelemetry(party, party.currentSong);
        telemetry = playbackTelemetry.get(code);
      }
      if (telemetry) {
        telemetry.lastTime = time;
        telemetry.lastState = state;
        const bucket = Math.floor(time / 30);
        if (bucket > telemetry.lastProgressBucket) {
          telemetry.lastProgressBucket = bucket;
          const duration = Number(party.currentSong.durationSeconds || 0);
          recordPartyEvent(party, "SONG_PROGRESS", {
            song: songEventSnapshot(party, party.currentSong),
            playback: {
              elapsedSeconds: Math.round(time),
              completionRatio: duration > 0 ? Math.min(1, time / duration) : undefined,
            },
          });
        }
        if (state === 0) finalizePlayback(party, "ended");
      }
    }

    socket.to(`party:${code}`).emit("playback_sync", { code, videoId, state, time });
  });


  console.log(
    "Client connecté",
    socket.id
  );


  socket.on("disconnect",()=>{
    for (const [partyCode, controllerId] of playbackControllers.entries()) {
      if (controllerId === socket.id) playbackControllers.delete(partyCode);
    }

    console.log(
      "Client déconnecté",
      socket.id
    );

  });

});

// Recherche YouTube

type YoutubeSearchResult = {
  id: string;
  title: string;
  rawTitle?: string;
  thumbnail: string;
  channelTitle?: string;
  durationSeconds?: number;
  artistName?: string;
  featuredArtistNames?: string[];
  albumName?: string;
  metadataSource?: MusicMetadataSource;
  metadataConfidence?: number;
};

type SearchCacheEntry = {
  query: string;
  normalizedQuery: string;
  createdAt: number;
  results: YoutubeSearchResult[];
  engineVersion?: number;
};

const YOUTUBE_SEARCH_ENGINE_VERSION = 2;
const YOUTUBE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const YOUTUBE_CACHE_MAX_ENTRIES = 2000;
const youtubeCacheFilePath = path.resolve(persistentDataDir, "youtube-search-cache.json");
const youtubeSearchCache = new Map<string, SearchCacheEntry>();
const youtubeSearchesInFlight = new Map<string, Promise<YoutubeSearchResult[]>>();

const youtubeSearchStats = {
  totalRequests: 0,
  youtubeCalls: 0,
  exactCacheHits: 0,
  fuzzyCacheHits: 0,
  aliasCacheHits: 0,
  inFlightHits: 0,
  quotaSaved: 0,
};


const academyFilePath = path.resolve(persistentDataDir, "partybrain-academy.json");
const academyEnabled = String(process.env.PARTYBRAIN_ACADEMY_ENABLED || "false").toLowerCase() === "true";
const academyDailyLimit = Math.max(1, Number(process.env.PARTYBRAIN_QUOTA_DAILY_LIMIT || 100));
const academyMinutesBeforeReset = Math.max(2, Number(process.env.PARTYBRAIN_ACADEMY_MINUTES_BEFORE_RESET || 15));
const academyTargetSongs = Math.max(8, Number(process.env.PARTYBRAIN_ACADEMY_TARGET_SONGS || 24));
const academyTimeZone = process.env.PARTYBRAIN_QUOTA_TIMEZONE || "America/Los_Angeles";

function pacificCycleKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: academyTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - date.getTime();
}

function nextQuotaResetAt(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: academyTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localMidnightUtcGuess = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + 1,
    0,
    0,
    0
  );
  let candidate = new Date(localMidnightUtcGuess);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    candidate = new Date(localMidnightUtcGuess - timeZoneOffsetMs(candidate, academyTimeZone));
  }
  return candidate.getTime();
}

function createAcademyState(): AcademyState {
  const now = Date.now();
  return {
    version: 1,
    updatedAt: now,
    quota: {
      cycleKey: pacificCycleKey(new Date(now)),
      used: 0,
      lastResetAt: now,
    },
    running: false,
    artistProgress: {},
    logs: [],
    sessions: [],
  };
}

let academyState: AcademyState = createAcademyState();

function saveAcademyState() {
  academyState.updatedAt = Date.now();
  try {
    fs.writeFileSync(academyFilePath, JSON.stringify(academyState, null, 2), "utf-8");
  } catch (error) {
    console.warn("PartyBrain Academy non sauvegardée :", error);
  }
}

function loadAcademyState() {
  if (fs.existsSync(academyFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(academyFilePath, "utf-8"));
      academyState = {
        ...createAcademyState(),
        ...parsed,
        quota: { ...createAcademyState().quota, ...(parsed?.quota || {}) },
        artistProgress: parsed?.artistProgress || {},
        logs: Array.isArray(parsed?.logs) ? parsed.logs.slice(-400) : [],
        sessions: Array.isArray(parsed?.sessions) ? parsed.sessions.slice(-50) : [],
        running: false,
      };
    } catch (error) {
      console.warn("Etat Academy illisible, nouvel état créé :", error);
      academyState = createAcademyState();
    }
  }
  ensureAcademyQuotaCycle();
  saveAcademyState();
}

function addAcademyLog(
  level: AcademyLogEntry["level"],
  message: string,
  details: Partial<AcademyLogEntry> = {}
) {
  academyState.logs.push({ at: Date.now(), level, message, ...details });
  academyState.logs = academyState.logs.slice(-400);
  saveAcademyState();
  const prefix = level === "error" ? "❌" : level === "warning" ? "⚠️" : level === "success" ? "✅" : "🧠";
  console.log(`${prefix} Academy : ${message}`);
}

function ensureAcademyQuotaCycle() {
  const currentKey = pacificCycleKey();
  if (academyState.quota.cycleKey !== currentKey) {
    academyState.quota = {
      cycleKey: currentKey,
      used: 0,
      lastResetAt: Date.now(),
    };
    addAcademyLog("info", `Nouveau cycle de quota ${currentKey} : compteur remis à zéro.`);
  }
}

function registerYoutubeApiCall(source: "user" | "academy") {
  ensureAcademyQuotaCycle();
  youtubeSearchStats.youtubeCalls += 1;
  academyState.quota.used += 1;
  academyState.updatedAt = Date.now();
  saveAcademyState();
  if (source === "academy") {
    console.log(`🧠 Academy utilise l'appel YouTube ${academyState.quota.used}/${academyDailyLimit}`);
  }
}

function academyQuotaSnapshot() {
  ensureAcademyQuotaCycle();
  const now = Date.now();
  const resetAt = nextQuotaResetAt(new Date(now));
  const remaining = Math.max(0, academyDailyLimit - academyState.quota.used);
  const msUntilReset = Math.max(0, resetAt - now);
  return {
    enabled: academyEnabled,
    running: academyState.running,
    dailyLimit: academyDailyLimit,
    used: academyState.quota.used,
    remaining,
    cycleKey: academyState.quota.cycleKey,
    resetAt,
    msUntilReset,
    minutesUntilReset: Math.ceil(msUntilReset / 60_000),
    launchWindowMinutes: academyMinutesBeforeReset,
    inLaunchWindow: msUntilReset <= academyMinutesBeforeReset * 60_000 && msUntilReset > 20_000,
    targetSongsPerArtist: academyTargetSongs,
    timeZone: academyTimeZone,
  };
}

function logYoutubeSearchDiagnostic(params: {
  query: string;
  normalizedQuery: string;
  source: "YOUTUBE" | "MUSICBRAIN" | "CACHE" | "FUZZY_CACHE" | "ALIAS_CACHE" | "IN_FLIGHT";
  durationMs: number;
  resultCount: number;
  matchedQuery?: string;
}) {
  const sourceLabel = {
    YOUTUBE: "🔵 YouTube API",
    MUSICBRAIN: "🧠 MusicBrain",
    CACHE: "🟢 Cache exact",
    FUZZY_CACHE: "🟣 Cache faute corrigée",
    ALIAS_CACHE: "🟠 Cache variante",
    IN_FLIGHT: "🟡 Recherche déjà en cours",
  }[params.source];

  console.log("\n══════════════════════════════════════");
  console.log("🔎 MixParty Search Engine");
  console.log(`Recherche : ${params.query}`);
  console.log(`Clé normalisée : ${params.normalizedQuery}`);
  if (params.matchedQuery) console.log(`Correspondance : ${params.matchedQuery}`);
  console.log(`Source : ${sourceLabel}`);
  console.log(`Temps : ${params.durationMs} ms`);
  console.log(`Résultats : ${params.resultCount}`);
  console.log(`Cache : ${youtubeSearchCache.size} entrées`);
  console.log(`Appels YouTube : ${youtubeSearchStats.youtubeCalls}`);
  console.log(`Requêtes économisées : ${youtubeSearchStats.quotaSaved}`);
  console.log("══════════════════════════════════════\n");
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeMusicQuery(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/\b(feat|featuring|ft)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(et|the|officiel|official|video|audio|clip|music)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactMusicQuery(value: string) {
  return normalizeMusicQuery(value).replace(/\s+/g, "");
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function findCloseCachedQuery(normalizedQuery: string) {
  const compact = normalizedQuery.replace(/\s+/g, "");
  if (compact.length < 4) return null;

  let best: { key: string; distance: number } | null = null;

  for (const key of youtubeSearchCache.keys()) {
    const candidate = key.replace(/\s+/g, "");
    const maxLength = Math.max(compact.length, candidate.length);
    const allowedDistance = maxLength <= 7 ? 1 : maxLength <= 14 ? 2 : 3;
    const distance = levenshteinDistance(compact, candidate);

    if (distance <= allowedDistance && (!best || distance < best.distance)) {
      best = { key, distance };
    }
  }

  return best?.key ?? null;
}

function pruneYoutubeCache() {
  const now = Date.now();
  for (const [key, entry] of youtubeSearchCache.entries()) {
    if (now - entry.createdAt > YOUTUBE_CACHE_TTL_MS) youtubeSearchCache.delete(key);
  }

  if (youtubeSearchCache.size <= YOUTUBE_CACHE_MAX_ENTRIES) return;

  const oldest = [...youtubeSearchCache.entries()]
    .sort(([, a], [, b]) => a.createdAt - b.createdAt)
    .slice(0, youtubeSearchCache.size - YOUTUBE_CACHE_MAX_ENTRIES);

  oldest.forEach(([key]) => youtubeSearchCache.delete(key));
}

function saveYoutubeCache() {
  pruneYoutubeCache();
  try {
    fs.writeFileSync(
      youtubeCacheFilePath,
      JSON.stringify([...youtubeSearchCache.values()], null, 2),
      "utf-8"
    );
  } catch (error) {
    console.warn("Cache YouTube non sauvegardé :", error);
  }
}

function loadYoutubeCache() {
  if (!fs.existsSync(youtubeCacheFilePath)) return;

  try {
    const entries = JSON.parse(fs.readFileSync(youtubeCacheFilePath, "utf-8"));
    if (!Array.isArray(entries)) return;

    for (const rawEntry of entries) {
      const entry = rawEntry as SearchCacheEntry;
      if (
        entry &&
        typeof entry.normalizedQuery === "string" &&
        Array.isArray(entry.results) &&
        Number(entry.engineVersion || 0) === YOUTUBE_SEARCH_ENGINE_VERSION &&
        Date.now() - Number(entry.createdAt || 0) <= YOUTUBE_CACHE_TTL_MS
      ) {
        youtubeSearchCache.set(entry.normalizedQuery, entry);
      }
    }
    pruneYoutubeCache();
  } catch (error) {
    console.warn("Cache YouTube illisible, nouveau cache créé :", error);
  }
}

function parseIsoDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}


function cleanTrackTitle(value: string, artistName = "") {
  return coreCleanTrackTitle(value, artistName);
}

function parseProvidedToYoutube(description: string) {
  return coreParseProvidedToYoutube(description);
}

function extractMusicMetadata(params: {
  rawTitle: string;
  channelTitle?: string;
  description?: string;
  tags?: string[];
  query: string;
}) {
  return coreExtractMusicMetadata(params);
}

function normalizeSearchMatchText(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[\'’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantSearchTokens(value: string) {
  return normalizeSearchMatchText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function officialMusicStrength(result: YoutubeSearchResult) {
  const titleText = stripDiacritics(`${result.rawTitle || ""} ${result.title || ""}`).toLowerCase();
  const channel = stripDiacritics(result.channelTitle || "").toLowerCase();
  let strength = 0;

  if (/official audio|audio officiel/i.test(titleText)) strength += 5;
  if (/provided to youtube/i.test(titleText)) strength += 5;
  if (result.metadataSource === "ART_TRACK_DESCRIPTION") strength += 5;
  if (/official (music )?video|clip officiel/i.test(titleText)) strength += 4;
  if (/\btopic\b/i.test(channel)) strength += 4;
  if (/vevo/i.test(channel)) strength += 4;
  if (/official|officiel/i.test(channel)) strength += 3;

  return strength;
}

function scoreMusicResult(result: YoutubeSearchResult, query: string) {
  const cleanTitle = stripDiacritics(result.title || "").toLowerCase();
  const rawTitle = stripDiacritics(result.rawTitle || result.title || "").toLowerCase();
  const titleText = `${rawTitle} ${cleanTitle}`;
  const channel = stripDiacritics(result.channelTitle || "").toLowerCase();
  const artist = stripDiacritics(result.artistName || "").toLowerCase();

  const normalizedTitle = normalizeSearchMatchText(titleText);
  const normalizedChannel = normalizeSearchMatchText(channel);
  const normalizedArtist = normalizeSearchMatchText(artist);
  const normalizedQuery = normalizeSearchMatchText(query);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactArtist = normalizedArtist.replace(/\s+/g, "");
  const compactChannel = normalizedChannel.replace(/\s+/g, "");
  const queryTokens = significantSearchTokens(query);

  let score = 0;

  // Les versions réellement officielles doivent dominer le classement.
  if (/official audio|audio officiel/i.test(titleText)) score += 190;
  if (/provided to youtube/i.test(titleText)) score += 180;
  if (result.metadataSource === "ART_TRACK_DESCRIPTION") score += 175;
  if (/official (music )?video|clip officiel/i.test(titleText)) score += 155;
  if (/\btopic\b/i.test(channel)) score += 140;
  if (/vevo/i.test(channel)) score += 125;
  if (/official|officiel/i.test(channel)) score += 90;
  if (/music/i.test(channel)) score += 15;

  // Correspondance forte avec l'artiste / la chaîne. Le compact permet
  // notamment de rapprocher "Diam's" et "Diams" sans polluer la requête avec "s".
  if (compactQuery.length >= 3 && compactArtist === compactQuery) score += 145;
  else if (normalizedQuery && normalizedArtist.includes(normalizedQuery)) score += 75;

  if (compactQuery.length >= 3 && compactChannel.includes(compactQuery)) score += 90;
  if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) score += 55;

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) score += 18;
    if (normalizedArtist.includes(token)) score += 24;
    if (normalizedChannel.includes(token)) score += 12;
  }

  // Les versions alternatives restent visibles, mais passent après les versions propres.
  if (/lyrics?|paroles/i.test(titleText)) score -= 50;
  if (/karaoke|instrumental/i.test(titleText)) score -= 100;
  if (/cover|reprise/i.test(titleText)) score -= 110;
  if (/reaction|reacts?|analyse|analysis|review/i.test(titleText)) score -= 150;
  if (/interview|podcast|documentary|documentaire|making of|behind the scenes/i.test(titleText)) score -= 170;
  if (/shorts?|#shorts/i.test(titleText)) score -= 280;
  if (/live|concert|festival/i.test(titleText)) score -= 35;
  if (/mix|compilation|playlist|best of/i.test(titleText)) score -= 55;

  const confidence = Number(result.metadataConfidence || 0);
  if (confidence >= 85) score += 35;
  else if (confidence >= 70) score += 20;

  const duration = result.durationSeconds || 0;
  if (duration >= 90 && duration <= 600) score += 35;
  if (duration > 1200 || (duration > 0 && duration < 45)) score -= 180;

  return score;
}

async function requestYoutubeMusic(
  query: string,
  source: "user" | "academy" = "user"
): Promise<YoutubeSearchResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YOUTUBE_API_KEY manquante");

  registerYoutubeApiCall(source);

  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "50",
    q: query,
    key: apiKey,
    videoCategoryId: "10",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    regionCode: "FR",
    relevanceLanguage: "fr",
    order: "relevance",
    safeSearch: "none",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
      { signal: controller.signal }
    );
    const data: any = await response.json();

    if (!response.ok || !Array.isArray(data.items)) {
      const error: any = new Error(data?.error?.message || "Erreur Google YouTube");
      error.status = response.status;
      error.details = data?.error;
      throw error;
    }

    const basicResults = data.items
      .map((item: any) => ({
        id: String(item?.id?.videoId || ""),
        title: String(item?.snippet?.title || ""),
        thumbnail:
          item?.snippet?.thumbnails?.high?.url ||
          item?.snippet?.thumbnails?.medium?.url ||
          item?.snippet?.thumbnails?.default?.url ||
          "",
        channelTitle: String(item?.snippet?.channelTitle || ""),
      }))
      .filter((item: YoutubeSearchResult) => item.id && item.title);

    if (!basicResults.length) return [];

    const detailParams = new URLSearchParams({
      part: "contentDetails,status,snippet,topicDetails",
      id: basicResults.map((item: YoutubeSearchResult) => item.id).join(","),
      key: apiKey,
    });
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`,
      { signal: controller.signal }
    );
    const detailsData: any = await detailsResponse.json();
    const detailsById = new Map<string, any>(
      (Array.isArray(detailsData.items) ? detailsData.items : []).map((item: any) => [
        String(item.id),
        item,
      ])
    );

    return basicResults
      .map((result: YoutubeSearchResult) => {
        const detail = detailsById.get(result.id);
        const rawTitle = String(detail?.snippet?.title || result.title || "");
        const metadata = extractMusicMetadata({
          rawTitle,
          channelTitle: String(detail?.snippet?.channelTitle || result.channelTitle || ""),
          description: String(detail?.snippet?.description || ""),
          tags: Array.isArray(detail?.snippet?.tags) ? detail.snippet.tags.map(String) : [],
          query,
        });
        return {
          ...result,
          rawTitle,
          title: metadata.title,
          durationSeconds: parseIsoDuration(String(detail?.contentDetails?.duration || "")),
          channelTitle: String(detail?.snippet?.channelTitle || result.channelTitle || ""),
          artistName: metadata.artistName,
          featuredArtistNames: metadata.featuredArtistNames,
          albumName: metadata.albumName,
          metadataSource: metadata.metadataSource,
          metadataConfidence: metadata.metadataConfidence,
          embeddable: detail?.status?.embeddable !== false,
          privacyStatus: detail?.status?.privacyStatus,
        };
      })
      .filter((result: any) => result.embeddable && result.privacyStatus !== "private")
      .filter((result: YoutubeSearchResult) => {
        const text = `${result.rawTitle || ""} ${result.title} ${result.channelTitle || ""}`.toLowerCase();
        // On écarte seulement les contenus clairement non musicaux ou trop courts.
        // Les remix, lives, paroles, instrumentaux, reprises et versions alternatives restent disponibles.
        return !/(podcast|interview|reaction|reacts?|documentary|documentaire|#shorts|\bshorts?\b|audition|the voice|incroyable talent|concours|talent show|making of|behind the scenes)/i.test(text);
      })
      .sort((a: YoutubeSearchResult, b: YoutubeSearchResult) =>
        scoreMusicResult(b, query) - scoreMusicResult(a, query)
      )
      .slice(0, 40)
      .map((result: any): YoutubeSearchResult => ({
        id: result.id,
        title: result.title,
        thumbnail: result.thumbnail,
        channelTitle: result.channelTitle,
        durationSeconds: result.durationSeconds,
        rawTitle: result.rawTitle,
        artistName: result.artistName,
        featuredArtistNames: result.featuredArtistNames,
        albumName: result.albumName,
        metadataSource: result.metadataSource,
        metadataConfidence: result.metadataConfidence,
      }));
  } finally {
    clearTimeout(timeout);
  }
}


function deduplicateMusicResults(results: YoutubeSearchResult[]) {
  // On retire uniquement les doublons stricts YouTube.
  // Deux vidéos différentes restent visibles même lorsqu'il s'agit du même titre
  // en version live, remix, paroles, acoustique ou instrumentale.
  const byVideoId = new Map<string, YoutubeSearchResult>();
  for (const result of results) {
    if (!result.id || byVideoId.has(result.id)) continue;
    byVideoId.set(result.id, result);
  }
  return [...byVideoId.values()];
}

function musicBrainResultsForQuery(query: string) {
  const normalized = normalizeMusicQuery(query);
  const compact = compactMusicQuery(query);
  if (!normalized) return [] as YoutubeSearchResult[];

  return Object.values(musicBrain.songs)
    .filter((song) => {
      const artist = normalizeMusicQuery(song.artistName || "");
      const title = normalizeMusicQuery(song.title || "");
      const artistCompact = artist.replace(/\s+/g, "");
      return artist.includes(normalized) || normalized.includes(artist) || artistCompact === compact || title.includes(normalized);
    })
    .map((song): YoutubeSearchResult => ({
      id: song.videoId,
      title: song.title,
      rawTitle: song.rawTitle,
      thumbnail: song.thumbnail,
      channelTitle: song.channelTitle,
      durationSeconds: song.durationSeconds,
      artistName: song.artistName,
      featuredArtistNames: song.featuredArtistNames,
      albumName: song.albumName,
      metadataSource: song.metadataSource,
      metadataConfidence: song.metadataConfidence,
    }))
    .sort((a, b) => scoreMusicResult(b, query) - scoreMusicResult(a, query));
}

type MusicBrainDirectSearchDecision = {
  useMusicBrainOnly: boolean;
  reason: "broad_artist_catalog" | "strong_artist_title_match" | null;
  strongMatchIds: Set<string>;
};

function normalizedPhraseTokens(value: string) {
  return normalizeMusicQuery(value).split(" ").filter(Boolean);
}

function normalizePreciseMatchText(value: string) {
  return stripDiacritics(String(value || ""))
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/\b(feat|featuring|ft|avec)\.?\b.*$/i, " ")
    .replace(/\b(official|officiel|official audio|audio officiel|official video|clip officiel|lyrics?|paroles|topic|art track|remaster(?:ed)?)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedPreciseTokens(value: string) {
  return normalizePreciseMatchText(value).split(" ").filter(Boolean);
}

function tokensEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((token, index) => token === right[index]);
}

function tokenOverlapRatio(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;

  const rightCounts = new Map<string, number>();
  for (const token of right) {
    rightCounts.set(token, (rightCounts.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of left) {
    const count = rightCounts.get(token) || 0;
    if (count <= 0) continue;
    overlap += 1;
    rightCounts.set(token, count - 1);
  }

  return overlap / Math.max(left.length, right.length);
}

function preciseTitleMatch(queryTitleTokens: string[], songTitle: string) {
  const titleTokens = normalizedPreciseTokens(songTitle);
  if (!queryTitleTokens.length || !titleTokens.length) return false;

  if (tokensEqual(queryTitleTokens, titleTokens)) return true;

  const queryJoined = queryTitleTokens.join(" ");
  const titleJoined = titleTokens.join(" ");

  // Tolère uniquement de petites différences de ponctuation / formes contractées /
  // variantes mineures, jamais une simple ressemblance vague.
  if (
    queryJoined.length >= 6 &&
    titleJoined.length >= 6 &&
    (queryJoined === titleJoined ||
      queryJoined.includes(titleJoined) ||
      titleJoined.includes(queryJoined))
  ) {
    const lengthRatio =
      Math.min(queryJoined.length, titleJoined.length) /
      Math.max(queryJoined.length, titleJoined.length);

    if (lengthRatio >= 0.92) return true;
  }

  const overlap = tokenOverlapRatio(queryTitleTokens, titleTokens);
  const sameLengthWindow = Math.abs(queryTitleTokens.length - titleTokens.length) <= 1;

  return overlap >= 0.92 && sameLengthWindow;
}

function removeArtistTokensFromQuery(query: string, artistName: string) {
  const queryTokens = normalizedPhraseTokens(query);
  const artistTokens = normalizedPhraseTokens(artistName);

  if (!queryTokens.length || !artistTokens.length || queryTokens.length <= artistTokens.length) {
    return null;
  }

  const startsWithArtist = artistTokens.every(
    (token, index) => queryTokens[index] === token
  );

  if (startsWithArtist) {
    return queryTokens.slice(artistTokens.length);
  }

  const startIndex = queryTokens.length - artistTokens.length;
  const endsWithArtist = artistTokens.every(
    (token, index) => queryTokens[startIndex + index] === token
  );

  if (endsWithArtist) {
    return queryTokens.slice(0, startIndex);
  }

  return null;
}

function musicBrainStrongArtistTitleMatches(
  query: string,
  known: YoutubeSearchResult[]
) {
  const matches: YoutubeSearchResult[] = [];

  for (const result of known) {
    const artistName = String(result.artistName || "").trim();
    const title = String(result.title || result.rawTitle || "").trim();
    if (!artistName || !title) continue;

    const remainingQueryTokens = removeArtistTokensFromQuery(query, artistName);
    if (!remainingQueryTokens?.length) continue;

    // Règle volontairement stricte mais tolérante aux petites différences :
    // ponctuation, apostrophes, tirets et variantes techniques YouTube.
    // Une recherche approximative continue toujours vers YouTube.
    if (preciseTitleMatch(remainingQueryTokens, title)) {
      matches.push(result);
    }
  }

  return matches;
}

function musicBrainQueryIsBroadArtistSearch(
  query: string,
  known: YoutubeSearchResult[]
) {
  const normalizedQuery = normalizeMusicQuery(query);
  const compactQuery = compactMusicQuery(query);
  if (!normalizedQuery) return false;

  return known.some((result) => {
    const artist = normalizeMusicQuery(result.artistName || "");
    const compactArtist = artist.replace(/\s+/g, "");
    return artist === normalizedQuery || compactArtist === compactQuery;
  });
}

function musicBrainDirectSearchDecision(
  query: string,
  known: YoutubeSearchResult[]
): MusicBrainDirectSearchDecision {
  const strongMatches = musicBrainStrongArtistTitleMatches(query, known);
  const strongMatchIds = new Set(strongMatches.map((result) => result.id));

  if (strongMatches.length > 0) {
    return {
      useMusicBrainOnly: true,
      reason: "strong_artist_title_match",
      strongMatchIds,
    };
  }

  const broadArtistSearch = musicBrainQueryIsBroadArtistSearch(query, known);

  if (broadArtistSearch && known.length > 20) {
    return {
      useMusicBrainOnly: true,
      reason: "broad_artist_catalog",
      strongMatchIds,
    };
  }

  return {
    useMusicBrainOnly: false,
    reason: null,
    strongMatchIds,
  };
}

function rankMusicBrainDirectResults(
  query: string,
  known: YoutubeSearchResult[],
  strongMatchIds: Set<string>
) {
  return deduplicateMusicResults(known)
    .sort((a, b) => {
      const aStrong = strongMatchIds.has(a.id) ? 1 : 0;
      const bStrong = strongMatchIds.has(b.id) ? 1 : 0;
      if (bStrong !== aStrong) return bStrong - aStrong;
      return scoreMusicResult(b, query) - scoreMusicResult(a, query);
    })
    .slice(0, 40);
}

async function smartYoutubeMusicSearch(query: string): Promise<YoutubeSearchResult[]> {
  const known = musicBrainResultsForQuery(query);
  const directDecision = musicBrainDirectSearchDecision(query, known);

  // Deux cas seulement permettent d'éviter complètement YouTube :
  // 1) recherche large d'un artiste avec plus de 20 titres déjà connus ;
  // 2) recherche précise "artiste + titre" avec correspondance exacte dans MusicBrain.
  //
  // Toute recherche précise non confirmée continue vers YouTube, même si MusicBrain
  // connaît énormément de titres de l'artiste. C'est la garantie fondamentale :
  // MusicBrain économise du quota, mais ne doit jamais masquer une musique trouvable
  // sur YouTube.
  if (directDecision.useMusicBrainOnly) {
    const results = rankMusicBrainDirectResults(
      query,
      known,
      directDecision.strongMatchIds
    );

    youtubeSearchStats.quotaSaved += 1;

    if (directDecision.reason === "strong_artist_title_match") {
      console.log(
        `🧠 MusicBrain "${query}" : correspondance exacte artiste + titre, YouTube évité.`
      );
    } else {
      console.log(
        `🧠 MusicBrain "${query}" : ${known.length} titre(s) connu(s), YouTube évité.`
      );
    }

    return results;
  }

  console.log(
    `🧠 MusicBrain "${query}" : ${known.length} résultat(s) local(aux), complément YouTube pour garantir le catalogue complet.`
  );

  const primary = await requestYoutubeMusic(query, "user");
  let combined = [...known, ...primary];

  const firstPass = deduplicateMusicResults(combined);
  const officialCount = firstPass.filter((result) => officialMusicStrength(result) >= 4).length;
  const compactQueryTokenCount = significantSearchTokens(query).length;

  console.log(`🎵 Recherche "${query}" : ${firstPass.length} résultat(s), ${officialCount} officiel(s)/fiable(s) avant secours ciblé.`);

  // Une liste peut contenir 30 ou 40 vidéos et pourtant presque aucune version
  // officielle. Dans ce cas on lance une recherche ciblée au lieu de considérer
  // à tort que la première page est "assez riche".
  const needsOfficialFallback =
    firstPass.length < 16 ||
    (compactQueryTokenCount > 0 && compactQueryTokenCount <= 5 && officialCount < 6);

  if (needsOfficialFallback) {
    const fallbackQuery = `${query} official audio`;
    const fallback = await requestYoutubeMusic(fallbackQuery, "user");
    combined = [...combined, ...fallback];
  }

  return deduplicateMusicResults(combined)
    .sort((a, b) => scoreMusicResult(b, query) - scoreMusicResult(a, query))
    .slice(0, 40);
}

loadYoutubeCache();
loadAcademyState();

const ACADEMY_QUERY_VARIANTS = [
  (artist: string) => `${artist} official audio`,
  (artist: string) => `${artist} topic`,
  (artist: string) => `${artist} art track`,
  (artist: string) => `${artist} album`,
  (artist: string) => `${artist} chansons`,
  (artist: string) => `${artist} meilleurs titres`,
];

// PARTYBRAIN ACADEMY V2 — rendement adaptatif
// Deux recherches consécutives sans nouveau morceau mettent temporairement
// l'artiste de côté pour éviter de gaspiller le quota YouTube.
const academyZeroCooldownHours = Math.max(
  12,
  Number(process.env.PARTYBRAIN_ACADEMY_ZERO_COOLDOWN_HOURS || 72)
);
const academyZeroCooldownMs = academyZeroCooldownHours * 60 * 60 * 1000;
const academyRecentYieldWindow = 4;

function academyProgressForArtist(artistKey: string): AcademyArtistProgress {
  const existing = academyState.artistProgress[artistKey];
  if (existing) {
    existing.recentAdds = Array.isArray(existing.recentAdds)
      ? existing.recentAdds.slice(-academyRecentYieldWindow)
      : [];
    existing.consecutiveZeroAdds = Number(existing.consecutiveZeroAdds || 0);
    existing.totalSongsAdded = Number(existing.totalSongsAdded || 0);
    existing.successfulAttempts = Number(existing.successfulAttempts || 0);
    existing.lastSongsAdded = Number(existing.lastSongsAdded || 0);
    return existing;
  }

  const created: AcademyArtistProgress = {
    attempts: 0,
    recentAdds: [],
    consecutiveZeroAdds: 0,
    totalSongsAdded: 0,
    successfulAttempts: 0,
    lastSongsAdded: 0,
  };
  academyState.artistProgress[artistKey] = created;
  return created;
}

function academyRecentYield(progress: AcademyArtistProgress) {
  const values = Array.isArray(progress.recentAdds)
    ? progress.recentAdds.slice(-academyRecentYieldWindow)
    : [];
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function recordAcademyDiscoveryYield(artistKey: string, songsAdded: number) {
  const progress = academyProgressForArtist(artistKey);
  const added = Math.max(0, Number(songsAdded || 0));

  progress.lastSongsAdded = added;
  progress.totalSongsAdded = Number(progress.totalSongsAdded || 0) + added;
  progress.recentAdds = [...(progress.recentAdds || []), added].slice(-academyRecentYieldWindow);

  if (added > 0) {
    progress.successfulAttempts = Number(progress.successfulAttempts || 0) + 1;
    progress.consecutiveZeroAdds = 0;
    progress.cooldownUntil = undefined;
  } else {
    progress.consecutiveZeroAdds = Number(progress.consecutiveZeroAdds || 0) + 1;
    if (progress.consecutiveZeroAdds >= 2) {
      progress.cooldownUntil = Date.now() + academyZeroCooldownMs;
    }
  }

  academyState.artistProgress[artistKey] = progress;
  return progress;
}

function academyResultIsTrusted(result: YoutubeSearchResult, expectedArtist: string) {
  const titleText = `${result.rawTitle || ""} ${result.title || ""}`.toLowerCase();
  const channelText = String(result.channelTitle || "").toLowerCase();
  const combined = `${titleText} ${channelText}`;

  // Academy doit enrichir MusicBrain avec des versions propres, pas avec des
  // reprises amateurs, karaokés, réactions, auditions ou contenus parasites.
  if (/(karaoke|instrumental|cover|reprise|tribute|hommage|parodie|fanmade|fan made|amateur|audition|the voice|incroyable talent|chorale|choir|school|école|concours|talent show)/i.test(combined)) {
    return false;
  }
  if (/(reaction|reacts?|interview|podcast|documentary|documentaire|making of|behind the scenes|shorts?|#shorts)/i.test(combined)) {
    return false;
  }

  const expectedKey = normalizeMusicQuery(expectedArtist || "");
  const artistKey = normalizeMusicQuery(result.artistName || "");
  const channelKey = normalizeMusicQuery(result.channelTitle || "");
  if (!expectedKey || !artistKey || artistKey === "unknown") return false;

  const artistMatches =
    artistKey === expectedKey ||
    artistKey.includes(expectedKey) ||
    expectedKey.includes(artistKey) ||
    channelKey.includes(expectedKey);

  const topicChannelMatches =
    /(?:^|\s)-\s*topic$/i.test(String(result.channelTitle || "").trim()) &&
    channelKey.includes(expectedKey);

  if (!artistMatches && !topicChannelMatches) return false;

  const trustedAudio =
    result.metadataSource === "ART_TRACK_DESCRIPTION" ||
    /(?:^|\s)-\s*topic$/i.test(channelText) ||
    /\btopic$/i.test(channelText) ||
    /\bofficial\s+audio\b/i.test(titleText) ||
    /\baudio\s+officiel\b/i.test(titleText) ||
    /provided to youtube/i.test(titleText);

  const trustedChannel =
    /\bofficial\b/i.test(channelText) ||
    /\bvevo\b/i.test(channelText) ||
    /\btopic\b/i.test(channelText);

  const trustedMetadata = Number(result.metadataConfidence || 0) >= 70;
  const duration = Number(result.durationSeconds || 0);
  const plausibleDuration = duration === 0 || (duration >= 60 && duration <= 720);

  return plausibleDuration && (trustedAudio || trustedChannel || trustedMetadata);
}

function recordMusicBrainAcademySearch(
  query: string,
  expectedArtist: string,
  results: YoutubeSearchResult[]
) {
  const accepted = results.filter((result) => academyResultIsTrusted(result, expectedArtist));
  recordMusicBrainSearch(query, accepted);
  return {
    accepted,
    rejectedCount: Math.max(0, results.length - accepted.length),
  };
}

function karaokeComparableTitle(value: unknown) {
  return normalizeMusicQuery(String(value || ""))
    .replace(/\b(?:feat|featuring|ft|avec)\b.*$/i, " ")
    .replace(/\b(?:official|officiel|official audio|audio officiel|official video|clip officiel|lyrics?|paroles|topic|art track|remaster(?:ed)?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function karaokeSearchTitle(song: MusicBrainSong) {
  const cleaned = karaokeComparableTitle(song.title || song.rawTitle || "");
  return cleaned || String(song.title || song.rawTitle || "").trim();
}

function nextAcademyKaraokeMission() {
  if (!karaokeFeatureEnabled) return null;

  const localResolution = karaokeLocalResolution();

  const candidates = Object.values(musicBrain.songs)
    .filter((song) => {
      const resolution = localResolution.resolutionByVideoId.get(song.videoId);
      return resolution?.kind === "probable_clip" || resolution?.kind === "indeterminate";
    })
    .filter((song) => !karaokeAudit.entries[song.videoId])
    .filter((song) => {
      const artistKey = normalizeMusicQuery(song.artistName || "");
      const titleKey = normalizeMusicQuery(song.title || song.rawTitle || "");
      return Boolean(
        artistKey &&
        artistKey !== "unknown" &&
        titleKey &&
        !/^(unknown|inconnu|artiste inconnu)$/i.test(String(song.artistName || "").trim())
      );
    })
    .sort((a, b) => {
      const resolutionA = localResolution.resolutionByVideoId.get(a.videoId);
      const resolutionB = localResolution.resolutionByVideoId.get(b.videoId);
      const clipPriorityA = resolutionA?.kind === "probable_clip" ? 1 : 0;
      const clipPriorityB = resolutionB?.kind === "probable_clip" ? 1 : 0;
      if (clipPriorityA !== clipPriorityB) return clipPriorityB - clipPriorityA;

      const score = (song: MusicBrainSong) =>
        Number(song.playedCount || 0) * 6 +
        Number(song.addedCount || 0) * 5 +
        Number(song.voteCount || 0) * 4 +
        Number(song.searchCount || 0) * 2 +
        Number(song.metadataConfidence || 0) / 10;

      return score(b) - score(a);
    });

  const song = candidates[0];
  if (!song) return null;

  return {
    mode: "karaoke" as const,
    key: `karaoke:${song.videoId}`,
    name: song.artistName,
    sourceSong: song,
    query: `${song.artistName} ${karaokeSearchTitle(song)}`,
  };
}

function academyMissionCandidates(excludedArtistKeys: Set<string> = new Set()) {
  const now = Date.now();

  return Object.values(musicBrain.artists)
    .filter((artist) => artist.key && artist.name && artist.key !== "unknown")
    .filter((artist) => !excludedArtistKeys.has(artist.key))
    .map((artist) => {
      const songCount = Object.keys(artist.songs || {}).length;
      const progress = academyProgressForArtist(artist.key);
      const cooldownUntil = Number(progress.cooldownUntil || 0);
      const inCooldown = cooldownUntil > now;
      const searchedRecently = now - Number(artist.lastSeenAt || 0) < 7 * 24 * 60 * 60 * 1000;
      const lastAttemptAgeMs = progress.lastAttemptAt ? now - Number(progress.lastAttemptAt) : Number.POSITIVE_INFINITY;

      const incompleteBonus = Math.max(0, academyTargetSongs - songCount) * 12;
      const demandScore = Number(artist.searchCount || 0) * 20;
      const recencyScore = searchedRecently ? 80 : 0;

      // V2 : le rendement observé devient un signal majeur.
      const recentYield = academyRecentYield(progress);
      const yieldScore = recentYield === null
        ? 45 // exploration : on laisse une vraie chance aux artistes jamais mesurés
        : Math.min(260, recentYield * 42);

      const zeroPenalty = Number(progress.consecutiveZeroAdds || 0) * 95;
      const retryPenalty = Math.min(120, Number(progress.attempts || 0) * 4);
      const veryRecentAttemptPenalty = lastAttemptAgeMs < 5 * 60_000
        ? 120
        : lastAttemptAgeMs < 30 * 60_000
          ? 55
          : 0;

      return {
        key: artist.key,
        name: artist.name,
        songCount,
        priority:
          demandScore +
          incompleteBonus +
          recencyScore +
          yieldScore -
          zeroPenalty -
          retryPenalty -
          veryRecentAttemptPenalty,
        progress,
        recentYield,
        cooldownUntil,
        inCooldown,
      };
    })
    .filter((candidate) => !candidate.inCooldown)
    .filter((candidate) => {
      // On continue à explorer un artiste déjà riche seulement s'il rapporte encore
      // réellement des nouveautés. Cela évite de boucler éternellement sur les stars.
      if (candidate.songCount < academyTargetSongs) return true;
      return Number(candidate.recentYield || 0) >= 1;
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aLastAttempt = Number(a.progress.lastAttemptAt || 0);
      const bLastAttempt = Number(b.progress.lastAttemptAt || 0);
      if (aLastAttempt !== bLastAttempt) return aLastAttempt - bLastAttempt;
      return a.songCount - b.songCount;
    });
}

function nextAcademyDiscoveryMission(excludedArtistKeys: Set<string> = new Set()) {
  const candidates = academyMissionCandidates(excludedArtistKeys);
  if (!candidates.length) return null;

  const candidate = candidates[0];
  const variantIndex = Number(candidate.progress.lastQueryVariant ?? -1) + 1;
  const normalizedVariant = variantIndex % ACADEMY_QUERY_VARIANTS.length;
  return {
    ...candidate,
    mode: "discovery" as const,
    variantIndex: normalizedVariant,
    query: ACADEMY_QUERY_VARIANTS[normalizedVariant](candidate.name),
  };
}

async function runPartyBrainAcademy(trigger: "scheduler" | "manual" = "scheduler") {
  if (academyState.running) return;
  const initialSnapshot = academyQuotaSnapshot();

  if (!academyEnabled && trigger !== "manual") return;
  if (trigger === "scheduler" && !initialSnapshot.inLaunchWindow) return;
  if (initialSnapshot.remaining <= 0) return;

  academyState.running = true;
  const session: AcademySession = {
    id: randomUUID(),
    startedAt: Date.now(),
    cycleKey: initialSnapshot.cycleKey,
    callsPlanned: initialSnapshot.remaining,
    callsUsed: 0,
    songsAdded: 0,
    artistsTouched: [],
    status: "running",
  };
  academyState.sessions.push(session);
  academyState.sessions = academyState.sessions.slice(-50);
  academyState.lastSessionAt = session.startedAt;
  addAcademyLog(
    "info",
    `Session lancée : ${initialSnapshot.remaining} appel(s) disponible(s) avant la réinitialisation.`,
  );

  // V2 : on fait tourner les artistes avant de revenir sur le même.
  // Si tous les artistes utiles ont été testés, on ouvre un nouveau tour.
  const artistsUsedThisRound = new Set<string>();

  try {
    while (true) {
      const snapshot = academyQuotaSnapshot();
      if (snapshot.remaining <= 0) {
        session.status = "completed";
        session.reason = "Quota restant entièrement transformé en connaissances.";
        break;
      }
      if (trigger === "scheduler" && snapshot.msUntilReset <= 20_000) {
        session.status = "stopped";
        session.reason = "Arrêt de sécurité 20 secondes avant la réinitialisation.";
        break;
      }

      // Karaoké OFF : 100 % du quota Academy sert maintenant à enrichir
      // le catalogue musical normal. Si le Karaoké est réactivé un jour,
      // son ancien chemin reste conservé ci-dessous.
      let karaokeMission = karaokeFeatureEnabled && session.callsUsed % 4 !== 3
        ? nextAcademyKaraokeMission()
        : null;
      let discoveryMission = karaokeMission
        ? null
        : nextAcademyDiscoveryMission(artistsUsedThisRound);

      // Tous les artistes utiles ont déjà été visités dans ce tour : on recommence
      // avec les priorités recalculées grâce au rendement fraîchement observé.
      if (!karaokeMission && !discoveryMission && artistsUsedThisRound.size > 0) {
        artistsUsedThisRound.clear();
        discoveryMission = nextAcademyDiscoveryMission(artistsUsedThisRound);
      }

      const fallbackKaraokeMission =
        karaokeFeatureEnabled && !karaokeMission && !discoveryMission
          ? nextAcademyKaraokeMission()
          : null;
      const mission = karaokeMission || discoveryMission || fallbackKaraokeMission;

      if (!mission) {
        session.status = "completed";
        session.reason = "Aucune mission utile restante : artistes saturés ou temporairement en cooldown.";
        break;
      }

      const beforeSongs = Object.keys(musicBrain.songs).length;

      if (mission.mode !== "karaoke") {
        const progress = academyProgressForArtist(mission.key);
        progress.attempts += 1;
        progress.lastAttemptAt = Date.now();
        progress.lastQueryVariant = mission.variantIndex;
        academyState.artistProgress[mission.key] = progress;
        artistsUsedThisRound.add(mission.key);
      }

      addAcademyLog(
        "info",
        `${mission.mode === "karaoke" ? "Audio prioritaire" : "Découverte"} ${session.callsUsed + 1}/${session.callsPlanned} : ${mission.query}`,
        {
          artist: mission.name,
          query: mission.query,
        }
      );

      session.callsUsed += 1;

      try {
        const results = await requestYoutubeMusic(mission.query, "academy");

        let acceptedCount = 0;
        let rejectedCount = 0;

        if (mission.mode === "karaoke") {
          const ranked = results
            .map((candidate) => ({
              candidate,
              kind: karaokeKindForVideo(candidate),
              score: karaokeCandidateScore(mission.sourceSong, candidate),
            }))
            .filter(
              (item) =>
                item.kind &&
                item.score >= 160 &&
                academyResultIsTrusted(item.candidate, mission.sourceSong.artistName)
            )
            .sort((a, b) => b.score - a.score);

          const best = ranked[0];

          if (best?.kind) {
            recordMusicBrainSearch(mission.query, [best.candidate]);
            acceptedCount = 1;
            karaokeAudit.entries[mission.sourceSong.videoId] = {
              sourceVideoId: mission.sourceSong.videoId,
              sourceTitle: mission.sourceSong.title,
              sourceArtistName: mission.sourceSong.artistName,
              checkedAt: Date.now(),
              kind: best.kind,
              candidateVideoId: best.candidate.id,
              candidateTitle: best.candidate.title,
              candidateChannelTitle: best.candidate.channelTitle,
              candidateDurationSeconds: best.candidate.durationSeconds,
            };
          } else {
            rejectedCount = results.length;
            karaokeAudit.entries[mission.sourceSong.videoId] = {
              sourceVideoId: mission.sourceSong.videoId,
              sourceTitle: mission.sourceSong.title,
              sourceArtistName: mission.sourceSong.artistName,
              checkedAt: Date.now(),
              kind: "not_found",
            };
          }
          saveKaraokeAudit();
        } else {
          const academyRecorded = recordMusicBrainAcademySearch(
            mission.query,
            mission.name,
            results
          );
          acceptedCount = academyRecorded.accepted.length;
          rejectedCount = academyRecorded.rejectedCount;
        }

        const normalizedQuery = normalizeMusicQuery(mission.query);
        youtubeSearchCache.set(normalizedQuery, {
          query: mission.query,
          normalizedQuery,
          createdAt: Date.now(),
          results,
          engineVersion: YOUTUBE_SEARCH_ENGINE_VERSION,
        });
        saveYoutubeCache();

        const added = Math.max(0, Object.keys(musicBrain.songs).length - beforeSongs);
        session.songsAdded += added;
        if (!session.artistsTouched.includes(mission.name)) session.artistsTouched.push(mission.name);

        let discoveryProgress: AcademyArtistProgress | null = null;
        if (mission.mode !== "karaoke") {
          discoveryProgress = recordAcademyDiscoveryYield(mission.key, added);
          if (Number(discoveryProgress.cooldownUntil || 0) > Date.now()) {
            addAcademyLog(
              "warning",
              `${mission.name} mis en pause ${academyZeroCooldownHours} h après ${discoveryProgress.consecutiveZeroAdds} recherche(s) consécutive(s) à +0.`,
              { artist: mission.name, query: mission.query, songsAdded: added }
            );
          }
        }

        addAcademyLog(
          acceptedCount > 0 ? "success" : "info",
          mission.mode === "karaoke"
            ? `${mission.name} — ${mission.sourceSong.title} : ${acceptedCount ? "version audio officielle trouvée" : "aucune version audio fiable trouvée"}.`
            : `${mission.name} enrichi : +${added} nouveau(x) morceau(x), ${rejectedCount} résultat(s) douteux écarté(s) • rendement récent ${academyRecentYield(discoveryProgress || academyProgressForArtist(mission.key))?.toFixed(1) || "0.0"}/appel.`,
          {
            artist: mission.name,
            query: mission.query,
            songsAdded: added,
          }
        );
      } catch (error: any) {
        const status = Number(error?.status || 500);
        if (status === 429) {
          session.status = "quota_exhausted";
          session.reason = "YouTube a signalé que le quota réel était épuisé.";
          addAcademyLog("warning", "Quota YouTube réel épuisé : session arrêtée immédiatement.");
          break;
        }
        addAcademyLog("error", `Échec pour ${mission.name} : ${error?.message || "erreur inconnue"}.`, {
          artist: mission.name,
          query: mission.query,
        });
      }

      session.finishedAt = Date.now();
      saveAcademyState();
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  } catch (error: any) {
    session.status = "failed";
    session.reason = error?.message || "Erreur Academy inconnue";
    addAcademyLog("error", `Session interrompue : ${session.reason}`);
  } finally {
    session.finishedAt = Date.now();
    if (session.status === "running") session.status = "completed";
    academyState.running = false;
    saveAcademyState();
    addAcademyLog(
      session.status === "completed" ? "success" : "warning",
      `Session terminée : ${session.callsUsed} recherche(s), +${session.songsAdded} morceau(x), ${session.artistsTouched.length} artiste(s) touché(s).`,
    );
  }
}

function academyDashboard() {
  const snapshot = academyQuotaSnapshot();
  const missions = academyMissionCandidates().slice(0, 12).map((mission) => ({
    artistKey: mission.key,
    artistName: mission.name,
    knownSongs: mission.songCount,
    targetSongs: academyTargetSongs,
    priority: Math.max(0, Math.round(mission.priority)),
    attempts: Number(mission.progress.attempts || 0),
    lastSongsAdded: Number(mission.progress.lastSongsAdded || 0),
    totalSongsAdded: Number(mission.progress.totalSongsAdded || 0),
    recentYield: mission.recentYield === null ? null : Math.round(mission.recentYield * 10) / 10,
    consecutiveZeroAdds: Number(mission.progress.consecutiveZeroAdds || 0),
    cooldownUntil: Number(mission.progress.cooldownUntil || 0) || null,
    nextQuery: ACADEMY_QUERY_VARIANTS[(Number(mission.progress.lastQueryVariant ?? -1) + 1) % ACADEMY_QUERY_VARIANTS.length](mission.name),
  }));
  return {
    ...snapshot,
    strategy: "adaptive-yield-v2",
    karaokeDiscoveryEnabled: karaokeFeatureEnabled,
    zeroCooldownHours: academyZeroCooldownHours,
    lastCheckAt: academyState.lastCheckAt,
    lastSessionAt: academyState.lastSessionAt,
    missions,
    currentSession: [...academyState.sessions].reverse().find((session) => session.status === "running") || null,
    lastSession: [...academyState.sessions].reverse().find((session) => session.status !== "running") || null,
    sessions: [...academyState.sessions].reverse().slice(0, 20),
    logs: [...academyState.logs].reverse().slice(0, 150),
  };
}

setInterval(() => {
  academyState.lastCheckAt = Date.now();
  ensureAcademyQuotaCycle();
  saveAcademyState();
  const snapshot = academyQuotaSnapshot();
  if (academyEnabled && snapshot.inLaunchWindow && snapshot.remaining > 0 && !academyState.running) {
    const alreadyRanThisCycle = academyState.sessions.some(
      (session) => session.cycleKey === snapshot.cycleKey && session.status !== "failed"
    );
    if (!alreadyRanThisCycle) {
      void runPartyBrainAcademy("scheduler");
    }
  }
}, 30_000);



app.get("/partybrain/intelligence/insights/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Recherche manquante" });
  return res.json(partyBrainSearchInsight(query));
});

app.get("/partybrain/intelligence/stats", (_req, res) => {
  res.json(partyIntelligenceStats());
});

app.get("/partybrain/intelligence/stats/v2", (_req, res) => {
  res.json(partyIntelligenceStats());
});

app.get("/partybrain/intelligence/events", (req, res) => {
  const requested = Number(req.query.limit || 500);
  const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 500, 5000));
  res.json({ events: readPartyEvents(limit) });
});

app.get("/partybrain/intelligence/export", (_req, res) => {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="mixparty-party-intelligence-${Date.now()}.jsonl"`);
  if (!fs.existsSync(partyEventsFilePath)) return res.send("");
  return res.sendFile(partyEventsFilePath);
});


type KaraokeAuditKind = "topic" | "official_audio" | "not_found";

type KaraokeAuditEntry = {
  sourceVideoId: string;
  sourceTitle: string;
  sourceArtistName: string;
  checkedAt: number;
  kind: KaraokeAuditKind;
  candidateVideoId?: string;
  candidateTitle?: string;
  candidateChannelTitle?: string;
  candidateDurationSeconds?: number;
};

type KaraokeAuditState = {
  version: 1;
  updatedAt: number;
  entries: Record<string, KaraokeAuditEntry>;
};

function createEmptyKaraokeAudit(): KaraokeAuditState {
  return { version: 1, updatedAt: Date.now(), entries: {} };
}

let karaokeAudit: KaraokeAuditState = createEmptyKaraokeAudit();

function saveKaraokeAudit() {
  karaokeAudit.updatedAt = Date.now();
  try {
    fs.writeFileSync(karaokeAuditFilePath, JSON.stringify(karaokeAudit, null, 2), "utf-8");
  } catch (error) {
    console.warn("Audit Karaoké non sauvegardé :", error);
  }
}

function loadKaraokeAudit() {
  if (!fs.existsSync(karaokeAuditFilePath)) {
    saveKaraokeAudit();
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(karaokeAuditFilePath, "utf-8"));
    karaokeAudit = {
      version: 1,
      updatedAt: Number(parsed?.updatedAt || Date.now()),
      entries: parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {},
    };
  } catch (error) {
    console.warn("Audit Karaoké illisible, nouvelle base créée :", error);
    karaokeAudit = createEmptyKaraokeAudit();
    saveKaraokeAudit();
  }
}

function karaokeKindForVideo(video: {
  rawTitle?: string;
  title?: string;
  channelTitle?: string;
  metadataSource?: MusicMetadataSource;
}): Exclude<KaraokeAuditKind, "not_found"> | null {
  const channel = String(video.channelTitle || "").trim().toLowerCase();
  const rawTitle = String(video.rawTitle || video.title || "").trim().toLowerCase();

  if (
    video.metadataSource === "ART_TRACK_DESCRIPTION" ||
    /(?:^|\s)-\s*topic$/.test(channel) ||
    /\btopic$/.test(channel)
  ) {
    return "topic";
  }

  if (
    /\bofficial\s+audio\b/i.test(rawTitle) ||
    /\baudio\s+officiel\b/i.test(rawTitle) ||
    /\bofficial\s+audio\b/i.test(channel)
  ) {
    return "official_audio";
  }

  return null;
}

function karaokeCandidateScore(source: MusicBrainSong, candidate: YoutubeSearchResult) {
  const kind = karaokeKindForVideo(candidate);
  if (!kind) return -1;

  const targetTitle = karaokeComparableTitle(source.title || source.rawTitle || "");
  const candidateTitle = karaokeComparableTitle(candidate.title || candidate.rawTitle || "");
  const targetArtist = normalizeMusicQuery(source.artistName || "");
  const candidateArtist = normalizeMusicQuery(candidate.artistName || candidate.channelTitle || "");
  const candidateChannel = normalizeMusicQuery(candidate.channelTitle || "");

  let score = kind === "topic" ? 200 : 170;

  if (!targetTitle || !candidateTitle) return -1;

  if (candidateTitle === targetTitle) {
    score += 100;
  } else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) {
    score += 60;
  } else {
    const targetTokens = new Set(targetTitle.split(" ").filter((token) => token.length > 1));
    const candidateTokens = new Set(candidateTitle.split(" ").filter((token) => token.length > 1));
    const common = [...targetTokens].filter((token) => candidateTokens.has(token)).length;
    const similarity = targetTokens.size ? common / targetTokens.size : 0;
    if (similarity >= 0.75) score += 45;
    else return -1;
  }

  if (targetArtist && candidateArtist === targetArtist) score += 70;
  else if (
    targetArtist &&
    (
      (candidateArtist && (candidateArtist.includes(targetArtist) || targetArtist.includes(candidateArtist))) ||
      (candidateChannel && candidateChannel.includes(targetArtist))
    )
  ) {
    score += 40;
  }

  const sourceDuration = Number(source.durationSeconds || 0);
  const candidateDuration = Number(candidate.durationSeconds || 0);
  if (sourceDuration > 0 && candidateDuration > 0) {
    const diff = Math.abs(sourceDuration - candidateDuration);
    if (diff <= 3) score += 35;
    else if (diff <= 8) score += 18;
    else if (diff > 45) score -= 35;
  }

  return score;
}

type KaraokeLocalResolutionKind =
  | "direct_topic"
  | "direct_official_audio"
  | "alternative_topic"
  | "alternative_official_audio"
  | "probable_clip"
  | "indeterminate";

function karaokeTrackKey(song: Pick<MusicBrainSong, "title" | "rawTitle" | "artistName">) {
  const artist = normalizeMusicQuery(song.artistName || "");
  const title = normalizeMusicQuery(song.title || song.rawTitle || "");
  if (!artist || !title) return "";
  return `${artist}::${title}`;
}

function karaokeLooksLikeClip(song: MusicBrainSong) {
  const title = `${song.rawTitle || ""} ${song.title || ""}`.toLowerCase();
  const channel = String(song.channelTitle || "").toLowerCase();
  return (
    /\bofficial\s+(music\s+)?video\b/i.test(title) ||
    /\b(?:clip|vid[eé]o)\s+officiel(?:le)?\b/i.test(title) ||
    /\bmusic\s+video\b/i.test(title) ||
    /\bvevo\b/i.test(channel)
  );
}

function karaokeLocalResolution() {
  const songs = Object.values(musicBrain.songs);

  const compatibleByTrack = new Map<
    string,
    { kind: "topic" | "official_audio"; videoId: string }
  >();

  for (const song of songs) {
    const kind = karaokeKindForVideo(song);
    if (!kind) continue;
    const key = karaokeTrackKey(song);
    if (!key) continue;

    const current = compatibleByTrack.get(key);
    if (!current || (kind === "topic" && current.kind !== "topic")) {
      compatibleByTrack.set(key, { kind, videoId: song.videoId });
    }
  }

  const resolutionByVideoId = new Map<
    string,
    {
      kind: KaraokeLocalResolutionKind;
      candidateVideoId?: string;
    }
  >();

  let directTopic = 0;
  let directOfficialAudio = 0;
  let alternativeTopic = 0;
  let alternativeOfficialAudio = 0;
  let probableClip = 0;
  let indeterminate = 0;

  for (const song of songs) {
    const directKind = karaokeKindForVideo(song);
    if (directKind === "topic") {
      directTopic += 1;
      resolutionByVideoId.set(song.videoId, { kind: "direct_topic", candidateVideoId: song.videoId });
      continue;
    }
    if (directKind === "official_audio") {
      directOfficialAudio += 1;
      resolutionByVideoId.set(song.videoId, { kind: "direct_official_audio", candidateVideoId: song.videoId });
      continue;
    }

    const key = karaokeTrackKey(song);
    const alternative = key ? compatibleByTrack.get(key) : undefined;
    if (alternative && alternative.videoId !== song.videoId) {
      if (alternative.kind === "topic") {
        alternativeTopic += 1;
        resolutionByVideoId.set(song.videoId, {
          kind: "alternative_topic",
          candidateVideoId: alternative.videoId,
        });
      } else {
        alternativeOfficialAudio += 1;
        resolutionByVideoId.set(song.videoId, {
          kind: "alternative_official_audio",
          candidateVideoId: alternative.videoId,
        });
      }
      continue;
    }

    if (karaokeLooksLikeClip(song)) {
      probableClip += 1;
      resolutionByVideoId.set(song.videoId, { kind: "probable_clip" });
    } else {
      indeterminate += 1;
      resolutionByVideoId.set(song.videoId, { kind: "indeterminate" });
    }
  }

  const topic = directTopic + alternativeTopic;
  const officialAudio = directOfficialAudio + alternativeOfficialAudio;
  const compatible = topic + officialAudio;
  const unclassified = probableClip + indeterminate;

  return {
    resolutionByVideoId,
    summary: {
      scannedAt: Date.now(),
      scannedSongs: songs.length,
      directTopic,
      directOfficialAudio,
      alternativeTopic,
      alternativeOfficialAudio,
      topic,
      officialAudio,
      compatible,
      probableClip,
      indeterminate,
      unclassified,
      coveragePercent: songs.length
        ? Math.round((compatible / songs.length) * 1000) / 10
        : 0,
    },
  };
}

function karaokeLocalMusicBrainScan() {
  return karaokeLocalResolution().summary;
}

function karaokeAuditSummary() {
  const songs = Object.values(musicBrain.songs);
  const localResolution = karaokeLocalResolution();
  const localScan = localResolution.summary;

  const alreadyTopic = localScan.topic;
  const alreadyOfficialAudio = localScan.officialAudio;
  const alreadyCompatible = localScan.compatible;

  const locallyCompatibleIds = new Set(
    [...localResolution.resolutionByVideoId.entries()]
      .filter(([, resolution]) =>
        resolution.kind === "direct_topic" ||
        resolution.kind === "direct_official_audio" ||
        resolution.kind === "alternative_topic" ||
        resolution.kind === "alternative_official_audio"
      )
      .map(([videoId]) => videoId)
  );

  const relevantEntries = Object.values(karaokeAudit.entries).filter(
    (entry) =>
      Boolean(musicBrain.songs[entry.sourceVideoId]) &&
      !locallyCompatibleIds.has(entry.sourceVideoId)
  );

  const discoveredTopic = relevantEntries.filter((entry) => entry.kind === "topic").length;
  const discoveredOfficialAudio = relevantEntries.filter((entry) => entry.kind === "official_audio").length;
  const noOfficialAudio = relevantEntries.filter((entry) => entry.kind === "not_found").length;
  const auditedMissing = relevantEntries.length;
  const confirmedCompatible = alreadyCompatible + discoveredTopic + discoveredOfficialAudio;
  const unchecked = Math.max(0, songs.length - alreadyCompatible - auditedMissing);
  const checkedSongs = Math.min(songs.length, alreadyCompatible + auditedMissing);

  return {
    generatedAt: Date.now(),
    updatedAt: karaokeAudit.updatedAt,
    knownSongs: songs.length,
    alreadyTopic,
    alreadyOfficialAudio,
    alreadyCompatible,
    discoveredTopic,
    discoveredOfficialAudio,
    noOfficialAudio,
    auditedMissing,
    checkedSongs,
    unchecked,
    confirmedCompatible,
    confirmedCoveragePercent: songs.length ? Math.round((confirmedCompatible / songs.length) * 1000) / 10 : 0,
    checkedPercent: songs.length ? Math.round((checkedSongs / songs.length) * 1000) / 10 : 0,
    localScan,
    youtubeAudit: {
      tested: auditedMissing,
      foundTopic: discoveredTopic,
      foundOfficialAudio: discoveredOfficialAudio,
      notFound: noOfficialAudio,
    },
    note: "MusicBrain est analysé localement d'abord : versions audio directes + autres videoId du même titre déjà connus. YouTube reste une seconde étape séparée uniquement pour les morceaux encore sans solution locale.",
    youtubeSearchesPerBatchMax: 10,
  };
}


type KaraokeLyricsAuditKind = "synced" | "plain" | "instrumental" | "not_found";

type KaraokeLyricsAuditEntry = {
  videoId: string;
  checkedAt: number;
  kind: KaraokeLyricsAuditKind;
  lrclibId?: number;
  matchedTrackName?: string;
  matchedArtistName?: string;
  matchedAlbumName?: string;
  matchedDuration?: number;
};

type KaraokeLyricsAuditState = {
  version: 1;
  updatedAt: number;
  entries: Record<string, KaraokeLyricsAuditEntry>;
};

function createEmptyKaraokeLyricsAudit(): KaraokeLyricsAuditState {
  return {
    version: 1,
    updatedAt: Date.now(),
    entries: {},
  };
}

let karaokeLyricsAudit: KaraokeLyricsAuditState = createEmptyKaraokeLyricsAudit();

function saveKaraokeLyricsAudit() {
  karaokeLyricsAudit.updatedAt = Date.now();
  try {
    fs.writeFileSync(
      karaokeLyricsAuditFilePath,
      JSON.stringify(karaokeLyricsAudit, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.warn("Audit paroles Karaoké non sauvegardé :", error);
  }
}

function loadKaraokeLyricsAudit() {
  if (!fs.existsSync(karaokeLyricsAuditFilePath)) {
    saveKaraokeLyricsAudit();
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(karaokeLyricsAuditFilePath, "utf-8"));
    karaokeLyricsAudit = {
      version: 1,
      updatedAt: Number(parsed?.updatedAt || Date.now()),
      entries:
        parsed?.entries && typeof parsed.entries === "object"
          ? parsed.entries
          : {},
    };
  } catch (error) {
    console.warn("Audit paroles Karaoké illisible, nouvelle base créée :", error);
    karaokeLyricsAudit = createEmptyKaraokeLyricsAudit();
    saveKaraokeLyricsAudit();
  }
}

function karaokeLyricsComparable(value: unknown) {
  return normalizeMusicQuery(String(value || ""))
    .replace(/\b(?:official|officiel|official audio|audio officiel|official video|clip officiel|lyrics?|paroles|topic|art track|remaster(?:ed)?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function karaokeLyricsArtistReliable(song: MusicBrainSong) {
  const artist = String(song.artistName || "").trim();
  const key = normalizeMusicQuery(artist);
  if (!key || /^(unknown|inconnu|artiste inconnu|unknown artist)$/i.test(artist)) return false;
  if (/^(da|art|music|musique|official|officiel|topic|audio|video)$/i.test(key)) return false;
  return true;
}


const KARAOKE_STRICT_DURATION_TOLERANCE_SECONDS = 0.5;
const KARAOKE_STRICT_MIN_TIMED_LINES = 5;

const KARAOKE_UNSAFE_VERSION_MARKERS = [
  "live",
  "concert",
  "remix",
  "radio edit",
  "edit version",
  "sped up",
  "speed up",
  "slowed",
  "slowed down",
  "nightcore",
  "acoustic",
  "acoustique",
  "unplugged",
  "instrumental",
  "cover",
  "karaoke version",
  "extended",
  "demo",
  "rehearsal",
  "remaster",
  "remastered",
  "version longue",
  "version courte",
  "clip officiel",
  "official video",
  "music video",
  "video officielle",
];

function karaokeVersionComparable(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function karaokeSongHasUnsafeVersionMarker(song: MusicBrainSong) {
  const haystack = karaokeVersionComparable(
    `${song.rawTitle || ""} ${song.title || ""} ${song.channelTitle || ""}`
  );

  return KARAOKE_UNSAFE_VERSION_MARKERS.some((marker) =>
    haystack.includes(marker)
  );
}

function karaokeSourceLooksAudioExact(song: MusicBrainSong) {
  const channel = karaokeVersionComparable(song.channelTitle || "");
  const raw = karaokeVersionComparable(song.rawTitle || song.title || "");

  // YouTube Art Tracks / Topic sont les sources les plus stables pour faire
  // correspondre la durée et les timestamps LRCLIB.
  const topicChannel =
    /(^|\s)-?\s*topic$/.test(channel) ||
    channel.endsWith(" topic");

  const officialAudio =
    raw.includes("official audio") ||
    raw.includes("audio officiel");

  const learnedAsArtTrack =
    song.metadataSource === "ART_TRACK_DESCRIPTION";

  // On accepte seulement des sources audio très fiables.
  return topicChannel || officialAudio || learnedAsArtTrack;
}

function karaokeLyricsCertifiedSource(song: MusicBrainSong) {
  if (!karaokeSourceLooksAudioExact(song)) return false;
  if (karaokeSongHasUnsafeVersionMarker(song)) return false;
  return true;
}

function karaokeLyricsStrictIdentityMatch(song: MusicBrainSong, item: any) {
  // V5 : un bon match LRCLIB ne suffit plus. La source audio YouTube doit
  // elle-même être une version jugée assez stable pour le Karaoké.
  if (!karaokeLyricsCertifiedSource(song)) return false;

  const targetTitle = karaokeLyricsComparable(song.title || song.rawTitle || "");
  const targetArtist = karaokeLyricsComparable(song.artistName || "");
  const resultTitle = karaokeLyricsComparable(item?.trackName || "");
  const resultArtist = karaokeLyricsComparable(item?.artistName || "");

  if (!targetTitle || !targetArtist || !resultTitle || !resultArtist) return false;

  // Mode fiabilité maximale : titre et artiste doivent correspondre exactement.
  if (resultTitle !== targetTitle) return false;
  if (resultArtist !== targetArtist) return false;

  const sourceDuration = Number(song.durationSeconds || 0);
  const resultDuration = Number(item?.duration || 0);

  // Sans durée des deux côtés, on ne publie pas.
  if (!(sourceDuration > 0) || !(resultDuration > 0)) return false;

  return (
    Math.abs(sourceDuration - resultDuration) <=
    KARAOKE_STRICT_DURATION_TOLERANCE_SECONDS
  );
}

function karaokeLyricsStrictTimedLines(raw: unknown, expectedDuration?: number) {
  const lines = parseLrclibSyncedLyrics(raw);
  const nonEmpty = lines.filter((line) => String(line.text || "").trim());

  if (nonEmpty.length < KARAOKE_STRICT_MIN_TIMED_LINES) return false;

  const lastTimedLine = nonEmpty[nonEmpty.length - 1]?.time || 0;
  if (!(lastTimedLine > 0)) return false;

  const duration = Number(expectedDuration || 0);
  if (duration > 0) {
    // V5 : on refuse les fichiers qui dépassent réellement l'audio.
    if (lastTimedLine > duration + 0.75) return false;

    // Les paroles ne doivent pas s'arrêter très tôt par rapport au morceau.
    // On garde une marge pour les longues outros instrumentales.
    if (lastTimedLine < duration * 0.55) return false;
  }

  // Timestamps strictement croissants : sinon le défilement est imprévisible.
  for (let index = 1; index < nonEmpty.length; index += 1) {
    if (nonEmpty[index].time <= nonEmpty[index - 1].time) return false;
  }

  return true;
}

function karaokeLyricsStrictCandidateMatch(song: MusicBrainSong, item: any) {
  if (!karaokeLyricsStrictIdentityMatch(song, item)) return false;
  if (!String(item?.syncedLyrics || "").trim()) return false;

  return karaokeLyricsStrictTimedLines(
    item.syncedLyrics,
    Number(item?.duration || song.durationSeconds || 0)
  );
}


function karaokeLyricsCertifiedReason(song: MusicBrainSong) {
  const reasons: string[] = [];

  if (song.metadataSource === "ART_TRACK_DESCRIPTION") reasons.push("ART_TRACK");
  if (karaokeVersionComparable(song.channelTitle || "").includes("topic")) {
    reasons.push("TOPIC");
  }
  if (
    karaokeVersionComparable(song.rawTitle || song.title || "").includes(
      "official audio"
    )
  ) {
    reasons.push("OFFICIAL_AUDIO");
  }

  reasons.push("TITLE_EXACT", "ARTIST_EXACT", "DURATION_0_5S");

  return reasons.join("+");
}

function karaokeLyricsAuditEntryIsStrictlyVerified(
  song: MusicBrainSong | undefined,
  entry: KaraokeLyricsAuditEntry | undefined
) {
  if (!song || !entry || entry.kind !== "synced" || !entry.lrclibId) return false;

  return karaokeLyricsStrictIdentityMatch(song, {
    trackName: entry.matchedTrackName,
    artistName: entry.matchedArtistName,
    duration: entry.matchedDuration,
  });
}

function karaokeLyricsCandidateScore(song: MusicBrainSong, item: any) {
  const targetTitle = karaokeLyricsComparable(song.title || song.rawTitle || "");
  const targetArtist = karaokeLyricsComparable(song.artistName || "");
  const resultTitle = karaokeLyricsComparable(item?.trackName || "");
  const resultArtist = karaokeLyricsComparable(item?.artistName || "");

  if (!targetTitle || !targetArtist || !resultTitle || !resultArtist) return -1;

  let score = 0;

  if (resultTitle === targetTitle) score += 160;
  else if (resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle)) score += 90;
  else {
    const targetTokens = new Set(targetTitle.split(" ").filter((token) => token.length > 1));
    const resultTokens = new Set(resultTitle.split(" ").filter((token) => token.length > 1));
    const common = [...targetTokens].filter((token) => resultTokens.has(token)).length;
    const ratio = targetTokens.size ? common / targetTokens.size : 0;
    if (ratio >= 0.8) score += 60;
    else return -1;
  }

  if (resultArtist === targetArtist) score += 140;
  else if (resultArtist.includes(targetArtist) || targetArtist.includes(resultArtist)) score += 70;
  else return -1;

  const sourceDuration = Number(song.durationSeconds || 0);
  const resultDuration = Number(item?.duration || 0);
  if (sourceDuration > 0 && resultDuration > 0) {
    const diff = Math.abs(sourceDuration - resultDuration);
    if (diff <= 2) score += 80;
    else if (diff <= 5) score += 50;
    else if (diff <= 10) score += 20;
    else if (diff > 30) score -= 60;
  }

  if (item?.syncedLyrics) score += 30;
  if (item?.plainLyrics) score += 10;

  return score;
}

async function requestLrclibForSong(song: MusicBrainSong) {
  const params = new URLSearchParams({
    track_name: String(song.title || song.rawTitle || "").trim(),
    artist_name: String(song.artistName || "").trim(),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
      headers: {
        "User-Agent": "MixParty/1.0 (https://mixpartyapp.fr)",
        "Lrclib-Client": "MixParty/1.0 (https://mixpartyapp.fr)",
      },
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = Math.max(1, Number(response.headers.get("retry-after") || 5));
      const error: any = new Error("LRCLIB_RATE_LIMIT");
      error.status = 429;
      error.retryAfter = retryAfter;
      throw error;
    }

    if (!response.ok) {
      const error: any = new Error(`LRCLIB HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [];

    const ranked = items
      .filter((item: any) => karaokeLyricsStrictCandidateMatch(song, item))
      .map((item: any) => ({
        item,
        score: karaokeLyricsCandidateScore(song, item),
      }))
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.item || null;
  } finally {
    clearTimeout(timeout);
  }
}

function karaokeLyricsAuditSummary() {
  const songs = Object.values(musicBrain.songs);
  const entries = Object.values(karaokeLyricsAudit.entries).filter(
    (entry) => Boolean(musicBrain.songs[entry.videoId])
  );

  const rawSynced = entries.filter((entry) => entry.kind === "synced").length;
  const synced = entries.filter((entry) =>
    karaokeLyricsAuditEntryIsStrictlyVerified(
      musicBrain.songs[entry.videoId],
      entry
    )
  ).length;
  const heldForSyncVerification = Math.max(0, rawSynced - synced);
  const plain = entries.filter((entry) => entry.kind === "plain").length;
  const instrumental = entries.filter((entry) => entry.kind === "instrumental").length;
  const notFound = entries.filter((entry) => entry.kind === "not_found").length;
  const checked = entries.length;

  const eligibleSongs = songs.filter(karaokeLyricsArtistReliable);
  const eligibleCount = eligibleSongs.length;
  const unchecked = Math.max(0, eligibleCount - checked);

  return {
    generatedAt: Date.now(),
    updatedAt: karaokeLyricsAudit.updatedAt,
    knownSongs: songs.length,
    eligibleSongs: eligibleCount,
    checked,
    unchecked,
    synced,
    rawSynced,
    heldForSyncVerification,
    plain,
    instrumental,
    notFound,
    syncedCoverageCheckedPercent:
      checked ? Math.round((synced / checked) * 1000) / 10 : 0,
    syncedCoverageEligiblePercent:
      eligibleCount ? Math.round((synced / eligibleCount) * 1000) / 10 : 0,
    batchSizeMax: 100,
    delayMs: 300,
    note:
      "Karaoké Sync Certified V5 : seuls les Art Tracks/Topic/Official Audio sans variante douteuse, avec titre exact + artiste exact + durée ±0,5 s + timestamps cohérents sont publiables. Rien n’est supprimé de PartyBrain.",
  };
}

loadKaraokeLyricsAudit();

type AutomaticLrclibQueueItem = {
  videoId: string;
  reason: "musicbrain-search" | "party-addition";
  queuedAt: number;
};

const automaticLrclibQueue: AutomaticLrclibQueueItem[] = [];
const automaticLrclibQueuedIds = new Set<string>();
let automaticLrclibWorkerRunning = false;

const AUTOMATIC_LRCLIB_DELAY_MS = 400;
const AUTOMATIC_LRCLIB_RETRY_AFTER_MS = 30_000;

function automaticLrclibNeedsCheck(song: MusicBrainSong) {
  if (!karaokeLyricsArtistReliable(song)) return false;

  const existing = karaokeLyricsAudit.entries[song.videoId];
  if (!existing) return true;

  if (existing.kind === "instrumental") {
    return false;
  }

  if (existing.kind === "synced") {
    return !karaokeLyricsAuditEntryIsStrictlyVerified(song, existing);
  }

  // Si MusicBrain a corrigé l'artiste depuis l'ancien audit, on retente.
  const currentArtist = normalizeMusicQuery(song.artistName || "");
  const auditedArtist = normalizeMusicQuery(existing.matchedArtistName || "");
  if (currentArtist && auditedArtist && currentArtist !== auditedArtist) {
    return true;
  }

  // LRCLIB évolue : les échecs/paroles simples sont retestés après 14 jours.
  const ageMs = Date.now() - Number(existing.checkedAt || 0);
  return ageMs >= 14 * 24 * 60 * 60_000;
}

function enqueueAutomaticLrclibCheck(
  videoId: string,
  reason: AutomaticLrclibQueueItem["reason"]
) {
  if (!karaokeFeatureEnabled) return;

  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) return;

  const song = musicBrain.songs[cleanVideoId];
  if (!song || !automaticLrclibNeedsCheck(song)) return;
  if (automaticLrclibQueuedIds.has(cleanVideoId)) return;

  automaticLrclibQueuedIds.add(cleanVideoId);
  automaticLrclibQueue.push({
    videoId: cleanVideoId,
    reason,
    queuedAt: Date.now(),
  });

  void runAutomaticLrclibWorker();
}

async function runAutomaticLrclibWorker() {
  if (!karaokeFeatureEnabled) {
    automaticLrclibQueue.length = 0;
    automaticLrclibQueuedIds.clear();
    automaticLrclibWorkerRunning = false;
    return;
  }
  if (automaticLrclibWorkerRunning) return;
  automaticLrclibWorkerRunning = true;

  try {
    while (automaticLrclibQueue.length > 0) {
      const job = automaticLrclibQueue.shift();
      if (!job) continue;

      automaticLrclibQueuedIds.delete(job.videoId);

      const song = musicBrain.songs[job.videoId];
      if (!song || !automaticLrclibNeedsCheck(song)) continue;

      try {
        const match = await requestLrclibForSong(song);

        let kind: KaraokeLyricsAuditKind = "not_found";
        if (match?.instrumental) kind = "instrumental";
        else if (String(match?.syncedLyrics || "").trim()) kind = "synced";
        else if (String(match?.plainLyrics || "").trim()) kind = "plain";

        if (kind === "synced" && match && karaokeLyricsStrictCandidateMatch(song, match)) {
          song.karaokeSyncCertifiedAt = Date.now();
          song.karaokeSyncCertifiedReason = karaokeLyricsCertifiedReason(song);
        } else {
          song.karaokeSyncCertifiedAt = undefined;
          song.karaokeSyncCertifiedReason = undefined;
        }

        karaokeLyricsAudit.entries[song.videoId] = {
          videoId: song.videoId,
          checkedAt: Date.now(),
          kind,
          lrclibId: Number.isFinite(Number(match?.id)) ? Number(match.id) : undefined,
          matchedTrackName: match?.trackName ? String(match.trackName) : undefined,
          matchedArtistName: match?.artistName ? String(match.artistName) : undefined,
          matchedAlbumName: match?.albumName ? String(match.albumName) : undefined,
          matchedDuration: Number.isFinite(Number(match?.duration))
            ? Number(match.duration)
            : undefined,
        };

        saveKaraokeLyricsAudit();
        karaokeLyricsRuntimeCache.delete(song.videoId);

        if (kind === "synced") {
          console.log(
            `🎤 LRCLIB AUTO : ajouté au catalogue Karaoké → ${song.artistName} — ${song.title}`
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, AUTOMATIC_LRCLIB_DELAY_MS)
        );
      } catch (error: any) {
        if (
          Number(error?.status || 0) === 429 ||
          error?.message === "LRCLIB_RATE_LIMIT"
        ) {
          const retryAfterMs = Math.max(
            AUTOMATIC_LRCLIB_RETRY_AFTER_MS,
            Number(error?.retryAfter || 0) * 1000
          );

          if (!automaticLrclibQueuedIds.has(song.videoId)) {
            automaticLrclibQueuedIds.add(song.videoId);
            automaticLrclibQueue.unshift(job);
          }

          console.warn(
            `🎤 LRCLIB AUTO : limite atteinte, nouvelle tentative dans ${Math.ceil(
              retryAfterMs / 1000
            )}s.`
          );

          await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
          continue;
        }

        // Une erreur réseau/serveur n'est pas mémorisée comme "introuvable".
        console.warn(
          `🎤 LRCLIB AUTO : vérification impossible pour ${song.artistName} — ${song.title}`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } finally {
    automaticLrclibWorkerRunning = false;
    if (automaticLrclibQueue.length > 0) {
      void runAutomaticLrclibWorker();
    }
  }
}

app.get("/partybrain/karaoke-lrclib-auto/status", (_req, res) => {
  return res.json({
    running: automaticLrclibWorkerRunning,
    queued: automaticLrclibQueue.length,
    delayMs: AUTOMATIC_LRCLIB_DELAY_MS,
  });
});


type KaraokeLyricsAuditJob = {
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

let karaokeLyricsAuditJob: KaraokeLyricsAuditJob = {
  running: false,
  requested: 0,
  selected: 0,
  searched: 0,
  synced: 0,
  plain: 0,
  instrumental: 0,
  notFound: 0,
  errors: 0,
  rateLimited: false,
  retryAfterSeconds: 0,
  startedAt: 0,
  finishedAt: 0,
  message: "",
};

async function runKaraokeLyricsAuditBatch(limit: number) {
  const localResolution = karaokeLocalResolution();

  const candidates = Object.values(musicBrain.songs)
    .filter(karaokeLyricsArtistReliable)
    .filter((song) => {
      const existing = karaokeLyricsAudit.entries[song.videoId];
      if (!existing) return true;
      return (
        existing.kind === "synced" &&
        !karaokeLyricsAuditEntryIsStrictlyVerified(song, existing)
      );
    })
    .sort((a, b) => {
      const resolutionA = localResolution.resolutionByVideoId.get(a.videoId);
      const resolutionB = localResolution.resolutionByVideoId.get(b.videoId);

      const audioPriority = (resolution: any) =>
        resolution?.kind === "direct_topic" ||
        resolution?.kind === "direct_official_audio" ||
        resolution?.kind === "alternative_topic" ||
        resolution?.kind === "alternative_official_audio"
          ? 1
          : 0;

      const priorityA = audioPriority(resolutionA);
      const priorityB = audioPriority(resolutionB);
      if (priorityA !== priorityB) return priorityB - priorityA;

      const activity = (song: MusicBrainSong) =>
        Number(song.playedCount || 0) * 6 +
        Number(song.addedCount || 0) * 5 +
        Number(song.voteCount || 0) * 4 +
        Number(song.searchCount || 0) * 2;

      return activity(b) - activity(a);
    })
    .slice(0, limit);

  karaokeLyricsAuditJob = {
    running: true,
    requested: limit,
    selected: candidates.length,
    searched: 0,
    synced: 0,
    plain: 0,
    instrumental: 0,
    notFound: 0,
    errors: 0,
    rateLimited: false,
    retryAfterSeconds: 0,
    startedAt: Date.now(),
    finishedAt: 0,
    message: `Audit LRCLIB en cours : 0 / ${candidates.length}`,
  };

  try {
    for (const song of candidates) {
      try {
        const match = await requestLrclibForSong(song);

        let kind: KaraokeLyricsAuditKind = "not_found";
        if (match?.instrumental) kind = "instrumental";
        else if (String(match?.syncedLyrics || "").trim()) kind = "synced";
        else if (String(match?.plainLyrics || "").trim()) kind = "plain";

        karaokeLyricsAudit.entries[song.videoId] = {
          videoId: song.videoId,
          checkedAt: Date.now(),
          kind,
          lrclibId: Number.isFinite(Number(match?.id)) ? Number(match.id) : undefined,
          matchedTrackName: match?.trackName ? String(match.trackName) : undefined,
          matchedArtistName: match?.artistName ? String(match.artistName) : undefined,
          matchedAlbumName: match?.albumName ? String(match.albumName) : undefined,
          matchedDuration: Number.isFinite(Number(match?.duration))
            ? Number(match.duration)
            : undefined,
        };

        karaokeLyricsAuditJob.searched += 1;
        if (kind === "synced") karaokeLyricsAuditJob.synced += 1;
        else if (kind === "plain") karaokeLyricsAuditJob.plain += 1;
        else if (kind === "instrumental") karaokeLyricsAuditJob.instrumental += 1;
        else karaokeLyricsAuditJob.notFound += 1;

        karaokeLyricsAuditJob.message =
          `Audit LRCLIB en cours : ${karaokeLyricsAuditJob.searched} / ${candidates.length}`;

        saveKaraokeLyricsAudit();
        karaokeLyricsRuntimeCache.delete(song.videoId);
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error: any) {
        karaokeLyricsAuditJob.errors += 1;

        if (Number(error?.status || 0) === 429 || error?.message === "LRCLIB_RATE_LIMIT") {
          karaokeLyricsAuditJob.rateLimited = true;
          karaokeLyricsAuditJob.retryAfterSeconds = Math.max(
            1,
            Number(error?.retryAfter || 5)
          );
          karaokeLyricsAuditJob.message =
            `LRCLIB demande une pause de ${karaokeLyricsAuditJob.retryAfterSeconds}s.`;
          break;
        }

        console.warn(
          `Audit LRCLIB impossible pour ${song.artistName} — ${song.title}`,
          error
        );

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    karaokeLyricsAuditJob.running = false;
    karaokeLyricsAuditJob.finishedAt = Date.now();

    if (!karaokeLyricsAuditJob.rateLimited) {
      karaokeLyricsAuditJob.message =
        `Audit terminé : ${karaokeLyricsAuditJob.searched} morceau(x) testé(s), ` +
        `${karaokeLyricsAuditJob.synced} synchronisé(s).`;
    }
  }
}

/* =========================================================
   KARAOKÉ AUDIT V2 — PLANIFICATEUR LRCLIB AUTONOME
   - LRCLIB uniquement : aucun appel YouTube
   - 100 morceaux maximum par vague
   - une tentative toutes les 60 secondes
   - aucun chevauchement avec un autre audit / worker LRCLIB
   ========================================================= */

const karaokeLyricsAuditSchedulerEnabled =
  karaokeFeatureEnabled &&
  String(process.env.KARAOKE_LRCLIB_SCHEDULER_ENABLED || "true").toLowerCase() !== "false";

const karaokeLyricsAuditSchedulerIntervalMs = Math.max(
  60_000,
  Number(process.env.KARAOKE_LRCLIB_SCHEDULER_INTERVAL_MS || 60_000)
);

const karaokeLyricsAuditSchedulerBatchSize = Math.max(
  1,
  Math.min(100, Number(process.env.KARAOKE_LRCLIB_SCHEDULER_BATCH_SIZE || 100))
);

let karaokeLyricsAuditSchedulerLastCheckAt = 0;
let karaokeLyricsAuditSchedulerLastStartedAt = 0;
let karaokeLyricsAuditSchedulerLastSkipReason = "";

function karaokeLyricsAuditPendingCount() {
  return Object.values(musicBrain.songs)
    .filter(karaokeLyricsArtistReliable)
    .filter((song) => {
      const existing = karaokeLyricsAudit.entries[song.videoId];
      if (!existing) return true;
      return (
        existing.kind === "synced" &&
        !karaokeLyricsAuditEntryIsStrictlyVerified(song, existing)
      );
    })
    .length;
}

function karaokeLyricsAuditSchedulerSnapshot() {
  return {
    enabled: karaokeLyricsAuditSchedulerEnabled,
    intervalMs: karaokeLyricsAuditSchedulerIntervalMs,
    batchSize: karaokeLyricsAuditSchedulerBatchSize,
    pending: karaokeLyricsAuditPendingCount(),
    lastCheckAt: karaokeLyricsAuditSchedulerLastCheckAt,
    lastStartedAt: karaokeLyricsAuditSchedulerLastStartedAt,
    lastSkipReason: karaokeLyricsAuditSchedulerLastSkipReason,
  };
}

async function runScheduledKaraokeLyricsAudit() {
  karaokeLyricsAuditSchedulerLastCheckAt = Date.now();

  if (!karaokeLyricsAuditSchedulerEnabled) {
    karaokeLyricsAuditSchedulerLastSkipReason = "Planificateur désactivé.";
    return;
  }

  // Ne jamais superposer deux lots LRCLIB.
  if (karaokeLyricsAuditJob.running) {
    karaokeLyricsAuditSchedulerLastSkipReason = "Audit LRCLIB déjà en cours.";
    return;
  }

  // Le petit worker automatique utilisé lors des recherches/ajouts passe d'abord.
  // Cela évite de bombarder LRCLIB avec deux flux en parallèle.
  if (automaticLrclibWorkerRunning || automaticLrclibQueue.length > 0) {
    karaokeLyricsAuditSchedulerLastSkipReason = "Worker LRCLIB temps réel occupé.";
    return;
  }

  // Respecte aussi un éventuel Retry-After renvoyé par LRCLIB lors de la vague précédente.
  const retryAfterMs = Math.max(
    0,
    Number(karaokeLyricsAuditJob.retryAfterSeconds || 0) * 1000
  );
  const retryUntil =
    karaokeLyricsAuditJob.rateLimited && karaokeLyricsAuditJob.finishedAt
      ? karaokeLyricsAuditJob.finishedAt + retryAfterMs
      : 0;

  if (retryUntil > Date.now()) {
    karaokeLyricsAuditSchedulerLastSkipReason =
      `Pause LRCLIB jusqu'à ${new Date(retryUntil).toISOString()}.`;
    return;
  }

  const pending = karaokeLyricsAuditPendingCount();
  if (pending <= 0) {
    karaokeLyricsAuditSchedulerLastSkipReason = "Aucun nouveau morceau à vérifier.";
    return;
  }

  const batchSize = Math.min(karaokeLyricsAuditSchedulerBatchSize, pending);

  karaokeLyricsAuditSchedulerLastStartedAt = Date.now();
  karaokeLyricsAuditSchedulerLastSkipReason = "";

  console.log(
    `🎤 KARAOKÉ AUDIT V2 AUTO : lancement d'une vague LRCLIB de ${batchSize} morceau(x) ` +
    `(${pending} en attente).`
  );

  try {
    await runKaraokeLyricsAuditBatch(batchSize);
  } catch (error) {
    console.error("🎤 KARAOKÉ AUDIT V2 AUTO : vague LRCLIB interrompue", error);
  }
}

if (karaokeLyricsAuditSchedulerEnabled) {
  // Petit délai au démarrage de Railway pour laisser MusicBrain et les fichiers persistants se charger.
  setTimeout(() => {
    void runScheduledKaraokeLyricsAudit();
  }, 15_000);

  setInterval(() => {
    void runScheduledKaraokeLyricsAudit();
  }, karaokeLyricsAuditSchedulerIntervalMs);
}




/* =========================================================
   KARAOKÉ SYNC ENGINE V1 — SHADOW MODE
   ---------------------------------------------------------
   Objectif :
   - ne casse PAS le Karaoké LRCLIB actuel ;
   - prépare une file de morceaux à réaligner ;
   - délègue l'alignement audio à un worker externe spécialisé ;
   - mémorise les résultats certifiés, sans les publier automatiquement.

   Le worker externe est optionnel au départ.
   Variable Railway :
     KARAOKE_SYNC_ENGINE_URL=https://.../align

   Contrat JSON attendu du worker :
   {
     "status": "certified" | "needs_review" | "failed",
     "confidence": 0..100,
     "offsetSeconds": number,
     "lines": [{"time": 12.34, "text": "..."}],
     "engine": "nom/version",
     "reason": "...",
     "diagnostics": {...}
   }
   ========================================================= */

type KaraokeSyncEngineEntryStatus =
  | "pending"
  | "analyzing"
  | "needs_review"
  | "certified"
  | "failed"
  | "blocked";

type KaraokeSyncEngineEntry = {
  videoId: string;
  status: KaraokeSyncEngineEntryStatus;
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  updatedAt: number;

  source: {
    title: string;
    artistName: string;
    durationSeconds?: number;
    lrclibId?: number;
    lrclibTrackName?: string;
    lrclibArtistName?: string;
    lrclibDuration?: number;
  };

  engine?: string;
  confidence?: number;
  offsetSeconds?: number;
  alignedLines?: KaraokeTimedLine[];
  reason?: string;
  diagnostics?: Record<string, unknown>;
  attempts: number;
};

type KaraokeSyncEngineState = {
  version: 1;
  mode: "shadow";
  createdAt: number;
  updatedAt: number;
  entries: Record<string, KaraokeSyncEngineEntry>;
};

function createEmptyKaraokeSyncEngineState(): KaraokeSyncEngineState {
  const now = Date.now();
  return {
    version: 1,
    mode: "shadow",
    createdAt: now,
    updatedAt: now,
    entries: {},
  };
}

let karaokeSyncEngineState: KaraokeSyncEngineState =
  createEmptyKaraokeSyncEngineState();

function saveKaraokeSyncEngineState() {
  karaokeSyncEngineState.updatedAt = Date.now();

  try {
    fs.writeFileSync(
      karaokeSyncEngineFilePath,
      JSON.stringify(karaokeSyncEngineState, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.warn("Karaoke Sync Engine non sauvegardé :", error);
  }
}

function loadKaraokeSyncEngineState() {
  if (!fs.existsSync(karaokeSyncEngineFilePath)) {
    saveKaraokeSyncEngineState();
    return;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(karaokeSyncEngineFilePath, "utf-8")
    );

    karaokeSyncEngineState = {
      ...createEmptyKaraokeSyncEngineState(),
      ...parsed,
      version: 1,
      mode: "shadow",
      entries:
        parsed?.entries && typeof parsed.entries === "object"
          ? parsed.entries
          : {},
    };

    // Un crash Railway pendant une analyse ne doit pas laisser un morceau
    // bloqué éternellement en "analyzing".
    for (const entry of Object.values(karaokeSyncEngineState.entries)) {
      if (entry.status === "analyzing") {
        entry.status = "pending";
        entry.reason = "Analyse interrompue par un redémarrage du serveur.";
        entry.updatedAt = Date.now();
      }
    }

    saveKaraokeSyncEngineState();
  } catch (error) {
    console.warn(
      "Karaoke Sync Engine illisible, nouvelle base créée :",
      error
    );
    karaokeSyncEngineState = createEmptyKaraokeSyncEngineState();
    saveKaraokeSyncEngineState();
  }
}

loadKaraokeSyncEngineState();

const karaokeSyncEngineQueue: string[] = [];
const karaokeSyncEngineQueuedIds = new Set<string>();
let karaokeSyncEngineWorkerRunning = false;

// V1.2 TEST AUDIO
// URL audio autorisée fournie manuellement pour UN test.
// Elle reste uniquement en mémoire et n'est jamais écrite dans
// karaoke-sync-engine.json.
const karaokeSyncEngineAudioUrlOverrides = new Map<string, string>();

const KARAOKE_SYNC_ENGINE_MIN_CONFIDENCE = Math.max(
  0,
  Math.min(
    100,
    Number(process.env.KARAOKE_SYNC_ENGINE_MIN_CONFIDENCE || 92)
  )
);

const KARAOKE_SYNC_ENGINE_MAX_ABS_OFFSET_SECONDS = Math.max(
  0.25,
  Number(process.env.KARAOKE_SYNC_ENGINE_MAX_ABS_OFFSET_SECONDS || 4)
);

const KARAOKE_SYNC_ENGINE_DEFAULT_URL =
  "https://karaoke-sync-worker-production.up.railway.app/align";

function karaokeSyncEngineUrl() {
  const configured = String(
    process.env.KARAOKE_SYNC_ENGINE_URL ||
    process.env.NEXT_PUBLIC_KARAOKE_SYNC_ENGINE_URL ||
    ""
  ).trim();

  // Railway doit normalement fournir KARAOKE_SYNC_ENGINE_URL.
  // Le fallback garde le worker fonctionnel même si cette variable
  // n'est pas injectée dans le runtime API du service monorepo.
  const raw = configured || KARAOKE_SYNC_ENGINE_DEFAULT_URL;

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";

    // Accepte soit la racine du worker, soit /align.
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/") {
      parsed.pathname = "/align";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function karaokeSyncEngineEnabled() {
  return karaokeFeatureEnabled && Boolean(karaokeSyncEngineUrl());
}

function karaokeSyncEngineAuthorizedAudioUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";

    // On refuse localhost / loopback pour éviter qu'un endpoint admin
    // devienne une porte SSRF vers le service Railway lui-même.
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function karaokeSyncEngineSanitizeLines(raw: unknown): KaraokeTimedLine[] {
  if (!Array.isArray(raw)) return [];

  const lines = raw
    .map((item: any) => ({
      time: Number(item?.time),
      text: String(item?.text || "").trim(),
    }))
    .filter(
      (line) =>
        Number.isFinite(line.time) &&
        line.time >= 0 &&
        Boolean(line.text)
    )
    .sort((a, b) => a.time - b.time);

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].time <= lines[index - 1].time) {
      return [];
    }
  }

  return lines;
}

function karaokeSyncEngineCandidate(videoId: string) {
  const song = musicBrain.songs[videoId];
  const audit = karaokeLyricsAudit.entries[videoId];

  if (!song || !audit) return null;
  if (
    audit.kind !== "synced" ||
    !audit.lrclibId ||
    !karaokeLyricsAuditEntryIsStrictlyVerified(song, audit)
  ) {
    return null;
  }

  return { song, audit };
}

function karaokeSyncEngineQueueSong(videoId: string) {
  if (!karaokeFeatureEnabled) return false;

  const cleanVideoId = String(videoId || "").trim();
  if (!cleanVideoId) return false;

  const candidate = karaokeSyncEngineCandidate(cleanVideoId);
  if (!candidate) return false;

  const existing = karaokeSyncEngineState.entries[cleanVideoId];

  if (
    existing?.status === "certified" ||
    existing?.status === "analyzing" ||
    karaokeSyncEngineQueuedIds.has(cleanVideoId)
  ) {
    return false;
  }

  const now = Date.now();

  karaokeSyncEngineState.entries[cleanVideoId] = {
    videoId: cleanVideoId,
    status: "pending",
    queuedAt: existing?.queuedAt || now,
    updatedAt: now,
    source: {
      title: candidate.song.title || candidate.song.rawTitle || "",
      artistName: candidate.song.artistName || "",
      durationSeconds: candidate.song.durationSeconds,
      lrclibId: candidate.audit.lrclibId,
      lrclibTrackName: candidate.audit.matchedTrackName,
      lrclibArtistName: candidate.audit.matchedArtistName,
      lrclibDuration: candidate.audit.matchedDuration,
    },
    attempts: Number(existing?.attempts || 0),
  };

  karaokeSyncEngineQueuedIds.add(cleanVideoId);
  karaokeSyncEngineQueue.push(cleanVideoId);
  saveKaraokeSyncEngineState();

  void runKaraokeSyncEngineWorker();
  return true;
}

async function requestKaraokeSyncAlignment(
  song: MusicBrainSong,
  audit: KaraokeLyricsAuditEntry,
  audioUrl?: string
) {
  const endpoint = karaokeSyncEngineUrl();

  if (!endpoint) {
    const error: any = new Error("KARAOKE_SYNC_ENGINE_NOT_CONFIGURED");
    error.code = "KARAOKE_SYNC_ENGINE_NOT_CONFIGURED";
    throw error;
  }

  const record = await fetchLrclibLyricsById(Number(audit.lrclibId));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.KARAOKE_SYNC_ENGINE_TOKEN
          ? {
              Authorization: `Bearer ${process.env.KARAOKE_SYNC_ENGINE_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify({
        version: 1,
        videoId: song.videoId,
        title: song.title,
        rawTitle: song.rawTitle,
        artistName: song.artistName,
        durationSeconds: song.durationSeconds,
        youtube: {
          videoId: song.videoId,
          channelTitle: song.channelTitle,
          metadataSource: song.metadataSource,
        },
        lyrics: {
          lrclibId: audit.lrclibId,
          trackName: record?.trackName || audit.matchedTrackName,
          artistName: record?.artistName || audit.matchedArtistName,
          duration: Number(
            record?.duration || audit.matchedDuration || 0
          ) || undefined,
          syncedLyrics: String(record?.syncedLyrics || ""),
          plainLyrics: String(record?.plainLyrics || ""),
        },

        // V1.2 : seulement une URL audio que l'administrateur MixParty
        // est autorisé à faire analyser.
        audioUrl: audioUrl || undefined,
      }),
      signal: controller.signal,
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error: any = new Error(
        data?.error ||
          data?.message ||
          `Karaoke Sync Engine HTTP ${response.status}`
      );
      error.status = response.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}


async function requestKaraokeSyncAlignmentUpload(
  song: MusicBrainSong,
  audit: KaraokeLyricsAuditEntry,
  audioBuffer: Buffer,
  fileName: string,
  mimeType: string
) {
  const endpoint = karaokeSyncEngineUrl();
  if (!endpoint) {
    throw new Error(
      "KARAOKE_SYNC_ENGINE_NOT_CONFIGURED: aucune URL worker valide n'a pu être résolue."
    );
  }

  const record = await fetchLrclibLyricsById(Number(audit.lrclibId));

  const payload = {
    version: 1,
    videoId: song.videoId,
    title: song.title,
    rawTitle: song.rawTitle,
    artistName: song.artistName,
    durationSeconds: song.durationSeconds,
    youtube: {
      videoId: song.videoId,
      channelTitle: song.channelTitle,
      metadataSource: song.metadataSource,
    },
    lyrics: {
      lrclibId: audit.lrclibId,
      trackName: record?.trackName || audit.matchedTrackName,
      artistName: record?.artistName || audit.matchedArtistName,
      duration: Number(record?.duration || audit.matchedDuration || 0) || undefined,
      syncedLyrics: String(record?.syncedLyrics || ""),
      plainLyrics: String(record?.plainLyrics || ""),
    },
  };

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append(
    "audio",
    new Blob([audioBuffer], { type: mimeType || "application/octet-stream" }),
    fileName || "source.audio"
  );

  const base = endpoint.endsWith("/align")
    ? endpoint.slice(0, -6)
    : endpoint.replace(/\/+$/, "");
  const uploadEndpoint = `${base}/align-upload`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const response = await fetch(uploadEndpoint, {
      method: "POST",
      headers: process.env.KARAOKE_SYNC_ENGINE_TOKEN
        ? { Authorization: `Bearer ${process.env.KARAOKE_SYNC_ENGINE_TOKEN}` }
        : {},
      body: form,
      signal: controller.signal,
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data?.detail || data?.error || data?.message ||
        `Karaoke Sync Worker HTTP ${response.status}`
      );
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function applyKaraokeSyncEngineResult(entry: KaraokeSyncEngineEntry, result: any) {
  const resultStatus = String(result?.status || "").toLowerCase();
  const confidence = Math.max(0, Math.min(100, Number(result?.confidence || 0)));
  const offsetSeconds = Number(result?.offsetSeconds || 0);
  const alignedLines = karaokeSyncEngineSanitizeLines(result?.lines);

  entry.engine = String(result?.engine || "external-aligner");
  entry.confidence = confidence;
  entry.offsetSeconds = Number.isFinite(offsetSeconds)
    ? Math.round(offsetSeconds * 1000) / 1000
    : undefined;
  entry.diagnostics =
    result?.diagnostics && typeof result.diagnostics === "object"
      ? result.diagnostics
      : undefined;

  const offsetSafe =
    Number.isFinite(offsetSeconds) &&
    Math.abs(offsetSeconds) <= KARAOKE_SYNC_ENGINE_MAX_ABS_OFFSET_SECONDS;

  if (
    resultStatus === "certified" &&
    confidence >= KARAOKE_SYNC_ENGINE_MIN_CONFIDENCE &&
    offsetSafe &&
    alignedLines.length >= KARAOKE_STRICT_MIN_TIMED_LINES
  ) {
    entry.status = "certified";
    entry.alignedLines = alignedLines;
  } else if (resultStatus === "needs_review" || resultStatus === "certified") {
    entry.status = "needs_review";
    entry.alignedLines = alignedLines.length ? alignedLines : undefined;
  } else {
    entry.status = "failed";
    entry.alignedLines = alignedLines.length ? alignedLines : undefined;
  }

  entry.reason = String(result?.reason || "").trim() || entry.reason;
}

async function runKaraokeSyncEngineWorker() {
  if (!karaokeFeatureEnabled) {
    karaokeSyncEngineQueue.length = 0;
    karaokeSyncEngineQueuedIds.clear();
    karaokeSyncEngineAudioUrlOverrides.clear();
    karaokeSyncEngineWorkerRunning = false;
    return;
  }
  if (karaokeSyncEngineWorkerRunning) return;
  karaokeSyncEngineWorkerRunning = true;

  try {
    while (karaokeSyncEngineQueue.length > 0) {
      const videoId = karaokeSyncEngineQueue.shift();
      if (!videoId) continue;

      karaokeSyncEngineQueuedIds.delete(videoId);

      const candidate = karaokeSyncEngineCandidate(videoId);
      const entry = karaokeSyncEngineState.entries[videoId];

      if (!candidate || !entry) continue;

      if (!karaokeSyncEngineEnabled()) {
        entry.status = "blocked";
        entry.reason =
          "Worker d’alignement non configuré : KARAOKE_SYNC_ENGINE_URL manquant.";
        entry.updatedAt = Date.now();
        saveKaraokeSyncEngineState();
        continue;
      }

      entry.status = "analyzing";
      entry.startedAt = Date.now();
      entry.updatedAt = Date.now();
      entry.attempts = Number(entry.attempts || 0) + 1;
      entry.reason = undefined;
      saveKaraokeSyncEngineState();

      try {
        const authorizedAudioUrl =
          karaokeSyncEngineAudioUrlOverrides.get(videoId);

        const result: any = await requestKaraokeSyncAlignment(
          candidate.song,
          candidate.audit,
          authorizedAudioUrl
        );

        const resultStatus = String(result?.status || "").toLowerCase();
        const confidence = Math.max(
          0,
          Math.min(100, Number(result?.confidence || 0))
        );
        const offsetSeconds = Number(result?.offsetSeconds || 0);
        const alignedLines = karaokeSyncEngineSanitizeLines(result?.lines);

        entry.engine = String(result?.engine || "external-aligner");
        entry.confidence = confidence;
        entry.offsetSeconds = Number.isFinite(offsetSeconds)
          ? Math.round(offsetSeconds * 1000) / 1000
          : undefined;
        entry.diagnostics =
          result?.diagnostics && typeof result.diagnostics === "object"
            ? result.diagnostics
            : undefined;

        const offsetSafe =
          Number.isFinite(offsetSeconds) &&
          Math.abs(offsetSeconds) <=
            KARAOKE_SYNC_ENGINE_MAX_ABS_OFFSET_SECONDS;

        const workerClaimsCertified = resultStatus === "certified";

        if (
          workerClaimsCertified &&
          confidence >= KARAOKE_SYNC_ENGINE_MIN_CONFIDENCE &&
          offsetSafe &&
          alignedLines.length >= KARAOKE_STRICT_MIN_TIMED_LINES
        ) {
          entry.status = "certified";
          entry.alignedLines = alignedLines;
          entry.reason =
            String(result?.reason || "").trim() ||
            "Alignement audio certifié en shadow mode.";
        } else if (
          resultStatus === "needs_review" ||
          workerClaimsCertified
        ) {
          entry.status = "needs_review";
          entry.alignedLines = alignedLines.length
            ? alignedLines
            : undefined;
          entry.reason =
            String(result?.reason || "").trim() ||
            `Résultat non certifié automatiquement (confiance ${confidence}%).`;
        } else {
          entry.status = "failed";
          entry.alignedLines = undefined;
          entry.reason =
            String(result?.reason || "").trim() ||
            "Le moteur d’alignement n’a pas pu certifier ce morceau.";
        }
      } catch (error: any) {
        entry.status =
          error?.code === "KARAOKE_SYNC_ENGINE_NOT_CONFIGURED"
            ? "blocked"
            : "failed";
        entry.reason =
          error?.message || "Erreur inconnue du moteur d’alignement.";
      } finally {
        // L'URL audio de test n'est conservée ni sur disque ni après l'analyse.
        karaokeSyncEngineAudioUrlOverrides.delete(videoId);

        entry.finishedAt = Date.now();
        entry.updatedAt = Date.now();
        saveKaraokeSyncEngineState();

        // V1 Shadow : surtout ne pas toucher au cache/runtime Karaoké actuel.
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  } finally {
    karaokeSyncEngineWorkerRunning = false;

    if (karaokeSyncEngineQueue.length > 0) {
      void runKaraokeSyncEngineWorker();
    }
  }
}

function karaokeSyncEngineSummary() {
  const entries = Object.values(karaokeSyncEngineState.entries);

  const count = (status: KaraokeSyncEngineEntryStatus) =>
    entries.filter((entry) => entry.status === status).length;

  const eligible = Object.values(karaokeLyricsAudit.entries).filter(
    (audit) =>
      audit.kind === "synced" &&
      karaokeLyricsAuditEntryIsStrictlyVerified(
        musicBrain.songs[audit.videoId],
        audit
      )
  ).length;

  return {
    version: 1,
    mode: "shadow",
    enabled: karaokeSyncEngineEnabled(),
    engineUrlConfigured: karaokeSyncEngineEnabled(),
    workerRunning: karaokeSyncEngineWorkerRunning,
    queued: karaokeSyncEngineQueue.length,
    temporaryAuthorizedAudioUrls:
      karaokeSyncEngineAudioUrlOverrides.size,
    thresholds: {
      minimumConfidence: KARAOKE_SYNC_ENGINE_MIN_CONFIDENCE,
      maximumAbsoluteOffsetSeconds:
        KARAOKE_SYNC_ENGINE_MAX_ABS_OFFSET_SECONDS,
    },
    eligibleFromCurrentCatalog: eligible,
    analyzed: entries.length,
    pending: count("pending"),
    analyzing: count("analyzing"),
    needsReview: count("needs_review"),
    certified: count("certified"),
    failed: count("failed"),
    blocked: count("blocked"),
    note:
      "Shadow mode : les résultats du nouveau moteur sont enregistrés séparément et ne remplacent pas encore les paroles LRCLIB servies par MixParty.",
  };
}


type KaraokeBenchmarkTrackResult = {
  jamendoId: string;
  title: string;
  artistName: string;
  durationSeconds: number;
  image?: string;
  language?: string;
  licenseUrl?: string;
  status: "pending" | "analyzing" | "passed" | "failed" | "error";
  benchmarkScore?: number;
  coverage?: number;
  similarity?: number;
  timingContinuity?: number;
  wordProbability?: number;
  reason?: string;
};

type KaraokeBenchmarkCampaign = {
  id: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: "preparing" | "running" | "finished" | "failed";
  requested: number;
  total: number;
  completed: number;
  passed: number;
  failed: number;
  errors: number;
  currentTrack?: string;
  error?: string;
  tracks: KaraokeBenchmarkTrackResult[];
};

const karaokeBenchmarkCampaigns = new Map<string, KaraokeBenchmarkCampaign>();

function jamendoClientId() {
  return String(process.env.JAMENDO_CLIENT_ID || "").trim();
}

function karaokeBenchmarkWorkerUrl() {
  const alignUrl = karaokeSyncEngineUrl();
  if (!alignUrl) return "";
  return alignUrl.endsWith("/align")
    ? `${alignUrl.slice(0, -"/align".length)}/benchmark-upload`
    : `${alignUrl.replace(/\/+$/, "")}/benchmark-upload`;
}

function benchmarkPlainLyrics(value: unknown) {
  const raw = String(value || "").replace(/\r/g, "").trim();
  if (!raw) return "";
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length >= 5 ? lines.join("\n") : "";
}

async function fetchJamendoBenchmarkTracks(limit: number) {
  const clientId = jamendoClientId();
  if (!clientId) throw new Error("JAMENDO_CLIENT_ID_NOT_CONFIGURED");

  const wanted = Math.max(1, Math.min(50, Math.floor(limit || 50)));
  const selected: any[] = [];
  const seenArtists = new Set<string>();

  for (let offset = 0; offset < 1000 && selected.length < wanted; offset += 200) {
    const url = new URL("https://api.jamendo.com/v3.0/tracks/");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "200");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("include", "lyrics musicinfo licenses");
    url.searchParams.set("audioformat", "mp32");
    url.searchParams.set("audiodlformat", "mp32");
    url.searchParams.set("vocalinstrumental", "vocal");
    url.searchParams.set("durationbetween", "90_420");
    url.searchParams.set("order", "popularity_total");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error(`JAMENDO_HTTP_${response.status}`);

    const payload: any = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];

    for (const track of results) {
      if (selected.length >= wanted) break;

      const artistId = String(track?.artist_id || track?.artist_name || "");
      if (!artistId || seenArtists.has(artistId)) continue;

      const lyrics = benchmarkPlainLyrics(track?.lyrics);
      if (!lyrics) continue;

      if (track?.audiodownload_allowed !== true) continue;
      const audioUrl = String(track?.audiodownload || "").trim();
      if (!audioUrl.startsWith("http")) continue;

      seenArtists.add(artistId);
      selected.push({
        id: String(track?.id || ""),
        title: String(track?.name || "Sans titre"),
        artistName: String(track?.artist_name || "Artiste inconnu"),
        durationSeconds: Number(track?.duration || 0),
        image: String(track?.image || track?.album_image || ""),
        audioUrl,
        lyrics,
        language: String(track?.musicinfo?.lang || ""),
        licenseUrl: String(track?.license_ccurl || ""),
      });
    }

    if (!results.length) break;
  }

  return selected;
}

async function downloadBenchmarkAudio(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "MixParty-Karaoke-Benchmark/1.0" },
    });

    if (!response.ok) throw new Error(`AUDIO_HTTP_${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 45 * 1024 * 1024) {
      throw new Error("AUDIO_TOO_LARGE");
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get("content-type") || "audio/mpeg",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runJamendoBenchmarkCampaign(campaignId: string) {
  const campaign = karaokeBenchmarkCampaigns.get(campaignId);
  if (!campaign) return;

  try {
    campaign.status = "preparing";
    const tracks = await fetchJamendoBenchmarkTracks(campaign.requested);

    campaign.total = tracks.length;
    campaign.tracks = tracks.map((track) => ({
      jamendoId: track.id,
      title: track.title,
      artistName: track.artistName,
      durationSeconds: track.durationSeconds,
      image: track.image,
      language: track.language,
      licenseUrl: track.licenseUrl,
      status: "pending",
    }));

    if (!tracks.length) {
      throw new Error(
        "Aucune piste Jamendo avec audio téléchargeable + paroles n'a été trouvée."
      );
    }

    campaign.status = "running";
    campaign.startedAt = Date.now();

    const workerUrl = karaokeBenchmarkWorkerUrl();
    if (!workerUrl) throw new Error("KARAOKE_SYNC_ENGINE_NOT_CONFIGURED");

    for (let index = 0; index < tracks.length; index += 1) {
      const source = tracks[index];
      const resultEntry = campaign.tracks[index];

      resultEntry.status = "analyzing";
      campaign.currentTrack = `${source.artistName} — ${source.title}`;

      try {
        const audio = await downloadBenchmarkAudio(source.audioUrl);

        const form = new FormData();
        form.append(
          "payload",
          JSON.stringify({
            id: source.id,
            title: source.title,
            artistName: source.artistName,
            durationSeconds: source.durationSeconds,
            lyrics: { plainLyrics: source.lyrics },
          })
        );
        form.append(
          "audio",
          new Blob([audio.buffer], { type: audio.contentType }),
          `jamendo-${source.id}.mp3`
        );

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 240_000);

        try {
          const workerResponse = await fetch(workerUrl, {
            method: "POST",
            headers: process.env.KARAOKE_SYNC_ENGINE_TOKEN
              ? {
                  Authorization:
                    `Bearer ${process.env.KARAOKE_SYNC_ENGINE_TOKEN}`,
                }
              : {},
            body: form,
            signal: controller.signal,
          });

          const workerData: any = await workerResponse.json().catch(() => ({}));

          if (!workerResponse.ok) {
            throw new Error(
              workerData?.detail ||
              workerData?.error ||
              `WORKER_HTTP_${workerResponse.status}`
            );
          }

          const score = Number(workerData?.benchmarkScore || 0);
          const diag = workerData?.diagnostics || {};

          resultEntry.benchmarkScore = score;
          resultEntry.coverage = Number(diag?.coverage || 0);
          resultEntry.similarity = Number(diag?.averageSimilarity || 0);
          resultEntry.timingContinuity = Number(diag?.timingContinuity || 0);
          resultEntry.wordProbability = Number(
            diag?.averageWordProbability || 0
          );
          resultEntry.status =
            workerData?.benchmarkPass === true ? "passed" : "failed";

          if (resultEntry.status === "passed") campaign.passed += 1;
          else campaign.failed += 1;
        } finally {
          clearTimeout(timeout);
        }
      } catch (error: any) {
        resultEntry.status = "error";
        resultEntry.reason =
          error?.message || "Erreur inconnue pendant le benchmark.";
        campaign.errors += 1;
      }

      campaign.completed += 1;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    campaign.currentTrack = undefined;
    campaign.finishedAt = Date.now();
    campaign.status = "finished";
  } catch (error: any) {
    campaign.status = "failed";
    campaign.error = error?.message || "Benchmark impossible.";
    campaign.finishedAt = Date.now();
    campaign.currentTrack = undefined;
  }
}

app.get("/partybrain/karaoke-benchmark/config", (_req, res) => {
  return res.json({
    jamendoConfigured: Boolean(jamendoClientId()),
    workerConfigured: Boolean(karaokeBenchmarkWorkerUrl()),
    maxTracks: 50,
    mode: "technical-benchmark",
    note:
      "Jamendo fournit l'audio et les paroles, mais pas des timestamps karaoké de référence.",
  });
});

app.post("/partybrain/karaoke-benchmark/start", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  if (!jamendoClientId()) {
    return res.status(503).json({
      error: "JAMENDO_CLIENT_ID n'est pas configuré sur l'API MixParty.",
    });
  }

  const requested = Math.max(1, Math.min(50, Number(req.body?.limit || 50)));
  const id = `bench-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const campaign: KaraokeBenchmarkCampaign = {
    id,
    createdAt: Date.now(),
    status: "preparing",
    requested,
    total: 0,
    completed: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    tracks: [],
  };

  karaokeBenchmarkCampaigns.set(id, campaign);

  setTimeout(() => {
    void runJamendoBenchmarkCampaign(id);
  }, 50);

  return res.status(202).json({
    ok: true,
    campaignId: id,
    campaign,
  });
});

app.get("/partybrain/karaoke-benchmark/:campaignId", (req, res) => {
  const campaign = karaokeBenchmarkCampaigns.get(
    String(req.params.campaignId || "")
  );

  if (!campaign) {
    return res.status(404).json({ error: "Campagne benchmark introuvable." });
  }

  return res.json({ campaign });
});

app.get("/partybrain/karaoke-sync-engine/config", (_req, res) => {
  const configured = String(
    process.env.KARAOKE_SYNC_ENGINE_URL ||
    process.env.NEXT_PUBLIC_KARAOKE_SYNC_ENGINE_URL ||
    ""
  ).trim();

  return res.json({
    enabled: karaokeSyncEngineEnabled(),
    endpoint: karaokeSyncEngineUrl(),
    source: configured ? "railway-variable" : "built-in-fallback",
    envDetected: Boolean(configured),
    shadowMode: true,
  });
});

app.get("/partybrain/karaoke-sync-engine", (_req, res) => {
  return res.json(karaokeSyncEngineSummary());
});

app.get("/partybrain/karaoke-sync-engine/entries", (req, res) => {
  const requestedLimit = Number(req.query.limit || 100);
  const limit = Math.max(
    1,
    Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 100)
  );

  const status = String(req.query.status || "").trim();
  const query = normalizeMusicQuery(String(req.query.q || ""));

  const items = Object.values(karaokeSyncEngineState.entries)
    .filter((entry) => !status || entry.status === status)
    .filter((entry) => {
      if (!query) return true;
      return normalizeMusicQuery(
        `${entry.source.artistName} ${entry.source.title}`
      ).includes(query);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);

  return res.json({
    ...karaokeSyncEngineSummary(),
    returned: items.length,
    items,
  });
});


app.get("/partybrain/karaoke-sync-engine/entry/:videoId", (req, res) => {
  const videoId = String(req.params.videoId || "").trim();
  const entry = karaokeSyncEngineState.entries[videoId];

  if (!entry) {
    return res.status(404).json({
      error: "Aucune analyse Karaoke Sync Engine pour ce morceau.",
      videoId,
    });
  }

  return res.json({
    entry,
    temporaryAudioUrlLoaded:
      karaokeSyncEngineAudioUrlOverrides.has(videoId),
    shadowMode: true,
    note:
      "Le résultat n'est pas encore utilisé par le lecteur Karaoké public.",
  });
});

app.post("/partybrain/karaoke-sync-engine/queue", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const requestedLimit = Number(req.body?.limit || 25);
  const limit = Math.max(
    1,
    Math.min(200, Number.isFinite(requestedLimit) ? requestedLimit : 25)
  );

  const requestedVideoId = String(req.body?.videoId || "").trim();

  if (requestedVideoId) {
    const queued = karaokeSyncEngineQueueSong(requestedVideoId);

    return res.status(queued ? 202 : 409).json({
      ok: queued,
      videoId: requestedVideoId,
      summary: karaokeSyncEngineSummary(),
      message: queued
        ? "Morceau ajouté à la file du Karaoke Sync Engine."
        : "Morceau non éligible, déjà certifié ou déjà en cours.",
    });
  }

  const candidates = Object.values(karaokeLyricsAudit.entries)
    .filter(
      (audit) =>
        audit.kind === "synced" &&
        karaokeLyricsAuditEntryIsStrictlyVerified(
          musicBrain.songs[audit.videoId],
          audit
        )
    )
    .map((audit) => {
      const song = musicBrain.songs[audit.videoId];
      const priority =
        Number(song?.playedCount || 0) * 8 +
        Number(song?.addedCount || 0) * 6 +
        Number(song?.voteCount || 0) * 5 +
        Number(song?.searchCount || 0) * 2;

      return { audit, priority };
    })
    .filter(({ audit }) => {
      const current = karaokeSyncEngineState.entries[audit.videoId];
      return !current || ["failed", "blocked", "needs_review"].includes(current.status);
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);

  let queued = 0;

  for (const candidate of candidates) {
    if (karaokeSyncEngineQueueSong(candidate.audit.videoId)) {
      queued += 1;
    }
  }

  return res.status(202).json({
    ok: true,
    queued,
    requested: limit,
    summary: karaokeSyncEngineSummary(),
  });
});



app.post(
  "/partybrain/karaoke-sync-engine/test-upload/:videoId",
  express.raw({
    type: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/flac",
      "audio/x-flac",
      "audio/mp4",
      "audio/aac",
      "application/octet-stream",
    ],
    limit: "45mb",
  }),
  async (req, res) => {
    if (!requirePartyBrainAdmin(req, res)) return;

    const videoId = String(req.params.videoId || "").trim();
    const candidate = karaokeSyncEngineCandidate(videoId);

    if (!candidate) {
      return res.status(409).json({
        error:
          "Ce morceau doit déjà être synchronisé LRCLIB et validé V5 avant le test Sync Engine.",
      });
    }

    const audioBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body || []);

    if (!audioBuffer.length) {
      return res.status(400).json({ error: "Fichier audio vide ou non reçu." });
    }

    const fileName = decodeURIComponent(
      String(req.headers["x-mixparty-audio-filename"] || "source.mp3")
    ).slice(0, 180);

    const mimeType = String(
      req.headers["content-type"] || "application/octet-stream"
    );

    const now = Date.now();
    const previous = karaokeSyncEngineState.entries[videoId];

    const entry: KaraokeSyncEngineEntry = {
      videoId,
      status: "analyzing",
      queuedAt: previous?.queuedAt || now,
      startedAt: now,
      updatedAt: now,
      source: {
        title: candidate.song.title || candidate.song.rawTitle || "",
        artistName: candidate.song.artistName || "",
        durationSeconds: candidate.song.durationSeconds,
        lrclibId: candidate.audit.lrclibId,
        lrclibTrackName: candidate.audit.matchedTrackName,
        lrclibArtistName: candidate.audit.matchedArtistName,
        lrclibDuration: candidate.audit.matchedDuration,
      },
      attempts: Number(previous?.attempts || 0) + 1,
      reason: "Analyse du fichier audio envoyé depuis MusicBrain.",
    };

    karaokeSyncEngineState.entries[videoId] = entry;
    saveKaraokeSyncEngineState();

    try {
      const result = await requestKaraokeSyncAlignmentUpload(
        candidate.song,
        candidate.audit,
        audioBuffer,
        fileName,
        mimeType
      );

      applyKaraokeSyncEngineResult(entry, result);
      entry.finishedAt = Date.now();
      entry.updatedAt = Date.now();
      saveKaraokeSyncEngineState();

      return res.json({
        ok: true,
        entry,
        shadowMode: true,
      });
    } catch (error: any) {
      entry.status = "failed";
      entry.finishedAt = Date.now();
      entry.updatedAt = Date.now();
      entry.reason = error?.message || "Erreur pendant l'analyse WhisperX.";
      saveKaraokeSyncEngineState();

      return res.status(500).json({
        error: entry.reason,
        entry,
      });
    }
  }
);

app.post("/partybrain/karaoke-sync-engine/test/:videoId", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const audioUrl = karaokeSyncEngineAuthorizedAudioUrl(req.body?.audioUrl);

  if (!videoId) {
    return res.status(400).json({
      error: "videoId manquant.",
    });
  }

  if (!audioUrl) {
    return res.status(400).json({
      error:
        "audioUrl invalide. Utilise une URL HTTP/HTTPS directe vers un fichier audio que tu es autorisé à faire analyser.",
    });
  }

  if (!karaokeSyncEngineEnabled()) {
    return res.status(503).json({
      error:
        "KARAOKE_SYNC_ENGINE_URL n'est pas configuré sur l'API MixParty.",
    });
  }

  const candidate = karaokeSyncEngineCandidate(videoId);

  if (!candidate) {
    return res.status(409).json({
      error:
        "Ce morceau n'est pas encore éligible au test : il doit déjà avoir une entrée LRCLIB synchronisée et validée par le filtre V5.",
    });
  }

  const existing = karaokeSyncEngineState.entries[videoId];

  if (existing?.status === "analyzing") {
    return res.status(409).json({
      error: "Ce morceau est déjà en cours d'analyse.",
    });
  }

  // On force une nouvelle passe de test, même si un ancien résultat Shadow existe.
  if (existing) {
    existing.status = "pending";
    existing.reason = "Test audio autorisé demandé manuellement.";
    existing.updatedAt = Date.now();
    existing.alignedLines = undefined;
    existing.confidence = undefined;
    existing.offsetSeconds = undefined;
    existing.engine = undefined;
    existing.diagnostics = undefined;
    saveKaraokeSyncEngineState();
  }

  karaokeSyncEngineAudioUrlOverrides.set(videoId, audioUrl);

  // karaokeSyncEngineQueueSong refuse un morceau déjà certifié.
  // Pour un test explicite on réinitialise donc le statut avant la mise en file.
  const queued = karaokeSyncEngineQueueSong(videoId);

  if (!queued) {
    karaokeSyncEngineAudioUrlOverrides.delete(videoId);

    return res.status(409).json({
      error:
        "Impossible de mettre ce morceau en file. Vérifie qu'il n'est pas déjà en attente ou en cours.",
      summary: karaokeSyncEngineSummary(),
    });
  }

  return res.status(202).json({
    ok: true,
    videoId,
    title: candidate.song.title,
    artistName: candidate.song.artistName,
    message:
      "Test audio lancé en Shadow Mode. L'URL audio ne sera pas sauvegardée.",
    statusUrl: `/partybrain/karaoke-sync-engine/entries?q=${encodeURIComponent(
      candidate.song.title
    )}`,
    summary: karaokeSyncEngineSummary(),
  });
});

app.post("/partybrain/karaoke-sync-engine/retry/:videoId", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const existing = karaokeSyncEngineState.entries[videoId];

  if (existing?.status === "analyzing") {
    return res.status(409).json({
      error: "Ce morceau est déjà en cours d’analyse.",
    });
  }

  if (existing) {
    existing.status = "pending";
    existing.reason = "Nouvelle tentative demandée manuellement.";
    existing.updatedAt = Date.now();
    saveKaraokeSyncEngineState();
  }

  const queued = karaokeSyncEngineQueueSong(videoId);

  return res.status(queued ? 202 : 409).json({
    ok: queued,
    videoId,
    summary: karaokeSyncEngineSummary(),
  });
});

app.post("/partybrain/karaoke-sync-engine/certify/:videoId", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const entry = karaokeSyncEngineState.entries[videoId];

  if (!entry) {
    return res.status(404).json({
      error: "Analyse Karaoke Sync Engine introuvable.",
    });
  }

  if (!entry.alignedLines?.length) {
    return res.status(400).json({
      error: "Aucune parole réalignée disponible pour ce morceau.",
    });
  }

  entry.status = "certified";
  entry.confidence = Math.max(
    Number(entry.confidence || 0),
    KARAOKE_SYNC_ENGINE_MIN_CONFIDENCE
  );
  entry.reason = "Certification manuelle validée dans MusicBrain.";
  entry.finishedAt = Date.now();
  entry.updatedAt = Date.now();
  saveKaraokeSyncEngineState();

  return res.json({
    ok: true,
    entry,
    summary: karaokeSyncEngineSummary(),
    note:
      "Toujours en shadow mode : cette certification n'est pas encore utilisée par le lecteur Karaoké.",
  });
});


type KaraokeTimedLine = {
  time: number;
  text: string;
};

type KaraokeLyricsRuntimeResponse = {
  videoId: string;
  available: boolean;
  kind: KaraokeLyricsAuditKind | "unchecked" | "error";
  lrclibId?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  lines?: KaraokeTimedLine[];
  plainLyrics?: string;
  message?: string;
  syncOffsetSeconds?: number;
  certification?: string;
  syncEngine?: {
    mode: "shadow" | "active";
    status: KaraokeSyncEngineEntryStatus;
    confidence?: number;
    engine?: string;
  };
};

const karaokeLyricsRuntimeCache = new Map<
  string,
  { expiresAt: number; payload: KaraokeLyricsRuntimeResponse }
>();

function parseLrclibSyncedLyrics(raw: unknown): KaraokeTimedLine[] {
  const input = String(raw || "").replace(/\r/g, "");
  if (!input.trim()) return [];

  const lines: KaraokeTimedLine[] = [];

  for (const row of input.split("\n")) {
    const match = row.match(/^\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]\s?(.*)$/);
    if (!match) continue;

    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) continue;

    const text = String(match[3] || "").trim();
    const time = minutes * 60 + seconds;

    lines.push({ time, text });
  }

  return lines
    .filter((line) => Number.isFinite(line.time))
    .sort((a, b) => a.time - b.time);
}

async function fetchLrclibLyricsById(id: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`https://lrclib.net/api/get/${encodeURIComponent(String(id))}`, {
      headers: {
        "User-Agent": "MixParty/1.0 (https://mixpartyapp.fr)",
        "Lrclib-Client": "MixParty/1.0 (https://mixpartyapp.fr)",
      },
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryAfter = Math.max(1, Number(response.headers.get("retry-after") || 5));
      const error: any = new Error("LRCLIB_RATE_LIMIT");
      error.status = 429;
      error.retryAfter = retryAfter;
      throw error;
    }

    if (!response.ok) {
      const error: any = new Error(`LRCLIB HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}


app.post("/partybrain/maintenance/karaoke-sync-offset/:videoId", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const offsetSeconds = Number(req.body?.offsetSeconds);

  if (!videoId || !Number.isFinite(offsetSeconds)) {
    return res.status(400).json({
      error: "videoId ou offsetSeconds invalide.",
    });
  }

  if (Math.abs(offsetSeconds) > 5) {
    return res.status(400).json({
      error:
        "Offset refusé : au-delà de ±5 s, il faut rechercher une meilleure version plutôt que corriger artificiellement.",
    });
  }

  const song = musicBrain.songs[videoId];
  if (!song) {
    return res.status(404).json({
      error: "Morceau introuvable dans PartyBrain.",
    });
  }

  song.karaokeSyncOffsetSeconds = Math.round(offsetSeconds * 100) / 100;
  song.karaokeSyncCertifiedAt = Date.now();
  song.karaokeSyncCertifiedReason = "MANUAL_OFFSET";
  song.lastSeenAt = Date.now();

  musicBrain.updatedAt = Date.now();
  saveMusicBrain();
  karaokeLyricsRuntimeCache.delete(videoId);

  return res.json({
    ok: true,
    videoId,
    offsetSeconds: song.karaokeSyncOffsetSeconds,
    message:
      `Offset Karaoké enregistré : ${song.karaokeSyncOffsetSeconds >= 0 ? "+" : ""}${song.karaokeSyncOffsetSeconds}s. Le morceau reste dans PartyBrain.`,
  });
});

app.get("/partybrain/karaoke/lyrics/:videoId", async (req, res) => {
  const videoId = String(req.params.videoId || "").trim();

  if (!videoId) {
    return res.status(400).json({
      available: false,
      kind: "error",
      message: "videoId manquant.",
    });
  }

  const cached = karaokeLyricsRuntimeCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.payload);
  }

  const audit = karaokeLyricsAudit.entries[videoId];

  if (!audit) {
    const payload: KaraokeLyricsRuntimeResponse = {
      videoId,
      available: false,
      kind: "unchecked",
      message: "Ce morceau n'a pas encore été vérifié par l'audit LRCLIB.",
    };

    karaokeLyricsRuntimeCache.set(videoId, {
      expiresAt: Date.now() + 60_000,
      payload,
    });

    return res.json(payload);
  }

  const sourceSong = musicBrain.songs[videoId];

  if (
    audit.kind === "synced" &&
    !karaokeLyricsAuditEntryIsStrictlyVerified(sourceSong, audit)
  ) {
    const payload: KaraokeLyricsRuntimeResponse = {
      videoId,
      available: false,
      kind: "unchecked",
      lrclibId: audit.lrclibId,
      trackName: audit.matchedTrackName,
      artistName: audit.matchedArtistName,
      albumName: audit.matchedAlbumName,
      duration: audit.matchedDuration,
      message:
        "Paroles bloquées par Karaoké Sync Certified V5 : la version audio exacte n’est pas certifiée.",
    };

    karaokeLyricsRuntimeCache.set(videoId, {
      expiresAt: Date.now() + 60_000,
      payload,
    });

    return res.json(payload);
  }

  if (audit.kind !== "synced" || !audit.lrclibId) {
    const payload: KaraokeLyricsRuntimeResponse = {
      videoId,
      available: false,
      kind: audit.kind,
      lrclibId: audit.lrclibId,
      trackName: audit.matchedTrackName,
      artistName: audit.matchedArtistName,
      albumName: audit.matchedAlbumName,
      duration: audit.matchedDuration,
      message:
        audit.kind === "plain"
          ? "Paroles disponibles, mais pas synchronisées."
          : audit.kind === "instrumental"
            ? "Morceau indiqué comme instrumental."
            : "Aucune parole synchronisée trouvée.",
    };

    karaokeLyricsRuntimeCache.set(videoId, {
      expiresAt: Date.now() + 10 * 60_000,
      payload,
    });

    return res.json(payload);
  }

  try {
    const record = await fetchLrclibLyricsById(audit.lrclibId);

    if (
      !sourceSong ||
      !karaokeLyricsStrictIdentityMatch(sourceSong, record) ||
      !karaokeLyricsStrictTimedLines(
        record?.syncedLyrics,
        Number(record?.duration || sourceSong.durationSeconds || 0)
      )
    ) {
      const payload: KaraokeLyricsRuntimeResponse = {
        videoId,
        available: false,
        kind: "unchecked",
        lrclibId: audit.lrclibId,
        trackName: record?.trackName || audit.matchedTrackName,
        artistName: record?.artistName || audit.matchedArtistName,
        albumName: record?.albumName || audit.matchedAlbumName,
        duration: Number(record?.duration || audit.matchedDuration || 0) || undefined,
        message:
          "Certification Karaoké V5 échouée au moment de la lecture : paroles non servies.",
      };

      karaokeLyricsRuntimeCache.set(videoId, {
        expiresAt: Date.now() + 60_000,
        payload,
      });

      return res.json(payload);
    }

    const rawLines = parseLrclibSyncedLyrics(record?.syncedLyrics);
    const syncOffset = Number(sourceSong?.karaokeSyncOffsetSeconds || 0);
    const lines = rawLines.map((line) => ({
      ...line,
      time: Math.max(0, line.time + syncOffset),
    }));

    if (!lines.length) {
      const payload: KaraokeLyricsRuntimeResponse = {
        videoId,
        available: false,
        kind: String(record?.plainLyrics || "").trim() ? "plain" : "not_found",
        lrclibId: audit.lrclibId,
        trackName: record?.trackName || audit.matchedTrackName,
        artistName: record?.artistName || audit.matchedArtistName,
        albumName: record?.albumName || audit.matchedAlbumName,
        duration: Number(record?.duration || audit.matchedDuration || 0) || undefined,
        plainLyrics: String(record?.plainLyrics || "").trim() || undefined,
        message: "LRCLIB ne renvoie plus de paroles synchronisées pour ce morceau.",
      };

      karaokeLyricsRuntimeCache.set(videoId, {
        expiresAt: Date.now() + 5 * 60_000,
        payload,
      });

      return res.json(payload);
    }

    const syncEngineEntry = karaokeSyncEngineState.entries[videoId];

    const payload: KaraokeLyricsRuntimeResponse = {
      videoId,
      available: true,
      kind: "synced",
      lrclibId: audit.lrclibId,
      trackName: record?.trackName || audit.matchedTrackName,
      artistName: record?.artistName || audit.matchedArtistName,
      albumName: record?.albumName || audit.matchedAlbumName,
      duration: Number(record?.duration || audit.matchedDuration || 0) || undefined,
      lines,
      ...(sourceSong
        ? {
            syncOffsetSeconds: Number(sourceSong.karaokeSyncOffsetSeconds || 0),
            certification: karaokeLyricsCertifiedReason(sourceSong),
          }
        : {}),
      ...(syncEngineEntry
        ? {
            syncEngine: {
              mode: "shadow",
              status: syncEngineEntry.status,
              confidence: syncEngineEntry.confidence,
              engine: syncEngineEntry.engine,
            },
          }
        : {}),
    } as KaraokeLyricsRuntimeResponse;

    // Un morceau déjà résolu peut rester en cache 6 h sur l'API.
    karaokeLyricsRuntimeCache.set(videoId, {
      expiresAt: Date.now() + 6 * 60 * 60_000,
      payload,
    });

    return res.json(payload);
  } catch (error: any) {
    const retryAfter = Math.max(0, Number(error?.retryAfter || 0));

    return res.status(Number(error?.status || 0) === 429 ? 429 : 502).json({
      videoId,
      available: false,
      kind: "error",
      message:
        retryAfter > 0
          ? `LRCLIB demande une pause de ${retryAfter}s.`
          : "Impossible de charger les paroles LRCLIB pour le moment.",
      retryAfter,
    });
  }
});



function normalizeKaraokeArtistCandidate(value: unknown) {
  return normalizeMusicQuery(
    String(value || "")
      .replace(/[-–—_]+topic$/i, "")
      .replace(/\b(?:official|lyrics?|paroles|karaok[eé]|music|audio|video|channel)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function isGenericKaraokeArtistName(value: unknown) {
  const normalized = normalizeKaraokeArtistCandidate(value);
  if (!normalized) return true;

  const compact = normalized.replace(/\s+/g, "");

  const genericPatterns = [
    /^7clouds?$/,
    /^clouds?$/,
    /^cloudmusic$/,
    /^lyrics?$/,
    /^lyricsmusic$/,
    /^music$/,
    /^musicchannel$/,
    /^officialmusic$/,
    /^karaoke$/,
    /^vevo$/,
    /^topic$/,
    /^youtube$/,
    /^unknown$/,
    /^artisteinconnu$/,
  ];

  if (genericPatterns.some((pattern) => pattern.test(compact))) return true;

  return (
    compact.includes("lyricschannel") ||
    compact.includes("musicchannel") ||
    compact.includes("karaokechannel")
  );
}

function inferKaraokeArtistFromRawTitle(song: MusicBrainSong) {
  const raw = String(song.rawTitle || "").trim();
  if (!raw) return "";

  // Beaucoup de chaînes de paroles (ex. 7clouds) publient sous la forme :
  // "Ariana Grande - 7 rings (Lyrics)".
  // On récupère donc le préfixe avant le séparateur comme candidat artiste.
  const match = raw.match(
    /^\s*(.{2,90}?)\s+(?:-|–|—|\||:)\s+.{2,}\s*$/
  );

  const candidate = String(match?.[1] || "")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:official|lyrics?|paroles|karaok[eé]|audio|video|clip)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || isGenericKaraokeArtistName(candidate)) return "";

  // Évite de prendre un titre de chanson entier pour un artiste.
  if (candidate.length > 70) return "";

  return candidate;
}

function resolveKaraokeArtistName(song: MusicBrainSong, entry: KaraokeLyricsAuditEntry) {
  const lrclibArtist = String(entry?.matchedArtistName || "").trim();
  const musicBrainArtist = String(song?.artistName || "").trim();
  const rawTitleArtist = inferKaraokeArtistFromRawTitle(song);

  // 1. LRCLIB reste prioritaire lorsqu'il contient un vrai artiste.
  if (lrclibArtist && !isGenericKaraokeArtistName(lrclibArtist)) {
    return lrclibArtist;
  }

  // 2. Si LRCLIB a hérité d'un faux artiste (7clouds, Lyrics, etc.),
  // on tente de récupérer l'artiste réel depuis le titre YouTube brut.
  if (rawTitleArtist) {
    return rawTitleArtist;
  }

  // 3. MusicBrain sert ensuite de secours uniquement s'il n'est pas générique.
  if (musicBrainArtist && !isGenericKaraokeArtistName(musicBrainArtist)) {
    return musicBrainArtist;
  }

  // Jamais de dossier "7clouds", "Lyrics", etc.
  return "À classer";
}

app.get("/partybrain/karaoke-lyrics-audit/ready", (req, res) => {
  const q = normalizeMusicQuery(String(req.query?.q || ""));
  const rawLimit = Number(req.query?.limit || 500);
  const rawOffset = Number(req.query?.offset || 0);

  const limit = Math.max(
    1,
    Math.min(1000, Number.isFinite(rawLimit) ? rawLimit : 500)
  );
  const offset = Math.max(
    0,
    Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0
  );

  const rawSyncedEntries = Object.values(karaokeLyricsAudit.entries)
    .filter((entry) => entry.kind === "synced")
    .filter((entry) => Boolean(musicBrain.songs[entry.videoId]));

  const syncedEntries = rawSyncedEntries.filter((entry) =>
    karaokeLyricsAuditEntryIsStrictlyVerified(
      musicBrain.songs[entry.videoId],
      entry
    )
  );

  let heldForReview = 0;
  let blockedByMusicBrain = 0;

  const items = syncedEntries
    .map((entry) => {
      const song = musicBrain.songs[entry.videoId];
      if (!song) return null;

      const publication = musicBrainPublicationDecision(song);

      if (publication.status === "review") {
        heldForReview += 1;
        return null;
      }

      if (publication.status === "blocked") {
        blockedByMusicBrain += 1;
        return null;
      }

      // IMPORTANT :
      // À partir d'ici MixParty ne "répare" plus rien.
      // Le nom d'artiste et le titre viennent du MusicBrain nettoyé.
      return {
        videoId: entry.videoId,
        title: song.title || song.rawTitle || entry.matchedTrackName || "Titre inconnu",
        rawTitle: song.rawTitle || song.title || "",
        artistName: song.artistName || "Artiste inconnu",
        thumbnail: song.thumbnail || "",
        durationSeconds: Number(song.durationSeconds || entry.matchedDuration || 0),
        lrclibId: entry.lrclibId || null,
        checkedAt: entry.checkedAt,
        matchedTrackName: entry.matchedTrackName || "",
        matchedArtistName: entry.matchedArtistName || "",
        matchedAlbumName: entry.matchedAlbumName || "",
        musicBrainPublicationStatus: publication.status,
      };
    })
    .filter(Boolean)
    .filter((item: any) => {
      if (!q) return true;
      const haystack = normalizeMusicQuery(
        `${item.title} ${item.rawTitle} ${item.artistName} ${item.matchedTrackName} ${item.matchedArtistName}`
      );
      return haystack.includes(q);
    })
    .sort((a: any, b: any) => {
      const artistCompare = String(a.artistName || "").localeCompare(
        String(b.artistName || ""),
        "fr",
        { sensitivity: "base" }
      );
      if (artistCompare !== 0) return artistCompare;

      return String(a.title || "").localeCompare(String(b.title || ""), "fr", {
        sensitivity: "base",
      });
    });

  const pageItems = items.slice(offset, offset + limit);

  return res.json({
    // Nombre LRCLIB brut : utile pour l'admin.
    totalSynced: rawSyncedEntries.length,

    // Nombre qui passe réellement le filtre Karaoké Sync Certified V5.
    totalStrictlyVerified: syncedEntries.length,
    totalCertified: syncedEntries.length,
    heldForSyncCertification: Math.max(0, rawSyncedEntries.length - syncedEntries.length),

    // Nombre réellement publié dans MixParty après certification synchro + validation MusicBrain.
    totalReady: items.length,
    heldForReview,
    blockedByMusicBrain,

    matched: items.length,
    returned: pageItems.length,
    offset,
    limit,
    hasMore: offset + pageItems.length < items.length,
    nextOffset:
      offset + pageItems.length < items.length
        ? offset + pageItems.length
        : null,
    query: String(req.query?.q || ""),
    items: pageItems,
  });
});

app.get("/partybrain/karaoke-lyrics-audit", (_req, res) => {
  return res.json({
    ...karaokeLyricsAuditSummary(),
    job: karaokeLyricsAuditJob,
    scheduler: karaokeLyricsAuditSchedulerSnapshot(),
  });
});

app.post("/partybrain/karaoke-lyrics-audit/run", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  if (karaokeLyricsAuditJob.running) {
    return res.status(409).json({
      error: "Un audit LRCLIB est déjà en cours.",
      summary: karaokeLyricsAuditSummary(),
      job: karaokeLyricsAuditJob,
    });
  }

  const requestedLimit = Number(req.body?.limit || 100);
  const limit = Math.max(
    1,
    Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 100)
  );

  // Important : on lance le scan en arrière-plan et on répond immédiatement.
  // Cela évite le timeout HTTP Railway pendant les ~30+ secondes du lot de 100.
  void runKaraokeLyricsAuditBatch(limit).catch((error) => {
    console.error("Audit LRCLIB arrière-plan interrompu :", error);
    karaokeLyricsAuditJob.running = false;
    karaokeLyricsAuditJob.finishedAt = Date.now();
    karaokeLyricsAuditJob.message = "Audit interrompu par une erreur serveur.";
  });

  return res.status(202).json({
    ok: true,
    started: true,
    requested: limit,
    summary: karaokeLyricsAuditSummary(),
    job: karaokeLyricsAuditJob,
  });
});

loadKaraokeAudit();

app.get("/partybrain/karaoke-audit", (_req, res) => {
  return res.json(karaokeAuditSummary());
});

app.post("/partybrain/karaoke-audit/scan-musicbrain", (_req, res) => {
  const localScan = karaokeLocalMusicBrainScan();
  return res.json({
    ok: true,
    message: `Scan MusicBrain terminé : ${localScan.scannedSongs} morceaux analysés sans quota YouTube.`,
    localScan,
    summary: karaokeAuditSummary(),
  });
});

app.post("/partybrain/karaoke-audit/run", async (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const requestedLimit = Number(req.body?.limit || 10);
  const limit = Math.max(1, Math.min(10, Number.isFinite(requestedLimit) ? requestedLimit : 10));

  const localResolution = karaokeLocalResolution();
  const candidates = Object.values(musicBrain.songs)
    .filter((song) => {
      const resolution = localResolution.resolutionByVideoId.get(song.videoId);
      return resolution?.kind === "probable_clip" || resolution?.kind === "indeterminate";
    })
    .filter((song) => !karaokeAudit.entries[song.videoId])
    .sort((a, b) => {
      const score = (song: MusicBrainSong) =>
        Number(song.playedCount || 0) * 4 +
        Number(song.addedCount || 0) * 3 +
        Number(song.voteCount || 0) * 2 +
        Number(song.searchCount || 0);
      return score(b) - score(a);
    })
    .slice(0, limit);

  let searched = 0;
  let foundTopic = 0;
  let foundOfficialAudio = 0;
  let notFound = 0;
  let errors = 0;

  for (const song of candidates) {
    try {
      const query = `${song.artistName} ${song.title} official audio`;
      const results = await requestYoutubeMusic(query, "user");
      searched += 1;

      const ranked = results
        .map((candidate) => ({
          candidate,
          kind: karaokeKindForVideo(candidate),
          score: karaokeCandidateScore(song, candidate),
        }))
        .filter((item) => item.kind && item.score >= 0)
        .sort((a, b) => b.score - a.score);

      const best = ranked[0];
      if (best?.kind) {
        karaokeAudit.entries[song.videoId] = {
          sourceVideoId: song.videoId,
          sourceTitle: song.title,
          sourceArtistName: song.artistName,
          checkedAt: Date.now(),
          kind: best.kind,
          candidateVideoId: best.candidate.id,
          candidateTitle: best.candidate.rawTitle || best.candidate.title,
          candidateChannelTitle: best.candidate.channelTitle,
          candidateDurationSeconds: best.candidate.durationSeconds,
        };
        if (best.kind === "topic") foundTopic += 1;
        if (best.kind === "official_audio") foundOfficialAudio += 1;
      } else {
        karaokeAudit.entries[song.videoId] = {
          sourceVideoId: song.videoId,
          sourceTitle: song.title,
          sourceArtistName: song.artistName,
          checkedAt: Date.now(),
          kind: "not_found",
        };
        notFound += 1;
      }

      saveKaraokeAudit();
    } catch (error) {
      errors += 1;
      console.warn(`Audit Karaoké impossible pour ${song.artistName} — ${song.title}`, error);
      // Une erreur YouTube/quota n'est volontairement pas mémorisée afin de pouvoir réessayer plus tard.
      break;
    }
  }

  return res.json({
    ok: true,
    batch: { requested: limit, selected: candidates.length, searched, foundTopic, foundOfficialAudio, notFound, errors },
    summary: karaokeAuditSummary(),
  });
});


app.get("/musicbrain/stats", (_req, res) => {
  return res.json(musicBrainStats());
});


function requirePartyBrainAdmin(req: express.Request, res: express.Response) {
  const expectedToken = String(process.env.PARTYBRAIN_ADMIN_TOKEN || "").trim();
  if (!expectedToken) {
    res.status(503).json({
      error: "Administration des jaquettes désactivée : configure PARTYBRAIN_ADMIN_TOKEN sur Railway.",
    });
    return false;
  }

  const providedToken = String(req.header("x-partybrain-admin-token") || "").trim();
  if (!providedToken || providedToken !== expectedToken) {
    res.status(401).json({ error: "Code administrateur incorrect." });
    return false;
  }

  return true;
}

function coverLibraryCategory(song: MusicBrainSong) {
  if (coverLookupsInFlight.has(song.videoId)) return "active";
  if (song.coverStatus === "found" && song.coverUrl) {
    if (song.coverSource === "APPLE_ARTIST_FALLBACK") return "artist_fallback";
    if (song.coverSource === "APPLE_ITUNES" || song.coverSource === "MUSICBRAINZ_CAA") return "exact";
    if (song.coverSource === "MANUAL") return "manual";
    return "downloaded";
  }
  if (song.coverStatus === "pending") return "pending";
  if (song.coverStatus === "not_found") return "not_found";
  if (song.coverStatus === "error") return "error";
  return "unrequested";
}

app.get("/partybrain/covers", (req, res) => {
  const requestedStatus = String(req.query.status || "all").trim().toLowerCase();
  const query = normalizeMusicQuery(String(req.query.q || ""));
  const limit = Math.max(1, Math.min(10000, Number(req.query.limit || 10000)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const allSongs = Object.values(musicBrain.songs).filter((song) => {
    const category = coverLibraryCategory(song);
    const matchesStatus =
      requestedStatus === "all" ||
      (requestedStatus === "downloaded" && song.coverStatus === "found" && Boolean(song.coverUrl)) ||
      requestedStatus === category;

    if (!matchesStatus) return false;
    if (!query) return true;

    return normalizeMusicQuery(`${song.title} ${song.artistName} ${song.albumName || ""}`).includes(query);
  });

  allSongs.sort((a, b) => {
    const scoreA = Number(a.playedCount || 0) * 4 + Number(a.addedCount || 0) * 3 + Number(a.voteCount || 0) * 2 + Number(a.searchCount || 0);
    const scoreB = Number(b.playedCount || 0) * 4 + Number(b.addedCount || 0) * 3 + Number(b.voteCount || 0) * 2 + Number(b.searchCount || 0);
    return scoreB - scoreA || String(a.artistName).localeCompare(String(b.artistName), "fr");
  });

  const items = allSongs.slice(offset, offset + limit).map((song) => ({
    videoId: song.videoId,
    title: song.title,
    artistName: song.artistName,
    albumName: song.albumName,
    thumbnail: song.thumbnail,
    coverStatus: song.coverStatus,
    coverUrl: song.coverUrl,
    coverSource: song.coverSource,
    coverWidth: song.coverWidth,
    coverHeight: song.coverHeight,
    coverLastCheckedAt: song.coverLastCheckedAt,
    coverAttempts: Number(song.coverAttempts || 0),
    category: coverLibraryCategory(song),
    active: coverLookupsInFlight.has(song.videoId),
  }));

  return res.json({
    status: requestedStatus,
    total: allSongs.length,
    offset,
    limit,
    items,
  });
});

app.post("/partybrain/covers/:videoId/retry", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const song = musicBrain.songs[videoId];
  if (!song) return res.status(404).json({ error: "Morceau introuvable dans MusicBrain." });
  if (coverLookupsInFlight.has(videoId)) {
    return res.status(409).json({ error: "Une recherche est déjà en cours pour ce morceau." });
  }

  song.coverStatus = undefined;
  song.coverUrl = undefined;
  song.coverSource = undefined;
  song.coverWidth = undefined;
  song.coverHeight = undefined;
  song.coverLastCheckedAt = undefined;
  saveMusicBrain();
  queueHdCoverLookup(videoId);

  return res.status(202).json({
    ok: true,
    message: `Nouvelle recherche lancée pour « ${song.title} ».`,
  });
});

app.put("/partybrain/covers/:videoId", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const song = musicBrain.songs[videoId];
  if (!song) return res.status(404).json({ error: "Morceau introuvable dans MusicBrain." });

  const coverUrl = String(req.body?.coverUrl || "").trim();
  if (!/^https?:\/\/\S+$/i.test(coverUrl)) {
    return res.status(400).json({ error: "Entre une URL complète commençant par http:// ou https://." });
  }

  song.coverStatus = "found";
  song.coverUrl = coverUrl;
  song.coverSource = "MANUAL";
  song.coverWidth = Math.max(1, Number(req.body?.coverWidth || 1200));
  song.coverHeight = Math.max(1, Number(req.body?.coverHeight || 1200));
  song.coverLastCheckedAt = Date.now();
  song.coverAttempts = Number(song.coverAttempts || 0) + 1;
  saveMusicBrain();

  return res.json({
    ok: true,
    message: `Jaquette manuelle enregistrée pour « ${song.title} ».`,
    song: {
      videoId: song.videoId,
      coverStatus: song.coverStatus,
      coverUrl: song.coverUrl,
      coverSource: song.coverSource,
    },
  });
});

app.delete("/partybrain/covers/:videoId", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const videoId = String(req.params.videoId || "").trim();
  const song = musicBrain.songs[videoId];
  if (!song) return res.status(404).json({ error: "Morceau introuvable dans MusicBrain." });
  if (coverLookupsInFlight.has(videoId)) {
    return res.status(409).json({ error: "Attends la fin de la recherche active avant de supprimer cette jaquette." });
  }

  song.coverStatus = undefined;
  song.coverUrl = undefined;
  song.coverSource = undefined;
  song.coverWidth = undefined;
  song.coverHeight = undefined;
  song.coverLastCheckedAt = undefined;
  saveMusicBrain();

  return res.json({
    ok: true,
    message: `Jaquette supprimée pour « ${song.title} ». Le morceau est de nouveau à rechercher.`,
  });
});


app.get("/musicbrain/artists/:key", (req, res) => {
  const key = normalizeMusicQuery(String(req.params.key || ""));
  const artist = musicBrain.artists[key];
  if (!artist) return res.status(404).json({ error: "Artiste inconnu" });
  return res.json(artist);
});

app.get("/partybrain/stats", (_req, res) => res.json(musicBrainStats()));

app.get("/partybrain/live-users", (_req, res) => {
  const now = Date.now();
  const onlineWindowMs = 30_000;

  const activeParties = parties
    .map((party) => {
      const users = (party.participants || [])
        .filter((participant) => now - Number(participant.lastSeen || 0) <= onlineWindowMs)
        .map((participant) => ({
          id: participant.id,
          name: participant.name,
          avatar: participant.avatar,
          lastSeen: Number(participant.lastSeen || 0),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      return {
        code: party.code,
        users,
        userCount: users.length,
        currentSong: party.currentSong
          ? {
              title: party.currentSong.title,
              artistName: party.currentSong.artistName,
            }
          : null,
      };
    })
    .filter((party) => party.userCount > 0)
    .sort((a, b) => b.userCount - a.userCount || a.code.localeCompare(b.code));

  return res.json({
    generatedAt: now,
    onlineWindowMs,
    totalUsers: activeParties.reduce((total, party) => total + party.userCount, 0),
    activePartyCount: activeParties.length,
    parties: activeParties,
  });
});


app.get("/partybrain/attendance-history", (_req, res) => {
  cleanupAttendanceHistory();

  const now = Date.now();
  const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - index * 24 * 60 * 60 * 1000);
    const dateKey = dayFormatter.format(date);
    return {
      dateKey,
      dateAt: date.getTime(),
      parties: [] as Array<{
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
      }>,
    };
  });

  const byDate = new Map(days.map((day) => [day.dateKey, day]));

  for (const historyParty of Object.values(attendanceHistory.parties)) {
    const dateKey = dayFormatter.format(new Date(historyParty.firstActivityAt || historyParty.createdAt));
    const day = byDate.get(dateKey);
    if (!day) continue;

    const participants = Object.values(historyParty.participants || {})
      .sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.name.localeCompare(b.name, "fr"));

    day.parties.push({
      code: historyParty.code,
      createdAt: historyParty.createdAt,
      firstActivityAt: historyParty.firstActivityAt,
      lastActivityAt: historyParty.lastActivityAt,
      durationMinutes: Math.max(
        1,
        Math.round((historyParty.lastActivityAt - historyParty.firstActivityAt) / 60_000)
      ),
      participantCount: participants.length,
      participants,
    });
  }

  for (const day of days) {
    day.parties.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  return res.json({
    generatedAt: now,
    retentionDays: 7,
    totalParties: days.reduce((total, day) => total + day.parties.length, 0),
    totalParticipations: days.reduce(
      (total, day) => total + day.parties.reduce((sum, party) => sum + party.participantCount, 0),
      0
    ),
    days,
  });
});




type MusicBrainArtistRepairSource = "TOPIC_CHANNEL" | "TITLE_CHANNEL_MATCH" | "TITLE_PREFIX" | "METADATA_REPARSE";
type MusicBrainArtistRepairLevel = "safe" | "review";

type MusicBrainArtistRepairProposal = {
  videoId: string;
  title: string;
  rawTitle?: string;
  currentArtistName: string;
  proposedArtistName: string;
  channelTitle?: string;
  source: MusicBrainArtistRepairSource;
  sourceLabel: string;
  confidence: number;
  level: MusicBrainArtistRepairLevel;
  reason: string;
};

function isSuspiciousArtistName(value: unknown) {
  const artist = cleanArtistName(String(value || ""));
  const key = normalizeMusicQuery(artist);
  const compact = key.replace(/\s+/g, "");

  if (!key) return true;
  if (/^(unknown|inconnu|artiste inconnu|unknown artist)$/i.test(artist)) return true;

  // Noms déjà observés comme faux positifs / valeurs de parsing.
  if (/^(da|art)$/i.test(key)) return true;

  // Les noms très courts sont seulement suspects, jamais supprimés automatiquement.
  if (key.length <= 2) return true;

  // Chaînes / agrégateurs de paroles et de repost déjà rencontrés dans MusicBrain.
  // Ils sont conservés pour contrôle : ils ne sont PAS supprimés automatiquement.
  if (
    /^(7clouds?|clouds?|lyrics?|lyricsmusic|music|musique|official|officiel|topic|audio|video|records?|recordings?|channel|youtube)$/i.test(
      compact
    )
  ) {
    return true;
  }

  return false;
}

function validRepairArtist(value: unknown) {
  const artist = cleanArtistName(String(value || ""));
  const key = normalizeMusicQuery(artist);
  if (!key || key.length < 2) return false;
  if (isSuspiciousArtistName(artist)) return false;
  if (/^(feat|featuring|ft|avec|official|officiel|music|topic)$/i.test(artist)) return false;
  return true;
}

function repairArtistLooksMulti(value: unknown) {
  const artist = String(value || "").trim();
  return /(?:,|\s&\s|\sx\s|\sfeat\.?\s|\sft\.?\s|\sfeaturing\s|\savec\s)/i.test(artist);
}

function channelConfirmsRepairArtist(channelTitle: unknown, artistName: unknown) {
  const channelKey = normalizeMusicQuery(String(channelTitle || ""));
  const artistKey = normalizeMusicQuery(String(artistName || ""));
  if (!channelKey || !artistKey) return false;
  return channelKey.includes(artistKey) || artistKey.includes(channelKey);
}

function artistFromTopicChannel(channelTitle: unknown) {
  const channel = String(channelTitle || "").trim();
  const match = channel.match(/^(.+?)\s*-\s*Topic$/i);
  if (!match) return "";
  return cleanArtistName(match[1]);
}

function artistFromTitlePrefix(rawTitle: unknown) {
  const raw = decodeHtmlEntities(String(rawTitle || "")).trim();
  if (!raw) return "";

  // On exige un séparateur clair afin d'éviter de deviner un artiste à partir
  // d'un simple mot présent dans le titre.
  const parts = raw.split(/\s+(?:-|–|—|\||:)\s+/);
  if (parts.length < 2) return "";

  let candidate = cleanArtistName(parts[0]);
  candidate = candidate
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^\([^)]+\)\s*/, "")
    .trim();

  return candidate;
}

function proposeMusicBrainArtistRepair(song: MusicBrainSong): MusicBrainArtistRepairProposal | null {
  if (!isSuspiciousArtistName(song.artistName)) return null;

  const currentKey = normalizeMusicQuery(song.artistName || "");
  const rawTitle = String(song.rawTitle || song.title || "");
  const channelTitle = String(song.channelTitle || "");

  const titleArtist = artistFromTitlePrefix(rawTitle);
  const topicArtist = artistFromTopicChannel(channelTitle);

  const titleArtistValid =
    validRepairArtist(titleArtist) &&
    !repairArtistLooksMulti(titleArtist) &&
    normalizeMusicQuery(titleArtist) !== currentKey;

  const topicArtistValid =
    validRepairArtist(topicArtist) &&
    !repairArtistLooksMulti(topicArtist) &&
    normalizeMusicQuery(topicArtist) !== currentKey;

  // RÈGLE V1.5.3 :
  // Une réparation automatique exige AU MOINS DEUX signaux indépendants
  // qui confirment exactement le même artiste.
  //
  // Signal 1 : le titre YouTube commence clairement par "Artiste - Morceau".
  // Signal 2 : la chaîne YouTube confirme ce même artiste
  //            (chaîne artiste, chaîne officielle ou "Artiste - Topic").
  //
  // Une chaîne Topic seule n'est JAMAIS suffisante.
  if (
    titleArtistValid &&
    channelConfirmsRepairArtist(channelTitle, titleArtist)
  ) {
    return {
      videoId: song.videoId,
      title: song.title,
      rawTitle: song.rawTitle,
      currentArtistName: song.artistName,
      proposedArtistName: titleArtist,
      channelTitle: song.channelTitle,
      source: topicArtistValid && normalizeMusicQuery(topicArtist) === normalizeMusicQuery(titleArtist)
        ? "TOPIC_CHANNEL"
        : "TITLE_CHANNEL_MATCH",
      sourceLabel:
        topicArtistValid && normalizeMusicQuery(topicArtist) === normalizeMusicQuery(titleArtist)
          ? "Titre + chaîne Topic concordants"
          : "Titre + chaîne YouTube concordants",
      confidence: 99,
      level: "safe",
      reason:
        topicArtistValid && normalizeMusicQuery(topicArtist) === normalizeMusicQuery(titleArtist)
          ? `Le titre identifie « ${titleArtist} » et la chaîne Topic confirme exactement le même artiste.`
          : `Le titre identifie « ${titleArtist} » et la chaîne YouTube confirme exactement le même artiste.`,
    };
  }

  // Une chaîne Topic seule = proposition à vérifier, jamais réparation auto.
  if (topicArtistValid) {
    return {
      videoId: song.videoId,
      title: song.title,
      rawTitle: song.rawTitle,
      currentArtistName: song.artistName,
      proposedArtistName: topicArtist,
      channelTitle: song.channelTitle,
      source: "TOPIC_CHANNEL",
      sourceLabel: "Chaîne YouTube Topic seule",
      confidence: 75,
      level: "review",
      reason:
        "La chaîne Topic suggère cet artiste, mais le titre YouTube ne fournit pas un second signal indépendant concordant.",
    };
  }

  // Titre seul = proposition manuelle.
  if (titleArtistValid) {
    return {
      videoId: song.videoId,
      title: song.title,
      rawTitle: song.rawTitle,
      currentArtistName: song.artistName,
      proposedArtistName: titleArtist,
      channelTitle: song.channelTitle,
      source: "TITLE_PREFIX",
      sourceLabel: "Artiste présent avant le séparateur du titre YouTube",
      confidence: 70,
      level: "review",
      reason:
        "Le titre suggère cet artiste, mais la chaîne YouTube ne le confirme pas. Vérification manuelle nécessaire.",
    };
  }

  // Nouvelle analyse locale : proposition uniquement.
  // Elle ne devient jamais automatique à elle seule, car elle repose sur
  // les mêmes métadonnées déjà utilisées pour interpréter le titre/chaîne.
  const reparsed = extractMusicMetadata({
    rawTitle,
    channelTitle,
    query: rawTitle,
  });

  const reparsedArtist = cleanArtistName(reparsed.artistName || "");
  if (
    validRepairArtist(reparsedArtist) &&
    !repairArtistLooksMulti(reparsedArtist) &&
    normalizeMusicQuery(reparsedArtist) !== currentKey &&
    Number(reparsed.metadataConfidence || 0) >= 65
  ) {
    return {
      videoId: song.videoId,
      title: song.title,
      rawTitle: song.rawTitle,
      currentArtistName: song.artistName,
      proposedArtistName: reparsedArtist,
      channelTitle: song.channelTitle,
      source: "METADATA_REPARSE",
      sourceLabel: "Nouvelle analyse locale des métadonnées",
      confidence: Math.min(85, Number(reparsed.metadataConfidence || 0)),
      level: "review",
      reason:
        "La nouvelle analyse propose cet artiste, mais elle ne constitue pas un second signal indépendant suffisant pour une correction automatique.",
    };
  }

  return null;
}

function musicBrainArtistRepairReport() {
  const safeRepairs: MusicBrainArtistRepairProposal[] = [];
  const reviewProposals: MusicBrainArtistRepairProposal[] = [];
  const unresolved: Array<{
    videoId: string;
    title: string;
    rawTitle?: string;
    artistName: string;
    channelTitle?: string;
  }> = [];

  for (const song of Object.values(musicBrain.songs)) {
    if (!isSuspiciousArtistName(song.artistName)) continue;

    const proposal = proposeMusicBrainArtistRepair(song);
    if (proposal?.level === "safe") {
      safeRepairs.push(proposal);
    } else if (proposal?.level === "review") {
      reviewProposals.push(proposal);
    } else {
      unresolved.push({
        videoId: song.videoId,
        title: song.title,
        rawTitle: song.rawTitle,
        artistName: song.artistName,
        channelTitle: song.channelTitle,
      });
    }
  }

  const sorter = (a: MusicBrainArtistRepairProposal, b: MusicBrainArtistRepairProposal) =>
    b.confidence - a.confidence ||
    a.currentArtistName.localeCompare(b.currentArtistName, "fr");

  safeRepairs.sort(sorter);
  reviewProposals.sort(sorter);

  return {
    generatedAt: Date.now(),
    suspiciousCount: safeRepairs.length + reviewProposals.length + unresolved.length,
    safeRepairCount: safeRepairs.length,
    reviewProposalCount: reviewProposals.length,
    unresolvedCount: unresolved.length,
    safeRepairs,
    reviewProposals,
    unresolved: unresolved.slice(0, 1000),
    note:
      "Aucun appel YouTube. Seules les réparations avec preuve forte peuvent être appliquées automatiquement. Les propositions basées sur le titre seul restent manuelles.",
  };
}

type MusicBrainPublicationStatus =
  | "ready"
  | "review"
  | "blocked";

type MusicBrainConsensusSignal =
  | "CURRENT"
  | "TITLE"
  | "CHANNEL"
  | "TOPIC"
  | "LRCLIB"
  | "ART_TRACK"
  | "KNOWN_ALIAS"
  | "LRCLIB_PARTICIPANT"
  | "TITLE_CURRENT";

type MusicBrainConsensusResolution =
  | "auto_validated"
  | "auto_fixable"
  | "manual_review"
  | "blocked";

type MusicBrainConsensusResult = {
  resolution: MusicBrainConsensusResolution;
  artistName: string;
  proposedArtistName?: string;
  confidence: number;
  signals: MusicBrainConsensusSignal[];
  reason: string;
};

type MusicBrainPublicationDecision = {
  status: MusicBrainPublicationStatus;
  reason: string;
  proposedArtistName?: string;
  consensusResolution: MusicBrainConsensusResolution;
  consensusConfidence: number;
  consensusSignals: MusicBrainConsensusSignal[];
};

function sameMusicBrainArtist(left: unknown, right: unknown) {
  const leftKey = normalizeMusicQuery(String(left || ""));
  const rightKey = normalizeMusicQuery(String(right || ""));
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function validConsensusArtist(value: unknown) {
  const artist = cleanArtistName(String(value || ""));
  return (
    validRepairArtist(artist) &&
    !repairArtistLooksMulti(artist) &&
    !isSuspiciousArtistName(artist)
  );
}

function artistParticipantMatch(container: unknown, artist: unknown) {
  const containerKey = normalizeMusicQuery(String(container || ""));
  const artistKey = normalizeMusicQuery(String(artist || ""));
  if (!containerKey || !artistKey) return false;

  if (containerKey === artistKey) return true;

  const parts = String(container || "")
    .split(/(?:,|\/|&|\bx\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bavec\b)/i)
    .map((part) => normalizeMusicQuery(part))
    .filter(Boolean);

  return parts.includes(artistKey);
}

function knownAliasConfirmsArtist(song: MusicBrainSong, artistName: string) {
  const artist = musicBrain.artists[song.artistKey];
  if (!artist) return false;

  const raw = `${song.rawTitle || ""} ${song.title || ""} ${song.channelTitle || ""}`;
  const rawKey = normalizeMusicQuery(raw);

  return (artist.aliases || []).some((alias) => {
    const aliasKey = normalizeMusicQuery(alias);
    return Boolean(aliasKey && aliasKey.length >= 3 && rawKey.includes(aliasKey));
  });
}

function musicBrainArtistConsensus(song: MusicBrainSong): MusicBrainConsensusResult {
  const currentArtist = cleanArtistName(song.artistName || "");
  const currentKey = normalizeMusicQuery(currentArtist);
  const titleArtist = cleanArtistName(
    artistFromTitlePrefix(song.rawTitle || song.title || "")
  );
  const topicArtist = cleanArtistName(
    artistFromTopicChannel(song.channelTitle || "")
  );

  const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];
  const lrclibArtist =
    karaokeEntry?.kind === "synced"
      ? cleanArtistName(karaokeEntry.matchedArtistName || "")
      : "";

  const candidateNames = [
    currentArtist,
    titleArtist,
    topicArtist,
    lrclibArtist,
  ].filter((name, index, all) => {
    const key = normalizeMusicQuery(name);
    return Boolean(
      key &&
      validConsensusArtist(name) &&
      all.findIndex((item) => normalizeMusicQuery(item) === key) === index
    );
  });

  type CandidateEvidence = {
    artistName: string;
    signals: Set<MusicBrainConsensusSignal>;
    score: number;
  };

  const evidence = new Map<string, CandidateEvidence>();

  function addSignal(
    artistName: string,
    signal: MusicBrainConsensusSignal,
    score: number
  ) {
    if (!validConsensusArtist(artistName)) return;
    const key = normalizeMusicQuery(artistName);
    if (!key) return;

    const existing = evidence.get(key) || {
      artistName: cleanArtistName(artistName),
      signals: new Set<MusicBrainConsensusSignal>(),
      score: 0,
    };

    if (!existing.signals.has(signal)) {
      existing.signals.add(signal);
      existing.score += score;
    }

    evidence.set(key, existing);
  }

  if (validConsensusArtist(currentArtist)) {
    addSignal(currentArtist, "CURRENT", 1);

    if (
      song.metadataSource === "ART_TRACK_DESCRIPTION" &&
      Number(song.metadataConfidence || 0) >= 65
    ) {
      addSignal(currentArtist, "ART_TRACK", 4);
    }

    if (channelConfirmsRepairArtist(song.channelTitle, currentArtist)) {
      addSignal(currentArtist, "CHANNEL", 2);
    }

    // V3.1 — seconde passe :
    // 1) le titre brut contient explicitement l'artiste actuel ;
    // 2) un alias déjà appris de CET artiste apparaît dans le titre/chaîne.
    // Ces signaux servent surtout à valider les QUERY_FALLBACK légitimes,
    // jamais à remplacer seuls un artiste par un autre.
    const rawIdentityKey = normalizeMusicQuery(
      `${song.rawTitle || ""} ${song.title || ""}`
    );
    if (currentKey && rawIdentityKey.includes(currentKey)) {
      addSignal(currentArtist, "TITLE_CURRENT", 2);
    }

    if (knownAliasConfirmsArtist(song, currentArtist)) {
      addSignal(currentArtist, "KNOWN_ALIAS", 2);
    }

    // LRCLIB peut renvoyer "Artiste feat. X" alors que MusicBrain stocke
    // uniquement l'artiste principal. On confirme alors l'artiste actuel
    // sans créer un faux dossier multi-artistes.
    if (
      validRepairArtist(lrclibArtist) &&
      artistParticipantMatch(lrclibArtist, currentArtist)
    ) {
      addSignal(currentArtist, "LRCLIB_PARTICIPANT", 3);
    }
  }

  if (validConsensusArtist(titleArtist)) {
    addSignal(titleArtist, "TITLE", 2);
    if (channelConfirmsRepairArtist(song.channelTitle, titleArtist)) {
      addSignal(titleArtist, "CHANNEL", 2);
    }
  }

  if (validConsensusArtist(topicArtist)) {
    addSignal(topicArtist, "TOPIC", 2);
  }

  if (validConsensusArtist(lrclibArtist)) {
    // LRCLIB ne compte ici que lorsque les paroles synchronisées ont
    // réellement été validées pour ce videoId.
    addSignal(lrclibArtist, "LRCLIB", 3);
  }

  const ranked = [...evidence.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.signals.size - a.signals.size;
  });

  const best = ranked[0];

  if (!best) {
    return {
      resolution: "manual_review",
      artistName: currentArtist || "Artiste inconnu",
      confidence: 0,
      signals: [],
      reason: "Aucun signal indépendant exploitable.",
    };
  }

  const signals = [...best.signals];

  const hasIndependentPair =
    (best.signals.has("TITLE") && best.signals.has("LRCLIB")) ||
    (best.signals.has("TITLE") && best.signals.has("CHANNEL")) ||
    (best.signals.has("LRCLIB") && best.signals.has("TOPIC")) ||
    (best.signals.has("LRCLIB") && best.signals.has("CHANNEL")) ||
    (best.signals.has("TITLE_CURRENT") && best.signals.has("LRCLIB_PARTICIPANT")) ||
    (best.signals.has("TITLE_CURRENT") && best.signals.has("KNOWN_ALIAS")) ||
    (best.signals.has("TITLE_CURRENT") && best.signals.has("CHANNEL")) ||
    (best.signals.has("KNOWN_ALIAS") && best.signals.has("LRCLIB_PARTICIPANT")) ||
    best.signals.has("ART_TRACK");

  const confidence = Math.min(
    99,
    Math.round(
      45 +
        best.score * 8 +
        Math.max(0, best.signals.size - 1) * 5
    )
  );

  // Le meilleur consensus pointe vers un autre artiste :
  // correction automatique seulement avec au moins deux preuves indépendantes.
  if (
    currentKey &&
    !sameMusicBrainArtist(best.artistName, currentArtist)
  ) {
    if (hasIndependentPair && best.score >= 5) {
      return {
        resolution: "auto_fixable",
        artistName: currentArtist || "Artiste inconnu",
        proposedArtistName: best.artistName,
        confidence: Math.max(92, confidence),
        signals,
        reason: `Consensus fort vers « ${best.artistName} » (${signals.join(" + ")}).`,
      };
    }

    return {
      resolution: "manual_review",
      artistName: currentArtist || "Artiste inconnu",
      proposedArtistName: best.artistName,
      confidence,
      signals,
      reason: `Une correction vers « ${best.artistName} » est plausible, mais les preuves ne sont pas assez indépendantes.`,
    };
  }

  // L'identité actuelle est confirmée par des sources concordantes.
  if (sameMusicBrainArtist(best.artistName, currentArtist) && hasIndependentPair) {
    return {
      resolution: "auto_validated",
      artistName: currentArtist,
      confidence: Math.max(90, confidence),
      signals,
      reason: `Identité confirmée automatiquement (${signals.join(" + ")}).`,
    };
  }

  return {
    resolution: "manual_review",
    artistName: currentArtist || "Artiste inconnu",
    confidence,
    signals,
    reason: "MusicBrain conserve ce morceau pour vérification humaine.",
  };
}

type MusicBrainAutomaticAction =
  | "none"
  | "validate"
  | "correct";

type MusicBrainAutomaticActionDecision = {
  action: MusicBrainAutomaticAction;
  reason: string;
  proposedArtistName?: string;
  confidence: number;
  signals: MusicBrainConsensusSignal[];
};

type MusicBrainManualReviewCategory =
  | "aggregator_channel"
  | "query_fallback"
  | "featuring_conflict"
  | "lrclib_conflict"
  | "short_artist"
  | "weak_identity"
  | "metadata_conflict"
  | "other";

function musicBrainManualReviewCategory(song: MusicBrainSong) {
  const publication = musicBrainPublicationDecision(song);
  const currentArtist = cleanArtistName(song.artistName || "");
  const currentKey = normalizeMusicQuery(currentArtist);
  const channelKey = normalizeMusicQuery(song.channelTitle || "");
  const rawTitle = song.rawTitle || song.title || "";
  const titleArtist = cleanArtistName(artistFromTitlePrefix(rawTitle));
  const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];
  const lrclibArtist =
    karaokeEntry?.kind === "synced"
      ? cleanArtistName(karaokeEntry.matchedArtistName || "")
      : "";

  const compactArtist = currentKey.replace(/\s+/g, "");

  if (
    /^(7clouds?|clouds?|lyrics?|lyricsmusic|music|musique|official|officiel|topic|audio|video|records?|recordings?|channel|youtube)$/i.test(
      compactArtist
    )
  ) {
    return "aggregator_channel" as const;
  }

  if (
    publication.reason === "manual_metadata_review" ||
    song.metadataSource === "QUERY_FALLBACK"
  ) {
    return "query_fallback" as const;
  }

  if (
    repairArtistLooksMulti(currentArtist) ||
    /\b(feat\.?|ft\.?|featuring|avec)\b/i.test(currentArtist) ||
    /\s\/\s/.test(currentArtist)
  ) {
    return "featuring_conflict" as const;
  }

  if (
    lrclibArtist &&
    currentArtist &&
    !sameMusicBrainArtist(lrclibArtist, currentArtist) &&
    !artistParticipantMatch(lrclibArtist, currentArtist)
  ) {
    return "lrclib_conflict" as const;
  }

  if (currentKey.length <= 2) {
    return "short_artist" as const;
  }

  if (
    titleArtist &&
    currentArtist &&
    !sameMusicBrainArtist(titleArtist, currentArtist) &&
    channelKey &&
    channelKey.includes(currentKey)
  ) {
    return "metadata_conflict" as const;
  }

  if (
    Number(song.metadataConfidence || 0) < 40 ||
    publication.consensusConfidence < 65
  ) {
    return "weak_identity" as const;
  }

  return "other" as const;
}

function musicBrainManualReviewCategoryLabel(
  category: MusicBrainManualReviewCategory
) {
  switch (category) {
    case "aggregator_channel":
      return "Chaîne / agrégateur";
    case "query_fallback":
      return "Artiste déduit de la recherche";
    case "featuring_conflict":
      return "Featuring / artistes multiples";
    case "lrclib_conflict":
      return "Conflit LRCLIB";
    case "short_artist":
      return "Nom artiste très court";
    case "weak_identity":
      return "Identité trop faible";
    case "metadata_conflict":
      return "Conflit titre / chaîne";
    default:
      return "Autre cas ambigu";
  }
}

function musicBrainAutomaticActionDecision(
  song: MusicBrainSong
): MusicBrainAutomaticActionDecision {
  const publication = musicBrainPublicationDecision(song);
  const thirdPass = musicBrainThirdPassDecision(song);

  // Déjà validé par consensus ou sauvé par la 3e passe : aucune écriture nécessaire.
  if (thirdPass.resolution === "auto_validated") {
    return {
      action: "validate",
      reason: thirdPass.reason,
      confidence: thirdPass.confidence,
      signals: thirdPass.signals,
    };
  }

  // V3.2 : si l'interface sait déjà afficher "Auto-corrigeable",
  // le backend utilise EXACTEMENT cette même décision pour agir.
  if (
    thirdPass.resolution === "auto_fixable" &&
    thirdPass.proposedArtistName &&
    thirdPass.confidence >= 90 &&
    thirdPass.signals.length >= 2
  ) {
    return {
      action: "correct",
      reason: thirdPass.reason,
      proposedArtistName: thirdPass.proposedArtistName,
      confidence: thirdPass.confidence,
      signals: thirdPass.signals,
    };
  }

  return {
    action: "none",
    reason: thirdPass.reason,
    proposedArtistName: thirdPass.proposedArtistName,
    confidence: thirdPass.confidence,
    signals: thirdPass.signals,
  };
}

function musicBrainPublicationDecision(song: MusicBrainSong): MusicBrainPublicationDecision {
  const learning = musicBrainLearningDecision({
    artistName: song.artistName,
    channelTitle: song.channelTitle,
    title: song.title,
    rawTitle: song.rawTitle,
    metadataSource: song.metadataSource,
    metadataConfidence: song.metadataConfidence,
  });

  if (!learning.learn) {
    return {
      status: "blocked",
      reason: learning.reason || "musicbrain_rejected",
      consensusResolution: "blocked",
      consensusConfidence: 100,
      consensusSignals: [],
    };
  }

  // V3.4.1 — une validation humaine explicite est définitive pour cette
  // identité tant que le morceau n'est pas réattribué à un autre artiste.
  // C'est ce marqueur qui fait réellement sortir le morceau de "À traiter".
  if (song.manualValidatedAt) {
    return {
      status: "ready",
      reason: "manual_human_validation",
      consensusResolution: "auto_validated",
      consensusConfidence: 100,
      consensusSignals: ["CURRENT"],
    };
  }

  if (song.autoAcceptedAt) {
    return {
      status: "ready",
      reason: song.autoAcceptReason || "auto_accept_v35",
      consensusResolution: "auto_validated",
      consensusConfidence: 98,
      consensusSignals: ["CURRENT"],
    };
  }

  const consensus = musicBrainArtistConsensus(song);

  if (consensus.resolution === "auto_fixable") {
    return {
      status: "review",
      reason: "autofix_available",
      proposedArtistName: consensus.proposedArtistName,
      consensusResolution: consensus.resolution,
      consensusConfidence: consensus.confidence,
      consensusSignals: consensus.signals,
    };
  }

  if (consensus.resolution === "auto_validated") {
    return {
      status: "ready",
      reason: "autovalidated_consensus",
      consensusResolution: consensus.resolution,
      consensusConfidence: consensus.confidence,
      consensusSignals: consensus.signals,
    };
  }

  const currentArtist = cleanArtistName(song.artistName || "");
  const currentArtistKey = normalizeMusicQuery(currentArtist);
  const titleArtist = artistFromTitlePrefix(song.rawTitle || song.title || "");
  const titleArtistKey = normalizeMusicQuery(titleArtist);
  const channelKey = normalizeMusicQuery(song.channelTitle || "");

  const channelLooksLikeCurrentArtist =
    Boolean(
      currentArtistKey &&
      channelKey &&
      (channelKey.includes(currentArtistKey) || currentArtistKey.includes(channelKey))
    );

  const titlePointsToAnotherArtist =
    Boolean(
      titleArtistKey &&
      currentArtistKey &&
      titleArtistKey !== currentArtistKey &&
      validRepairArtist(titleArtist) &&
      !repairArtistLooksMulti(titleArtist)
    );

  if (
    isSuspiciousArtistName(currentArtist) ||
    (channelLooksLikeCurrentArtist && titlePointsToAnotherArtist)
  ) {
    const repair = proposeMusicBrainArtistRepair(song);

    if (repair?.level === "safe") {
      return {
        status: "review",
        reason: "autofix_available",
        proposedArtistName: repair.proposedArtistName,
        consensusResolution: "auto_fixable",
        consensusConfidence: Math.max(92, repair.confidence),
        consensusSignals:
          repair.source === "TOPIC_CHANNEL"
            ? ["TITLE", "TOPIC"]
            : ["TITLE", "CHANNEL"],
      };
    }

    return {
      status: "review",
      reason:
        repair?.level === "review"
          ? "manual_artist_review"
          : titlePointsToAnotherArtist
            ? "artist_conflicts_with_youtube_title"
            : "suspicious_artist_identity",
      proposedArtistName:
        repair?.proposedArtistName ||
        (titlePointsToAnotherArtist ? titleArtist : undefined),
      consensusResolution: "manual_review",
      consensusConfidence: consensus.confidence,
      consensusSignals: consensus.signals,
    };
  }

  if (learning.reason === "fiable_a_verifier") {
    return {
      status: "review",
      reason: "manual_metadata_review",
      consensusResolution: "manual_review",
      consensusConfidence: consensus.confidence,
      consensusSignals: consensus.signals,
    };
  }

  return {
    status: "ready",
    reason: "musicbrain_validated",
    consensusResolution: "auto_validated",
    consensusConfidence: Math.max(80, consensus.confidence),
    consensusSignals: consensus.signals,
  };
}

function musicBrainThirdPassDecision(song: MusicBrainSong) {
  const publication = musicBrainPublicationDecision(song);

  if (publication.consensusResolution !== "manual_review") {
    return {
      resolution: publication.consensusResolution,
      proposedArtistName: publication.proposedArtistName,
      confidence: publication.consensusConfidence,
      signals: publication.consensusSignals,
      category: null as MusicBrainManualReviewCategory | null,
      reason: publication.reason,
    };
  }

  const category = musicBrainManualReviewCategory(song);
  const currentArtist = cleanArtistName(song.artistName || "");
  const titleArtist = cleanArtistName(
    artistFromTitlePrefix(song.rawTitle || song.title || "")
  );
  const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];
  const lrclibArtist =
    karaokeEntry?.kind === "synced"
      ? cleanArtistName(karaokeEntry.matchedArtistName || "")
      : "";
  const topicArtist = cleanArtistName(
    artistFromTopicChannel(song.channelTitle || "")
  );

  // 3e passe sûre :
  // agrégateur (ex. 7clouds) + titre + LRCLIB parfaitement concordants.
  if (
    category === "aggregator_channel" &&
    validConsensusArtist(titleArtist) &&
    validConsensusArtist(lrclibArtist) &&
    sameMusicBrainArtist(titleArtist, lrclibArtist)
  ) {
    return {
      resolution: "auto_fixable" as const,
      proposedArtistName: titleArtist,
      confidence: 97,
      signals: ["TITLE", "LRCLIB"] as MusicBrainConsensusSignal[],
      category,
      reason: "third_pass_aggregator_title_lrclib_consensus",
    };
  }

  // Topic + LRCLIB concordants vers le même artiste.
  if (
    validConsensusArtist(topicArtist) &&
    validConsensusArtist(lrclibArtist) &&
    sameMusicBrainArtist(topicArtist, lrclibArtist) &&
    !sameMusicBrainArtist(topicArtist, currentArtist)
  ) {
    return {
      resolution: "auto_fixable" as const,
      proposedArtistName: topicArtist,
      confidence: 98,
      signals: ["TOPIC", "LRCLIB"] as MusicBrainConsensusSignal[],
      category,
      reason: "third_pass_topic_lrclib_consensus",
    };
  }

  // QUERY_FALLBACK : on valide seulement si le titre brut contient l'artiste
  // actuel ET LRCLIB confirme exactement le même artiste.
  if (
    category === "query_fallback" &&
    validConsensusArtist(currentArtist) &&
    normalizeMusicQuery(song.rawTitle || song.title || "").includes(
      normalizeMusicQuery(currentArtist)
    ) &&
    validConsensusArtist(lrclibArtist) &&
    sameMusicBrainArtist(lrclibArtist, currentArtist)
  ) {
    return {
      resolution: "auto_validated" as const,
      proposedArtistName: undefined,
      confidence: 95,
      signals: ["TITLE_CURRENT", "LRCLIB"] as MusicBrainConsensusSignal[],
      category,
      reason: "third_pass_query_fallback_confirmed",
    };
  }

  return {
    resolution: "manual_review" as const,
    proposedArtistName: publication.proposedArtistName,
    confidence: publication.consensusConfidence,
    signals: publication.consensusSignals,
    category,
    reason: publication.reason,
  };
}


type MusicBrainAutoAcceptV35Action = "validate_current" | "correct_artist" | "manual";

type MusicBrainAutoAcceptV35Decision = {
  action: MusicBrainAutoAcceptV35Action;
  confidence: number;
  reason: string;
  proposedArtistName?: string;
  category: MusicBrainManualReviewCategory;
};

function musicBrainAutoAcceptV35Decision(
  song: MusicBrainSong
): MusicBrainAutoAcceptV35Decision {
  const publication = musicBrainPublicationDecision(song);

  if (publication.consensusResolution !== "manual_review") {
    return {
      action: "manual",
      confidence: publication.consensusConfidence,
      reason: "already_resolved",
      category: "other",
    };
  }

  const category = musicBrainManualReviewCategory(song);
  const currentArtist = cleanArtistName(song.artistName || "");
  const currentKey = normalizeMusicQuery(currentArtist);
  const rawTitle = String(song.rawTitle || song.title || "");
  const rawKey = normalizeMusicQuery(rawTitle);
  const lrclibEntry = karaokeLyricsAudit.entries[song.videoId];
  const lrclibArtist =
    lrclibEntry?.kind === "synced"
      ? cleanArtistName(lrclibEntry.matchedArtistName || "")
      : "";

  const proposedArtist = cleanArtistName(publication.proposedArtistName || "");
  const proposedValid =
    Boolean(proposedArtist) &&
    validConsensusArtist(proposedArtist) &&
    !repairArtistLooksMulti(proposedArtist);

  const lrclibSupportsProposed =
    proposedValid &&
    Boolean(lrclibArtist) &&
    (
      sameMusicBrainArtist(lrclibArtist, proposedArtist) ||
      artistParticipantMatch(lrclibArtist, proposedArtist)
    );

  const lrclibSupportsCurrent =
    Boolean(lrclibArtist) &&
    Boolean(currentArtist) &&
    (
      sameMusicBrainArtist(lrclibArtist, currentArtist) ||
      artistParticipantMatch(lrclibArtist, currentArtist)
    );

  const lrclibContradictsCurrent =
    Boolean(lrclibArtist) &&
    Boolean(currentArtist) &&
    !lrclibSupportsCurrent;

  const lrclibContradictsProposed =
    Boolean(lrclibArtist) &&
    proposedValid &&
    !lrclibSupportsProposed;

  // 1) Une correction déjà proposée par MusicBrain devient automatique
  // dès qu'elle est assez confiante ET qu'aucune source forte ne la contredit.
  if (
    proposedValid &&
    publication.consensusConfidence >= 80 &&
    !lrclibContradictsProposed
  ) {
    const enoughEvidence =
      publication.consensusSignals.length >= 2 ||
      lrclibSupportsProposed ||
      category === "metadata_conflict" ||
      category === "aggregator_channel";

    if (enoughEvidence) {
      return {
        action: "correct_artist",
        proposedArtistName: proposedArtist,
        confidence: Math.max(90, publication.consensusConfidence),
        reason: lrclibSupportsProposed
          ? "v35_proposal_confirmed_by_lrclib"
          : "v35_high_confidence_proposal_no_contradiction",
        category,
      };
    }
  }

  // 2) QUERY_FALLBACK : si l'artiste actuel est réellement écrit dans le titre
  // et qu'aucun LRCLIB ne le contredit, on arrête de demander une validation humaine.
  if (
    category === "query_fallback" &&
    currentKey &&
    rawKey.includes(currentKey) &&
    !lrclibContradictsCurrent &&
    publication.consensusConfidence >= 70
  ) {
    return {
      action: "validate_current",
      confidence: Math.max(90, publication.consensusConfidence),
      reason: lrclibSupportsCurrent
        ? "v35_query_fallback_title_lrclib_confirmed"
        : "v35_query_fallback_title_confirmed_no_contradiction",
      category,
    };
  }

  // 3) LRCLIB confirme exactement l'artiste actuel : validation automatique,
  // même si la source initiale était faible.
  if (
    lrclibSupportsCurrent &&
    publication.consensusConfidence >= 60
  ) {
    return {
      action: "validate_current",
      confidence: Math.max(92, publication.consensusConfidence),
      reason: "v35_current_artist_confirmed_by_lrclib",
      category,
    };
  }

  // 4) Les cas réellement contradictoires restent manuels :
  // exemple MHD vs Black Eyed Peas/Shakira.
  return {
    action: "manual",
    confidence: publication.consensusConfidence,
    reason: lrclibContradictsCurrent
      ? "v35_strong_lrclib_conflict"
      : "v35_not_enough_evidence",
    proposedArtistName: publication.proposedArtistName,
    category,
  };
}

function applyMusicBrainAutoAcceptV35Correction(
  song: MusicBrainSong,
  proposedArtistName: string,
  reason: string
) {
  const newArtistName = cleanArtistName(proposedArtistName);
  const newArtistKey = normalizeMusicQuery(newArtistName);

  if (!newArtistKey || !validConsensusArtist(newArtistName)) return false;

  const oldArtistKey = song.artistKey;

  if (oldArtistKey !== newArtistKey) {
    const oldArtist = musicBrain.artists[oldArtistKey];
    if (oldArtist?.songs?.[song.videoId]) {
      delete oldArtist.songs[song.videoId];
    }

    song.artistName = newArtistName;
    song.artistKey = newArtistKey;
    song.title = cleanTrackTitle(song.rawTitle || song.title, newArtistName);

    const now = Date.now();
    const targetArtist = musicBrain.artists[newArtistKey] || {
      key: newArtistKey,
      name: newArtistName,
      aliases: [],
      collaborators: {},
      firstSeenAt: song.firstSeenAt || now,
      lastSeenAt: now,
      searchCount: 0,
      songs: {},
    };

    targetArtist.name = newArtistName;
    targetArtist.lastSeenAt = now;
    targetArtist.songs[song.videoId] = song;
    musicBrain.artists[newArtistKey] = targetArtist;
    removeEmptyMusicBrainArtist(oldArtistKey);
  }

  song.manualValidatedAt = undefined;
  song.manualValidationCategory = undefined;
  song.autoAcceptedAt = Date.now();
  song.autoAcceptReason = reason;
  song.metadataConfidence = Math.max(Number(song.metadataConfidence || 0), 95);
  song.lastSeenAt = Date.now();

  const karaokeEntry = karaokeAudit.entries[song.videoId];
  if (karaokeEntry) karaokeEntry.sourceArtistName = newArtistName;

  return true;
}

function musicBrainAutoAcceptV35Preview() {
  let validateCurrent = 0;
  let correctArtist = 0;
  let stillManual = 0;

  const examples: any[] = [];

  for (const song of Object.values(musicBrain.songs)) {
    const publication = musicBrainPublicationDecision(song);
    if (publication.consensusResolution !== "manual_review") continue;

    const decision = musicBrainAutoAcceptV35Decision(song);

    if (decision.action === "validate_current") validateCurrent += 1;
    else if (decision.action === "correct_artist") correctArtist += 1;
    else stillManual += 1;

    if (examples.length < 300) {
      examples.push({
        videoId: song.videoId,
        title: song.title,
        artistName: song.artistName,
        channelTitle: song.channelTitle || "",
        action: decision.action,
        proposedArtistName: decision.proposedArtistName || "",
        confidence: decision.confidence,
        reason: decision.reason,
        category: decision.category,
        lrclibArtistName:
          karaokeLyricsAudit.entries[song.videoId]?.kind === "synced"
            ? karaokeLyricsAudit.entries[song.videoId]?.matchedArtistName || ""
            : "",
      });
    }
  }

  return {
    generatedAt: Date.now(),
    validateCurrent,
    correctArtist,
    autoAcceptable: validateCurrent + correctArtist,
    stillManual,
    totalReviewed: validateCurrent + correctArtist + stillManual,
    examples,
    policy: {
      minimumProposalConfidence: 80,
      note:
        "V3.5 accepte automatiquement les propositions cohérentes sans contradiction forte. Les conflits LRCLIB réels restent manuels.",
    },
  };
}

function musicBrainPublicationSummary() {
  const summary = {
    ready: 0,
    review: 0,
    blocked: 0,
    autoValidated: 0,
    autoFixable: 0,
    manualReview: 0,
    secondPassValidated: 0,
    thirdPassResolved: 0,
    karaokeSyncedReady: 0,
    karaokeSyncedReview: 0,
    karaokeSyncedBlocked: 0,
    karaokeAutoFixable: 0,
    karaokeManualReview: 0,
  };

  for (const song of Object.values(musicBrain.songs)) {
    const decision = musicBrainPublicationDecision(song);
    summary[decision.status] += 1;

    if (decision.consensusResolution === "auto_validated") {
      summary.autoValidated += 1;
      if (
        decision.reason === "autovalidated_consensus" &&
        (
          decision.consensusSignals.includes("KNOWN_ALIAS") ||
          decision.consensusSignals.includes("LRCLIB_PARTICIPANT") ||
          decision.consensusSignals.includes("TITLE_CURRENT")
        )
      ) {
        summary.secondPassValidated += 1;
      }
    } else if (decision.consensusResolution === "auto_fixable") {
      summary.autoFixable += 1;
    } else if (decision.consensusResolution === "manual_review") {
      summary.manualReview += 1;
    }

    const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];
    if (karaokeEntry?.kind === "synced") {
      if (decision.status === "ready") summary.karaokeSyncedReady += 1;
      else if (decision.status === "review") summary.karaokeSyncedReview += 1;
      else summary.karaokeSyncedBlocked += 1;

      if (decision.consensusResolution === "auto_fixable") {
        summary.karaokeAutoFixable += 1;
      } else if (decision.consensusResolution === "manual_review") {
        summary.karaokeManualReview += 1;
      }
    }
  }

  return {
    generatedAt: Date.now(),
    ...summary,
    total: summary.ready + summary.review + summary.blocked,
    karaokeSyncedTotal:
      summary.karaokeSyncedReady +
      summary.karaokeSyncedReview +
      summary.karaokeSyncedBlocked,
  };
}

function removeEmptyMusicBrainArtist(artistKey: string) {
  const artist = musicBrain.artists[artistKey];
  if (!artist || Object.keys(artist.songs || {}).length > 0) return;

  delete musicBrain.artists[artistKey];

  for (const [relationKeyValue, relation] of Object.entries(musicBrain.artistRelations)) {
    if (relation.fromKey === artistKey || relation.toKey === artistKey) {
      delete musicBrain.artistRelations[relationKeyValue];
    }
  }

  for (const otherArtist of Object.values(musicBrain.artists)) {
    if (otherArtist.collaborators?.[artistKey]) {
      delete otherArtist.collaborators[artistKey];
    }
  }
}

function applyMusicBrainArtistRepair(proposal: MusicBrainArtistRepairProposal) {
  const song = musicBrain.songs[proposal.videoId];
  if (!song) return false;

  // On recalcule au moment de l'action pour ne jamais appliquer une proposition obsolète.
  const freshProposal = proposeMusicBrainArtistRepair(song);
  if (
    !freshProposal ||
    freshProposal.level !== "safe" ||
    proposal.level !== "safe" ||
    freshProposal.proposedArtistName !== proposal.proposedArtistName ||
    freshProposal.source !== proposal.source
  ) {
    return false;
  }

  const oldArtistKey = song.artistKey;
  const newArtistName = cleanArtistName(freshProposal.proposedArtistName);
  const newArtistKey = normalizeMusicQuery(newArtistName);
  if (!newArtistKey || newArtistKey === oldArtistKey) return false;

  const oldArtist = musicBrain.artists[oldArtistKey];
  if (oldArtist?.songs?.[song.videoId]) {
    delete oldArtist.songs[song.videoId];
  }

  song.artistName = newArtistName;
  song.artistKey = newArtistKey;
  song.manualValidatedAt = undefined;
  song.manualValidationCategory = undefined;
  song.autoAcceptedAt = undefined;
  song.autoAcceptReason = undefined;
  song.title = cleanTrackTitle(song.rawTitle || song.title, newArtistName);
  song.metadataConfidence = Math.max(
    Number(song.metadataConfidence || 0),
    freshProposal.confidence
  );
  song.lastSeenAt = Date.now();

  const now = Date.now();
  const targetArtist = musicBrain.artists[newArtistKey] || {
    key: newArtistKey,
    name: newArtistName,
    aliases: [],
    collaborators: {},
    firstSeenAt: song.firstSeenAt || now,
    lastSeenAt: now,
    searchCount: 0,
    songs: {},
  };

  targetArtist.name = newArtistName;
  targetArtist.lastSeenAt = now;
  targetArtist.songs[song.videoId] = song;
  musicBrain.artists[newArtistKey] = targetArtist;

  removeEmptyMusicBrainArtist(oldArtistKey);

  const auditEntry = karaokeAudit.entries[song.videoId];
  if (auditEntry) {
    auditEntry.sourceArtistName = newArtistName;
  }

  return true;
}


function applySelectedMusicBrainArtistRepair(videoId: string, proposedArtistName: string) {
  const song = musicBrain.songs[videoId];
  if (!song) return { ok: false, reason: "morceau_introuvable" };

  const freshProposal = proposeMusicBrainArtistRepair(song);
  if (!freshProposal || freshProposal.level !== "review") {
    return { ok: false, reason: "proposition_non_valide" };
  }

  const expectedKey = normalizeMusicQuery(freshProposal.proposedArtistName);
  const requestedKey = normalizeMusicQuery(proposedArtistName);
  if (!expectedKey || expectedKey !== requestedKey) {
    return { ok: false, reason: "proposition_modifiee" };
  }

  const oldArtistKey = song.artistKey;
  const newArtistName = cleanArtistName(freshProposal.proposedArtistName);
  const newArtistKey = normalizeMusicQuery(newArtistName);
  if (!newArtistKey || newArtistKey === oldArtistKey) {
    return { ok: false, reason: "aucun_changement" };
  }

  const oldArtist = musicBrain.artists[oldArtistKey];
  if (oldArtist?.songs?.[song.videoId]) {
    delete oldArtist.songs[song.videoId];
  }

  song.artistName = newArtistName;
  song.artistKey = newArtistKey;
  song.title = cleanTrackTitle(song.rawTitle || song.title, newArtistName);
  song.metadataConfidence = Math.max(Number(song.metadataConfidence || 0), 95);
  song.lastSeenAt = Date.now();

  const now = Date.now();
  const targetArtist = musicBrain.artists[newArtistKey] || {
    key: newArtistKey,
    name: newArtistName,
    aliases: [],
    collaborators: {},
    firstSeenAt: song.firstSeenAt || now,
    lastSeenAt: now,
    searchCount: 0,
    songs: {},
  };

  targetArtist.name = newArtistName;
  targetArtist.lastSeenAt = now;
  targetArtist.songs[song.videoId] = song;
  musicBrain.artists[newArtistKey] = targetArtist;

  removeEmptyMusicBrainArtist(oldArtistKey);

  const auditEntry = karaokeAudit.entries[song.videoId];
  if (auditEntry) {
    auditEntry.sourceArtistName = newArtistName;
  }

  return {
    ok: true,
    videoId: song.videoId,
    oldArtistName: freshProposal.currentArtistName,
    newArtistName,
  };
}

function repairMusicBrainArtists() {
  const before = musicBrainArtistRepairReport();
  let repaired = 0;

  for (const proposal of before.safeRepairs) {
    if (applyMusicBrainArtistRepair(proposal)) repaired += 1;
  }

  musicBrain.updatedAt = Date.now();
  saveMusicBrain();
  saveKaraokeAudit();

  const after = musicBrainArtistRepairReport();

  return {
    repaired,
    before,
    after,
  };
}

app.post("/partybrain/maintenance/musicbrain-artist-repair/preview", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;
  return res.json({
    ok: true,
    report: musicBrainArtistRepairReport(),
  });
});

app.post("/partybrain/maintenance/musicbrain-artist-repair/run", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const result = repairMusicBrainArtists();
  return res.json({
    ok: true,
    ...result,
    message: `${result.repaired} réparation(s) sûre(s) appliquée(s). ${result.after.reviewProposalCount} proposition(s) restent à vérifier et ${result.after.unresolvedCount} restent non résolue(s).`,
  });
});

type MusicBrainCleanupReason =
  | "artiste_inconnu"
  | "artiste_generique"
  | "contenu_non_musical";

type MusicBrainReviewCategory =
  | "artiste_probablement_mal_attribue"
  | "nom_artiste_tres_court"
  | "query_fallback"
  | "confiance_tres_faible"
  | "confiance_faible"
  | "chaine_non_coherente"
  | "identite_non_confirmee";

function classifyMusicBrainReviewSong(song: MusicBrainSong, decisionReason: string): {
  category: MusicBrainReviewCategory;
  categoryLabel: string;
  explanation: string;
} {
  const artistName = String(song.artistName || "").trim();
  const artistKey = normalizeMusicQuery(artistName);
  const channel = String(song.channelTitle || "").trim();
  const channelKey = normalizeMusicQuery(channel);
  const confidence = Number(song.metadataConfidence || 0);

  const artistChannelMatch = Boolean(
    artistKey &&
    channelKey &&
    (channelKey.includes(artistKey) || artistKey.includes(channelKey))
  );

  const trustedChannel = /\b(topic|vevo|official|officiel)\b/i.test(channel);

  const titleKey = normalizeMusicQuery(`${song.rawTitle || ""} ${song.title || ""}`);
  const artistTitleMatch = Boolean(
    artistKey &&
    titleKey &&
    titleKey.includes(artistKey)
  );

  const repairProposal = proposeMusicBrainArtistRepair(song);
  if (isSuspiciousArtistName(song.artistName) && repairProposal) {
    return {
      category: "artiste_probablement_mal_attribue",
      categoryLabel: "Artiste probablement mal attribué",
      explanation: `${song.artistName} peut être réparé en ${repairProposal.proposedArtistName} grâce à : ${repairProposal.sourceLabel}.`,
    };
  }

  if (artistKey.length > 0 && artistKey.length <= 3) {
    return {
      category: "nom_artiste_tres_court",
      categoryLabel: "Nom artiste très court",
      explanation: "Le nom détecté fait 3 caractères ou moins et aucun signal assez fort ne confirme encore qu’il s’agit bien de l’artiste.",
    };
  }

  if (song.metadataSource === "QUERY_FALLBACK" && !artistTitleMatch && !artistChannelMatch) {
    return {
      category: "query_fallback",
      categoryLabel: "Artiste déduit de la recherche",
      explanation: "L’artiste provient surtout du texte de recherche et n’est confirmé ni par le titre YouTube ni par la chaîne.",
    };
  }

  if (confidence < 35 && !artistTitleMatch && !artistChannelMatch) {
    return {
      category: "confiance_tres_faible",
      categoryLabel: "Confiance très faible",
      explanation: `Confiance métadonnées ${Math.round(confidence)} %. L’identité du morceau est trop incertaine pour être apprise automatiquement.`,
    };
  }

  if (confidence < 65) {
    return {
      category: "confiance_faible",
      categoryLabel: "Confiance faible",
      explanation: `Confiance métadonnées ${Math.round(confidence)} %. Le morceau peut être correct, mais PartyBrain manque de preuves.`,
    };
  }

  if (!artistChannelMatch && !trustedChannel) {
    return {
      category: "chaine_non_coherente",
      categoryLabel: "Chaîne non cohérente",
      explanation: "Le nom de la chaîne YouTube ne confirme pas clairement l’artiste détecté.",
    };
  }

  return {
    category: "identite_non_confirmee",
    categoryLabel: "Identité non confirmée",
    explanation:
      decisionReason === "metadata_faible"
        ? "Les métadonnées sont insuffisantes pour apprendre automatiquement ce morceau."
        : "Plusieurs signaux existent, mais pas assez pour confirmer l’identité avec certitude.",
  };
}

function musicBrainCleanupReport() {
  const removable: Array<{
    videoId: string;
    title: string;
    artistName: string;
    reason: MusicBrainCleanupReason;
    searchCount: number;
    addedCount: number;
    playedCount: number;
    voteCount: number;
  }> = [];

  const reviewOnly: Array<{
    videoId: string;
    title: string;
    rawTitle?: string;
    artistName: string;
    channelTitle?: string;
    metadataSource?: MusicMetadataSource;
    metadataConfidence?: number;
    reason: string;
    category: MusicBrainReviewCategory;
    categoryLabel: string;
    explanation: string;
    searchCount: number;
    addedCount: number;
    playedCount: number;
    voteCount: number;
  }> = [];

  const counts: Record<string, number> = {
    artiste_inconnu: 0,
    artiste_generique: 0,
    contenu_non_musical: 0,
    metadata_faible: 0,
    identite_non_confirmee: 0,
  };

  const reviewCategoryCounts: Record<MusicBrainReviewCategory, number> = {
    artiste_probablement_mal_attribue: 0,
    nom_artiste_tres_court: 0,
    query_fallback: 0,
    confiance_tres_faible: 0,
    confiance_faible: 0,
    chaine_non_coherente: 0,
    identite_non_confirmee: 0,
  };

  for (const song of Object.values(musicBrain.songs)) {
    const decision = musicBrainLearningDecision({
      artistName: song.artistName,
      channelTitle: song.channelTitle,
      title: song.title,
      rawTitle: song.rawTitle,
      metadataSource: song.metadataSource,
      metadataConfidence: song.metadataConfidence,
    });

    const confidence = Number(song.metadataConfidence || 0);
    const channel = String(song.channelTitle || "");
    const artistKey = normalizeMusicQuery(song.artistName || "");
    const channelKey = normalizeMusicQuery(channel);
    const titleKey = normalizeMusicQuery(`${song.rawTitle || ""} ${song.title || ""}`);

    const artistChannelMatch = Boolean(
      artistKey &&
      channelKey &&
      (channelKey.includes(artistKey) || artistKey.includes(channelKey))
    );

    const artistTitleMatch = Boolean(
      artistKey &&
      titleKey &&
      titleKey.includes(artistKey)
    );

    const trustedChannel = /\b(topic|vevo|official|officiel)\b/i.test(channel);
    const strongMetadata =
      song.metadataSource === "ART_TRACK_DESCRIPTION" ||
      confidence >= 72;

    // Une faible confiance ou QUERY_FALLBACK ne suffit plus du tout à mettre
    // un vrai artiste en "à vérifier".
    // Exemple : "Charles Aznavour - Hier encore" confirme déjà Aznavour dans le titre,
    // même si la chaîne YouTube est un festival et que la confiance vaut 1 %.
    const positivelyConfirmed =
      artistTitleMatch ||
      artistChannelMatch ||
      trustedChannel ||
      strongMetadata;

    // Les noms très courts restent à vérifier sauf signal fort,
    // car "ART", "TV", "DJ"... sont particulièrement ambigus.
    const veryShortArtist = artistKey.length > 0 && artistKey.length <= 3;
    const shortNameConfirmed =
      veryShortArtist &&
      (artistChannelMatch || trustedChannel || strongMetadata);

    const shouldReview =
      !decision.learn ||
      (veryShortArtist ? !shortNameConfirmed : !positivelyConfirmed);

    if (decision.learn && !shouldReview) continue;

    if (!decision.learn) {
      counts[decision.reason] = (counts[decision.reason] || 0) + 1;
    }

    const basic = {
      videoId: song.videoId,
      title: song.title,
      artistName: song.artistName,
    };

    // Nettoyage automatique volontairement conservateur :
    // on supprime seulement les erreurs évidentes.
    if (
      !decision.learn &&
      (
        decision.reason === "artiste_inconnu" ||
        decision.reason === "artiste_generique" ||
        decision.reason === "contenu_non_musical"
      )
    ) {
      removable.push({
        ...basic,
        reason: decision.reason as MusicBrainCleanupReason,
        searchCount: Number(song.searchCount || 0),
        addedCount: Number(song.addedCount || 0),
        playedCount: Number(song.playedCount || 0),
        voteCount: Number(song.voteCount || 0),
      });
    } else {
      const classification = classifyMusicBrainReviewSong(
        song,
        decision.reason === "fiable_a_verifier" ? "metadata_faible" : decision.reason
      );
      reviewCategoryCounts[classification.category] += 1;

      reviewOnly.push({
        ...basic,
        rawTitle: song.rawTitle,
        channelTitle: song.channelTitle,
        metadataSource: song.metadataSource,
        metadataConfidence: song.metadataConfidence,
        reason: decision.reason,
        category: classification.category,
        categoryLabel: classification.categoryLabel,
        explanation: classification.explanation,
        searchCount: Number(song.searchCount || 0),
        addedCount: Number(song.addedCount || 0),
        playedCount: Number(song.playedCount || 0),
        voteCount: Number(song.voteCount || 0),
      });
    }
  }

  removable.sort((a, b) => {
    const activityA = a.playedCount * 5 + a.addedCount * 4 + a.voteCount * 3 + a.searchCount;
    const activityB = b.playedCount * 5 + b.addedCount * 4 + b.voteCount * 3 + b.searchCount;
    return activityB - activityA;
  });

  return {
    generatedAt: Date.now(),
    totalSongs: Object.keys(musicBrain.songs).length,
    removableCount: removable.length,
    reviewOnlyCount: reviewOnly.length,
    counts,
    reviewCategoryCounts,
    examples: removable.slice(0, 30),
    reviewExamples: reviewOnly.slice(0, 20),
    reviewItems: reviewOnly
      .sort((a, b) => {
        const confidenceA = Number(a.metadataConfidence || 0);
        const confidenceB = Number(b.metadataConfidence || 0);
        if (confidenceA !== confidenceB) return confidenceA - confidenceB;

        const activityA = a.playedCount * 5 + a.addedCount * 4 + a.voteCount * 3 + a.searchCount;
        const activityB = b.playedCount * 5 + b.addedCount * 4 + b.voteCount * 3 + b.searchCount;
        return activityB - activityA;
      })
      .slice(0, 1000),
    policy:
      "Suppression automatique uniquement des erreurs évidentes. Une entrée n’est classée à vérifier que si aucun signal fiable (titre, chaîne, Topic/Official ou métadonnées fortes) ne confirme l’artiste.",
  };
}

function cleanMusicBrainDatabase() {
  const report = musicBrainCleanupReport();
  const removedVideoIds = new Set(report.examples.map(() => "")); // remplacé juste après
  removedVideoIds.clear();

  // Recalcule la liste complète, pas seulement les exemples.
  for (const song of Object.values(musicBrain.songs)) {
    const decision = musicBrainLearningDecision({
      artistName: song.artistName,
      channelTitle: song.channelTitle,
      title: song.title,
      rawTitle: song.rawTitle,
      metadataSource: song.metadataSource,
      metadataConfidence: song.metadataConfidence,
    });

    if (
      !decision.learn &&
      (
        decision.reason === "artiste_inconnu" ||
        decision.reason === "artiste_generique" ||
        decision.reason === "contenu_non_musical"
      )
    ) {
      removedVideoIds.add(song.videoId);
    }
  }

  const removedArtistKeys = new Set<string>();

  for (const videoId of removedVideoIds) {
    const song = musicBrain.songs[videoId];
    if (!song) continue;

    delete musicBrain.songs[videoId];

    const artist = musicBrain.artists[song.artistKey];
    if (artist?.songs) {
      delete artist.songs[videoId];
      if (!Object.keys(artist.songs).length) {
        delete musicBrain.artists[song.artistKey];
        removedArtistKeys.add(song.artistKey);
      }
    }

    if (karaokeAudit.entries[videoId]) {
      delete karaokeAudit.entries[videoId];
    }
  }

  for (const [key, transition] of Object.entries(musicBrain.transitions)) {
    if (
      removedVideoIds.has(transition.fromVideoId) ||
      removedVideoIds.has(transition.toVideoId)
    ) {
      delete musicBrain.transitions[key];
    }
  }

  for (const [key, relation] of Object.entries(musicBrain.artistRelations)) {
    if (
      removedArtistKeys.has(relation.fromKey) ||
      removedArtistKeys.has(relation.toKey)
    ) {
      delete musicBrain.artistRelations[key];
    }
  }

  // Supprime aussi les références de collaborateurs vers des artistes disparus.
  for (const artist of Object.values(musicBrain.artists)) {
    for (const collaboratorKey of Object.keys(artist.collaborators || {})) {
      if (removedArtistKeys.has(collaboratorKey)) {
        delete artist.collaborators[collaboratorKey];
      }
    }
  }

  musicBrain.updatedAt = Date.now();
  saveMusicBrain();
  saveKaraokeAudit();

  return {
    deletedSongs: removedVideoIds.size,
    deletedArtists: removedArtistKeys.size,
    remainingSongs: Object.keys(musicBrain.songs).length,
    remainingArtists: Object.keys(musicBrain.artists).length,
  };
}


function applyMusicBrainConsensusArtistCorrection(
  videoId: string,
  proposedArtistName: string,
  confidence: number
) {
  const song = musicBrain.songs[videoId];
  if (!song) return false;

  const automaticAction = musicBrainAutomaticActionDecision(song);

  if (
    automaticAction.action !== "correct" ||
    !automaticAction.proposedArtistName ||
    !sameMusicBrainArtist(
      automaticAction.proposedArtistName,
      proposedArtistName
    )
  ) {
    return false;
  }

  const oldArtistKey = song.artistKey;
  const newArtistName = cleanArtistName(automaticAction.proposedArtistName);
  const newArtistKey = normalizeMusicQuery(newArtistName);

  if (!newArtistKey || newArtistKey === oldArtistKey) return false;

  const oldArtist = musicBrain.artists[oldArtistKey];
  if (oldArtist?.songs?.[song.videoId]) {
    delete oldArtist.songs[song.videoId];
  }

  song.artistName = newArtistName;
  song.artistKey = newArtistKey;
  song.title = cleanTrackTitle(song.rawTitle || song.title, newArtistName);
  song.metadataConfidence = Math.max(
    Number(song.metadataConfidence || 0),
    Number(confidence || 0),
    automaticAction.confidence,
    95
  );
  song.lastSeenAt = Date.now();

  const now = Date.now();
  const targetArtist = musicBrain.artists[newArtistKey] || {
    key: newArtistKey,
    name: newArtistName,
    aliases: [],
    collaborators: {},
    firstSeenAt: song.firstSeenAt || now,
    lastSeenAt: now,
    searchCount: 0,
    songs: {},
  };

  targetArtist.name = newArtistName;
  targetArtist.lastSeenAt = now;
  targetArtist.songs[song.videoId] = song;
  musicBrain.artists[newArtistKey] = targetArtist;

  removeEmptyMusicBrainArtist(oldArtistKey);

  const karaokeEntry = karaokeAudit.entries[song.videoId];
  if (karaokeEntry) {
    karaokeEntry.sourceArtistName = newArtistName;
  }

  return true;
}

function musicBrainAutoFixPreview() {
  const before = musicBrainPublicationSummary();

  const actionable: Array<{
    videoId: string;
    title: string;
    rawTitle: string;
    currentArtistName: string;
    proposedArtistName: string;
    confidence: number;
    signals: MusicBrainConsensusSignal[];
    karaokeSynced: boolean;
    reason: string;
  }> = [];

  const manual: Array<{
    videoId: string;
    title: string;
    artistName: string;
    proposedArtistName?: string;
    confidence: number;
    signals: MusicBrainConsensusSignal[];
    karaokeSynced: boolean;
    reason: string;
  }> = [];

  for (const song of Object.values(musicBrain.songs)) {
    const action = musicBrainAutomaticActionDecision(song);
    const karaokeSynced =
      karaokeLyricsAudit.entries[song.videoId]?.kind === "synced";

    if (action.action === "correct" && action.proposedArtistName) {
      actionable.push({
        videoId: song.videoId,
        title: song.title,
        rawTitle: song.rawTitle || song.title,
        currentArtistName: song.artistName,
        proposedArtistName: action.proposedArtistName,
        confidence: action.confidence,
        signals: action.signals,
        karaokeSynced,
        reason: action.reason,
      });
      continue;
    }

    const publication = musicBrainPublicationDecision(song);
    if (publication.consensusResolution === "manual_review") {
      manual.push({
        videoId: song.videoId,
        title: song.title,
        artistName: song.artistName,
        proposedArtistName: publication.proposedArtistName,
        confidence: publication.consensusConfidence,
        signals: publication.consensusSignals,
        karaokeSynced,
        reason: publication.reason,
      });
    }
  }

  actionable.sort((a, b) => {
    if (a.karaokeSynced !== b.karaokeSynced) {
      return Number(b.karaokeSynced) - Number(a.karaokeSynced);
    }
    return b.confidence - a.confidence;
  });

  manual.sort((a, b) => {
    if (a.karaokeSynced !== b.karaokeSynced) {
      return Number(b.karaokeSynced) - Number(a.karaokeSynced);
    }
    return b.confidence - a.confidence;
  });

  return {
    generatedAt: Date.now(),
    before,
    autoFixableCount: actionable.length,
    manualReviewCount: manual.length,
    corrections: actionable.slice(0, 1000),
    manualPreview: manual.slice(0, 300),
    policy: {
      minimumConfidence: 90,
      minimumIndependentSignals: 2,
      note:
        "V3.2 applique exactement la décision déjà affichée comme Auto-corrigeable dans l'onglet Qualité.",
    },
  };
}

app.get("/partybrain/musicbrain-quality/diagnostic", (_req, res) => {
  const categoryCounts: Record<string, number> = {};
  const examples: Record<string, any[]> = {};
  let thirdPassAutoFixable = 0;
  let thirdPassAutoValidated = 0;
  let stillManual = 0;

  for (const song of Object.values(musicBrain.songs)) {
    const publication = musicBrainPublicationDecision(song);
    if (publication.consensusResolution !== "manual_review") continue;

    const thirdPass = musicBrainThirdPassDecision(song);

    if (thirdPass.resolution === "auto_fixable") {
      thirdPassAutoFixable += 1;
      continue;
    }

    if (thirdPass.resolution === "auto_validated") {
      thirdPassAutoValidated += 1;
      continue;
    }

    stillManual += 1;
    const category = thirdPass.category || "other";
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    if (!examples[category]) examples[category] = [];
    if (examples[category].length < 12) {
      const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];
      examples[category].push({
        videoId: song.videoId,
        title: song.title,
        artistName: song.artistName,
        channelTitle: song.channelTitle || "",
        metadataSource: song.metadataSource || "",
        metadataConfidence: Number(song.metadataConfidence || 0),
        proposedArtistName: thirdPass.proposedArtistName || "",
        confidence: thirdPass.confidence,
        karaokeSynced: karaokeEntry?.kind === "synced",
        lrclibArtistName:
          karaokeEntry?.kind === "synced"
            ? karaokeEntry.matchedArtistName || ""
            : "",
      });
    }
  }

  const categories = Object.entries(categoryCounts)
    .map(([key, count]) => ({
      key,
      label: musicBrainManualReviewCategoryLabel(
        key as MusicBrainManualReviewCategory
      ),
      count,
      examples: examples[key] || [],
    }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    generatedAt: Date.now(),
    thirdPassAutoFixable,
    thirdPassAutoValidated,
    thirdPassResolved: thirdPassAutoFixable + thirdPassAutoValidated,
    stillManual,
    categories,
    note:
      "Le diagnostic groupe uniquement les cas encore ambigus après les trois passes. Aucune règle n'abaisse le seuil de sécurité.",
  });
});

app.get("/partybrain/musicbrain-second-pass/preview", (_req, res) => {
  const summary = musicBrainPublicationSummary();
  const remaining = Object.values(musicBrain.songs)
    .map((song) => {
      const decision = musicBrainPublicationDecision(song);
      if (decision.consensusResolution !== "manual_review") return null;

      const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];
      return {
        videoId: song.videoId,
        title: song.title,
        artistName: song.artistName,
        channelTitle: song.channelTitle || "",
        metadataSource: song.metadataSource || "",
        metadataConfidence: Number(song.metadataConfidence || 0),
        karaokeSynced: karaokeEntry?.kind === "synced",
        lrclibArtistName:
          karaokeEntry?.kind === "synced"
            ? karaokeEntry.matchedArtistName || ""
            : "",
        reason: decision.reason,
      };
    })
    .filter(Boolean);

  return res.json({
    generatedAt: Date.now(),
    summary,
    remainingManualCount: remaining.length,
    remaining: remaining.slice(0, 300),
    note:
      "V3.1 applique une seconde passe locale et sûre. Aucun appel YouTube et aucune correction forcée des cas encore ambigus.",
  });
});

app.get("/partybrain/musicbrain-autofix/preview", (_req, res) => {
  return res.json(musicBrainAutoFixPreview());
});

app.post("/partybrain/maintenance/musicbrain-autofix/run", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const before = musicBrainPublicationSummary();
  const candidates = Object.values(musicBrain.songs)
    .map((song) => {
      const action = musicBrainAutomaticActionDecision(song);
      return { song, action };
    })
    .filter(
      (entry) =>
        entry.action.action === "correct" &&
        Boolean(entry.action.proposedArtistName)
    );

  let corrected = 0;
  const correctedItems: Array<{
    videoId: string;
    from: string;
    to: string;
    confidence: number;
    signals: MusicBrainConsensusSignal[];
  }> = [];

  for (const { song, action } of candidates) {
    const fromArtist = song.artistName;
    const proposed = String(action.proposedArtistName || "");

    if (
      applyMusicBrainConsensusArtistCorrection(
        song.videoId,
        proposed,
        action.confidence
      )
    ) {
      corrected += 1;
      correctedItems.push({
        videoId: song.videoId,
        from: fromArtist,
        to: proposed,
        confidence: action.confidence,
        signals: action.signals,
      });
    }
  }

  musicBrain.updatedAt = Date.now();
  saveMusicBrain();
  saveKaraokeAudit();

  const after = musicBrainPublicationSummary();

  return res.json({
    ok: true,
    corrected,
    correctedItems: correctedItems.slice(0, 500),
    before,
    after,
    message:
      `${corrected} correction(s) sûre(s) appliquée(s) automatiquement. ` +
      `${after.manualReview} morceau(x) restent réellement à vérifier par toi.`,
  });
});



app.post("/partybrain/maintenance/musicbrain-category-validation/apply", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const category = String(req.body?.category || "").trim();
  const mode = String(req.body?.mode || "selected").trim();
  const requestedVideoIds = Array.isArray(req.body?.videoIds)
    ? req.body.videoIds
        .map((value: unknown) => String(value || "").trim())
        .filter(Boolean)
    : [];

  if (!category) {
    return res.status(400).json({ error: "Catégorie de validation manquante." });
  }

  const candidates = Object.values(musicBrain.songs).filter((song) => {
    const publication = musicBrainPublicationDecision(song);
    return (
      publication.consensusResolution === "manual_review" &&
      musicBrainManualReviewCategory(song) === category
    );
  });

  const selected =
    mode === "all"
      ? candidates
      : candidates.filter((song) => requestedVideoIds.includes(song.videoId));

  if (!selected.length) {
    return res.status(400).json({
      error: "Aucun morceau sélectionné dans cette catégorie.",
    });
  }

  const validatedAt = Date.now();

  for (const song of selected) {
    // Validation humaine = l'identité actuellement affichée est confirmée.
    // Aucun changement de titre ou d'artiste.
    song.metadataConfidence = Math.max(
      Number(song.metadataConfidence || 0),
      99
    );
    song.manualValidatedAt = validatedAt;
    song.manualValidationCategory = category;
    song.lastSeenAt = validatedAt;

    const artist = musicBrain.artists[song.artistKey];
    if (artist) {
      artist.lastSeenAt = validatedAt;
    }
  }

  musicBrain.updatedAt = validatedAt;
  saveMusicBrain();

  const remainingInCategory = Object.values(musicBrain.songs).filter((song) => {
    const publication = musicBrainPublicationDecision(song);
    return (
      publication.consensusResolution === "manual_review" &&
      musicBrainManualReviewCategory(song) === category
    );
  }).length;

  return res.json({
    ok: true,
    category,
    mode,
    validated: selected.length,
    remainingInCategory,
    message:
      `${selected.length} morceau(x) validé(s) dans « ${musicBrainManualReviewCategoryLabel(
        category as MusicBrainManualReviewCategory
      )} ». ${remainingInCategory} restent à vérifier dans cette catégorie.`,
    summary: musicBrainPublicationSummary(),
  });
});


app.get("/partybrain/musicbrain-auto-accept-v35/preview", (_req, res) => {
  return res.json(musicBrainAutoAcceptV35Preview());
});

app.post("/partybrain/maintenance/musicbrain-auto-accept-v35/run", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const before = musicBrainAutoAcceptV35Preview();

  let validatedCurrent = 0;
  let correctedArtist = 0;

  const candidates = Object.values(musicBrain.songs).filter((song) => {
    const publication = musicBrainPublicationDecision(song);
    return publication.consensusResolution === "manual_review";
  });

  for (const song of candidates) {
    const decision = musicBrainAutoAcceptV35Decision(song);

    if (decision.action === "validate_current") {
      song.autoAcceptedAt = Date.now();
      song.autoAcceptReason = decision.reason;
      song.metadataConfidence = Math.max(
        Number(song.metadataConfidence || 0),
        decision.confidence,
        90
      );
      song.lastSeenAt = Date.now();
      validatedCurrent += 1;
      continue;
    }

    if (
      decision.action === "correct_artist" &&
      decision.proposedArtistName &&
      applyMusicBrainAutoAcceptV35Correction(
        song,
        decision.proposedArtistName,
        decision.reason
      )
    ) {
      correctedArtist += 1;
    }
  }

  musicBrain.updatedAt = Date.now();
  saveMusicBrain();
  saveKaraokeAudit();

  const after = musicBrainAutoAcceptV35Preview();

  return res.json({
    ok: true,
    validatedCurrent,
    correctedArtist,
    processed: validatedCurrent + correctedArtist,
    before,
    after,
    message:
      `${validatedCurrent + correctedArtist} morceau(x) accepté(s) automatiquement par MusicBrain V3.5 : ` +
      `${validatedCurrent} validation(s) directe(s), ${correctedArtist} correction(s) artiste. ` +
      `${after.stillManual} cas restent réellement contradictoires.`,
  });
});

app.get("/partybrain/musicbrain-publication/status", (_req, res) => {
  return res.json(musicBrainPublicationSummary());
});


app.get("/partybrain/musicbrain-publication/items", (req, res) => {
  const requestedStatus = String(req.query?.status || "review").trim().toLowerCase();
  const status: MusicBrainPublicationStatus | "all" =
    requestedStatus === "ready" ||
    requestedStatus === "review" ||
    requestedStatus === "blocked"
      ? requestedStatus
      : "all";

  const query = normalizeMusicQuery(String(req.query?.q || ""));
  const category = String(req.query?.category || "").trim();
  const rawLimit = Number(req.query?.limit || 200);
  const rawOffset = Number(req.query?.offset || 0);

  const limit = Math.max(
    1,
    Math.min(500, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 200)
  );
  const offset = Math.max(
    0,
    Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0
  );

  const items = Object.values(musicBrain.songs)
    .map((song) => {
      const publication = musicBrainPublicationDecision(song);
      const karaokeEntry = karaokeLyricsAudit.entries[song.videoId];

      return {
        videoId: song.videoId,
        title: song.title,
        rawTitle: song.rawTitle || song.title,
        artistName: song.artistName,
        channelTitle: song.channelTitle || "",
        thumbnail: song.thumbnail || "",
        metadataSource: song.metadataSource || null,
        metadataConfidence: Number(song.metadataConfidence || 0),
        searchCount: Number(song.searchCount || 0),
        addedCount: Number(song.addedCount || 0),
        playedCount: Number(song.playedCount || 0),
        voteCount: Number(song.voteCount || 0),
        publicationStatus: publication.status,
        publicationReason: publication.reason,
        proposedArtistName: publication.proposedArtistName || "",
        consensusResolution: publication.consensusResolution,
        consensusConfidence: publication.consensusConfidence,
        consensusSignals: publication.consensusSignals,
        automaticAction: musicBrainAutomaticActionDecision(song).action,
        manualReviewCategory:
          publication.consensusResolution === "manual_review"
            ? musicBrainManualReviewCategory(song)
            : null,
        thirdPassResolution: musicBrainThirdPassDecision(song).resolution,
        karaokeSynced: karaokeEntry?.kind === "synced",
        lrclibArtistName: karaokeEntry?.matchedArtistName || "",
        lrclibTrackName: karaokeEntry?.matchedTrackName || "",
      };
    })
    .filter((item) => status === "all" || item.publicationStatus === status)
    .filter((item) => {
      if (!category) return true;
      return item.manualReviewCategory === category;
    })
    .filter((item) => {
      if (!query) return true;
      const haystack = normalizeMusicQuery(
        `${item.title} ${item.rawTitle} ${item.artistName} ${item.channelTitle} ${item.proposedArtistName} ${item.lrclibArtistName}`
      );
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (a.karaokeSynced !== b.karaokeSynced) {
        return Number(b.karaokeSynced) - Number(a.karaokeSynced);
      }

      const activityA =
        a.playedCount * 6 +
        a.addedCount * 5 +
        a.voteCount * 4 +
        a.searchCount * 2;

      const activityB =
        b.playedCount * 6 +
        b.addedCount * 5 +
        b.voteCount * 4 +
        b.searchCount * 2;

      if (activityB !== activityA) return activityB - activityA;

      return String(a.artistName || "").localeCompare(
        String(b.artistName || ""),
        "fr",
        { sensitivity: "base" }
      );
    });

  const pageItems = items.slice(offset, offset + limit);

  return res.json({
    generatedAt: Date.now(),
    status,
    query: String(req.query?.q || ""),
    category,
    total: items.length,
    returned: pageItems.length,
    offset,
    limit,
    hasMore: offset + pageItems.length < items.length,
    nextOffset:
      offset + pageItems.length < items.length
        ? offset + pageItems.length
        : null,
    summary: musicBrainPublicationSummary(),
    items: pageItems,
  });
});


app.post("/partybrain/maintenance/musicbrain-artist-repair/apply-selected", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const selections = Array.isArray(req.body?.selections) ? req.body.selections : [];
  if (!selections.length) {
    return res.status(400).json({ error: "Aucune proposition sélectionnée." });
  }

  // Sécurité : on limite une validation manuelle à 200 propositions à la fois.
  const safeSelections = selections.slice(0, 200);

  const applied: Array<{
    videoId: string;
    oldArtistName: string;
    newArtistName: string;
  }> = [];
  const skipped: Array<{
    videoId: string;
    reason: string;
  }> = [];

  for (const selection of safeSelections) {
    const videoId = String(selection?.videoId || "").trim();
    const proposedArtistName = String(selection?.proposedArtistName || "").trim();

    if (!videoId || !proposedArtistName) {
      skipped.push({ videoId, reason: "selection_invalide" });
      continue;
    }

    const result = applySelectedMusicBrainArtistRepair(videoId, proposedArtistName);
    if (result.ok) {
      applied.push({
        videoId: result.videoId!,
        oldArtistName: result.oldArtistName!,
        newArtistName: result.newArtistName!,
      });
    } else {
      skipped.push({ videoId, reason: result.reason || "non_appliquee" });
    }
  }

  musicBrain.updatedAt = Date.now();
  saveMusicBrain();
  saveKaraokeAudit();

  return res.json({
    ok: true,
    appliedCount: applied.length,
    skippedCount: skipped.length,
    applied,
    skipped,
    report: musicBrainArtistRepairReport(),
    message: `${applied.length} proposition(s) sélectionnée(s) validée(s). ${skipped.length} ignorée(s).`,
  });
});

app.post("/partybrain/maintenance/musicbrain-cleanup/preview", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;
  return res.json({
    ok: true,
    report: musicBrainCleanupReport(),
  });
});

app.post("/partybrain/maintenance/musicbrain-cleanup/run", (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;

  const before = musicBrainCleanupReport();
  const result = cleanMusicBrainDatabase();
  const after = musicBrainCleanupReport();

  console.log(
    `🧹 MusicBrain nettoyé : ${result.deletedSongs} morceau(x), ${result.deletedArtists} artiste(s) supprimé(s).`
  );

  return res.json({
    ok: true,
    before,
    result,
    after,
    message: `MusicBrain nettoyé : ${result.deletedSongs} morceau(x) douteux supprimé(s), ${result.deletedArtists} artiste(s) vide(s) supprimé(s).`,
  });
});

app.get("/partybrain/maintenance/youtube-cache", (_req, res) => {
  return res.json({
    entries: youtubeSearchCache.size,
    filePath: youtubeCacheFilePath,
    persistent: Boolean(process.env.PERSISTENT_DATA_DIR?.trim()),
    protected: Boolean(process.env.PARTYBRAIN_ADMIN_TOKEN?.trim()),
  });
});
app.post("/partybrain/maintenance/youtube-cache/clear", (req, res) => {
  const expectedToken = String(process.env.PARTYBRAIN_ADMIN_TOKEN || "").trim();
  if (!expectedToken) {
    return res.status(503).json({
      error: "Maintenance désactivée : configure PARTYBRAIN_ADMIN_TOKEN sur Railway.",
    });
  }

  const providedToken = String(req.header("x-partybrain-admin-token") || "").trim();
  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: "Code administrateur incorrect." });
  }

  const deletedEntries = youtubeSearchCache.size;
  youtubeSearchCache.clear();
  youtubeSearchesInFlight.clear();
  saveYoutubeCache();

  console.log(`🧹 Cache YouTube vidé depuis l'administration : ${deletedEntries} entrée(s) supprimée(s).`);
  return res.json({
    ok: true,
    deletedEntries,
    remainingEntries: youtubeSearchCache.size,
    message: `Cache YouTube vidé : ${deletedEntries} entrée(s) supprimée(s). PartyBrain est conservé.`,
  });
});
app.get("/partybrain/academy", (_req, res) => res.json(academyDashboard()));

app.post("/partybrain/academy/test-one", async (req, res) => {
  if (!requirePartyBrainAdmin(req, res)) return;
  if (academyState.running) {
    return res.status(409).json({ error: "Academy est déjà en cours." });
  }

  const snapshot = academyQuotaSnapshot();
  if (snapshot.remaining <= 0) {
    return res.status(429).json({ error: "Aucun appel Academy restant pour ce cycle." });
  }

  const mission = nextAcademyKaraokeMission() || nextAcademyDiscoveryMission();
  if (!mission) {
    return res.status(404).json({ error: "Aucune mission Academy utile disponible." });
  }

  const beforeSongs = Object.keys(musicBrain.songs).length;
  addAcademyLog(
    "info",
    `TEST 1 RECHERCHE — ${mission.mode === "karaoke" ? "Audio prioritaire" : "Découverte"} : ${mission.query}`,
    { artist: mission.name, query: mission.query }
  );

  try {
    const results = await requestYoutubeMusic(mission.query, "academy");
    let acceptedCount = 0;
    let rejectedCount = 0;
    let foundKind: string | null = null;

    if (mission.mode === "karaoke") {
      const ranked = results
        .map((candidate) => ({
          candidate,
          kind: karaokeKindForVideo(candidate),
          score: karaokeCandidateScore(mission.sourceSong, candidate),
        }))
        .filter(
          (item) =>
            item.kind &&
            item.score >= 160 &&
            academyResultIsTrusted(item.candidate, mission.sourceSong.artistName)
        )
        .sort((a, b) => b.score - a.score);

      const best = ranked[0];
      if (best?.kind) {
        recordMusicBrainSearch(mission.query, [best.candidate]);
        acceptedCount = 1;
        foundKind = best.kind;
        karaokeAudit.entries[mission.sourceSong.videoId] = {
          sourceVideoId: mission.sourceSong.videoId,
          sourceTitle: mission.sourceSong.title,
          sourceArtistName: mission.sourceSong.artistName,
          checkedAt: Date.now(),
          kind: best.kind,
          candidateVideoId: best.candidate.id,
          candidateTitle: best.candidate.title,
          candidateChannelTitle: best.candidate.channelTitle,
          candidateDurationSeconds: best.candidate.durationSeconds,
        };
      } else {
        rejectedCount = results.length;
        karaokeAudit.entries[mission.sourceSong.videoId] = {
          sourceVideoId: mission.sourceSong.videoId,
          sourceTitle: mission.sourceSong.title,
          sourceArtistName: mission.sourceSong.artistName,
          checkedAt: Date.now(),
          kind: "not_found",
        };
      }
      saveKaraokeAudit();
    } else {
      const progress = academyState.artistProgress[mission.key] || { attempts: 0 };
      progress.attempts += 1;
      progress.lastAttemptAt = Date.now();
      progress.lastQueryVariant = mission.variantIndex;
      academyState.artistProgress[mission.key] = progress;

      const recorded = recordMusicBrainAcademySearch(
        mission.query,
        mission.name,
        results
      );
      acceptedCount = recorded.accepted.length;
      rejectedCount = recorded.rejectedCount;
    }

    const normalizedQuery = normalizeMusicQuery(mission.query);
    youtubeSearchCache.set(normalizedQuery, {
      query: mission.query,
      normalizedQuery,
      createdAt: Date.now(),
      results,
      engineVersion: YOUTUBE_SEARCH_ENGINE_VERSION,
    });
    saveYoutubeCache();

    const added = Math.max(0, Object.keys(musicBrain.songs).length - beforeSongs);
    const message =
      mission.mode === "karaoke"
        ? acceptedCount
          ? `TEST OK — ${mission.name} — ${mission.sourceSong.title} : version ${foundKind === "topic" ? "Topic / Art Track" : "Official Audio"} trouvée.`
          : `TEST OK — ${mission.name} — ${mission.sourceSong.title} : aucune version audio fiable trouvée.`
        : `TEST OK — ${mission.name} : ${acceptedCount} résultat(s) accepté(s), ${rejectedCount} écarté(s), +${added} nouveau(x) morceau(x).`;

    addAcademyLog(acceptedCount > 0 ? "success" : "info", message, {
      artist: mission.name,
      query: mission.query,
      songsAdded: added,
    });
    saveAcademyState();

    return res.json({
      ok: true,
      mode: mission.mode,
      query: mission.query,
      artist: mission.name,
      sourceTitle: mission.mode === "karaoke" ? mission.sourceSong.title : undefined,
      acceptedCount,
      rejectedCount,
      added,
      foundKind,
      remaining: academyQuotaSnapshot().remaining,
      message,
    });
  } catch (error: any) {
    addAcademyLog("error", `TEST 1 RECHERCHE échoué : ${error?.message || "erreur inconnue"}.`, {
      artist: mission.name,
      query: mission.query,
    });
    saveAcademyState();
    const status = Number(error?.status || 500);
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error?.message || "Test Academy impossible.",
    });
  }
});

app.post("/partybrain/academy/run", async (_req, res) => {
  if (String(process.env.PARTYBRAIN_ACADEMY_ALLOW_MANUAL || "false").toLowerCase() !== "true") {
    return res.status(403).json({ error: "Lancement manuel désactivé" });
  }
  if (academyState.running) return res.status(409).json({ error: "Academy déjà en cours" });
  void runPartyBrainAcademy("manual");
  return res.status(202).json({ ok: true, message: "Session Academy lancée" });
});
app.get("/partybrain/graph", (_req, res) => {
  const stats = musicBrainStats();
  const nodes = Object.values(musicBrain.artists).map((artist) => ({
    id: artist.key, label: artist.name, songs: Object.keys(artist.songs || {}).length, searches: artist.searchCount,
    weight: Object.keys(artist.songs || {}).length + artist.searchCount + Object.values(artist.collaborators || {}).reduce((sum, item) => sum + item.count, 0),
  })).sort((a, b) => b.weight - a.weight).slice(0, 80);
  const allowed = new Set(nodes.map((node) => node.id));
  const edges = (stats.topArtistRelations || []).filter((edge:any) => allowed.has(edge.fromKey) && allowed.has(edge.toKey));
  res.json({ nodes, edges, updatedAt: musicBrain.updatedAt });
});


app.get("/party/:code/partybrain/recommendations", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });

  const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 25));
  const recommendations = buildPartyBrainRecommendationScores(party, limit);

  return res.json({
    partyCode: party.code,
    generatedAt: Date.now(),
    currentSong: party.currentSong
      ? {
          videoId: party.currentSong.videoId,
          title: party.currentSong.title,
          artistName: party.currentSong.artistName,
        }
      : null,
    queueLength: party.songs.filter((song) => !song.played).length,
    scoringVersion: "partybrain-score-v1",
    weights: {
      transition: 28,
      artistAffinity: 18,
      popularity: 15,
      completion: 14,
      votes: 10,
      hourFit: 7,
      freshness: 8,
      penalties: "jusqu’à -44",
    },
    recommendations,
    learningState: recommendations.length
      ? recommendations[0].confidence >= 65
        ? "trained"
        : recommendations[0].confidence >= 40
          ? "learning"
          : "early_learning"
      : "no_candidate",
  });
});

// Retourne uniquement le meilleur morceau PartyBrain pour une soirée.
// Cette route est volontairement sans effet de bord :
// elle ne modifie ni la file, ni le morceau courant, ni l'historique.
app.get("/party/:code/partybrain/best-recommendation", (req, res) => {
  const party = findParty(req.params.code);

  if (!party) {
    return res.status(404).json({
      error: "Soirée introuvable",
    });
  }

  const recommendations = buildPartyBrainRecommendationScores(party, 1);
  const bestRecommendation = recommendations[0] || null;

  if (!bestRecommendation) {
    return res.status(404).json({
      error: "Aucune recommandation disponible",
      partyCode: party.code,
      scoringVersion: "partybrain-score-v1",
      reason: "PartyBrain ne possède pas encore de morceau compatible hors de la file actuelle.",
    });
  }

  const minimumScore = Math.max(
    0,
    Math.min(100, Number(req.query.minimumScore || 0))
  );

  const minimumConfidence = Math.max(
    0,
    Math.min(100, Number(req.query.minimumConfidence || 0))
  );

  const accepted =
    bestRecommendation.score >= minimumScore &&
    bestRecommendation.confidence >= minimumConfidence;

  return res.json({
    partyCode: party.code,
    generatedAt: Date.now(),
    scoringVersion: "partybrain-score-v1",
    accepted,
    thresholds: {
      minimumScore,
      minimumConfidence,
    },
    currentSong: party.currentSong
      ? {
          videoId: party.currentSong.videoId,
          title: party.currentSong.title,
          artistName: party.currentSong.artistName,
        }
      : null,
    queueLength: party.songs.filter((song) => !song.played).length,
    recommendation: bestRecommendation,
  });
});


app.get("/partybrain/intelligence/events/coverage", (_req, res) => {
  const events = readPartyEvents(50000);
  const expected: PartyIntelligenceEventType[] = [
    "PARTY_CREATED",
    "PARTICIPANT_JOINED",
    "PARTICIPANT_LEFT",
    "SONG_SEARCHED",
    "SONG_ADDED",
    "SONG_VOTED",
    "SONG_DOWNVOTED",
    "SONG_PLAY_STARTED",
    "SONG_PROGRESS",
    "SONG_PLAY_COMPLETED",
    "SONG_SKIPPED",
    "SONG_REMOVED",
    "QUEUE_REORDERED",
    "PARTY_ENDED",
  ];

  const counts = Object.fromEntries(expected.map((event) => [event, 0])) as Record<PartyIntelligenceEventType, number>;
  for (const entry of events) {
    if (entry.event in counts) counts[entry.event] += 1;
  }

  return res.json({
    ok: true,
    totalEvents: events.length,
    coverage: expected.map((event) => ({
      event,
      count: counts[event],
      collected: counts[event] > 0,
    })),
  });
});


app.get("/partybrain/covers/status", (_req, res) => {
  const songs = Object.values(musicBrain.songs || {});
  const counts = songs.reduce<Record<string, number>>((acc, song) => {
    const status = song.coverStatus || "unrequested";
    acc[status] = Number(acc[status] || 0) + 1;
    return acc;
  }, {});
  return res.json({
    totalSongs: songs.length,
    counts,
    inFlight: coverLookupsInFlight.size,
    found: songs
      .filter((song) => song.coverStatus === "found" && song.coverUrl)
      .slice(-50)
      .map((song) => ({
        videoId: song.videoId,
        title: song.title,
        artistName: song.artistName,
        coverUrl: song.coverUrl,
        coverSource: song.coverSource,
        coverWidth: song.coverWidth,
        coverHeight: song.coverHeight,
      })),
  });
});

app.post("/partybrain/covers/:videoId/retry", (req, res) => {
  const learnedSong = musicBrain.songs[String(req.params.videoId || "")];
  if (!learnedSong) return res.status(404).json({ error: "Morceau PartyBrain introuvable" });
  learnedSong.coverStatus = undefined;
  learnedSong.coverLastCheckedAt = undefined;
  saveMusicBrain();
  queueHdCoverLookup(learnedSong.videoId);
  return res.json({ ok: true, videoId: learnedSong.videoId, coverStatus: "pending" });
});

app.get("/partybrain/export", (_req, res) => {
  res.setHeader("Content-Disposition", "attachment; filename=partybrain-export.json");
  return res.json(musicBrain);
});


app.get("/search/youtube", async (req, res) => {
  const startedAt = Date.now();
  youtubeSearchStats.totalRequests += 1;

  const query = String(req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Recherche manquante" });

  const normalizedQuery = normalizeMusicQuery(query);
  if (!normalizedQuery) return res.status(400).json({ error: "Recherche invalide" });

  const partyCode = String(req.query.partyCode || "").trim().toUpperCase();
  const searchParty = partyCode ? parties.find((party) => party.code === partyCode) : undefined;
  if (searchParty) {
    recordPartyEvent(searchParty, "SONG_SEARCHED", {
      actorHash: anonymizeActor(req.query.actor),
      source: "manual_search",
      context: { query, normalizedQuery },
    });
  }

  pruneYoutubeCache();

  const exactCache = youtubeSearchCache.get(normalizedQuery);
  if (exactCache) {
    youtubeSearchStats.exactCacheHits += 1;
    youtubeSearchStats.quotaSaved += 1;
    logYoutubeSearchDiagnostic({
      query,
      normalizedQuery,
      source: "CACHE",
      durationMs: Date.now() - startedAt,
      resultCount: exactCache.results.length,
    });
    recordMusicBrainSearch(query, exactCache.results);
    res.setHeader("X-MixParty-Cache", "HIT");
    return res.json(exactCache.results);
  }

  // Pas de cache approximatif ici : deux recherches proches peuvent viser
  // des artistes ou des morceaux différents.

  const compactKey = compactMusicQuery(query);
  const alias = [...youtubeSearchCache.entries()].find(
    ([key]) => key.replace(/\s+/g, "") === compactKey
  );
  if (alias) {
    youtubeSearchStats.aliasCacheHits += 1;
    youtubeSearchStats.quotaSaved += 1;
    logYoutubeSearchDiagnostic({
      query,
      normalizedQuery,
      source: "ALIAS_CACHE",
      durationMs: Date.now() - startedAt,
      resultCount: alias[1].results.length,
      matchedQuery: alias[1].query,
    });
    recordMusicBrainSearch(query, alias[1].results);
    res.setHeader("X-MixParty-Cache", "ALIAS-HIT");
    return res.json(alias[1].results);
  }

  let inFlight = youtubeSearchesInFlight.get(normalizedQuery);
  const reusedInFlight = Boolean(inFlight);
  const knownBeforeSearch = musicBrainResultsForQuery(query);
  const directDecisionBeforeSearch = musicBrainDirectSearchDecision(
    query,
    knownBeforeSearch
  );
  const musicBrainOnly =
    !reusedInFlight && directDecisionBeforeSearch.useMusicBrainOnly;

  if (!inFlight) {
    inFlight = smartYoutubeMusicSearch(query);
    youtubeSearchesInFlight.set(normalizedQuery, inFlight);
  } else {
    youtubeSearchStats.inFlightHits += 1;
    youtubeSearchStats.quotaSaved += 1;
  }

  try {
    const results = await inFlight;
    youtubeSearchCache.set(normalizedQuery, {
      query,
      normalizedQuery,
      createdAt: Date.now(),
      results,
      engineVersion: YOUTUBE_SEARCH_ENGINE_VERSION,
    });
    saveYoutubeCache();
    recordMusicBrainSearch(query, results);

    logYoutubeSearchDiagnostic({
      query,
      normalizedQuery,
      source: reusedInFlight ? "IN_FLIGHT" : musicBrainOnly ? "MUSICBRAIN" : "YOUTUBE",
      durationMs: Date.now() - startedAt,
      resultCount: results.length,
    });

    res.setHeader(
      "X-MixParty-Cache",
      reusedInFlight ? "IN-FLIGHT" : musicBrainOnly ? "MUSICBRAIN" : "MISS"
    );
    return res.json(results);
  } catch (error: any) {
    console.error("ERREUR YOUTUBE :", error?.details || error);
    const status = Number(error?.status || 500);

    if (status === 429) {
      return res.status(429).json({
        error: "Quota YouTube dépassé",
        message: "La recherche musicale sera de nouveau disponible après la remise à zéro du quota.",
      });
    }

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "Erreur recherche YouTube",
      message: error?.message || "Impossible de rechercher cette musique.",
    });
  } finally {
    youtubeSearchesInFlight.delete(normalizedQuery);
  }
});

httpServer.listen(
  port,
  "0.0.0.0",
  ()=>{
    
    console.log(`API MixParty démarrée sur http://localhost:${port}`);
    console.log(`🧠 PartyBrain : ${process.env.PERSISTENT_DATA_DIR ? "volume Railway persistant" : "JSON local"}`);
    console.log(`💾 Données : ${persistentDataDir}`);

  }
);