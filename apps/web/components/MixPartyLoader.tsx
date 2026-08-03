"use client";

import MixPartyBackground from "./MixPartyBackground";
import { MixPartyLogo, WaveDivider } from "./ui";

type MixPartyLoaderProps = { visible?: boolean };

export default function MixPartyLoader({ visible = true }: MixPartyLoaderProps) {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#05050d] text-white transition duration-700 ${visible ? "opacity-100" : "pointer-events-none scale-[1.025] opacity-0"}`}
    >
      <MixPartyBackground />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,13,.15)_52%,rgba(5,5,13,.72)_100%)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6 text-center">
        <div className="relative">
          <div className="absolute inset-[-42px] rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/24 to-orange-400/20 blur-3xl" />
          <div className="mp-loader-ring absolute inset-[-26px] rounded-full border border-purple-300/18" />
          <div className="mp-loader-ring mp-loader-ring--two absolute inset-[-42px] rounded-full border border-pink-300/10" />
          <MixPartyLogo variant="icon" size="xl" className="relative" />
        </div>

        <div className="mp-loader-copy mt-8">
          <MixPartyLogo variant="wordmark" size="lg" animated={false} />
          <p className="mt-3 text-sm font-semibold tracking-[0.025em] text-white/50">La musique appartient à tout le monde.</p>
        </div>

        <WaveDivider className="mt-8 w-48" />
        <p className="mp-loader-status mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/28">Préparation de l’ambiance</p>
      </div>

      <style jsx>{`
        @keyframes loaderRing { 0% { opacity: 0; transform: scale(.8); } 45% { opacity: .65; } 100% { opacity: 0; transform: scale(1.35); } }
        @keyframes loaderCopy { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes loaderStatus { 0%,100% { opacity: .25; } 50% { opacity: .75; } }
        .mp-loader-ring { animation: loaderRing 2.5s ease-out infinite; }
        .mp-loader-ring--two { animation-delay: .8s; }
        .mp-loader-copy { animation: loaderCopy 1s .25s cubic-bezier(.16,1,.3,1) both; }
        .mp-loader-status { animation: loaderStatus 1.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mp-loader-ring,.mp-loader-copy,.mp-loader-status { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
