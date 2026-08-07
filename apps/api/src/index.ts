import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
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
const persistentDataDir = path.resolve(
  process.env.PERSISTENT_DATA_DIR?.trim() || process.cwd()
);
fs.mkdirSync(persistentDataDir, { recursive: true });
const dataFilePath = path.resolve(persistentDataDir, "data.json");
const partyEventsFilePath = path.resolve(persistentDataDir, "party-intelligence-events.jsonl");
const attendanceHistoryFilePath = path.resolve(persistentDataDir, "party-attendance-history.json");
const karaokeAuditFilePath = path.resolve(persistentDataDir, "karaoke-audit.json");
const karaokeLyricsAuditFilePath = path.resolve(persistentDataDir, "karaoke-lyrics-audit.json");
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
app.use(express.json());


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

type Participant = { id:string; name:string; avatar?:string; lastSeen:number };

type Party = {
  code: string;
  songs: Song[];
  history: Song[];
  participants: Participant[];
  currentSong: Song | null;
  createdAt: number;
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



function findParty(code:string) {

  return parties.find(
    (party) => party.code === code
  );

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

    const expired = now - party.createdAt >= 24 * 60 * 60 * 1000;
    if (!expired) {
      keptParties.push(party);
      continue;
    }

    if (party.currentSong) {
      finalizePlayback(party, "song_change");
    }

    recordPartyEvent(party, "PARTY_ENDED", {
      context: {
        reason: "expired_24h",
        songsPlayed: party.history?.length || 0,
        songsQueued: party.songs?.filter((song) => !song.played).length || 0,
      },
    });

    playbackTelemetry.delete(party.code);
  }

  parties = keptParties;
  saveParties();

}

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
  pruneOfflineParticipants(party);
  saveParties();
  io.emit("party_updated", toPublicParty(party));
}



loadMusicBrain();

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

  creatorToken: randomUUID(),

  partyBrainAutoRelayEnabled: false

};


parties.push(party);
recordPartyEvent(party, "PARTY_CREATED");

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
  const existingParticipant = party.participants.find((participant) => participant.id === participantId);
  const isNewParticipant = !existingParticipant;

  if(existingParticipant){
    existingParticipant.name = name;
    existingParticipant.avatar = avatar || existingParticipant.avatar;
    existingParticipant.lastSeen = Date.now();
  } else {
    party.participants.push({ id: participantId, name, avatar, lastSeen: Date.now() });
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
  if (!id || !name) return res.status(400).json({ error: "Participant invalide" });

  const participant = party.participants.find((item) => item.id === id);
  const isNewParticipant = !participant;

  if (participant) {
    participant.name = name;
    participant.avatar = avatar || participant.avatar;
    participant.lastSeen = Date.now();
  } else {
    party.participants.push({ id, name, avatar, lastSeen: Date.now() });
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
const learnedCover = learnedCoverFor(String(videoId || ""));
party.songs.push({

  title: song,

  videoId: videoId || "",

  thumbnail: thumbnail || "",

  durationSeconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : undefined,

  votes: 0,

  addedBy: addedBy || "Inconnu",

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
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });

  const index = Number(req.params.index);
  const song = party.songs[index];
  if (!song) return res.status(404).json({ error: "Chanson introuvable" });

  if (party.currentSong?.videoId === song.videoId && party.currentSong?.addedAt === song.addedAt) {
    finalizePlayback(party, "song_change");
    party.currentSong = null;
  }

  const snapshot = songEventSnapshot(party, song);
  party.songs.splice(index, 1);

  recordPartyEvent(party, "SONG_REMOVED", {
    song: snapshot,
    actorHash: anonymizeActor(req.body?.actor || req.query.actor),
    context: {
      reason: String(req.body?.reason || req.query.reason || "manual_remove"),
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
};

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
  source: "YOUTUBE" | "CACHE" | "FUZZY_CACHE" | "ALIAS_CACHE" | "IN_FLIGHT";
  durationMs: number;
  resultCount: number;
  matchedQuery?: string;
}) {
  const sourceLabel = {
    YOUTUBE: "🔵 YouTube API",
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

function scoreMusicResult(result: YoutubeSearchResult, query: string) {
  const title = stripDiacritics(result.title).toLowerCase();
  const channel = stripDiacritics(result.channelTitle || "").toLowerCase();
  const normalizedTitle = normalizeMusicQuery(title);
  const queryTokens = normalizeMusicQuery(query).split(" ").filter(Boolean);
  let score = 0;

  if (/official audio|audio officiel|provided to youtube/i.test(title)) score += 120;
  if (/official (music )?video|clip officiel/i.test(title)) score += 110;
  if (/\btopic\b/i.test(channel)) score += 95;
  if (/vevo/i.test(channel)) score += 85;
  if (/official/i.test(channel)) score += 70;
  if (/music/i.test(channel)) score += 20;

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) score += 16;
    if (channel.includes(token)) score += 10;
  }

  if (/lyrics?|paroles/i.test(title)) score -= 35;
  if (/karaoke|instrumental/i.test(title)) score -= 70;
  if (/cover|reprise/i.test(title)) score -= 65;
  if (/reaction|reacts?|analyse|analysis|review/i.test(title)) score -= 120;
  if (/interview|podcast|documentary|documentaire|making of|behind the scenes/i.test(title)) score -= 140;
  if (/shorts?|#shorts/i.test(title)) score -= 250;
  if (/live|concert|festival/i.test(title)) score -= 25;
  if (/mix|compilation|playlist|best of/i.test(title)) score -= 40;

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
        const text = `${result.title} ${result.channelTitle || ""}`.toLowerCase();
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

async function smartYoutubeMusicSearch(query: string): Promise<YoutubeSearchResult[]> {
  const known = musicBrainResultsForQuery(query);
  // Même lorsque PartyBrain connaît déjà beaucoup de titres, YouTube est interrogé
  // pour récupérer les nouveautés et les versions encore absentes de la base locale.
  const primary = await requestYoutubeMusic(query, "user");
  let combined = [...known, ...primary];

  // Une seconde requête ciblée seulement si la première page reste pauvre.
  // Cela évite le cas "PLK = seulement 8 titres" sans multiplier les appels à chaque recherche.
  if (deduplicateMusicResults(combined).length < 16) {
    const fallbackQuery = `${query} official audio topic`;
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

function academyMissionCandidates() {
  const now = Date.now();
  return Object.values(musicBrain.artists)
    .filter((artist) => artist.key && artist.name && artist.key !== "unknown")
    .map((artist) => {
      const songCount = Object.keys(artist.songs || {}).length;
      const progress = academyState.artistProgress[artist.key] || { attempts: 0 };
      const searchedRecently = now - Number(artist.lastSeenAt || 0) < 7 * 24 * 60 * 60 * 1000;
      const incompleteBonus = Math.max(0, academyTargetSongs - songCount) * 12;
      const demandScore = Number(artist.searchCount || 0) * 20;
      const recencyScore = searchedRecently ? 80 : 0;
      const retryPenalty = Number(progress.attempts || 0) * 7;
      return {
        key: artist.key,
        name: artist.name,
        songCount,
        priority: demandScore + incompleteBonus + recencyScore - retryPenalty,
        progress,
      };
    })
    .filter((candidate) => candidate.songCount < academyTargetSongs || candidate.progress.attempts < 2)
    .sort((a, b) => b.priority - a.priority || a.songCount - b.songCount);
}

function nextAcademyDiscoveryMission() {
  const candidates = academyMissionCandidates();
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

      // 3 appels sur 4 servent en priorité à chercher une version Topic /
      // Official Audio précise d'un morceau déjà connu. Le 4e garde une place
      // à la découverte générale du catalogue.
      const preferKaraoke = session.callsUsed % 4 !== 3;
      const karaokeMission = preferKaraoke ? nextAcademyKaraokeMission() : null;
      const discoveryMission = karaokeMission ? null : nextAcademyDiscoveryMission();
      const fallbackKaraokeMission =
        !karaokeMission && !discoveryMission ? nextAcademyKaraokeMission() : null;
      const mission = karaokeMission || discoveryMission || fallbackKaraokeMission;

      if (!mission) {
        session.status = "completed";
        session.reason = "Aucune mission utile restante.";
        break;
      }

      const beforeSongs = Object.keys(musicBrain.songs).length;

      if (mission.mode !== "karaoke") {
        const progress = academyState.artistProgress[mission.key] || { attempts: 0 };
        progress.attempts += 1;
        progress.lastAttemptAt = Date.now();
        progress.lastQueryVariant = mission.variantIndex;
        academyState.artistProgress[mission.key] = progress;
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
        });
        saveYoutubeCache();

        const added = Math.max(0, Object.keys(musicBrain.songs).length - beforeSongs);
        session.songsAdded += added;
        if (!session.artistsTouched.includes(mission.name)) session.artistsTouched.push(mission.name);

        addAcademyLog(
          acceptedCount > 0 ? "success" : "info",
          mission.mode === "karaoke"
            ? `${mission.name} — ${mission.sourceSong.title} : ${acceptedCount ? "version audio officielle trouvée" : "aucune version audio fiable trouvée"}.`
            : `${mission.name} enrichi : +${added} nouveau(x) morceau(x), ${rejectedCount} résultat(s) douteux écarté(s).`,
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
    nextQuery: ACADEMY_QUERY_VARIANTS[(Number(mission.progress.lastQueryVariant ?? -1) + 1) % ACADEMY_QUERY_VARIANTS.length](mission.name),
  }));
  return {
    ...snapshot,
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
      .map((item: any) => ({
        item,
        score: karaokeLyricsCandidateScore(song, item),
      }))
      .filter((entry) => entry.score >= 0)
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

  const synced = entries.filter((entry) => entry.kind === "synced").length;
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
      "Audit LRCLIB séparé : 100 morceaux maximum par lot, requêtes séquentielles, résultats sauvegardés pour éviter de rescanner les mêmes morceaux.",
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

  if (existing.kind === "synced" || existing.kind === "instrumental") {
    return false;
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
    .filter((song) => !karaokeLyricsAudit.entries[song.videoId])
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
    const lines = parseLrclibSyncedLyrics(record?.syncedLyrics);

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
    };

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



app.get("/partybrain/karaoke-lyrics-audit/ready", (req, res) => {
  const q = normalizeMusicQuery(String(req.query?.q || ""));
  const rawLimit = Number(req.query?.limit || 300);
  const limit = Math.max(1, Math.min(1000, Number.isFinite(rawLimit) ? rawLimit : 300));

  const items = Object.values(karaokeLyricsAudit.entries)
    .filter((entry) => entry.kind === "synced")
    .map((entry) => {
      const song = musicBrain.songs[entry.videoId];
      if (!song) return null;

      return {
        videoId: entry.videoId,
        title: song.title || song.rawTitle || entry.matchedTrackName || "Titre inconnu",
        rawTitle: song.rawTitle || song.title || "",
        artistName: song.artistName || entry.matchedArtistName || "Artiste inconnu",
        thumbnail: song.thumbnail || "",
        durationSeconds: Number(song.durationSeconds || entry.matchedDuration || 0),
        lrclibId: entry.lrclibId || null,
        checkedAt: entry.checkedAt,
        matchedTrackName: entry.matchedTrackName || "",
        matchedArtistName: entry.matchedArtistName || "",
        matchedAlbumName: entry.matchedAlbumName || "",
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

  return res.json({
    totalReady: Object.values(karaokeLyricsAudit.entries).filter(
      (entry) => entry.kind === "synced" && Boolean(musicBrain.songs[entry.videoId])
    ).length,
    matched: items.length,
    returned: Math.min(items.length, limit),
    query: String(req.query?.q || ""),
    items: items.slice(0, limit),
  });
});

app.get("/partybrain/karaoke-lyrics-audit", (_req, res) => {
  return res.json({
    ...karaokeLyricsAuditSummary(),
    job: karaokeLyricsAuditJob,
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

  if (!key) return true;
  if (/^(unknown|inconnu|artiste inconnu|unknown artist)$/i.test(artist)) return true;

  // Noms déjà observés comme faux positifs / valeurs de parsing.
  if (/^(da|art)$/i.test(key)) return true;

  // Les noms très courts sont seulement suspects, jamais supprimés automatiquement.
  if (key.length <= 2) return true;

  return /^(music|musique|official|officiel|topic|audio|video|records?|recordings?|channel|youtube)$/i.test(artist);
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
    });
    saveYoutubeCache();
    recordMusicBrainSearch(query, results);

    logYoutubeSearchDiagnostic({
      query,
      normalizedQuery,
      source: reusedInFlight ? "IN_FLIGHT" : "YOUTUBE",
      durationMs: Date.now() - startedAt,
      resultCount: results.length,
    });

    res.setHeader("X-MixParty-Cache", reusedInFlight ? "IN-FLIGHT" : "MISS");
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