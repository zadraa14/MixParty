"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    cast?: any;
  }
}

type DisplayMode = "tv" | "karaoke";

type ReceiverStage =
  | "BOOT"
  | "SDK_LOADING"
  | "SDK_READY"
  | "WAITING_SENDER"
  | "SENDER_CONNECTED"
  | "MESSAGE_RECEIVED"
  | "DISPLAY_OPEN"
  | "ERROR";

const CAST_NAMESPACE = "urn:x-cast:fr.mixparty.display";

function normalizePartyCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export default function MixPartyCastV2ReceiverPage() {
  const [stage, setStage] = useState<ReceiverStage>("BOOT");
  const [partyCode, setPartyCode] = useState("");
  const [mode, setMode] = useState<DisplayMode>("tv");
  const [senderConnected, setSenderConnected] = useState(false);
  const [lastMessageAt, setLastMessageAt] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const contextRef = useRef<any>(null);
  const readyPingedSendersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryCode = normalizePartyCode(params.get("code"));
    const queryMode: DisplayMode = "tv";

    if (queryCode) {
      setPartyCode(queryCode);
      setMode(queryMode);
      setStage("MESSAGE_RECEIVED");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    function startReceiver() {
      if (cancelled) return;

      const framework = window.cast?.framework;
      const system = framework?.system;

      if (!framework?.CastReceiverContext || !system) {
        setStage("ERROR");
        setErrorMessage("SDK Cast Receiver indisponible.");
        return;
      }

      try {
        const context = framework.CastReceiverContext.getInstance();
        contextRef.current = context;

        setStage("SDK_READY");

        context.addCustomMessageListener(
          CAST_NAMESPACE,
          (event: { senderId?: string; data?: any }) => {
            const payload = event?.data || {};
            const nextCode = normalizePartyCode(
              payload.partyCode || payload.code
            );
            const nextMode: DisplayMode = "tv";

            setLastMessageAt(new Date().toLocaleTimeString("fr-FR"));
            setStage("MESSAGE_RECEIVED");

            if (nextCode) setPartyCode(nextCode);
            if (payload.mode) setMode(nextMode);

            try {
              if (event?.senderId) {
                context.sendCustomMessage(
                  CAST_NAMESPACE,
                  event.senderId,
                  {
                    type: "mixparty_display_ack",
                    receiver: "cast-v2",
                    partyCode: nextCode,
                    mode: nextMode,
                  }
                );
              }
            } catch (error) {
              console.warn("ACK Receiver Cast V2 non envoyé", error);
            }
          }
        );

        function announceReceiverReady() {
          const senders = context.getSenders?.() || [];
          const connected = senders.length > 0;

          setSenderConnected(connected);

          if (connected) {
            setStage((current) =>
              current === "MESSAGE_RECEIVED" || current === "DISPLAY_OPEN"
                ? current
                : "SENDER_CONNECTED"
            );
          }

          for (const sender of senders) {
            const senderId = String(sender?.id || "");
            if (!senderId || readyPingedSendersRef.current.has(senderId)) continue;

            readyPingedSendersRef.current.add(senderId);

            try {
              context.sendCustomMessage(
                CAST_NAMESPACE,
                senderId,
                {
                  type: "mixparty_receiver_ready",
                  receiver: "cast-v2",
                }
              );
              console.log("📺 Receiver ready envoyé au Sender", senderId);
            } catch (error) {
              console.warn("Impossible d'annoncer le Receiver au Sender", error);
            }
          }
        }

        context.addEventListener(system.EventType.SENDER_CONNECTED, () => {
          announceReceiverReady();
        });

        context.addEventListener(system.EventType.READY, () => {
          announceReceiverReady();
        });

        context.addEventListener(system.EventType.SENDER_DISCONNECTED, () => {
          const senders = context.getSenders?.() || [];
          const stillConnected = senders.length > 0;
          setSenderConnected(stillConnected);

          if (!stillConnected) {
            setStage((current) =>
              current === "DISPLAY_OPEN" ? current : "WAITING_SENDER"
            );
          }
        });

        context.start({
          customNamespaces: {
            [CAST_NAMESPACE]: system.MessageType.JSON,
          },
          disableIdleTimeout: true,
          statusText: "MixParty Cast V2",
        });

        setStage("WAITING_SENDER");

        // Certains appareils Android TV ne rejouent pas toujours SENDER_CONNECTED
        // si le sender est déjà présent au moment où le Receiver finit de démarrer.
        // On vérifie donc directement getSenders() pendant les premières secondes.
        announceReceiverReady();
        const senderProbe = window.setInterval(announceReceiverReady, 500);
        window.setTimeout(() => window.clearInterval(senderProbe), 10000);
      } catch (error) {
        console.error("Receiver Cast V2 init error", error);
        setStage("ERROR");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Erreur d’initialisation du Receiver."
        );
      }
    }

    setStage("SDK_LOADING");

    if (window.cast?.framework?.CastReceiverContext) {
      startReceiver();
    } else {
      const script = document.createElement("script");
      script.src =
        "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js";
      script.async = true;
      script.onload = startReceiver;
      script.onerror = () => {
        setStage("ERROR");
        setErrorMessage("Impossible de charger le SDK Google Cast.");
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!partyCode) return;

    const timer = window.setTimeout(() => {
      setStage("DISPLAY_OPEN");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [partyCode, mode]);

  const displayUrl = useMemo(() => {
    if (!partyCode) return "";

    return `/party/${encodeURIComponent(partyCode)}?display=tv&cast=1`;
  }, [mode, partyCode]);

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        background: "#05050d",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {stage === "DISPLAY_OPEN" && displayUrl ? (
        <iframe
          key={displayUrl}
          src={displayUrl}
          title="MixParty Cast"
          allow="autoplay; fullscreen"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            background: "#05050d",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display:
            stage === "DISPLAY_OPEN" && displayUrl ? "none" : "grid",
          placeItems: "center",
          padding: "32px",
          boxSizing: "border-box",
          background:
            "radial-gradient(circle at 30% 25%, rgba(168,85,247,.22), transparent 35%), radial-gradient(circle at 75% 70%, rgba(249,115,22,.14), transparent 30%), #05050d",
        }}
      >
        <section
          style={{
            width: "min(88vw, 720px)",
            boxSizing: "border-box",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: "32px",
            padding: "32px",
            background: "rgba(10,8,20,.88)",
            boxShadow: "0 30px 100px rgba(0,0,0,.55)",
            textAlign: "center",
          }}
        >
          <img
            src="/branding/icon.png"
            alt="MixParty"
            style={{
              display: "block",
              width: "84px",
              height: "84px",
              margin: "0 auto",
              objectFit: "contain",
            }}
          />

          <div
            style={{
              marginTop: "18px",
              fontSize: "12px",
              fontWeight: 900,
              letterSpacing: ".24em",
              color: "#d8b4fe",
            }}
          >
            MIXPARTY CAST V2
          </div>

          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "32px",
              lineHeight: 1.1,
              fontWeight: 900,
            }}
          >
            Diagnostic Receiver
          </h1>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gap: "10px",
              textAlign: "left",
            }}
          >
            {[
              ["1. Receiver chargé", "OK"],
              [
                "2. SDK Google Cast",
                stage === "SDK_LOADING" ? "CHARGEMENT" : "OK",
              ],
              [
                "3. Sender connecté",
                senderConnected ? "OK" : "EN ATTENTE",
              ],
              [
                "4. Code soirée reçu",
                partyCode || "EN ATTENTE",
              ],
              [
                "5. Mode demandé",
                partyCode ? mode.toUpperCase() : "EN ATTENTE",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "20px",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,.035)",
                }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,.62)",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  {label}
                </span>
                <strong
                  style={{
                    color:
                      value === "OK" || (label.includes("Code") && partyCode)
                        ? "#6ee7b7"
                        : value === "EN ATTENTE"
                          ? "#fbbf24"
                          : "#e9d5ff",
                    fontSize: "14px",
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>

          {lastMessageAt ? (
            <p
              style={{
                marginTop: "16px",
                color: "rgba(255,255,255,.42)",
                fontSize: "12px",
              }}
            >
              Dernier message reçu : {lastMessageAt}
            </p>
          ) : null}

          {errorMessage ? (
            <p
              style={{
                marginTop: "16px",
                color: "#fca5a5",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {errorMessage}
            </p>
          ) : null}
        </section>
      </div>

      {stage === "DISPLAY_OPEN" && displayUrl ? (
        <div
          style={{
            position: "absolute",
            right: "18px",
            top: "18px",
            zIndex: 100,
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: "999px",
            padding: "8px 12px",
            background: "rgba(0,0,0,.62)",
            color: "rgba(255,255,255,.72)",
            fontSize: "11px",
            fontWeight: 900,
          }}
        >
          CAST V2 · {partyCode} · {mode.toUpperCase()}
        </div>
      ) : null}
    </main>
  );
}
