"use client";

import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function InstallMixParty() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setIsIos(isIosDevice());
    setInstalled(isStandaloneMode());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service Worker MixParty indisponible", error);
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstalled(false);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }

    setShowInstructions(true);
  }

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="mp-install-button"
        aria-label="Installer MixParty sur l’écran d’accueil"
      >
        <span className="mp-install-button__glow" aria-hidden="true" />
        <Download className="h-4 w-4" />
        <span>Installer l’app</span>
      </button>

      {showInstructions && (
        <div className="mp-install-modal" role="dialog" aria-modal="true" aria-labelledby="mp-install-title">
          <button
            type="button"
            className="mp-install-modal__backdrop"
            onClick={() => setShowInstructions(false)}
            aria-label="Fermer"
          />

          <div className="mp-install-modal__panel">
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="mp-install-modal__close"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mp-install-modal__icon">
              <img src="/branding/icon.png" alt="" className="h-14 w-14 object-contain" />
            </div>

            <p className="mp-install-modal__eyebrow">MixParty sur ton téléphone</p>
            <h2 id="mp-install-title" className="mp-install-modal__title">
              Ajoute MixParty à ton écran d’accueil
            </h2>

            {isIos ? (
              <div className="mp-install-steps">
                <div className="mp-install-step">
                  <span className="mp-install-step__number">1</span>
                  <Share className="h-5 w-5 text-cyan-300" />
                  <p>Dans Safari, touche le bouton <strong>Partager</strong>.</p>
                </div>
                <div className="mp-install-step">
                  <span className="mp-install-step__number">2</span>
                  <PlusSquare className="h-5 w-5 text-orange-300" />
                  <p>Choisis <strong>Sur l’écran d’accueil</strong>.</p>
                </div>
                <div className="mp-install-step">
                  <span className="mp-install-step__number">3</span>
                  <Smartphone className="h-5 w-5 text-purple-300" />
                  <p>Touche <strong>Ajouter</strong>. MixParty s’ouvrira comme une application.</p>
                </div>
              </div>
            ) : (
              <div className="mp-install-steps">
                <div className="mp-install-step">
                  <span className="mp-install-step__number">1</span>
                  <Smartphone className="h-5 w-5 text-purple-300" />
                  <p>Ouvre le menu de ton navigateur.</p>
                </div>
                <div className="mp-install-step">
                  <span className="mp-install-step__number">2</span>
                  <Download className="h-5 w-5 text-orange-300" />
                  <p>Choisis <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>
                </div>
              </div>
            )}

            <button type="button" onClick={() => setShowInstructions(false)} className="mp-install-modal__done">
              J’ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
