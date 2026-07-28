import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
dotenv.config();

console.log(
  "CLE YOUTUBE PRESENTE :",
  process.env.YOUTUBE_API_KEY?.substring(0,10)
);


const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
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


type Party = {
  code: string;
  songs: Song[];
  history: Song[];
  participants: string[];
  currentSong: Song | null;
  createdAt: number;
};

let parties: Party[] = [];

if(fs.existsSync("data.json")){

  const data = fs.readFileSync(
    "data.json",
    "utf-8"
  );

  parties = JSON.parse(data);

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
    "data.json",
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

function updateParty(party:Party) {

  saveParties();

  io.emit(
    "party_updated",
    party
  );

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

  createdAt: Date.now()

};


parties.push(party);

saveParties();

res.json(party);

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


  res.json(party);


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



  if(!party.participants.includes(name)){

    party.participants.push(name);

  }



  updateParty(party);


  res.json(party);


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



  res.json(party);


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



  res.json(party);


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


  res.json(party);


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


  res.json(party);

});
// Socket connexion
io.on("connection",(socket)=>{

  console.log(
    "Client connecté",
    socket.id
  );


  socket.on("disconnect",()=>{

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

const PORT = 4000;


httpServer.listen(
  PORT,
  "0.0.0.0",
  ()=>{
    
    console.log(
      `API démarrée sur http://0.0.0.0:${PORT}`
    );

  }
);