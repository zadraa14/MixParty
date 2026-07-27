"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  const [partyCode, setPartyCode] = useState("");


  async function createParty() {

    try {

      const response = await fetch(
        "http://192.168.1.21:4000/party",
        {
          method: "POST",
        }
      );


      const party = await response.json();


      router.push(`/party/${party.code}`);


    } catch (error) {

      console.error(error);
      alert("Erreur API");

    }

  }



  function joinParty() {

    if (!partyCode.trim()) {

      alert("Entre un code de soirée");
      return;

    }


    router.push(
      `/party/${partyCode.toUpperCase()}`
    );

  }



  return (

    <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-6">


      <div className="text-center max-w-xl">


        <h1 className="text-6xl font-bold mb-6">
          🎵 MixParty
        </h1>


        <p className="text-xl text-gray-300 mb-10">
          La playlist collaborative de vos soirées.
          <br />
          Une seule playlist, tous les amis aux commandes.
        </p>



        <div className="flex flex-col gap-4">


          <button

            onClick={createParty}

            className="bg-[#1DB954] hover:opacity-90 text-black font-bold px-8 py-4 rounded-full"

          >

            🎉 Créer une soirée

          </button>




          <div className="flex gap-3">


            <input

              placeholder="Code de soirée"

              value={partyCode}

              onChange={(e)=>setPartyCode(e.target.value)}

              className="flex-1 bg-[#18181B] rounded-xl p-4"

            />



            <button

              onClick={joinParty}

              className="bg-[#8B5CF6] hover:opacity-90 text-white font-bold px-8 py-4 rounded-full"

            >

              📱 Rejoindre

            </button>


          </div>


        </div>


      </div>


    </main>

  );

}