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
type CoverSource = "APPLE_ITUNES" | "MUSICBRAINZ_CAA";

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
    reason?: "ended" | "dj_skip" | "song_change";
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

function finalizePlayback(party: Party, reason: "ended" | "dj_skip" | "song_change") {
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
      persistCoverResult(videoId, musicBrainzResult, false);
    } catch (error) {
      console.error("HD COVER LOOKUP ERROR", videoId, error);
      persistCoverResult(videoId, null, true);
    } finally {
      coverLookupsInFlight.delete(videoId);
    }
  })();
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

function recordMusicBrainSearch(query: string, results: YoutubeSearchResult[]) {
  musicBrain.totals.searches += 1;
  const touchedArtists = new Set<string>();
  for (const result of results) {
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
  }
  for (const artistKey of touchedArtists) {
    const artist = musicBrain.artists[artistKey];
    if (artist) artist.searchCount += 1;
  }
  saveMusicBrain();
}

function recordMusicBrainAddition(song: Song) {
  if (!song.videoId) return;
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
  musicBrain.totals.additions += 1;
  saveMusicBrain();
}

function recordMusicBrainVote(song: Song) {
  if (!song.videoId) return;
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
  musicBrain.totals.votes += 1;
  saveMusicBrain();
}

function recordMusicBrainPlay(song: Song, previous?: Song | null) {
  if (!song.videoId) return;
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
  musicBrain.totals.plays += 1;

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

function chooseDiversifiedPartyBrainRecommendation(
  recommendations: PartyBrainRecommendation[],
  party: Party
): PartyBrainRecommendation | null {
  if (!recommendations.length) return null;
  const current = party.currentSong || party.history?.[party.history.length - 1] || null;
  const currentGenre = inferPartyBrainContextGenre(party);
  const compatibleRecommendations = recommendations.filter((item) => {
    const genre = inferPartyBrainGenre(item.title, item.artistName);
    return partyBrainGenreCompatibility(currentGenre, genre) >= 0.55;
  });
  const sourcePool = compatibleRecommendations.length >= 2
    ? compatibleRecommendations
    : recommendations;
  const top = sourcePool.slice(0, Math.min(8, sourcePool.length));
  const weighted = top.map((item, index) => {
    const genre = inferPartyBrainGenre(item.title, item.artistName);
    const genreBonus = partyBrainGenreCompatibility(currentGenre, genre) * 18;
    const rankPenalty = index * 1.5;
    const seedText = `${party.code}:${current?.videoId || "none"}:${item.videoId}:${Math.floor(Date.now() / 600000)}`;
    let hash = 0;
    for (let i = 0; i < seedText.length; i += 1) hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
    const rotationBonus = (hash % 1000) / 1000 * 5;
    return { item, value: item.score + genreBonus + rotationBonus - rankPenalty };
  });
  weighted.sort((a, b) => b.value - a.value);
  return weighted[0].item;
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
      process.env.PARTYBRAIN_RELAY_MIN_SCORE || 55
    );

    const minimumConfidence = Number(
      process.env.PARTYBRAIN_RELAY_MIN_CONFIDENCE || 30
    );

    const recommendationAccepted = Boolean(
      bestRecommendation &&
      bestRecommendation.score >= minimumScore &&
      bestRecommendation.confidence >= minimumConfidence
    );

    const fallbackEnabled =
      String(process.env.PARTYBRAIN_RELAY_FALLBACK_ENABLED || "true").toLowerCase() !== "false";

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
            ? "La recommandation n’atteint pas les seuils et aucun secours sûr n’est disponible."
            : "Aucune recommandation ni musique de secours disponible.",
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
        return !/(podcast|interview|reaction|reacts?|documentary|documentaire|#shorts|\bshorts?\b)/i.test(text);
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


function trackIdentity(result: YoutubeSearchResult) {
  const artist = normalizeMusicQuery(result.artistName || result.channelTitle || "");
  const title = normalizeMusicQuery(result.title || result.rawTitle || "")
    .replace(/\b(remix|live|version|audio|official|clip|lyrics|paroles)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${artist}::${title}`;
}

function deduplicateMusicResults(results: YoutubeSearchResult[]) {
  const byVideoId = new Map<string, YoutubeSearchResult>();
  for (const result of results) {
    if (!result.id || byVideoId.has(result.id)) continue;
    byVideoId.set(result.id, result);
  }

  const bestByTrack = new Map<string, YoutubeSearchResult>();
  for (const result of byVideoId.values()) {
    const identity = trackIdentity(result);
    if (!identity || identity === "::") continue;
    const current = bestByTrack.get(identity);
    if (!current || scoreMusicResult(result, result.artistName || result.title) > scoreMusicResult(current, current.artistName || current.title)) {
      bestByTrack.set(identity, result);
    }
  }
  return [...bestByTrack.values()];
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
  // Une base déjà riche répond sans consommer de quota.
  if (known.length >= 20) {
    youtubeSearchStats.quotaSaved += 1;
    return deduplicateMusicResults(known).slice(0, 40);
  }

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
  (artist: string) => `${artist} chansons`,
  (artist: string) => `${artist} album`,
  (artist: string) => `${artist} art track`,
  (artist: string) => `${artist} meilleurs titres`,
];

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

function nextAcademyMission() {
  const candidates = academyMissionCandidates();
  if (!candidates.length) return null;

  const candidate = candidates[0];
  const variantIndex = Number(candidate.progress.lastQueryVariant ?? -1) + 1;
  const normalizedVariant = variantIndex % ACADEMY_QUERY_VARIANTS.length;
  return {
    ...candidate,
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

      const mission = nextAcademyMission();
      if (!mission) {
        session.status = "completed";
        session.reason = "Aucune mission utile restante.";
        break;
      }

      const beforeSongs = Object.keys(musicBrain.songs).length;
      const progress = academyState.artistProgress[mission.key] || { attempts: 0 };
      progress.attempts += 1;
      progress.lastAttemptAt = Date.now();
      progress.lastQueryVariant = mission.variantIndex;
      academyState.artistProgress[mission.key] = progress;

      addAcademyLog("info", `Recherche ${session.callsUsed + 1}/${session.callsPlanned} : ${mission.query}`, {
        artist: mission.name,
        query: mission.query,
      });

      session.callsUsed += 1;

      try {
        const results = await requestYoutubeMusic(mission.query, "academy");
        recordMusicBrainSearch(mission.name, results);

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
        addAcademyLog("success", `${mission.name} enrichi : +${added} nouveau(x) morceau(x).`, {
          artist: mission.name,
          query: mission.query,
          songsAdded: added,
        });
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

app.get("/musicbrain/stats", (_req, res) => {
  return res.json(musicBrainStats());
});

app.get("/musicbrain/artists/:key", (req, res) => {
  const key = normalizeMusicQuery(String(req.params.key || ""));
  const artist = musicBrain.artists[key];
  if (!artist) return res.status(404).json({ error: "Artiste inconnu" });
  return res.json(artist);
});

app.get("/partybrain/stats", (_req, res) => res.json(musicBrainStats()));
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

  const closeKey = findCloseCachedQuery(normalizedQuery);
  if (closeKey) {
    const closeCache = youtubeSearchCache.get(closeKey);
    if (closeCache) {
      youtubeSearchCache.set(normalizedQuery, {
        ...closeCache,
        query,
        normalizedQuery,
      });
      youtubeSearchStats.fuzzyCacheHits += 1;
      youtubeSearchStats.quotaSaved += 1;
      logYoutubeSearchDiagnostic({
        query,
        normalizedQuery,
        source: "FUZZY_CACHE",
        durationMs: Date.now() - startedAt,
        resultCount: closeCache.results.length,
        matchedQuery: closeCache.query,
      });
      recordMusicBrainSearch(query, closeCache.results);
      res.setHeader("X-MixParty-Cache", "FUZZY-HIT");
      return res.json(closeCache.results);
    }
  }

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