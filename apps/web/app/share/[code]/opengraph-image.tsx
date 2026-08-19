import { ImageResponse } from "next/og";

export const alt = "Récap premium de soirée MixParty";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const runtime = "edge";

type RankingRow = {
  rank?: number;
  name?: string;
  avatar?: string;
  votesReceived?: number;
  partyScore?: number;
  songsAdded?: number;
};

type PartyResult = {
  code: string;
  endedAt: number;
  durationMs: number;
  uniqueParticipants: number;
  totalVotes: number;
  songsPlayed: number;
  ranking: RankingRow[];
  topSongs?: Array<{
    title?: string;
    artistName?: string;
    votes?: number;
    thumbnail?: string;
  }>;
  host?: { name?: string; avatar?: string } | null;
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://mixpartyapp.fr"
).replace(/\/+$/, "");

const BRAND_ICON = `${SITE_URL}/branding/icon.png`;

async function loadGoogleFont(fontFamily: string, weights: number[], text: string) {
  const query = new URLSearchParams({
    family: `${fontFamily}:wght@${weights.join(";")}`,
    text,
  });

  const css = await fetch(`https://fonts.googleapis.com/css2?${query.toString()}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "force-cache",
  }).then((res) => res.text());

  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype|woff2?)'\)/);
  if (!match) return null;
  return fetch(match[1]).then((res) => res.arrayBuffer());
}

function normalizeAssetUrl(value?: string) {
  const src = String(value || "").trim();
  if (!src) return "";
  if (/^https?:\/\//i.test(src) || /^data:/i.test(src)) return src;
  return `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

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

function initials(name?: string) {
  const parts = String(name || "MixParty")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "MP";
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

function Avatar({
  name,
  src,
  sizeValue = 84,
  fontSize = 30,
}: {
  name?: string;
  src?: string;
  sizeValue?: number;
  fontSize?: number;
}) {
  const safeSrc = normalizeAssetUrl(src);

  if (safeSrc) {
    return (
      <img
        src={safeSrc}
        width={sizeValue}
        height={sizeValue}
        alt=""
        style={{
          width: sizeValue,
          height: sizeValue,
          objectFit: "cover",
          borderRadius: 999,
          border: "2px solid rgba(255,255,255,.18)",
          boxShadow: "0 10px 28px rgba(0,0,0,.28)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: sizeValue,
        height: sizeValue,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        fontSize,
        fontWeight: 900,
        color: "#ffffff",
        background:
          "linear-gradient(135deg,#d946ef 0%,#8b5cf6 52%,#fb923c 100%)",
        border: "2px solid rgba(255,255,255,.18)",
        boxShadow: "0 10px 28px rgba(0,0,0,.28)",
      }}
    >
      {initials(name)}
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <img
        src={BRAND_ICON}
        width="54"
        height="54"
        alt=""
        style={{
          width: 54,
          height: 54,
          objectFit: "contain",
          borderRadius: 14,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 31,
            fontWeight: 900,
            letterSpacing: -1,
            fontFamily: '"Exo 2"',
          }}
        >
          MixParty
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 3,
            color: "#f0abfc",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 3.8,
          }}
        >
          PARTY RESULTS
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: 68,
        padding: "12px 16px",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,.09)",
        background: "rgba(255,255,255,.035)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#c4b5fd",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 2.1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 5,
          fontSize: 27,
          fontWeight: 900,
          fontFamily: '"Exo 2"',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function fallbackImage(code: string, fontData?: ArrayBuffer | null) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 28,
          color: "white",
          background:
            "radial-gradient(circle at 10% 8%,rgba(124,58,237,.60),transparent 34%),radial-gradient(circle at 90% 10%,rgba(236,72,153,.42),transparent 30%),radial-gradient(circle at 88% 95%,rgba(249,115,22,.24),transparent 30%),#07020d",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 42,
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(6,3,15,.78)",
          }}
        >
          <Brand />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "8px 15px",
                borderRadius: 999,
                border: "1px solid rgba(217,70,239,.30)",
                background: "rgba(217,70,239,.10)",
                color: "#f5d0fe",
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: 2.5,
              }}
            >
              RÉCAP DE SOIRÉE
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: -2,
                fontFamily: '"Exo 2"',
              }}
            >
              Classement final
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 13,
                fontSize: 25,
                color: "#d1d5db",
              }}
            >
              {`Soirée ${code}`}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#cbd5e1",
              fontSize: 18,
            }}
          >
            <div style={{ display: "flex" }}>La soirée continue en souvenir.</div>
            <div
              style={{
                display: "flex",
                color: "white",
                fontWeight: 800,
              }}
            >
              {`mixpartyapp.fr/share/${code}`}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "Exo 2", data: fontData, style: "normal", weight: 800 }]
        : [],
    },
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = String(rawCode || "").trim().toUpperCase();

  const [result, exo2] = await Promise.all([
    getPublicResult(code),
    loadGoogleFont(
      "Exo 2",
      [700, 800, 900],
      "MixParty PARTY RESULTS RÉCAP DE SOIRÉE LE GRAND GAGNANT Benjamin remporte la soirée Résultats officiels PARTICIPANTS VOTES TITRES JOUÉS DURÉE MORCEAU DE LA SOIRÉE PARTYSCORE PODIUM DE LA SOIRÉE Classement stats musique souvenirs 0123456789àéèùêâîôûçABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#·:/-",
    ).catch(() => null),
  ]);

  if (!result) return fallbackImage(code, exo2);

  const ranking = Array.isArray(result.ranking) ? result.ranking : [];
  const winner = ranking[0];
  const podium = ranking.slice(0, 3);
  const topSong = Array.isArray(result.topSongs) ? result.topSongs[0] : null;

  const winnerName = winner?.name || "Champion";
  const winnerVotes = Math.max(0, Number(winner?.votesReceived || 0));
  const winnerScore = Math.max(
    0,
    Number(winner?.partyScore || winner?.votesReceived || 0),
  );
  const winnerSongs = Math.max(0, Number(winner?.songsAdded || 0));
  const hostName = result.host?.name || "MixParty";
  const hostAvatar = result.host?.avatar;
  const topSongThumb = normalizeAssetUrl(topSong?.thumbnail);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 24,
          color: "white",
          background:
            "radial-gradient(circle at 8% 8%,rgba(124,58,237,.62),transparent 33%),radial-gradient(circle at 92% 6%,rgba(236,72,153,.40),transparent 28%),radial-gradient(circle at 92% 95%,rgba(249,115,22,.25),transparent 29%),linear-gradient(135deg,#0d041d 0%,#07020d 48%,#24091e 100%)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "30px 32px",
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,.11)",
            background:
              "linear-gradient(180deg,rgba(8,4,21,.92),rgba(6,2,15,.86))",
            boxShadow: "0 26px 100px rgba(0,0,0,.42)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -40,
              width: 260,
              height: 260,
              display: "flex",
              borderRadius: 999,
              background: "rgba(217,70,239,.10)",
              filter: "blur(40px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -50,
              bottom: -80,
              width: 340,
              height: 220,
              display: "flex",
              borderRadius: 999,
              background: "rgba(124,58,237,.10)",
              filter: "blur(40px)",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              borderRadius: 34,
              border: "1px solid rgba(255,255,255,.04)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Brand />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.05)",
                  color: "#d1d5db",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {formatDate(result.endedAt)}
              </div>

              <div
                style={{
                  display: "flex",
                  padding: "9px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(217,70,239,.25)",
                  background: "rgba(217,70,239,.10)",
                  color: "#f5d0fe",
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  fontFamily: '"Exo 2"',
                }}
              >
                {result.code}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 24,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  color: "#fbbf24",
                  fontSize: 13,
                  fontWeight: 900,
                  letterSpacing: 3.4,
                }}
              >
                LE GRAND GAGNANT
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: 53,
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: -1.8,
                  fontFamily: '"Exo 2"',
                }}
              >
                {`${winnerName} remporte la soirée`}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  color: "#cbd5e1",
                  fontSize: 17,
                }}
              >
                {`organisée par ${hostName} · ${plural(result.uniqueParticipants || 0, "participant")} · ${plural(result.totalVotes || 0, "vote")}`}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                padding: "11px 17px",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg,rgba(217,70,239,.18),rgba(139,92,246,.18),rgba(249,115,22,.18))",
                border: "1px solid rgba(255,255,255,.11)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 800,
                boxShadow: "0 12px 30px rgba(217,70,239,.14)",
              }}
            >
              Résultats officiels
            </div>
          </div>

          <div
            style={{
              marginTop: 17,
              display: "flex",
              gap: 16,
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: 1.28,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "18px 18px",
                  borderRadius: 24,
                  border: "1px solid rgba(251,191,36,.24)",
                  background:
                    "linear-gradient(105deg,rgba(251,191,36,.11),rgba(217,70,239,.08) 55%,rgba(139,92,246,.06))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
                }}
              >
                <div style={{ display: "flex", position: "relative" }}>
                  <Avatar
                    name={winnerName}
                    src={winner?.avatar || hostAvatar}
                    sizeValue={84}
                    fontSize={30}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: -6,
                      top: -6,
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 999,
                      background:
                        "linear-gradient(135deg,#facc15 0%,#fb923c 100%)",
                      border: "2px solid rgba(12,5,24,.9)",
                      fontSize: 15,
                    }}
                  >
                    👑
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginLeft: 17,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 32,
                      fontWeight: 900,
                      fontFamily: '"Exo 2"',
                    }}
                  >
                    {winnerName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 5,
                      gap: 10,
                      color: "#d1d5db",
                      fontSize: 16,
                    }}
                  >
                    <div style={{ display: "flex" }}>
                      {plural(winnerVotes, "vote")}
                    </div>
                    <div style={{ display: "flex" }}>•</div>
                    <div style={{ display: "flex" }}>
                      {plural(winnerSongs, "titre")}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    minWidth: 90,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#fbbf24",
                      fontSize: 48,
                      fontWeight: 900,
                      lineHeight: 1,
                      fontFamily: '"Exo 2"',
                    }}
                  >
                    {String(winnerScore)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 4,
                      color: "#fde68a",
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 2.2,
                    }}
                  >
                    PARTYSCORE
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "15px 16px",
                  borderRadius: 24,
                  border: "1px solid rgba(255,255,255,.09)",
                  background: "rgba(255,255,255,.028)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: "#c4b5fd",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 2.8,
                  }}
                >
                  PODIUM DE LA SOIRÉE
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: 10,
                    gap: 8,
                  }}
                >
                  {podium.map((row, index) => {
                    const score = Math.max(
                      0,
                      Number(row.partyScore || row.votesReceived || 0),
                    );
                    const medalBg =
                      index === 0
                        ? "linear-gradient(135deg,#fbbf24,#f59e0b)"
                        : index === 1
                          ? "linear-gradient(135deg,#e5e7eb,#94a3b8)"
                          : "linear-gradient(135deg,#fb7185,#f97316)";

                    return (
                      <div
                        key={`${row.name || index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "9px 10px",
                          borderRadius: 16,
                          background:
                            index === 0
                              ? "rgba(251,191,36,.08)"
                              : "rgba(255,255,255,.035)",
                          border: "1px solid rgba(255,255,255,.07)",
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 11,
                            background: medalBg,
                            color: index === 1 ? "#0f172a" : "#261400",
                            fontSize: 13,
                            fontWeight: 900,
                            fontFamily: '"Exo 2"',
                          }}
                        >
                          {`#${index + 1}`}
                        </div>

                        <div style={{ display: "flex", marginLeft: 10 }}>
                          <Avatar
                            name={row.name}
                            src={row.avatar}
                            sizeValue={36}
                            fontSize={12}
                          />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            marginLeft: 10,
                            flex: 1,
                            flexDirection: "column",
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              fontSize: 19,
                              fontWeight: 800,
                              fontFamily: '"Exo 2"',
                            }}
                          >
                            {row.name || `Participant ${index + 1}`}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            color: index === 0 ? "#fde68a" : "#e5e7eb",
                            fontSize: 16,
                            fontWeight: 900,
                            fontFamily: '"Exo 2"',
                          }}
                        >
                          {`${score} pts`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              style={{
                width: 248,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <StatCard
                label="Participants"
                value={String(result.uniqueParticipants || 0)}
              />
              <StatCard label="Votes" value={String(result.totalVotes || 0)} />
              <StatCard
                label="Titres joués"
                value={String(result.songsPlayed || 0)}
              />
              <StatCard label="Durée" value={formatDuration(result.durationMs || 0)} />
            </div>

            <div
              style={{
                width: 272,
                display: "flex",
                flexDirection: "column",
                padding: 17,
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,.09)",
                background:
                  "linear-gradient(180deg,rgba(249,115,22,.07),rgba(255,255,255,.025))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#fbbf24",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2.4,
                }}
              >
                MORCEAU DE LA SOIRÉE
              </div>

              {topSongThumb ? (
                <img
                  src={topSongThumb}
                  width="238"
                  height="114"
                  alt=""
                  style={{
                    width: 238,
                    height: 114,
                    marginTop: 12,
                    borderRadius: 18,
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,.10)",
                    boxShadow: "0 12px 30px rgba(0,0,0,.25)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 238,
                    height: 114,
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 18,
                    background:
                      "linear-gradient(135deg,rgba(217,70,239,.20),rgba(139,92,246,.16),rgba(249,115,22,.18))",
                    border: "1px solid rgba(255,255,255,.10)",
                  }}
                >
                  <Brand />
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  marginTop: 13,
                  fontSize: 22,
                  lineHeight: 1.05,
                  fontWeight: 900,
                  fontFamily: '"Exo 2"',
                }}
              >
                {topSong?.title || "Le hit de la soirée"}
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 6,
                  color: "#cbd5e1",
                  fontSize: 14,
                }}
              >
                {topSong?.artistName || "MixParty"}
              </div>

              <div
                style={{
                  display: "flex",
                  marginTop: 12,
                  alignSelf: "flex-start",
                  padding: "7px 11px",
                  borderRadius: 999,
                  background: "rgba(251,191,36,.11)",
                  border: "1px solid rgba(251,191,36,.18)",
                  color: "#fde68a",
                  fontSize: 14,
                  fontWeight: 900,
                  fontFamily: '"Exo 2"',
                }}
              >
                {plural(Math.max(0, Number(topSong?.votes || 0)), "vote")}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex" }}>
              Classement · stats · musique · souvenirs
            </div>
            <div
              style={{
                display: "flex",
                color: "#ffffff",
                fontWeight: 800,
              }}
            >
              {`mixpartyapp.fr/share/${result.code}`}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: exo2
        ? [{ name: "Exo 2", data: exo2, style: "normal", weight: 800 }]
        : [],
    },
  );
}
