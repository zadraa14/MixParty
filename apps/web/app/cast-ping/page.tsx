"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    cast?: any;
  }
}

const CAST_NAMESPACE = "urn:x-cast:fr.mixparty.display";

export default function CastPingPage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [senderConnected, setSenderConnected] = useState(false);
  const [pingReceived, setPingReceived] = useState(false);
  const [senderCount, setSenderCount] = useState(0);
  const [lastPayload, setLastPayload] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    function startReceiver() {
      if (cancelled) return;

      const framework = window.cast?.framework;
      const system = framework?.system;

      if (!framework?.CastReceiverContext || !system) {
        setError("SDK Receiver indisponible");
        return;
      }

      try {
        const context = framework.CastReceiverContext.getInstance();

        context.addCustomMessageListener(
          CAST_NAMESPACE,
          (event: any) => {
            const payload = event?.data || {};
            setLastPayload(JSON.stringify(payload));

            if (payload?.type === "mixparty_ping") {
              setPingReceived(true);

              try {
                if (event?.senderId) {
                  context.sendCustomMessage(
                    CAST_NAMESPACE,
                    event.senderId,
                    {
                      type: "mixparty_pong",
                      received: true,
                    }
                  );
                }
              } catch (err) {
                console.warn("PONG non envoyé", err);
              }
            }
          }
        );

        const refreshSenders = () => {
          const senders = context.getSenders?.() || [];
          setSenderCount(senders.length);
          setSenderConnected(senders.length > 0);
        };

        context.addEventListener(system.EventType.SENDER_CONNECTED, () => {
          refreshSenders();
        });

        context.addEventListener(system.EventType.SENDER_DISCONNECTED, () => {
          refreshSenders();
        });

        context.start({
          customNamespaces: {
            [CAST_NAMESPACE]: system.MessageType.JSON,
          },
          disableIdleTimeout: true,
          statusText: "MixParty Cast Ping Test",
        });

        setSdkReady(true);

        const probe = window.setInterval(() => {
          refreshSenders();
        }, 500);

        window.setTimeout(() => window.clearInterval(probe), 15000);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Erreur Receiver");
      }
    }

    if (window.cast?.framework?.CastReceiverContext) {
      startReceiver();
    } else {
      const script = document.createElement("script");
      script.src =
        "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js";
      script.async = true;
      script.onload = startReceiver;
      script.onerror = () => setError("Impossible de charger le SDK Cast");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        display: "grid",
        placeItems: "center",
        background: "#05050d",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(88vw, 720px)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 32,
          background: "rgba(10,8,20,.9)",
          padding: 32,
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <img
          src="/branding/icon.png"
          alt="MixParty"
          style={{
            width: 88,
            height: 88,
            display: "block",
            margin: "0 auto",
            objectFit: "contain",
          }}
        />

        <p
          style={{
            marginTop: 18,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".24em",
            color: "#d8b4fe",
          }}
        >
          MIXPARTY CAST PING TEST
        </p>

        <h1 style={{ marginTop: 10, fontSize: 34, fontWeight: 900 }}>
          Test de communication
        </h1>

        <div
          style={{
            marginTop: 24,
            display: "grid",
            gap: 10,
            textAlign: "left",
          }}
        >
          {[
            ["SDK Receiver", sdkReady ? "OK" : "EN ATTENTE"],
            ["Sender connecté", senderConnected ? "OK" : "EN ATTENTE"],
            ["Nombre de senders", String(senderCount)],
            ["Ping reçu", pingReceived ? "OUI" : "NON"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(255,255,255,.035)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,.62)", fontWeight: 700 }}>
                {label}
              </span>
              <strong
                style={{
                  color:
                    value === "OK" || value === "OUI"
                      ? "#6ee7b7"
                      : "#fbbf24",
                }}
              >
                {value}
              </strong>
            </div>
          ))}
        </div>

        {lastPayload ? (
          <p
            style={{
              marginTop: 18,
              fontSize: 12,
              color: "rgba(255,255,255,.45)",
              wordBreak: "break-all",
            }}
          >
            Dernier message : {lastPayload}
          </p>
        ) : null}

        {error ? (
          <p
            style={{
              marginTop: 18,
              color: "#fca5a5",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
