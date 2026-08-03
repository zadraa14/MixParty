import { ShieldCheck, Smartphone, Zap } from "lucide-react";
import { MixPartyLogo } from "./ui";

export default function MixPartyFooter() {
  return (
    <footer className="mt-10 border-t border-white/[0.07] py-6 sm:mt-16 sm:py-8">
      <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
        <div className="text-center sm:text-left">
          <MixPartyLogo variant="full" size="sm" animated={false} />
          <p className="mt-2 text-xs text-white/28">La musique appartient à tout le monde.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-orange-300" /> Temps réel</span>
          <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-purple-300" /> iPhone & Android</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Sans compte</span>
        </div>
      </div>
    </footer>
  );
}
