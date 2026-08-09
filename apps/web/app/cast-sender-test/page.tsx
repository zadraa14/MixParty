"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: any;
    chrome?: any;
  }
}

const APP_ID = "111703F0";
const NAMESPACE = "urn:x-cast:fr.mixparty.display";

export default function CastSenderTestPage() {
  const [sdk, setSdk] = useState("Chargement...");
  const [castState, setCastState] = useState("—");
  const [sessionState, setSessionState] = useState("—");
  const [device, setDevice] = useState("—");
  const [result, setResult] = useState("Aucun test lancé");
  const contextRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;

    const initialize = () => {
      if (disposed) return;

      try {
        const framework = window.cast?.framework;
        const chromeCast = window.chrome?.cast;

        if (!framework || !chromeCast) {
          setSdk("SDK présent mais API indisponible");
          return;
        }

        const context = framework.CastContext.getInstance();
        contextRef.current = context;

        context.setOptions({
          receiverApplicationId: APP_ID,
          autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
          resumeSavedSession: false,
        });

        const refresh = () => {
          try {
            setCastState(String(context.getCastState?.() || "—"));
            const session = context.getCurrentSession?.();
            setSessionState(String(session?.getSessionState?.() || "AUCUNE SESSION"));
            setDevice(
              String(
                session?.getCastDevice?.()?.friendlyName ||
                session?.getCastDevice?.()?.deviceId ||
                "—"
              )
            );
          } catch {}
        };

        context.addEventListener(
          framework.CastContextEventType.CAST_STATE_CHANGED,
          refresh
        );

        context.addEventListener(
          framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event: any) => {
            setSessionState(String(event?.sessionState || "—"));
            refresh();
          }
        );

        setSdk("OK");
        refresh();
      } catch (error: any) {
        setSdk("ERREUR");
        setResult(String(error?.message || error));
      }
    };

    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) initialize();
      else setSdk("SDK Google Cast indisponible");
    };

    if (window.cast?.framework && window.chrome?.cast) {
      initialize();
    } else {
      const script = document.createElement("script");
      script.src =
        "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
      script.async = true;
      script.onerror = () => setSdk("Échec chargement SDK");
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
    };
  }, []);

  async function requestCast() {
    const context = contextRef.current;

    if (!context) {
      setResult("CastContext indisponible");
      return;
    }

    setResult("Ouverture du sélecteur Google Cast...");

    try {
      await context.requestSession();

      const session = context.getCurrentSession?.();
      if (!session) {
        setResult("requestSession résolu mais aucune CastSession");
        return;
      }

      const metadata = session.getApplicationMetadata?.();
      const namespaces = Array.isArray(metadata?.namespaces)
        ? metadata.namespaces
            .map((entry: any) => String(entry?.name || entry || ""))
            .filter(Boolean)
        : [];

      setResult(
        `SESSION OK | app=${metadata?.applicationId || "?"} | namespaces=${
          namespaces.join(", ") || "aucun"
        }`
      );

      setSessionState(String(session.getSessionState?.() || "—"));
      setDevice(
        String(
          session.getCastDevice?.()?.friendlyName ||
          session.getCastDevice?.()?.deviceId ||
          "—"
        )
      );

      try {
        await session.sendMessage(NAMESPACE, {
          type: "mixparty_ping",
          source: "standalone_sender_test",
          sentAt: Date.now(),
        });
        setResult((current) => `${current} | PING envoyé`);
      } catch (error: any) {
        setResult(
          (current) =>
            `${current} | PING erreur=${String(
              error?.code || error?.description || error
            )}`
        );
      }
    } catch (error: any) {
      const code = String(error?.code || error || "unknown");
      setResult(`SESSION ERROR : ${code}`);
      console.error("Standalone Cast test:", error);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#070610",
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(760px, 94vw)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 28,
          padding: 30,
          background: "rgba(16,12,30,.96)",
        }}
      >
        <p style={{ color: "#d8b4fe", fontWeight: 900, letterSpacing: ".18em" }}>
          MIXPARTY · TEST INDÉPENDANT
        </p>
        <h1 style={{ fontSize: 34, margin: "10px 0 6px" }}>
          Google Cast Sender
        </h1>
        <p style={{ color: "rgba(255,255,255,.55)", marginBottom: 24 }}>
          Aucun PartyBrain, lecteur, Socket.IO ou logique de soirée.
        </p>

        {[
          ["Application ID", APP_ID],
          ["SDK Google Cast", sdk],
          ["Cast state", castState],
          ["Session state", sessionState],
          ["Appareil", device],
          ["Résultat", result],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "170px 1fr",
              gap: 14,
              padding: "12px 0",
              borderBottom: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <strong style={{ color: "rgba(255,255,255,.55)" }}>{label}</strong>
            <span style={{ wordBreak: "break-word" }}>{value}</span>
          </div>
        ))}

        <button
          onClick={requestCast}
          style={{
            width: "100%",
            marginTop: 24,
            padding: "16px 20px",
            border: 0,
            borderRadius: 16,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 900,
            color: "white",
            background:
              "linear-gradient(90deg, rgb(168,85,247), rgb(236,72,153), rgb(249,115,22))",
          }}
        >
          LANCER LE TEST CAST
        </button>
      </section>
    </main>
  );
}
