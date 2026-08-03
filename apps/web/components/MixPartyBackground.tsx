"use client";

const PARTICLES = Array.from({ length: 44 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 61) % 100}%`,
  size: 1 + (index % 4) * 0.7,
  duration: 10 + (index % 7) * 2.4,
  delay: -(index % 9) * 1.35,
  opacity: 0.22 + (index % 5) * 0.09,
}));

export default function MixPartyBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#05050d]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(20,9,38,0.5),transparent_58%),linear-gradient(180deg,#070711_0%,#090713_48%,#04040b_100%)]" />

      <div className="mp-aurora mp-aurora--purple" />
      <div className="mp-aurora mp-aurora--pink" />
      <div className="mp-aurora mp-aurora--orange" />
      <div className="mp-aurora mp-aurora--magenta" />

      <div className="mp-ribbon mp-ribbon--left" />
      <div className="mp-ribbon mp-ribbon--center" />
      <div className="mp-ribbon mp-ribbon--right" />

      <div className="mp-horizon" />
      <div className="mp-wave mp-wave--one" />

      <div className="mp-grid" />

      <div className="absolute inset-0">
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="mp-particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="mp-noise" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(2,2,8,0.2)_68%,rgba(2,2,8,0.56)_100%)]" />

      <style jsx>{`
        @keyframes mpBreathPurple {
          0%, 100% { transform: translate3d(-12%, -10%, 0) scale(0.94) rotate(-6deg); opacity: .78; }
          50% { transform: translate3d(4%, 4%, 0) scale(1.12) rotate(5deg); opacity: 1; }
        }

        @keyframes mpBreathPink {
          0%, 100% { transform: translate3d(6%, -8%, 0) scale(.92) rotate(5deg); opacity: .68; }
          50% { transform: translate3d(-6%, 8%, 0) scale(1.13) rotate(-5deg); opacity: .95; }
        }

        @keyframes mpBreathOrange {
          0%, 100% { transform: translate3d(10%, 4%, 0) scale(.93) rotate(-3deg); opacity: .62; }
          50% { transform: translate3d(-5%, -7%, 0) scale(1.15) rotate(4deg); opacity: .9; }
        }

        @keyframes mpRibbonFloat {
          0%, 100% { transform: translate3d(-4%, 0, 0) rotate(-6deg) scaleX(.96); }
          50% { transform: translate3d(4%, -18px, 0) rotate(5deg) scaleX(1.06); }
        }

        @keyframes mpGridMove {
          from { background-position: center 0, center 0; }
          to { background-position: center 76px, center 76px; }
        }

        @keyframes mpWaveMove {
          0%, 100% { transform: translate3d(-4%, 0, 0) scaleY(.85); opacity: .28; }
          50% { transform: translate3d(4%, -7px, 0) scaleY(1.12); opacity: .62; }
        }

        @keyframes mpParticleFloat {
          0% { transform: translate3d(0, 22px, 0) scale(.75); filter: brightness(.8); }
          50% { transform: translate3d(12px, -10px, 0) scale(1.25); filter: brightness(1.7); }
          100% { transform: translate3d(-8px, -42px, 0) scale(.85); filter: brightness(1); }
        }

        .mp-aurora {
          position: absolute;
          border-radius: 999px;
          filter: blur(92px);
          mix-blend-mode: screen;
          will-change: transform, opacity;
        }

        .mp-aurora--purple {
          left: -16vw;
          top: -22vh;
          width: 78vw;
          height: 82vh;
          background: radial-gradient(circle at 55% 45%, rgba(124,58,237,.92) 0%, rgba(124,58,237,.48) 28%, rgba(76,29,149,.14) 58%, transparent 76%);
          animation: mpBreathPurple 18s ease-in-out infinite;
        }

        .mp-aurora--pink {
          right: -20vw;
          top: -20vh;
          width: 76vw;
          height: 74vh;
          background: radial-gradient(circle at 40% 50%, rgba(236,72,153,.84) 0%, rgba(190,24,93,.42) 32%, rgba(88,28,135,.12) 60%, transparent 78%);
          animation: mpBreathPink 21s ease-in-out infinite;
        }

        .mp-aurora--orange {
          right: -18vw;
          bottom: -36vh;
          width: 78vw;
          height: 78vh;
          background: radial-gradient(circle at 42% 38%, rgba(249,115,22,.78) 0%, rgba(244,63,94,.34) 34%, rgba(120,53,15,.1) 62%, transparent 80%);
          animation: mpBreathOrange 23s ease-in-out infinite;
        }

        .mp-aurora--magenta {
          left: 20vw;
          bottom: -38vh;
          width: 62vw;
          height: 70vh;
          background: radial-gradient(circle at 50% 45%, rgba(217,70,239,.54), rgba(168,85,247,.2) 36%, transparent 72%);
          filter: blur(110px);
          mix-blend-mode: screen;
          animation: mpBreathPink 26s ease-in-out infinite reverse;
        }

        .mp-ribbon {
          position: absolute;
          height: 34vh;
          border-radius: 50%;
          filter: blur(34px);
          opacity: .64;
          mix-blend-mode: screen;
          will-change: transform;
          animation: mpRibbonFloat 14s ease-in-out infinite;
        }

        .mp-ribbon--left {
          left: -14vw;
          top: 22vh;
          width: 68vw;
          background: conic-gradient(from 100deg at 48% 50%, transparent 0deg, rgba(124,58,237,.7) 48deg, rgba(217,70,239,.46) 88deg, transparent 132deg);
        }

        .mp-ribbon--center {
          left: 16vw;
          top: 12vh;
          width: 70vw;
          background: conic-gradient(from 96deg at 52% 52%, transparent 0deg, rgba(236,72,153,.48) 46deg, rgba(124,58,237,.36) 82deg, transparent 132deg);
          animation-duration: 18s;
          animation-direction: reverse;
        }

        .mp-ribbon--right {
          right: -18vw;
          top: 28vh;
          width: 64vw;
          background: conic-gradient(from 106deg at 52% 50%, transparent 0deg, rgba(249,115,22,.66) 48deg, rgba(244,63,94,.38) 86deg, transparent 130deg);
          animation-duration: 16s;
        }

        .mp-horizon {
          position: absolute;
          inset-inline: 0;
          top: 48%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(168,85,247,.38), rgba(236,72,153,.62), rgba(249,115,22,.42), transparent);
          filter: blur(.5px) drop-shadow(0 0 18px rgba(236,72,153,.5));
          opacity: .75;
        }

        .mp-wave {
          position: absolute;
          left: -5%;
          width: 110%;
          height: 140px;
          top: 42%;
          border-radius: 50%;
          border-top: 1px solid rgba(244,114,182,.5);
          box-shadow: 0 -8px 30px rgba(236,72,153,.12);
          filter: drop-shadow(0 0 12px rgba(168,85,247,.32));
          animation: mpWaveMove 8s ease-in-out infinite;
        }

        .mp-wave--two {
          top: 45%;
          height: 120px;
          border-color: rgba(251,146,60,.36);
          animation-duration: 11s;
          animation-direction: reverse;
        }

        .mp-grid {
          position: absolute;
          left: -18%;
          right: -18%;
          bottom: -28%;
          height: 72%;
          transform: perspective(820px) rotateX(64deg);
          transform-origin: center top;
          background-image:
            linear-gradient(rgba(168,85,247,.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(236,72,153,.12) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.8) 20%, #000 100%);
          opacity: .68;
          animation: mpGridMove 11s linear infinite;
        }

        .mp-particle {
          position: absolute;
          border-radius: 999px;
          background: #fff;
          box-shadow:
            0 0 8px rgba(255,255,255,.95),
            0 0 18px rgba(236,72,153,.72),
            0 0 28px rgba(124,58,237,.4);
          animation-name: mpParticleFloat;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform, filter;
        }

        .mp-noise {
          position: absolute;
          inset: -50%;
          opacity: .035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.65'/%3E%3C/svg%3E");
          transform: rotate(7deg);
          mix-blend-mode: soft-light;
        }

        @media (max-width: 767px) {
          .mp-aurora { filter: blur(70px); }
          .mp-aurora--purple { width: 110vw; height: 72vh; left: -42vw; }
          .mp-aurora--pink { width: 100vw; right: -46vw; }
          .mp-aurora--orange { width: 110vw; right: -52vw; bottom: -28vh; }
          .mp-ribbon { opacity: .42; height: 28vh; }
          .mp-grid { opacity: .34; background-size: 52px 52px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mp-aurora,
          .mp-ribbon,
          .mp-wave,
          .mp-grid,
          .mp-particle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
