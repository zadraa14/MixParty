import { ArrowUp, Music4, Sparkles } from "lucide-react";

const FEATURES = [
  {
    title: "Ajoute",
    text: "Recherche les morceaux de ton choix.",
    icon: Music4,
    accent: "purple",
  },
  {
    title: "Vote",
    text: "Fais monter tes titres préférés.",
    icon: ArrowUp,
    accent: "pink",
  },
  {
    title: "Profite",
    text: "Le DJ automatique gère la suite.",
    icon: Sparkles,
    accent: "orange",
  },
] as const;

const ACCENTS = {
  purple: {
    card: "hover:border-purple-400/25 hover:bg-purple-500/[0.07] hover:shadow-[0_20px_50px_rgba(124,58,237,0.12)]",
    glow: "bg-purple-500/10",
    iconBox: "border-purple-400/10 bg-purple-500/15 group-hover:border-purple-400/25 group-hover:bg-purple-500/25",
    icon: "text-purple-300",
  },
  pink: {
    card: "hover:border-pink-400/25 hover:bg-pink-500/[0.07] hover:shadow-[0_20px_50px_rgba(236,72,153,0.12)]",
    glow: "bg-pink-500/10",
    iconBox: "border-pink-400/10 bg-pink-500/15 group-hover:border-pink-400/25 group-hover:bg-pink-500/25",
    icon: "text-pink-300",
  },
  orange: {
    card: "hover:border-orange-400/25 hover:bg-orange-500/[0.07] hover:shadow-[0_20px_50px_rgba(249,115,22,0.12)]",
    glow: "bg-orange-500/10",
    iconBox: "border-orange-400/10 bg-orange-500/15 group-hover:border-orange-400/25 group-hover:bg-orange-500/25",
    icon: "text-orange-300",
  },
} as const;

export default function MixPartyHero() {
  return (
    <section className="text-center lg:text-left">
      <div className="mb-3 inline-flex sm:mb-6 items-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-300">
        <span>✦</span>
        La playlist devient collective
      </div>

      <h1 className="mx-auto max-w-3xl text-[2.15rem] lg:mx-0 lg:text-7xl sm:text-6xl font-black leading-[0.98] tracking-tight">
        La musique de la soirée appartient à
        <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-orange-300 bg-clip-text pb-2 text-transparent">tout le monde.</span>
      </h1>

      <p className="mx-auto mt-3 max-w-xl text-[0.95rem] lg:mx-0 lg:mt-6 lg:max-w-2xl lg:text-xl sm:text-lg leading-relaxed text-white/50">
        Crée une soirée, partage le QR Code et laisse tes invités ajouter leurs morceaux préférés.
        <span className="font-bold text-white/80"> Les titres les plus votés passent en premier.</span>
      </p>

      <div className="mx-auto mt-5 hidden max-w-2xl lg:mx-0 lg:mt-9 lg:grid gap-3 sm:grid-cols-3">
        {FEATURES.map(({ title, text, icon: Icon, accent }) => {
          const styles = ACCENTS[accent];
          return (
            <div key={title} className={`group relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.04] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 ${styles.card}`}>
              <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition duration-500 group-hover:opacity-100 ${styles.glow}`} />
              <div className={`relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl border shadow-[0_0_20px_rgba(168,85,247,0.08)] transition duration-300 group-hover:scale-110 ${styles.iconBox}`}>
                <Icon className={`h-5 w-5 ${styles.icon}`} />
              </div>
              <p className="relative font-black">{title}</p>
              <p className="relative mt-1 text-sm text-white/35 transition duration-300 group-hover:text-white/50">{text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
