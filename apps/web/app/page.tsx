"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MixPartyBackground from "../components/MixPartyBackground";
import MixPartyFooter from "../components/MixPartyFooter";
import MixPartyHeader from "../components/MixPartyHeader";
import MixPartyHero from "../components/MixPartyHero";
import MixPartyLoader from "../components/MixPartyLoader";
import PartyCard from "../components/PartyCard";
import { getApiBaseUrl } from "../lib/config";

export default function Home() {
  const router = useRouter();
  const [partyCode, setPartyCode] = useState("");
  const [creatingParty, setCreatingParty] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [loaderVisible, setLoaderVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setLoaderVisible(false), 1800);
    const removeTimer = window.setTimeout(() => setShowLoader(false), 2300);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  async function createParty() {
    if (creatingParty) return;
    setCreatingParty(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/party`, { method: "POST" });
      if (!response.ok) throw new Error(`Erreur API ${response.status}`);
      const party = (await response.json()) as { code?: string; creatorToken?: string };
      if (!party.code || !party.creatorToken) throw new Error("La réponse de création est incomplète.");
      localStorage.setItem(`mixparty_creator_${party.code}`, party.creatorToken);
      router.push(`/party/${party.code}`);
    } catch (error) {
      console.error(error);
      window.alert("Impossible de créer la soirée. Vérifie que l’API est démarrée.");
      setCreatingParty(false);
    }
  }

  function joinParty() {
    const normalizedCode = partyCode.trim().toUpperCase();
    if (!normalizedCode) {
      window.alert("Entre un code de soirée");
      return;
    }
    router.push(`/party/${normalizedCode}`);
  }

  return (
    <>
      {showLoader && <MixPartyLoader visible={loaderVisible} />}

      <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#070711] text-white">
        <MixPartyBackground />

        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-5 lg:px-8">
          <MixPartyHeader />

          <div className="flex flex-1 items-center py-5 sm:py-10 lg:py-16">
            <div className="grid w-full items-center gap-7 sm:gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-12">
              <MixPartyHero />
              <PartyCard
                partyCode={partyCode}
                creatingParty={creatingParty}
                onPartyCodeChange={setPartyCode}
                onCreateParty={createParty}
                onJoinParty={joinParty}
              />
            </div>
          </div>

          <MixPartyFooter />
        </div>
      </main>
    </>
  );
}
