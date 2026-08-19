import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Récap de soirée MixParty";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type PartyResult = {
  code: string;
  endedAt: number;
  durationMs: number;
  uniqueParticipants: number;
  totalVotes: number;
  songsPlayed: number;
  ranking: Array<{
    rank?: number;
    name?: string;
    votesReceived?: number;
    partyScore?: number;
  }>;
  host?: { name?: string } | null;
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://mixpartyapp.fr").replace(/\/+$/, "");

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(Number(ms || 0) / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

async function getPublicResult(code: string): Promise<PartyResult | null> {
  try {
    const response = await fetch(
      `${SITE_URL}/mixparty-api/party/${encodeURIComponent(code)}/share`,
      { cache: "no-store" },
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data?.result || null;
  } catch {
    return null;
  }
}

function fallbackImage(code: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          color: "white",
          background:
            "radial-gradient(circle at 15% 10%, rgba(139,92,246,.55), transparent 32%), radial-gradient(circle at 90% 15%, rgba(236,72,153,.40), transparent 30%), linear-gradient(135deg,#090313,#18072d 55%,#38102a)",
          fontFamily: "Arial",
        }}
      >
        <div style={{ fontSize: 62, fontWeight: 900 }}>MixParty</div>
        <div
          style={{
            marginTop: 18,
            fontSize: 26,
            letterSpacing: 6,
            color: "#f0abfc",
            fontWeight: 800,
          }}
        >
          RÉCAP DE SOIRÉE
        </div>
        <div style={{ marginTop: 50, fontSize: 74, fontWeight: 900 }}>
          Classement final
        </div>
        <div style={{ marginTop: 24, fontSize: 30, color: "#d1d5db" }}>
          Soirée {code}
        </div>
        <div
          style={{
            marginTop: 58,
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 26,
            color: "#e5e7eb",
          }}
        >
          mixpartyapp.fr/share/{code}
        </div>
      </div>
    ),
    size,
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = String(rawCode || "").trim().toUpperCase();
  const result = await getPublicResult(code);

  if (!result) return fallbackImage(code);

  const ranking = Array.isArray(result.ranking) ? result.ranking : [];
  const winner = ranking[0];
  const podium = ranking.slice(0, 3);
  const hostName = result.host?.name || "MixParty";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "54px",
          color: "white",
          background:
            "radial-gradient(circle at 10% 10%, rgba(139,92,246,.55), transparent 32%), radial-gradient(circle at 92% 12%, rgba(236,72,153,.42), transparent 28%), radial-gradient(circle at 88% 92%, rgba(249,115,22,.28), transparent 28%), #080211",
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            border: "1px solid rgba(255,255,255,.13)",
            borderRadius: 34,
            padding: "44px 48px",
            background: "rgba(7,4,17,.62)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 47, fontWeight: 900 }}>MixParty</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 19,
                  letterSpacing: 5,
                  color: "#f0abfc",
                  fontWeight: 800,
                }}
              >
                CLASSEMENT FINAL
              </div>
            </div>

            <div
              style={{
                display: "flex",
                border: "1px solid rgba(255,255,255,.13)",
                borderRadius: 999,
                padding: "13px 22px",
                fontSize: 20,
                fontWeight: 800,
                background: "rgba(255,255,255,.06)",
              }}
            >
              {result.code}
            </div>
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 28, flex: 1 }}>
            <div
              style={{
                flex: 1.1,
                display: "flex",
                flexDirection: "column",
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 30,
                padding: "30px",
                background: "rgba(255,255,255,.045)",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: 3,
                  color: "#fbbf24",
                  fontWeight: 900,
                }}
              >
                GRAND GAGNANT
              </div>

              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  style={{
                    width: 76,
                    height: 76,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    fontSize: 42,
                    background: "linear-gradient(135deg,#d946ef,#8b5cf6,#fb923c)",
                  }}
                >
                  🏆
                </div>

                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div style={{ fontSize: 48, fontWeight: 900 }}>
                    {winner?.name || "Champion"}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 23, color: "#d1d5db" }}>
                    {Number(winner?.votesReceived || 0)} vote
                    {Number(winner?.votesReceived || 0) > 1 ? "s" : ""} ·{" "}
                    {Number(winner?.partyScore || winner?.votesReceived || 0)} pts
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12 }}>
                {podium.map((row, index) => (
                  <div
                    key={`${row.name || index}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "13px 16px",
                      borderRadius: 18,
                      background: "rgba(255,255,255,.055)",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        marginRight: 14,
                        fontWeight: 900,
                        color: index === 0 ? "#1d1100" : "#ffffff",
                        background:
                          index === 0
                            ? "#fbbf24"
                            : index === 1
                              ? "#9ca3af"
                              : "#fb7185",
                      }}
                    >
                      #{index + 1}
                    </div>
                    <div style={{ flex: 1, fontSize: 24, fontWeight: 800 }}>
                      {row.name || `Participant ${index + 1}`}
                    </div>
                    <div style={{ fontSize: 20, color: "#fde68a", fontWeight: 800 }}>
                      {Number(row.votesReceived || 0)} vote
                      {Number(row.votesReceived || 0) > 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                width: 360,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[
                ["PARTICIPANTS", String(result.uniqueParticipants || 0)],
                ["VOTES", String(result.totalVotes || 0)],
                ["TITRES JOUÉS", String(result.songsPlayed || 0)],
                ["DURÉE", formatDuration(result.durationMs || 0)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    border: "1px solid rgba(255,255,255,.10)",
                    borderRadius: 24,
                    padding: "18px 22px",
                    background: "rgba(255,255,255,.045)",
                  }}
                >
                  <div style={{ fontSize: 14, letterSpacing: 2.5, color: "#c4b5fd", fontWeight: 800 }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 7, fontSize: 32, fontWeight: 900 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#cbd5e1",
              fontSize: 18,
            }}
          >
            <div>organisée par {hostName}</div>
            <div style={{ color: "#ffffff", fontWeight: 800 }}>
              mixpartyapp.fr/share/{result.code}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
