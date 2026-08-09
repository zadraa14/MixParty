"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cast, Mic2, MonitorUp, Wifi, WifiOff } from "lucide-react";

declare global {
  interface Window {
    cast?: any;
  }
}

type DisplayMode = "tv" | "karaoke";

type CastDisplayMessage = {
  type?: string;
  partyCode?: string;
  code?: string;
  mode?: DisplayMode;
};

const CAST_NAMESPACE = "urn:x-cast:fr.mixparty.display";

function normalizePartyCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export default function MixPartyCastReceiverPage() {
  const [partyCode, setPartyCode] = useState("");
  const [mode, setMode] = useState<DisplayMode>("tv");
  const [castReady, setCastReady] = useState(false);
  const [senderConnected, setSenderConnected] = useState(false);
  const [receiverError, setReceiverError] = useState("");
  const contextRef = useRef<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryCode = normalizePartyCode(params.get("code"));
    const queryMode = params.get("mode") === "karaoke" ? "karaoke" : "tv";

    if (queryCode) setPartyCode(queryCode);
    setMode(queryMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function startReceiver() {
      if (cancelled || !window.cast?.framework?.CastReceiverContext) return;

      try {
        const context = window.cast.framework.CastReceiverContext.getInstance();
        contextRef.current = context;

        context.addCustomMessageListener(
          CAST_NAMESPACE,
          (event: { data?: CastDisplayMessage }) => {
            const payload = event?.data || {};
            const nextCode = normalizePartyCode(payload.partyCode || payload.code);
            const nextMode: DisplayMode =
              payload.mode === "karaoke" ? "karaoke" : "tv";

            if (nextCode) setPartyCode(nextCode);
            if (payload.mode) setMode(nextMode);
            setSenderConnected(true);
          }
        );

        const system = window.cast.framework.system;

        context.addEventListener(
          system.EventType.SENDER_CONNECTED,
          () => setSenderConnected(true)
        );

        context.addEventListener(
          system.EventType.SENDER_DISCONNECTED,
          () => {
            const senders = context.getSenders?.() || [];
            setSenderConnected(senders.length > 0);
          }
        );

        context.start({
          customNamespaces: {
            [CAST_NAMESPACE]: window.cast.framework.system.MessageType.JSON,
          },
          disableIdleTimeout: true,
        });

        setCastReady(true);
        setReceiverError("");
      } catch (error) {
        console.error("MixParty Cast Receiver init error", error);
        setReceiverError("Impossible d’initialiser Google Cast.");
      }
    }

    if (window.cast?.framework?.CastReceiverContext) {
      startReceiver();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src*="cast_receiver_framework.js"]'
      );

      if (existing) {
        existing.addEventListener("load", startReceiver, { once: true });
      } else {
        const script = document.createElement("script");
        script.src =
          "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js";
        script.async = true;
        script.onload = startReceiver;
        script.onerror = () =>
          setReceiverError("Le SDK Google Cast n’a pas pu être chargé.");
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const displayUrl = useMemo(() => {
    if (!partyCode) return "";

    if (mode === "karaoke") {
      return `/party/${encodeURIComponent(partyCode)}/karaoke?cast=1`;
    }

    return `/party/${encodeURIComponent(
      partyCode
    )}?display=tv&cast=1`;
  }, [mode, partyCode]);

  if (!partyCode) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#05050d] px-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(168,85,247,.22),transparent_35%),radial-gradient(circle_at_75%_70%,rgba(249,115,22,.14),transparent_30%)]" />
        <div className="relative z-10 w-full max-w-xl rounded-[36px] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_35px_120px_rgba(0,0,0,.5)] backdrop-blur-2xl">
          <img
            src="/branding/icon.png"
            alt="MixParty"
            className="mx-auto h-24 w-24 object-contain drop-shadow-[0_0_32px_rgba(168,85,247,.35)]"
          />

          <p className="mt-5 text-[11px] font-black uppercase tracking-[.3em] text-purple-300">
            Google Cast Receiver
          </p>
          <h1 className="mt-2 text-4xl font-black">
            MIX<span className="text-fuchsia-400">PARTY</span>
          </h1>

          <div className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black text-white/55">
            {receiverError ? (
              <WifiOff className="h-4 w-4 text-red-300" />
            ) : castReady ? (
              <Wifi className="h-4 w-4 text-emerald-300" />
            ) : (
              <Cast className="h-4 w-4 animate-pulse text-purple-300" />
            )}
            {receiverError
              ? receiverError
              : castReady
                ? senderConnected
                  ? "Téléphone connecté — attente de la soirée"
                  : "Prêt à recevoir MixParty"
                : "Initialisation du récepteur…"}
          </div>

          <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/40">
            Choisis « Caster sur une TV » depuis l’appareil DJ. La soirée
            apparaîtra ici automatiquement.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#05050d]">
      <iframe
        key={displayUrl}
        src={displayUrl}
        title={
          mode === "karaoke"
            ? `MixParty Karaoké ${partyCode}`
            : `MixParty Mode TV ${partyCode}`
        }
        className="absolute inset-0 h-full w-full border-0 bg-[#05050d]"
        allow="autoplay; fullscreen"
      />

      <div className="pointer-events-none absolute right-5 top-5 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white/60 backdrop-blur-xl">
        {mode === "karaoke" ? (
          <Mic2 className="h-3.5 w-3.5 text-fuchsia-300" />
        ) : (
          <MonitorUp className="h-3.5 w-3.5 text-purple-300" />
        )}
        {mode === "karaoke" ? "Karaoké" : "Mode TV"}
        <span className="text-white/20">•</span>
        {partyCode}
      </div>
    </main>
  );
}
