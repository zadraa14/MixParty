"use client";

import { Headphones, QrCode, Radio, Sparkles, UsersRound } from "lucide-react";
import { GlowButton, GradientText, NeonBadge } from "./ui";

type MixPartyHeroProps = {
  creatingParty: boolean;
  onCreateParty: () => void;
  onJoinClick: () => void;
};

const FEATURES = [
  { title: "Invités illimités", text: "Tout le monde peut participer", icon: UsersRound, accent: "purple" },
  { title: "Vote en temps réel", text: "Les meilleurs titres passent devant", icon: Radio, accent: "pink" },
  { title: "PartyBrain", text: "Suggestions intelligentes", icon: Sparkles, accent: "cyan" },
  { title: "Ambiance garantie", text: "Le DJ automatique enchaîne", icon: Headphones, accent: "orange" },
] as const;

export default function MixPartyHero({ creatingParty, onCreateParty, onJoinClick }: MixPartyHeroProps) {
  return (
    <section className="relative z-10 text-center lg:text-left">
      <NeonBadge accent="purple" className="mixparty-reveal mixparty-reveal-delay-1 mixparty-hero-badge">
        <Sparkles className="h-3.5 w-3.5" />
        La playlist devient collective
      </NeonBadge>

      <h1 className="mixparty-hero-title mixparty-reveal mixparty-reveal-delay-2 mx-auto mt-7 max-w-[760px] font-[family:var(--font-exo-2)] text-[3rem] font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:mx-0 lg:text-[5.25rem]">
        <span className="block">La musique de la soirée</span>
        <span className="block">appartient à</span>
        <GradientText className="mt-1 block pb-2">tout le monde.</GradientText>
      </h1>

      <p className="mixparty-reveal mixparty-reveal-delay-3 mx-auto mt-6 max-w-[690px] text-base leading-7 text-white/62 sm:text-lg lg:mx-0">
        Crée une soirée, partage le QR Code et laisse tes invités ajouter leurs morceaux préférés.
        <span className="font-black text-white"> Les titres les plus votés passent en premier.</span>
      </p>

      <div className="mixparty-reveal mixparty-reveal-delay-4 mx-auto mt-8 flex max-w-[620px] flex-col gap-3 sm:flex-row lg:mx-0">
        <GlowButton accent="orange" size="lg" loading={creatingParty} onClick={onCreateParty} className="mixparty-main-cta min-h-14 flex-1">
          <Sparkles className="h-4 w-4" />
          Créer une soirée
        </GlowButton>
        <button type="button" onClick={onJoinClick} className="mixparty-secondary-cta min-h-14 flex-1">
          <QrCode className="h-4 w-4" />
          Rejoindre avec un code
        </button>
      </div>

      <div className="mixparty-feature-row mx-auto mt-9 grid max-w-[760px] grid-cols-2 gap-4 lg:mx-0 lg:grid-cols-4">
        {FEATURES.map(({ title, text, icon: Icon, accent }, index) => (
          <div key={title} className="mixparty-feature-item mixparty-reveal" style={{ animationDelay: `${700 + index * 90}ms` }}>
            <div className={`mixparty-feature-icon mixparty-feature-icon--${accent}`}><Icon className="h-5 w-5" /></div>
            <p className="mt-3 text-sm font-black text-white">{title}</p>
            <p className="mt-1 text-xs leading-5 text-white/42">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
