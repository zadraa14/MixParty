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
    songsAdded?: number;
  }>;
  topSongs?: Array<{
    title?: string;
    artistName?: string;
    votes?: number;
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

function formatDate(timestamp: number) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(timestamp || Date.now()));
  } catch {
    return "";
  }
}

function plural(value: number, singular: string, pluralWord?: string) {
  return `${value} ${value > 1 ? pluralWord || `${singular}s` : singular}`;
}

function getInitials(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "MP";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
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
          padding: 40,
          background:
            "radial-gradient(circle at 15% 10%, rgba(139,92,246,.55), transparent 32%), radial-gradient(circle at 90% 15%, rgba(236,72,153,.40), transparent 30%), radial-gradient(circle at 90% 90%, rgba(249,115,22,.20), transparent 30%), linear-gradient(135deg,#100726,#090313 55%,#2a0d26)",
          color: "white",
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRadius: 32,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(7,4,17,.78)",
            padding: 44,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#f0abfc",
                background: "rgba(217,70,239,.12)",
                border: "1px solid rgba(217,70,239,.28)",
              }}
            >
              Partage MixParty
            </div>

            <div style={{ marginTop: 28, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.05 }}>
                Classement de la soirée
              </div>
              <div style={{ marginTop: 14, fontSize: 24, color: "#d1d5db" }}>
                Code {code}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div style={{ fontSize: 24, color: "#e5e7eb" }}>
              mixpartyapp.fr/share/{code}
            </div>
            <div style={{ fontSize: 18, color: "#a1a1aa" }}>
              Récap prêt à partager
            </div>
          </div>
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
  const second = ranking[1];
  const third = ranking[2];
  const topSong = Array.isArray(result.topSongs) ? result.topSongs[0] : null;
  const hostName = result.host?.name || "MixParty";
  const winnerName = winner?.name || "Champion";
  const winnerVotes = Math.max(0, Number(winner?.votesReceived || 0));
  const winnerScore = Math.max(0, Number(winner?.partyScore || winner?.votesReceived || 0));
  const winnerSongs = Math.max(0, Number(winner?.songsAdded || 0));
  const partyDate = formatDate(result.endedAt);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 28,
          background:
            "radial-gradient(circle at 12% 8%, rgba(139,92,246,.55), transparent 32%), radial-gradient(circle at 85% 10%, rgba(236,72,153,.42), transparent 28%), radial-gradient(circle at 88% 88%, rgba(249,115,22,.22), transparent 26%), linear-gradient(135deg,#1b0e37 0%, #090313 48%, #2a0d26 100%)",
          color: "white",
          fontFamily: "Arial",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderRadius: 30,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(7,4,17,.78)",
            padding: 32,
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#f5d0fe",
                  background: "rgba(217,70,239,.12)",
                  border: "1px solid rgba(217,70,239,.28)",
                }}
              >
                Partage MixParty
              </div>

              <div style={{ marginTop: 18, fontSize: 58, fontWeight: 900, lineHeight: 1.02 }}>
                {winnerName} remporte la soirée
              </div>

              <div style={{ marginTop: 12, fontSize: 22, color: "#d1d5db" }}>
                {code} • {partyDate} • organisée par {hostName}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  padding: "12px 20px",
                  borderRadius: 999,
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: 1,
                  color: "#ffffff",
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.12)",
                }}
              >
                {code}
              </div>

              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  color: "#f0abfc",
                  fontWeight: 700,
                }}
              >
                mixpartyapp.fr/share/{code}
              </div>
            </div>
          </div>

          {/* MAIN */}
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 22,
              flex: 1,
            }}
          >
            {/* LEFT COLUMN */}
            <div
              style={{
                flex: 1.3,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {/* WINNER CARD */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 26,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div
                      style={{
                        width: 92,
                        height: 92,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 999,
                        fontSize: 34,
                        fontWeight: 900,
                        color: "#ffffff",
                        background: "linear-gradient(135deg,#d946ef 0%,#8b5cf6 50%,#fb923c 100%)",
                        border: "2px solid rgba(255,255,255,.15)",
                      }}
                    >
                      {getInitials(winnerName)}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          fontSize: 16,
                          letterSpacing: 3,
                          textTransform: "uppercase",
                          color: "#fbbf24",
                          fontWeight: 900,
                        }}
                      >
                        Grand gagnant
                      </div>

                      <div style={{ marginTop: 10, fontSize: 52, fontWeight: 900, lineHeight: 1 }}>
                        {winnerName}
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 22, color: "#d1d5db" }}>
                        <div>{plural(winnerVotes, "vote")}</div>
                        <div>•</div>
                        <div>{plural(winnerSongs, "titre")}</div>
                        <div>•</div>
                        <div>{plural(winnerScore, "pt")}</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 78,
                      height: 78,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 999,
                      fontSize: 34,
                      fontWeight: 900,
                      color: "#2a1500",
                      background: "linear-gradient(135deg,#fbbf24,#fde68a)",
                    }}
                  >
                    #1
                  </div>
                </div>
              </div>

              {/* PODIUM */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  borderRadius: 26,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.03)",
                  padding: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: "#c4b5fd",
                    fontWeight: 900,
                  }}
                >
                  Le podium
                </div>

                <div style={{ marginTop: 10, fontSize: 32, fontWeight: 900 }}>
                  Les rois de la soirée
                </div>

                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  {[winner, second, third]
                    .filter(Boolean)
                    .map((row, index) => {
                      const isWinner = index === 0;
                      const rowVotes = Math.max(0, Number(row?.votesReceived || 0));
                      const rowScore = Math.max(0, Number(row?.partyScore || row?.votesReceived || 0));

                      return (
                        <div
                          key={`${row?.name || index}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            padding: "16px 18px",
                            borderRadius: 18,
                            border: "1px solid rgba(255,255,255,.08)",
                            background: isWinner
                              ? "linear-gradient(90deg, rgba(251,191,36,.15), rgba(217,70,239,.08))"
                              : "rgba(255,255,255,.04)",
                          }}
                        >
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 14,
                              fontSize: 18,
                              fontWeight: 900,
                              color: isWinner ? "#241200" : "#ffffff",
                              background: isWinner
                                ? "#fbbf24"
                                : index === 1
                                  ? "#94a3b8"
                                  : "#fb7185",
                            }}
                          >
                            #{index + 1}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 24, fontWeight: 800 }}>
                              {row?.name || `Participant ${index + 1}`}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 16, color: "#cbd5e1" }}>
                              {plural(rowVotes, "vote")} • {plural(rowScore, "pt")}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              padding: "8px 14px",
                              borderRadius: 999,
                              fontSize: 18,
                              fontWeight: 900,
                              color: "#fde68a",
                              background: "rgba(255,255,255,.05)",
                              border: "1px solid rgba(255,255,255,.08)",
                            }}
                          >
                            {rowScore} pts
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div
              style={{
                width: 360,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  ["Participants", String(result.uniqueParticipants || 0)],
                  ["Votes", String(result.totalVotes || 0)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      borderRadius: 22,
                      border: "1px solid rgba(255,255,255,.10)",
                      background: "rgba(255,255,255,.04)",
                      padding: "18px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        letterSpacing: 2.5,
                        textTransform: "uppercase",
                        color: "#c4b5fd",
                        fontWeight: 900,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 36, fontWeight: 900 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 14 }}>
                {[
                  ["Titres joués", String(result.songsPlayed || 0)],
                  ["Durée", formatDuration(result.durationMs || 0)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      borderRadius: 22,
                      border: "1px solid rgba(255,255,255,.10)",
                      background: "rgba(255,255,255,.04)",
                      padding: "18px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        letterSpacing: 2.5,
                        textTransform: "uppercase",
                        color: "#c4b5fd",
                        fontWeight: 900,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 36, fontWeight: 900 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  borderRadius: 26,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                  padding: 22,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: "#fbbf24",
                    fontWeight: 900,
                  }}
                >
                  Morceau star
                </div>

                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, lineHeight: 1.15 }}>
                  {topSong?.title || "Le top morceau de la soirée"}
                </div>

                <div style={{ marginTop: 8, fontSize: 18, color: "#d1d5db" }}>
                  {topSong?.artistName || "MixParty"}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    alignSelf: "flex-start",
                    padding: "10px 14px",
                    borderRadius: 999,
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#1f1300",
                    background: "linear-gradient(135deg,#fbbf24,#fde68a)",
                  }}
                >
                  {plural(Math.max(0, Number(topSong?.votes || 0)), "vote")}
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 16,
                    color: "#cbd5e1",
                  }}
                >
                  <div>Classement final prêt à partager sur les réseaux.</div>
                  <div style={{ color: "#ffffff", fontWeight: 800 }}>
                    mixpartyapp.fr/share/{code}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}