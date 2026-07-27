"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";

type Party = {
  code: string;
  songs: {
    title: string;
    votes: number;
    addedBy: string;
  }[];
  participants: string[];
};

export default function PartyPage() {

  const params = useParams();
  const code = params.code as string;

  const [party, setParty] = useState<Party | null>(null);

  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [song, setSong] = useState("");


  // Charger le prénom sauvegardé
  useEffect(() => {

    const saved = localStorage.getItem("playerName");

    if (saved) {
      setPlayerName(saved);
    }

  }, []);



  // Charger soirée + socket
  useEffect(() => {

    if (!code) return;


    async function loadParty(){

      const response = await fetch(
        `http://192.168.1.21:4000/party/${code}`
      );

      const data = await response.json();

      setParty(data);

    }


    loadParty();


    const socket = io(
      "http://192.168.1.21:4000"
    );


    socket.on(
      "party_updated",
      (updatedParty)=>{

        if(updatedParty.code === code){

          setParty(updatedParty);

        }

      }
    );


    return ()=>{

      socket.disconnect();

    };


  },[code]);




  async function joinParty(){

    if(!name.trim()) return;


    const response = await fetch(
      `http://192.168.1.21:4000/party/${code}/join`,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          name:name.trim()
        })
      }
    );


    const updated = await response.json();


    setParty(updated);


    localStorage.setItem(
      "playerName",
      name.trim()
    );


    setPlayerName(
      name.trim()
    );


    setName("");

  }




  async function addSong(){


    if(!song.trim()) return;


    const response = await fetch(
      `http://192.168.1.21:4000/party/${code}/song`,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({

          song:song.trim(),

          addedBy:
          playerName ||
          "Inconnu"

        })
      }
    );


    const updated = await response.json();


    setParty(updated);

    setSong("");

  }





  async function vote(index:number){


    const response = await fetch(
      `http://192.168.1.21:4000/party/${code}/song/${index}/vote`,
      {
        method:"POST"
      }
    );


    const updated = await response.json();


    setParty(updated);

  }




  if(!party){

    return(

      <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center">

        Chargement...

      </main>

    );

  }



return(

<main className="min-h-screen bg-[#09090B] text-white p-6">

<div className="max-w-xl mx-auto">


<h1 className="text-4xl font-bold mb-6">
🎵 MixParty
</h1>



<div className="bg-[#18181B] rounded-xl p-6 mb-6 text-center">


<p className="text-gray-400">
Code de soirée
</p>


<p className="text-5xl font-bold text-[#1DB954]">
{party.code}
</p>


<div className="bg-white inline-block p-4 rounded-xl mt-5">


<QRCodeCanvas

value={`http://192.168.1.21:3000/party/${party.code}`}

size={220}

/>


</div>


</div>




{!playerName ? (

<div className="bg-[#18181B] rounded-xl p-6 mb-6">


<h2 className="text-xl font-bold mb-3">
👋 Ton prénom
</h2>


<input

value={name}

onChange={(e)=>setName(e.target.value)}

placeholder="Prénom"

className="bg-[#27272A] rounded-xl p-3 w-full mb-3"

/>


<button

onClick={joinParty}

className="bg-[#1DB954] text-black font-bold px-5 py-3 rounded-xl"

>

Rejoindre

</button>


</div>


):(


<div className="bg-[#18181B] rounded-xl p-4 mb-6">

👋 Connecté en tant que :

<b className="text-[#1DB954]">
{" "}{playerName}
</b>


</div>


)}






<div className="bg-[#18181B] rounded-xl p-6 mb-6">


<h2 className="text-xl font-bold mb-3">
👥 Participants
</h2>


{party.participants.map((p,i)=>(

<p key={i}>
{p}
</p>

))}


</div>






<div className="bg-[#18181B] rounded-xl p-6">


<h2 className="text-xl font-bold mb-4">
🎶 Playlist
</h2>


<div className="flex gap-3 mb-5">


<input

value={song}

onChange={(e)=>setSong(e.target.value)}

placeholder="Nom de la chanson"

className="flex-1 bg-[#27272A] rounded-xl p-3"

/>


<button

onClick={addSong}

className="bg-[#1DB954] text-black font-bold px-5 rounded-xl"

>

Ajouter

</button>


</div>





{party.songs.map((s,i)=>(


<div key={i} className="bg-[#27272A] rounded-xl p-4 mb-3">


<p className="font-bold">
🎵 {s.title}
</p>


<p className="text-gray-400">
👤 Ajoutée par {s.addedBy}
</p>


<p>
👍 {s.votes}
</p>



<button

onClick={()=>vote(i)}

className="bg-[#8B5CF6] px-4 py-2 rounded-xl mt-2"

>

👍 Voter

</button>


</div>


))}



</div>



</div>

</main>


);


}