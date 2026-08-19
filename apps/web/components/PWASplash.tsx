"use client";

import { useEffect, useState } from "react";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosStandalone
  );
}

export default function PWASplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!isStandaloneMode()) return;

    document.documentElement.classList.add("mixparty-standalone");

    const sessionKey = "mixparty.pwa.splash.v1";
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");
    setVisible(true);

    const fade = window.setTimeout(() => setLeaving(true), 850);
    const hide = window.setTimeout(() => setVisible(false), 1250);

    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`mixparty-pwa-splash ${leaving ? "mixparty-pwa-splash--leaving" : ""}`}
    >
      <div className="mixparty-pwa-splash__orb mixparty-pwa-splash__orb--a" />
      <div className="mixparty-pwa-splash__orb mixparty-pwa-splash__orb--b" />

      <div className="mixparty-pwa-splash__content">
        <div className="mixparty-pwa-splash__icon-shell">
          <img
            src="/icons/mixparty-512.png"
            alt=""
            className="mixparty-pwa-splash__icon"
          />
        </div>
        <p className="mixparty-pwa-splash__name">MixParty</p>
        <p className="mixparty-pwa-splash__tagline">
          La musique appartient à tout le monde.
        </p>
      </div>

      <style jsx global>{`
        .mixparty-pwa-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          min-height: 100dvh;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 22% 12%, rgba(139,92,246,.24), transparent 36%),
            radial-gradient(circle at 82% 82%, rgba(249,115,22,.18), transparent 34%),
            linear-gradient(180deg, #090711 0%, #06050d 100%);
          opacity: 1;
          transition: opacity 380ms ease, visibility 380ms ease;
          padding:
            max(24px, env(safe-area-inset-top))
            max(24px, env(safe-area-inset-right))
            max(24px, env(safe-area-inset-bottom))
            max(24px, env(safe-area-inset-left));
        }

        .mixparty-pwa-splash--leaving {
          opacity: 0;
          visibility: hidden;
        }

        .mixparty-pwa-splash__content {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: center;
          text-align: center;
        }

        .mixparty-pwa-splash__icon-shell {
          display: grid;
          width: 116px;
          height: 116px;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 29px;
          background: rgba(255,255,255,.055);
          box-shadow:
            0 28px 90px rgba(0,0,0,.48),
            0 0 54px rgba(168,85,247,.18),
            inset 0 1px 0 rgba(255,255,255,.13);
        }

        .mixparty-pwa-splash__icon {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mixparty-pwa-splash__name {
          margin-top: 24px;
          font-family: var(--font-exo-2), sans-serif;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -.035em;
          color: #fff;
        }

        .mixparty-pwa-splash__tagline {
          margin-top: 7px;
          font-size: 12px;
          font-weight: 800;
          color: rgba(255,255,255,.44);
        }

        .mixparty-pwa-splash__orb {
          position: absolute;
          width: 44vw;
          aspect-ratio: 1;
          border-radius: 999px;
          filter: blur(70px);
          opacity: .17;
          pointer-events: none;
        }

        .mixparty-pwa-splash__orb--a {
          top: -10%;
          left: -14%;
          background: #8b5cf6;
        }

        .mixparty-pwa-splash__orb--b {
          right: -14%;
          bottom: -10%;
          background: #f97316;
        }
      `}</style>
    </div>
  );
}
