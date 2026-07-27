"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  const [partyCode, setPartyCode] = useState("");

 async function createParty() {
  console.log("Bouton cliqué");

  try {
    const response = await fetch("http://192.168.1.21:4000/party", {
      method: "POST",
    });

    const party = await response.json();

    alert("Soirée créée : " + party.code);

    router.push(`/party/${party.code}`);

  } catch (error) {
    console.error(error);
    alert("Erreur API");
  }
}

  return (
    <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center px-6">

      <div className="text-center max-w-xl">

        <h1 className="text-6xl font-bold mb-6">
          🎵 MixParty
        </h1>
<p className="text-red-500">
  VERSION TEST BENJI
</p>

        <p className="text-gray-400 text-xl mb-10">
          La playlist collaborative de vos soirées
        </p>


       <button
  onClick={() => {
    alert("BOUTON OK");
    createParty();
  }}
  className="bg-[#1DB954] text-black font-bold px-10 py-4 rounded-full text-lg mb-8"
>
  🎉 Créer une soirée
</button>


        <div className="flex gap-3">
<p className="text-red-500">
  PAGE ACCUEIL TEST
</p>
          <input
            placeholder="Code de soirée"
            value={partyCode}
            onChange={(e)=>setPartyCode(e.target.value)}
            className="flex-1 bg-[#18181B] rounded-xl p-4"
          />


          <button
  type="button"
  onClick={() => {
    alert("CLIC REJOINDRE");
  }}
  className="bg-red-600 px-6 py-4 rounded-xl font-bold"
>
  Rejoindre
</button>

        </div>


      </div>

    </main>
  );
}