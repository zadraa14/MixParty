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
const dataFilePath = path.resolve(process.cwd(), "data.json");
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


type Song = {
  title:string;
  videoId:string;
  thumbnail:string;
  votes:number;
  addedBy:string;
  voters:string[];
  played:boolean;
  addedAt:number;
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
  addedBy
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

  addedAt: Date.now()

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


  party.currentSong = song;


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
app.get("/search/youtube", async (req, res) => {

  const query = req.query.q as string;


  if (!query) {
    return res.status(400).json({
      error: "Recherche manquante",
    });
  }


  try {

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`
    );


    const data:any = await response.json();


    console.log("REPONSE GOOGLE :", JSON.stringify(data, null, 2));


    if (!data.items) {

      return res.status(500).json({
        error: "Erreur Google YouTube",
        details: data.error,
      });

    }


    const videos = data.items.map((item:any) => ({

      id: item.id.videoId,

      title: item.snippet.title,

      thumbnail:
        item.snippet.thumbnails.medium.url,

    }));


    res.json(videos);


  } catch(error) {


    console.error("ERREUR YOUTUBE :", error);


    res.status(500).json({
      error:"Erreur recherche YouTube"
    });


  }

});

httpServer.listen(
  port,
  "0.0.0.0",
  ()=>{
    
    console.log(
      `API MixParty démarrée sur http://localhost:${port}`
    );

  }
);