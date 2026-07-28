import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

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
  title: string;
  votes: number;
  addedBy: string;
};


type Party = {
  code: string;
  songs: Song[];
  participants: string[];
};


const parties: Party[] = [];



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



function updateParty(party:Party) {

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

    code:generateCode(),

    songs:[],

    participants:[]

  };


  parties.push(party);


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



  const {name} = req.body;



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
    addedBy
  } = req.body;



  if(!song){

    return res.status(400).json({
      error:"Chanson obligatoire"
    });

  }



  party.songs.push({

    title:song,

    votes:0,

    addedBy: addedBy || "Inconnu"

  });



  updateParty(party);



  res.json(party);


});




// Voter pour une chanson
app.post("/party/:code/song/:index/vote",(req,res)=>{


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



  song.votes++;



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