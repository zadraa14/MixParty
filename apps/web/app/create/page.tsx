"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  const [partyCode, setPartyCode] = useState("");

  function createParty() {

    const code =
      "MX" +
      Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

    router.push(`/party/${code}`);
  }


  return (
    <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-6">

      <div className="text-center max-w-xl">

        <h1 className="text-6xl font-bold mb-6">
          🎵 MixParty
        </h1>


        <p className="text-gray-400 text-xl mb-10">
          La playlist collaborative de vos soirées
        </p>


        <button
          onClick={createParty}
          className="bg-[#1DB954] text-black font-bold px-10 py-4 rounded-full text-lg mb-8"
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
            onClick={()=>{
              if(partyCode){
                router.push(`/party/${partyCode}`);
              }
            }}
            className="bg-[#8B5CF6] px-6 rounded-xl font-bold"
          >
            Rejoindre
          </button>

        </div>


      </div>

    </main>
  );
}