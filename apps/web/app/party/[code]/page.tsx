"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
  }
}

type Song = {
  title: string;
  videoId: string;
  thumbnail: string;
  votes: number;
  addedBy: string;
  voters: string[];
  played: boolean;
  addedAt: number;
};

type Party = {
  code: string;
  currentSong: Song | null;
  songs: Song[];
  history: Song[];
  participants: string[];
};

export default function PartyPage() {

  const params = useParams();
  const code = params.code as string;

  const [party, setParty] = useState<Party | null>(null);

  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const playerRef = useRef<any>(null);
  const changingSongRef = useRef(false);

  useEffect(() => {

    const saved = localStorage.getItem("playerName");

    if(saved){

      setPlayerName(saved);

    }

  }, []);

  useEffect(()=>{

    if(!code) return;

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

        if(updatedParty.code===code){

          console.log(
            "🔥 PARTY UPDATE",
            updatedParty
          );

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

    localStorage.setItem(
      "playerName",
      name.trim()
    );

    setPlayerName(name.trim());

    setParty(updated);

    setName("");

  }


  async function searchYoutube(){

    if(!search.trim()) return;

    const response = await fetch(
      `http://192.168.1.21:4000/search/youtube?q=${encodeURIComponent(search)}`
    );

    const data = await response.json();

    setResults(data);

  }


  async function addYoutubeSong(video:any){

    const response = await fetch(
      `http://192.168.1.21:4000/party/${code}/song`,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({

          song:video.title,

          videoId:video.id,

          thumbnail:video.thumbnail,

          addedBy:playerName || "Inconnu"

        })
      }
    );

    const updated = await response.json();

    setParty(updated);

  }


  async function vote(index:number){

    const response = await fetch(
      `http://192.168.1.21:4000/party/${code}/song/${index}/vote`,
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          name:playerName
        })
      }
    );

    const updated = await response.json();

    if(updated.error){

      alert(updated.error);

      return;

    }

    setParty(updated);

  }


  async function playSong(index:number){

    const response = await fetch(
      `http://192.168.1.21:4000/party/${code}/play/${index}`,
      {
        method:"POST"
      }
    );

    const updated = await response.json();

    setParty(updated);

  }


  async function nextSong(){

    if(changingSongRef.current){

      return;

    }

    changingSongRef.current = true;

    try{

      const response = await fetch(
        `http://192.168.1.21:4000/party/${code}/next`,
        {
          method:"POST"
        }
      );

      const updated = await response.json();

      if(updated.error){

        console.log(updated.error);

        changingSongRef.current = false;

        return;

      }

      setParty(updated);

      setTimeout(()=>{

        changingSongRef.current = false;

      },3000);

    }catch(error){

      console.error(error);

      changingSongRef.current = false;

    }

  }
    useEffect(()=>{

    if(!party?.currentSong?.videoId) return;

    function createPlayer(){

      if(
        !window.YT ||
        !window.YT.Player
      ){
        return;
      }

      if(playerRef.current){

        playerRef.current.destroy();

      }

      console.log(
        "🎬 Création du player",
        party.currentSong?.title
      );

      playerRef.current = new window.YT.Player(
        "youtube-player",
        {
          events:{

            onReady:()=>{

              console.log("✅ Player prêt");

            },

            onStateChange:(event:any)=>{

              console.log(
                "🎥 Etat YouTube :",
                event.data
              );

              // 0 = vidéo terminée
              if(event.data===0){

                console.log(
                  "🎵 Fin de la vidéo"
                );

                nextSong();

              }

            }

          }

        }
      );

    }

    if(!window.YT){

      const tag=document.createElement("script");

      tag.src="https://www.youtube.com/iframe_api";

      document.body.appendChild(tag);

      window.onYouTubeIframeAPIReady=createPlayer;

    }else{

      createPlayer();

    }

    return ()=>{

      if(playerRef.current){

        playerRef.current.destroy();

        playerRef.current=null;

      }

    };

  },[
    party?.currentSong?.videoId
  ]);



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




        {party.currentSong && (

          <div className="bg-[#18181B] rounded-xl p-4 mb-6">

            <h2 className="text-xl font-bold mb-3">

              🎬 Lecture en cours

            </h2>


            <iframe

              key={party.currentSong.videoId}

              id="youtube-player"

              className="w-full aspect-video rounded-xl"

              src={
                `https://www.youtube.com/embed/${party.currentSong.videoId}?enablejsapi=1&autoplay=1&rel=0`
              }

              title={party.currentSong.title}

              allow="autoplay; encrypted-media"

              allowFullScreen

            />


            <p className="mt-3 font-bold">

              🎵 {party.currentSong.title}

            </p>


          </div>

        )}




        <div className="bg-[#18181B] rounded-xl p-6 mb-6">


          <button

            onClick={nextSong}

            className="bg-[#F59E0B] text-black font-bold px-5 py-3 rounded-xl mb-5"

          >

            🎧 Lancer DJ

          </button>



          <h2 className="text-xl font-bold mb-4">

            🔎 Recherche YouTube

          </h2>



          <div className="flex gap-3 mb-5">


            <input

              value={search}

              onChange={(e)=>setSearch(e.target.value)}

              placeholder="Rechercher une musique"

              className="flex-1 bg-[#27272A] rounded-xl p-3"

            />


            <button

              onClick={searchYoutube}

              className="bg-[#1DB954] text-black font-bold px-5 rounded-xl"

            >

              Chercher

            </button>


          </div>
                    {
            results.map((video)=>(

              <div

                key={video.id}

                className="bg-[#27272A] rounded-xl p-3 mb-3 flex gap-3 items-center"

              >


                <img

                  src={video.thumbnail}

                  className="w-32 rounded-lg"

                />


                <div className="flex-1">


                  <p className="font-bold">

                    {video.title}

                  </p>


                  <button

                    onClick={()=>addYoutubeSong(video)}

                    className="bg-[#8B5CF6] text-white px-4 py-2 rounded-xl mt-2"

                  >

                    ➕ Ajouter

                  </button>


                </div>


              </div>

            ))
          }



        </div>




        {party.history?.length > 0 && (

          <div className="bg-[#18181B] rounded-xl p-6 mb-6">


            <h2 className="text-xl font-bold mb-4">

              📜 Historique

            </h2>


            {party.history.map((song,i)=>(


              <div

                key={i}

                className="bg-[#27272A] rounded-xl p-3 mb-3 flex gap-3"

              >


                <img

                  src={song.thumbnail}

                  className="w-20 rounded-lg"

                />


                <div>

                  <p className="font-bold">

                    🎵 {song.title}

                  </p>


                  <p className="text-gray-400">

                    👤 {song.addedBy}

                  </p>


                </div>


              </div>


            ))}


          </div>

        )}






        <div className="bg-[#18181B] rounded-xl p-6">


          <h2 className="text-xl font-bold mb-4">

            🎶 Playlist

          </h2>

{party.songs.filter(song=>!song.played).length > 0 && (

<div className="bg-[#27272A] rounded-xl p-4 mb-5">

<h3 className="font-bold text-lg mb-3">
⏭ File d'attente DJ
</h3>


{[...party.songs]
.filter(song=>!song.played)
.sort((a,b)=>b.votes-a.votes)
.map((song,i)=>(

<div
key={song.videoId}
className="flex gap-3 items-center mb-3 bg-[#18181B] p-3 rounded-xl"
>

<img
src={song.thumbnail}
className="w-16 h-16 rounded-lg"
/>


<div className="flex-1">

<p className="font-bold">

{i === 0 ? "🎧 Prochaine : " : `#${i+1} : `}

{song.title}

</p>


<p className="text-gray-400 text-sm">
👤 {song.addedBy}
</p>


<p className="text-gray-400 text-sm">
👍 {song.votes} votes
</p>


</div>


</div>

))}

</div>

)}


          {
            party.songs

            .filter(song=>!song.played)

            .sort((a,b)=>b.votes-a.votes)

            .map((s)=>(


              <div

                key={s.videoId}

                className="bg-[#27272A] rounded-xl p-4 mb-4"

              >


                <img

                  src={s.thumbnail}

                  className="w-32 rounded-lg mb-3"

                />



                <p className="font-bold">

                  🎵 {s.title}

                </p>


                <p className="text-gray-400">

                  👤 {s.addedBy}

                </p>


                <p>

                  👍 {s.votes}

                </p>



                <button

                  onClick={()=>vote(
                    party.songs.findIndex(
                      song=>song.videoId===s.videoId
                    )
                  )}

                  className="bg-[#8B5CF6] px-4 py-2 rounded-xl mt-3"

                >

                  👍 Voter

                </button>




                <button

onClick={()=>vote(
  party.songs.findIndex(
    song=>song.videoId===s.videoId
  )
)}

className="bg-[#1DB954] text-black px-4 py-2 rounded-xl mt-3 ml-2 font-bold"

>
👍 Ajouter vote
</button>


              </div>


            ))

          }



        </div>


      </div>


    </main>


  );


}