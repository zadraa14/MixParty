"use client";

const BARS = [
  ["0ms", "900ms", "18px"],
  ["110ms", "760ms", "30px"],
  ["220ms", "980ms", "22px"],
  ["70ms", "820ms", "38px"],
  ["180ms", "920ms", "27px"],
  ["290ms", "740ms", "34px"],
  ["140ms", "870ms", "20px"],
  ["250ms", "800ms", "29px"],
  ["40ms", "960ms", "16px"],
];

export default function MixPartyLoader({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-[#070711] px-6 text-white transition duration-500 ${
        visible ? "opacity-100" : "pointer-events-none scale-[1.03] opacity-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="mixparty-loader-background absolute inset-[-15%] bg-[radial-gradient(circle_at_50%_45%,rgba(124,58,237,0.16),transparent_34%),radial-gradient(circle_at_65%_55%,rgba(236,72,153,0.11),transparent_30%),radial-gradient(circle_at_35%_65%,rgba(249,115,22,0.08),transparent_28%)]" />
        <div className="mixparty-loader-orb-purple absolute left-[12%] top-[10%] h-52 w-52 rounded-full bg-purple-600/10 blur-[90px]" />
        <div className="mixparty-loader-orb-pink absolute bottom-[8%] right-[10%] h-64 w-64 rounded-full bg-pink-500/10 blur-[100px]" />
        <div className="mixparty-loader-orb-orange absolute bottom-[18%] left-[18%] h-40 w-40 rounded-full bg-orange-400/[0.07] blur-[80px]" />
        <span className="mixparty-loader-particle absolute left-[22%] top-[30%] h-1.5 w-1.5 rounded-full bg-purple-300/50 shadow-[0_0_12px_rgba(216,180,254,0.8)]" />
        <span className="mixparty-loader-particle mixparty-loader-particle-two absolute right-[25%] top-[23%] h-1 w-1 rounded-full bg-pink-300/50 shadow-[0_0_10px_rgba(249,168,212,0.8)]" />
        <span className="mixparty-loader-particle mixparty-loader-particle-three absolute bottom-[28%] left-[28%] h-1 w-1 rounded-full bg-orange-200/50 shadow-[0_0_10px_rgba(254,215,170,0.8)]" />
        <span className="mixparty-loader-particle mixparty-loader-particle-four absolute bottom-[32%] right-[20%] h-1.5 w-1.5 rounded-full bg-purple-200/40 shadow-[0_0_12px_rgba(233,213,255,0.7)]" />
      </div>

      <div className="relative flex flex-col items-center">
        <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
          <div className="mixparty-loader-wave absolute inset-4 rounded-full border border-purple-400/30" />
          <div className="mixparty-loader-wave mixparty-loader-wave-delay absolute inset-4 rounded-full border border-pink-400/25" />
          <div className="mixparty-loader-wave mixparty-loader-wave-third absolute inset-4 rounded-full border border-orange-300/15" />
          <div className="mixparty-loader-glow absolute inset-10 rounded-full bg-gradient-to-br from-purple-600/30 via-pink-500/20 to-orange-400/20 blur-2xl" />
          <div className="mixparty-loader-light-orbit absolute inset-7 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(168,85,247,0.8)_45deg,rgba(236,72,153,0.75)_85deg,rgba(249,115,22,0.65)_120deg,transparent_170deg)] p-px opacity-50">
            <div className="h-full w-full rounded-full bg-[#070711]" />
          </div>
          <div className="mixparty-loader-note absolute right-3 top-5 bg-gradient-to-br from-purple-300 via-pink-300 to-orange-200 bg-clip-text text-3xl font-black text-transparent">♪</div>
          <div className="mixparty-loader-logo relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-[44px] border border-white/10 bg-[#10101d]/90 shadow-[0_0_60px_rgba(168,85,247,0.25)] backdrop-blur-xl sm:h-40 sm:w-40">
            <div className="absolute inset-[2px] rounded-[42px] bg-gradient-to-br from-purple-600/15 via-pink-500/10 to-orange-400/10" />
            <div className="mixparty-loader-reflection absolute -left-16 top-[-30%] h-[160%] w-10 rotate-[22deg] bg-white/20 blur-md" />
            <img src="/mixparty-logo-officiel.svg" alt="MixParty" className="relative h-20 w-20 object-contain" />
          </div>
        </div>

        <div className="mt-7 text-center">
          <h1 className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-300 bg-clip-text text-3xl font-black tracking-[0.16em] text-transparent sm:text-4xl">MIXPARTY</h1>
          <p className="mt-3 text-sm font-medium tracking-wide text-white/45 sm:text-base">La musique appartient à tout le monde.</p>
        </div>

        <div className="mt-9 flex h-11 items-center justify-center gap-1.5">
          {BARS.map(([delay, duration, height], index) => (
            <span
              key={index}
              className="mixparty-loader-bar w-1.5 rounded-full bg-gradient-to-t from-purple-500 via-pink-400 to-orange-300"
              style={{ animationDelay: delay, animationDuration: duration, height }}
            />
          ))}
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-white/20">Chargement</p>
      </div>

      <style jsx>{`
        @keyframes breathing { 0%,100%{transform:scale(1)} 50%{transform:scale(1.045)} }
        @keyframes wave { 0%{opacity:0;transform:scale(.65)} 30%{opacity:.8} 100%{opacity:0;transform:scale(1.45)} }
        @keyframes glow { 0%,100%{opacity:.45;transform:scale(.9)} 50%{opacity:.9;transform:scale(1.12)} }
        @keyframes note { 0%{opacity:0;transform:translateY(16px) rotate(-8deg) scale(.8)} 25%{opacity:1} 75%{opacity:.8} 100%{opacity:0;transform:translateY(-48px) rotate(12deg) scale(1.15)} }
        @keyframes reflection { 0%,65%{opacity:0;transform:translateX(0) rotate(22deg)} 72%{opacity:.65} 86%,100%{opacity:0;transform:translateX(230px) rotate(22deg)} }
        @keyframes bar { 0%,100%{opacity:.35;transform:scaleY(.3)} 25%{opacity:.8;transform:scaleY(.75)} 50%{opacity:1;transform:scaleY(1)} 72%{opacity:.65;transform:scaleY(.5)} }
        @keyframes background { 0%,100%{opacity:.75;transform:scale(1) rotate(0)} 50%{opacity:1;transform:scale(1.08) rotate(3deg)} }
        @keyframes orbit { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes orbPurple { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(35px,25px,0) scale(1.15)} }
        @keyframes orbPink { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(-30px,-20px,0) scale(1.12)} }
        @keyframes orbOrange { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(20px,-28px,0)} }
        @keyframes particle { 0%,100%{opacity:.15;transform:translateY(8px) scale(.7)} 50%{opacity:.8;transform:translateY(-12px) scale(1.15)} }
        .mixparty-loader-background{animation:background 7s ease-in-out infinite}
        .mixparty-loader-logo{animation:breathing 2s ease-in-out infinite;will-change:transform}
        .mixparty-loader-wave{animation:wave 2.4s ease-out infinite}
        .mixparty-loader-wave-delay{animation-delay:.8s}
        .mixparty-loader-wave-third{animation-delay:1.6s}
        .mixparty-loader-glow{animation:glow 2s ease-in-out infinite}
        .mixparty-loader-light-orbit{animation:orbit 7s linear infinite}
        .mixparty-loader-orb-purple{animation:orbPurple 8s ease-in-out infinite}
        .mixparty-loader-orb-pink{animation:orbPink 10s ease-in-out infinite}
        .mixparty-loader-orb-orange{animation:orbOrange 9s ease-in-out infinite}
        .mixparty-loader-particle{animation:particle 3s ease-in-out infinite}
        .mixparty-loader-particle-two{animation-delay:.7s}
        .mixparty-loader-particle-three{animation-delay:1.4s}
        .mixparty-loader-particle-four{animation-delay:2.1s}
        .mixparty-loader-note{animation:note 2.4s ease-in-out infinite}
        .mixparty-loader-reflection{animation:reflection 4.5s ease-in-out infinite}
        .mixparty-loader-bar{animation-name:bar;animation-timing-function:ease-in-out;animation-iteration-count:infinite;transform-origin:center;will-change:transform,opacity}
        @media (prefers-reduced-motion:reduce){
          .mixparty-loader-background,.mixparty-loader-logo,.mixparty-loader-wave,.mixparty-loader-glow,.mixparty-loader-note,.mixparty-loader-reflection,.mixparty-loader-bar,.mixparty-loader-light-orbit,.mixparty-loader-orb-purple,.mixparty-loader-orb-pink,.mixparty-loader-orb-orange,.mixparty-loader-particle{animation:none}
        }
      `}</style>
    </div>
  );
}
