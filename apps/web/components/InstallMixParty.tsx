"use client";

import { Download, Share2, PlusSquare, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    "beforeinstallprompt": BeforeInstallPromptEvent;
    "mixparty:pwa-install": CustomEvent;
  }
}

function detectStandalone() {
  if (typeof window === "undefined") return false;

  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosStandalone
  );
}

function detectIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallMixParty() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(detectStandalone());
    setIos(detectIOS());

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
      setDeferredPrompt(null);
    };

    const onRequestInstall = () => {
      if (detectStandalone()) {
        setInstalled(true);
      }
      setOpen(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("mixparty:pwa-install", onRequestInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("mixparty:pwa-install", onRequestInstall);
    };
  }, []);

  const mode = useMemo(() => {
    if (installed) return "installed";
    if (deferredPrompt) return "native";
    if (ios) return "ios";
    return "manual";
  }, [deferredPrompt, installed, ios]);

  async function installNative() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
      setOpen(false);
    }

    setDeferredPrompt(null);
  }

  if (!open) {
    return (
      <style jsx global>{`
        @media (display-mode: standalone) {
          .mixparty-pwa-install-trigger {
            display: none !important;
          }
        }

        html.mixparty-standalone .mixparty-pwa-install-trigger {
          display: none !important;
        }
      `}</style>
    );
  }

  return (
    <>
      <div className="mp-pwa-modal" role="dialog" aria-modal="true" aria-label="Installer MixParty">
        <button
          type="button"
          className="mp-pwa-modal__backdrop"
          aria-label="Fermer"
          onClick={() => setOpen(false)}
        />

        <section className="mp-pwa-modal__panel">
          <button
            type="button"
            className="mp-pwa-modal__close"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>

          <div className="mp-pwa-modal__app-icon">
            <img src="/icons/mixparty-192.png" alt="" />
          </div>

          <p className="mp-pwa-modal__eyebrow">APPLICATION MIXPARTY</p>
          <h2 className="mp-pwa-modal__title">
            {mode === "installed" ? "MixParty est déjà installée" : "Installer MixParty"}
          </h2>

          {mode === "installed" ? (
            <div className="mp-pwa-installed">
              <Smartphone size={22} />
              <p>
                Tu utilises déjà MixParty en mode application autonome.
              </p>
            </div>
          ) : mode === "native" ? (
            <>
              <p className="mp-pwa-modal__copy">
                Ajoute MixParty comme une vraie application : icône sur l’écran
                d’accueil, ouverture sans barre Chrome et affichage standalone.
              </p>

              <button
                type="button"
                className="mp-pwa-primary"
                onClick={() => void installNative()}
              >
                <Download size={18} />
                Installer maintenant
              </button>
            </>
          ) : mode === "ios" ? (
            <>
              <p className="mp-pwa-modal__copy">
                Sur iPhone/iPad, Safari ne peut pas déclencher l’installation
                automatiquement. Utilise le menu de partage.
              </p>

              <div className="mp-pwa-steps">
                <div className="mp-pwa-step">
                  <span>1</span>
                  <Share2 size={18} />
                  <p>Appuie sur <strong>Partager</strong> dans Safari.</p>
                </div>
                <div className="mp-pwa-step">
                  <span>2</span>
                  <PlusSquare size={18} />
                  <p>Choisis <strong>Sur l’écran d’accueil</strong>.</p>
                </div>
                <div className="mp-pwa-step">
                  <span>3</span>
                  <Smartphone size={18} />
                  <p>Valide <strong>Ajouter</strong> puis ouvre MixParty depuis son icône.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mp-pwa-modal__copy">
                Ton navigateur ne propose pas encore l’installation automatique.
                Ouvre son menu puis choisis <strong>Installer l’application</strong>
                ou <strong>Ajouter à l’écran d’accueil</strong>.
              </p>
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        .mp-pwa-modal {
          position: fixed;
          inset: 0;
          /* Toujours au-dessus de la navigation mobile MixParty et du player flottant. */
          z-index: 2147483000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding:
            max(16px, env(safe-area-inset-top))
            max(16px, env(safe-area-inset-right))
            max(16px, env(safe-area-inset-bottom))
            max(16px, env(safe-area-inset-left));
        }

        .mp-pwa-modal__backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(3,2,10,.78);
          backdrop-filter: blur(14px);
        }

        .mp-pwa-modal__panel {
          position: relative;
          width: min(100%, 440px);
          max-height: calc(
            100dvh -
            max(16px, env(safe-area-inset-top)) -
            max(16px, env(safe-area-inset-bottom)) -
            24px
          );
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 30px;
          padding: 25px 20px 20px;
          background:
            radial-gradient(circle at 18% 0%, rgba(139,92,246,.22), transparent 42%),
            radial-gradient(circle at 90% 18%, rgba(249,115,22,.15), transparent 38%),
            linear-gradient(180deg, rgba(24,18,39,.99), rgba(8,7,17,.99));
          color: white;
          box-shadow: 0 36px 120px rgba(0,0,0,.62);
          animation: mpPwaPanelIn 320ms cubic-bezier(.22,1,.36,1) both;
        }

        .mp-pwa-modal__panel::-webkit-scrollbar {
          display: none;
        }

        .mp-pwa-modal__close {
          position: sticky;
          float: right;
          right: 0;
          top: 0;
          z-index: 3;
          margin-top: -12px;
          margin-right: -7px;
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 999px;
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.7);
        }

        .mp-pwa-modal__app-icon {
          width: 74px;
          height: 74px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.13);
          border-radius: 21px;
          box-shadow: 0 16px 42px rgba(0,0,0,.38), 0 0 28px rgba(168,85,247,.15);
        }

        .mp-pwa-modal__app-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mp-pwa-modal__eyebrow {
          margin-top: 17px;
          text-align: center;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .22em;
          color: #c4b5fd;
        }

        .mp-pwa-modal__title {
          margin-top: 7px;
          text-align: center;
          font-family: var(--font-exo-2), sans-serif;
          font-size: 23px;
          line-height: 1.15;
          font-weight: 900;
        }

        .mp-pwa-modal__copy {
          margin: 13px auto 0;
          max-width: 350px;
          text-align: center;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255,255,255,.58);
        }

        .mp-pwa-primary {
          display: flex;
          width: 100%;
          min-height: 52px;
          margin-top: 20px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 17px;
          background: linear-gradient(115deg, #7c3aed, #ec4899, #f97316);
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 16px 38px rgba(124,58,237,.26);
        }

        .mp-pwa-steps {
          display: grid;
          gap: 9px;
          margin-top: 18px;
        }

        .mp-pwa-step {
          display: grid;
          grid-template-columns: 27px 22px 1fr;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 17px;
          padding: 12px;
          background: rgba(255,255,255,.045);
        }

        .mp-pwa-step > span {
          display: grid;
          width: 27px;
          height: 27px;
          place-items: center;
          border-radius: 999px;
          background: rgba(139,92,246,.18);
          color: #ddd6fe;
          font-size: 11px;
          font-weight: 900;
        }

        .mp-pwa-step p {
          font-size: 13px;
          line-height: 1.45;
          color: rgba(255,255,255,.65);
        }

        .mp-pwa-installed {
          display: flex;
          margin-top: 18px;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(52,211,153,.15);
          border-radius: 18px;
          padding: 14px;
          background: rgba(16,185,129,.08);
          color: #a7f3d0;
        }

        .mp-pwa-installed p {
          font-size: 13px;
          line-height: 1.5;
          font-weight: 800;
        }

        @keyframes mpPwaPanelIn {
          from { opacity: 0; transform: translateY(24px) scale(.975); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 767px) {
          .mp-pwa-modal__panel {
            padding-bottom: max(22px, env(safe-area-inset-bottom));
          }

          .mp-pwa-step {
            padding: 10px 11px;
          }
        }

        @media (max-height: 700px) {
          .mp-pwa-modal {
            align-items: flex-start;
          }

          .mp-pwa-modal__panel {
            margin-block: 8px;
          }

          .mp-pwa-modal__app-icon {
            width: 62px;
            height: 62px;
          }

          .mp-pwa-modal__title {
            font-size: 20px;
          }

          .mp-pwa-modal__copy {
            margin-top: 9px;
          }
        }

        @media (min-width: 768px) {
          .mp-pwa-modal {
            align-items: center;
          }
        }

        @media (display-mode: standalone) {
          .mixparty-pwa-install-trigger {
            display: none !important;
          }
        }

        html.mixparty-standalone .mixparty-pwa-install-trigger {
          display: none !important;
        }
      `}</style>
    </>
  );
}
