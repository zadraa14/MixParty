import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
dotenv.config();



const app = express();
const port = Number(process.env.PORT ?? 4000);
const persistentDataDir = path.resolve(
  process.env.PERSISTENT_DATA_DIR?.trim() || process.cwd()
);
fs.mkdirSync(persistentDataDir, { recursive: true });
const dataFilePath = path.resolve(persistentDataDir, "data.json");
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
};

type Song = {
  title:string;
  videoId:string;
  thumbnail:string;
  votes:number;
  addedBy:string;
  voters:string[];
  played:boolean;
  addedAt:number;
  sourceQuery?:string;
  suggestionPool?:YoutubeSuggestion[];
};




type MusicBrainSong = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
  durationSeconds?: number;
  artistKey: string;
  artistName: string;
  firstSeenAt: number;
  lastSeenAt: number;
  searchCount: number;
  addedCount: number;
  playedCount: number;
  voteCount: number;
};

type MusicBrainArtist = {
  key: string;
  name: string;
  aliases: string[];
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

type MusicBrainDatabase = {
  version: 1;
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
};

type Participant = { id:string; name:string; avatar?:string; lastSeen:number };

type Party = {
  code: string;
  songs: Song[];
  history: Song[];
  participants: Participant[];
  currentSong: Song | null;
  createdAt: number;
  creatorToken: string;
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
    version: 1,
    createdAt: now,
    updatedAt: now,
    totals: { searches: 0, additions: 0, plays: 0, votes: 0 },
    artists: {},
    songs: {},
    transitions: {},
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
    if (parsed?.version === 1 && parsed?.artists && parsed?.songs) {
      const defaults = createEmptyMusicBrain();
      musicBrain = {
        ...defaults,
        ...parsed,
        createdAt: Number(parsed.createdAt || defaults.createdAt),
        updatedAt: Number(parsed.updatedAt || defaults.updatedAt),
        totals: { ...defaults.totals, ...(parsed.totals || {}) },
        artists: parsed.artists || {},
        songs: parsed.songs || {},
        transitions: parsed.transitions || {},
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
  const merged: Record<string, MusicBrainArtist> = {};

  for (const artist of Object.values(musicBrain.artists || {})) {
    const cleanName = cleanArtistName(artist.name || artist.key);
    const canonicalKey = normalizeMusicQuery(cleanName) || artist.key;
    const target = merged[canonicalKey] || {
      key: canonicalKey,
      name: cleanName || artist.name,
      aliases: [],
      firstSeenAt: Number(artist.firstSeenAt || Date.now()),
      lastSeenAt: Number(artist.lastSeenAt || Date.now()),
      searchCount: 0,
      songs: {},
    };

    target.firstSeenAt = Math.min(target.firstSeenAt, Number(artist.firstSeenAt || target.firstSeenAt));
    target.lastSeenAt = Math.max(target.lastSeenAt, Number(artist.lastSeenAt || target.lastSeenAt));
    target.searchCount += Number(artist.searchCount || 0);
    target.aliases = [...new Set([
      ...target.aliases,
      ...(artist.aliases || []).map(cleanArtistName),
      cleanArtistName(artist.name || ""),
    ].filter(Boolean))].slice(-30);

    for (const song of Object.values(artist.songs || {})) {
      song.title = decodeHtmlEntities(song.title || "");
      song.artistKey = canonicalKey;
      song.artistName = target.name;
      target.songs[song.videoId] = song;
      musicBrain.songs[song.videoId] = song;
    }

    merged[canonicalKey] = target;
  }

  musicBrain.artists = merged;
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
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&#39;": "'",
    "&quot;": '"',
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
  };
  return value
    .replace(/&(amp|#39|quot|lt|gt|nbsp);/gi, (match) => entities[match.toLowerCase()] || match)
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function cleanArtistName(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\s+-\s+topic$/i, "")
    .replace(/vevo$/i, "")
    .replace(/official$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferArtistName(result: { title?: string; channelTitle?: string }, fallbackQuery: string) {
  const channel = cleanArtistName(String(result.channelTitle || ""));
  if (channel && !/music|records|label|entertainment/i.test(channel)) return channel;

  const title = String(result.title || "");
  const titleArtist = title.includes(" - ") ? title.split(" - ")[0].trim() : "";
  if (titleArtist && titleArtist.length <= 80) return cleanArtistName(titleArtist);

  return cleanArtistName(fallbackQuery) || "Artiste inconnu";
}

function upsertMusicBrainSong(params: {
  videoId: string;
  title: string;
  thumbnail?: string;
  channelTitle?: string;
  durationSeconds?: number;
  artistName?: string;
  sourceQuery?: string;
}) {
  const now = Date.now();
  const artistName = cleanArtistName(params.artistName || inferArtistName(params, params.sourceQuery || params.title));
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

  song.title = params.title || song.title;
  song.thumbnail = params.thumbnail || song.thumbnail;
  song.channelTitle = params.channelTitle || song.channelTitle;
  song.durationSeconds = params.durationSeconds ?? song.durationSeconds;
  song.artistKey = artistKey;
  song.artistName = artistName;
  song.lastSeenAt = now;
  musicBrain.songs[params.videoId] = song;

  const artist = musicBrain.artists[artistKey] || {
    key: artistKey,
    name: artistName,
    aliases: [],
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
    sourceQuery: song.sourceQuery,
  });
  item.playedCount += 1;
  musicBrain.totals.plays += 1;

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

  const knowledgePoints =
    artists.length * 25 + songs.length * 5 + Object.keys(musicBrain.transitions).length * 10 +
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
      youtubeCalls: youtubeSearchStats.youtubeCalls,
      quotaSaved: youtubeSearchStats.quotaSaved,
    },
    topArtists,
    topSongs,
    topTransitions,
  };
}


function cleanOldParties(){

  const now = Date.now();

  parties = parties.filter((party)=>{

    if(!party.createdAt){
      party.createdAt = now;
    }

    return now - party.createdAt < 24 * 60 * 60 * 1000;

  });


  saveParties();

}

function pruneOfflineParticipants(party: Party) {
  const cutoff = Date.now() - 30_000;
  party.participants = (party.participants || []).filter(
    (participant) => Number(participant.lastSeen || 0) >= cutoff
  );
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

  creatorToken: randomUUID()

};


parties.push(party);

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

  if(existingParticipant){
    existingParticipant.name = name;
    existingParticipant.avatar = avatar || existingParticipant.avatar;
    existingParticipant.lastSeen = Date.now();
  } else {
    party.participants.push({ id: participantId, name, avatar, lastSeen: Date.now() });
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
  if (participant) {
    participant.name = name;
    participant.avatar = avatar || participant.avatar;
    participant.lastSeen = Date.now();
  } else {
    party.participants.push({ id, name, avatar, lastSeen: Date.now() });
  }

  updateParty(party);
  res.json(toPublicParty(party));
});

app.post("/party/:code/leave", (req, res) => {
  const party = findParty(req.params.code);
  if (!party) return res.status(404).json({ error: "Soirée introuvable" });
  const id = String(req.body.id || "").trim();
  party.participants = party.participants.filter((participant) => participant.id !== id);
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
  suggestionPool
} = req.body;



  if(!song){

    return res.status(400).json({
      error:"Chanson obligatoire"
    });

  }


console.log("CHANSON RECUE API :", req.body);
party.songs.push({

  title: song,

  videoId: videoId || "",

  thumbnail: thumbnail || "",

  votes: 0,

  addedBy: addedBy || "Inconnu",

  voters: [],

  played:false,

  addedAt: Date.now(),

  sourceQuery: typeof sourceQuery === "string" ? sourceQuery.trim() : undefined,

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
        }))
    : []

});

  recordMusicBrainAddition(party.songs[party.songs.length - 1]);

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

  updateParty(party);



  res.json(toPublicParty(party));


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
  party.currentSong = song;
  recordMusicBrainPlay(song, previousSong);

  updateParty(party);


  res.json(toPublicParty(party));


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

  if(party.currentSong){

    party.history.push(
      party.currentSong
    );

  }



  const nextSong = party.songs
.filter(song=>!song.played)
.sort((a,b)=>{

  if(b.votes !== a.votes){

    return b.votes - a.votes;

  }


  return a.addedAt - b.addedAt;

})[0];



  if(!nextSong){

    return res.status(400).json({
      error:"Plus de chansons disponibles"
    });

  }



  nextSong.played = true;

  party.currentSong = nextSong;
  recordMusicBrainPlay(nextSong, previousSong);

  updateParty(party);


  res.json(toPublicParty(party));

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
    socket.to(`party:${code}`).emit("playback_sync", {
      code,
      videoId: String(payload.videoId || ""),
      state: Number(payload.state),
      time: Number(payload.time || 0),
    });
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
  thumbnail: string;
  channelTitle?: string;
  durationSeconds?: number;
};

type SearchCacheEntry = {
  query: string;
  normalizedQuery: string;
  createdAt: number;
  results: YoutubeSearchResult[];
};

const YOUTUBE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const YOUTUBE_CACHE_MAX_ENTRIES = 500;
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

async function requestYoutubeMusic(query: string): Promise<YoutubeSearchResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YOUTUBE_API_KEY manquante");

  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "15",
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
      part: "contentDetails,status,snippet",
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
        return {
          ...result,
          durationSeconds: parseIsoDuration(String(detail?.contentDetails?.duration || "")),
          channelTitle: String(detail?.snippet?.channelTitle || result.channelTitle || ""),
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
      .slice(0, 8)
      .map((result: any): YoutubeSearchResult => ({
        id: result.id,
        title: result.title,
        thumbnail: result.thumbnail,
        channelTitle: result.channelTitle,
        durationSeconds: result.durationSeconds,
      }));
  } finally {
    clearTimeout(timeout);
  }
}

loadYoutubeCache();



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
    youtubeSearchStats.youtubeCalls += 1;
    inFlight = requestYoutubeMusic(query);
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