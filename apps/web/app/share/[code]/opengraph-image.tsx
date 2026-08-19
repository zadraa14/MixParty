import { ImageResponse } from "next/og";
import sharp from "sharp";

export const alt = "Récap premium de soirée MixParty";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

  return (
    parts.map((part) => part.charAt(0).toUpperCase()).join("") || "MP"
  );
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


async function prepareAvatar(src?: string): Promise<ArrayBuffer | undefined> {
  const value = String(src || "").trim();
  if (!value) return undefined;

  try {
    let input: Buffer;

    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) {
      const commaIndex = value.indexOf(",");
      if (commaIndex < 0) return undefined;
      input = Buffer.from(value.slice(commaIndex + 1), "base64");
    } else {
      const url = /^https?:\/\//i.test(value)
        ? value
        : value.startsWith("/")
          ? `${SITE_URL}${value}`
          : "";

      if (!url) return undefined;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) return undefined;
        input = Buffer.from(await response.arrayBuffer());
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!input.length || input.length > 8 * 1024 * 1024) return undefined;

    const png = await sharp(input)
      .rotate()
      .resize(256, 256, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: false,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return Uint8Array.from(png).buffer;
  } catch {
    // Un avatar ne doit jamais pouvoir faire tomber l'image Open Graph.
    return undefined;
  }
}

function Avatar({
  name,
  image,
  sizeValue = 88,
  fontSize = 30,
}: {
  name?: string;
  image?: ArrayBuffer;
  sizeValue?: number;
  fontSize?: number;
}) {
  if (image) {
    return (
      <img
        // @ts-expect-error Satori accepte ArrayBuffer pour img src.
        src={image}
        width={sizeValue}
        height={sizeValue}
        alt=""
        style={{
          width: sizeValue,
          height: sizeValue,
          objectFit: "cover",
          borderRadius: 999,
          border: "2px solid rgba(255,255,255,.18)",
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
      }}
    >
      {initials(name)}
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
      <img
        src={BRAND_ICON}
        width="46"
        height="46"
        alt=""
        style={{
          width: 46,
          height: 46,
          objectFit: "contain",
          borderRadius: 12,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: -0.8,
          }}
        >
          MixParty
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 2,
            color: "#f0abfc",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 3.2,
          }}
        >
          PARTY RESULTS
        </div>
      </div>
    </div>
  );
}

function fallbackImage(code: string) {
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
                fontSize: 66,
                fontWeight: 900,
                letterSpacing: -2.4,
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
            <div style={{ display: "flex", color: "white", fontWeight: 800 }}>
              {`mixpartyapp.fr/share/${code}`}
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
  const podium = ranking.slice(0, 3);
  const topSong = Array.isArray(result.topSongs) ? result.topSongs[0] : null;

  const podiumAvatarImages = await Promise.all(
    podium.map((row) => prepareAvatar(row.avatar)),
  );
  const winnerAvatarImage =
    podiumAvatarImages[0] || (await prepareAvatar(result.host?.avatar));

  const winnerName = winner?.name || "Champion";
  const winnerVotes = Math.max(0, Number(winner?.votesReceived || 0));
  const winnerScore = Math.max(
    0,
    Number(winner?.partyScore || winner?.votesReceived || 0),
  );
  const winnerSongs = Math.max(0, Number(winner?.songsAdded || 0));
  const hostName = result.host?.name || "MixParty";

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
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "28px 32px",
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(5,2,13,.80)",
            boxShadow: "0 30px 100px rgba(0,0,0,.35)",
          }}
        >
          {/* TOP BAR */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Brand />

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                }}
              >
                {result.code}
              </div>
            </div>
          </div>

          {/* HEADLINE */}
          <div
            style={{
              marginTop: 20,
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
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 3.4,
                }}
              >
                LE GRAND GAGNANT
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 7,
                  fontSize: 51,
                  lineHeight: 0.98,
                  fontWeight: 900,
                  letterSpacing: -2.1,
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
                padding: "10px 15px",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg,rgba(217,70,239,.18),rgba(139,92,246,.18),rgba(249,115,22,.18))",
                border: "1px solid rgba(255,255,255,.11)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              Résultats officiels
            </div>
          </div>

          {/* CONTENT */}
          <div
            style={{
              marginTop: 19,
              display: "flex",
              gap: 18,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* WINNER / PODIUM */}
            <div
              style={{
                flex: 1.25,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderRadius: 24,
                  border: "1px solid rgba(251,191,36,.24)",
                  background:
                    "linear-gradient(105deg,rgba(251,191,36,.12),rgba(217,70,239,.08) 55%,rgba(139,92,246,.07))",
                }}
              >
                <Avatar
                  name={winnerName}
                  image={winnerAvatarImage}
                  sizeValue={82}
                  fontSize={28}
                />

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
                      letterSpacing: -0.7,
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
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#fbbf24",
                      fontSize: 44,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {winnerScore}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 4,
                      color: "#fde68a",
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 2.4,
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
                  padding: "15px 18px",
                  borderRadius: 24,
                  border: "1px solid rgba(255,255,255,.09)",
                  background: "rgba(255,255,255,.028)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    color: "#c4b5fd",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 2.6,
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
                    const medal =
                      index === 0
                        ? ["#fbbf24", "#261400"]
                        : index === 1
                          ? ["#cbd5e1", "#111827"]
                          : ["#fb7185", "#27070f"];

                    return (
                      <div
                        key={`${row.name || index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "9px 11px",
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
                            background: medal[0],
                            color: medal[1],
                            fontSize: 13,
                            fontWeight: 900,
                          }}
                        >
                          {`#${index + 1}`}
                        </div>

                        <div style={{ display: "flex", marginLeft: 10 }}>
                          <Avatar
                            name={row.name}
                            image={podiumAvatarImages[index]}
                            sizeValue={34}
                            fontSize={12}
                          />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            marginLeft: 10,
                            flex: 1,
                            fontSize: 18,
                            fontWeight: 800,
                          }}
                        >
                          {row.name || `Participant ${index + 1}`}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            color: index === 0 ? "#fde68a" : "#e5e7eb",
                            fontSize: 16,
                            fontWeight: 900,
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

            {/* STATS */}
            <div
              style={{
                width: 250,
                display: "flex",
                flexDirection: "column",
                gap: 10,
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
                    padding: "10px 15px",
                    borderRadius: 19,
                    border: "1px solid rgba(255,255,255,.09)",
                    background: "rgba(255,255,255,.035)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#c4b5fd",
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 2.1,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 4,
                      fontSize: 27,
                      fontWeight: 900,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* TOP SONG */}
            <div
              style={{
                width: 270,
                display: "flex",
                flexDirection: "column",
                padding: 17,
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,.09)",
                background:
                  "linear-gradient(180deg,rgba(249,115,22,.07),rgba(255,255,255,.025))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#fbbf24",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2.3,
                }}
              >
                MORCEAU DE LA SOIRÉE
              </div>

              {topSong?.thumbnail &&
              /^https?:\/\//i.test(topSong.thumbnail) ? (
                <img
                  src={topSong.thumbnail}
                  width="236"
                  height="116"
                  alt=""
                  style={{
                    width: 236,
                    height: 116,
                    marginTop: 12,
                    borderRadius: 17,
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,.10)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 236,
                    height: 116,
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 17,
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
                  marginTop: 12,
                  fontSize: 21,
                  lineHeight: 1.05,
                  fontWeight: 900,
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
                  marginTop: 11,
                  alignSelf: "flex-start",
                  padding: "7px 11px",
                  borderRadius: 999,
                  background: "rgba(251,191,36,.11)",
                  border: "1px solid rgba(251,191,36,.18)",
                  color: "#fde68a",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                {plural(Math.max(0, Number(topSong?.votes || 0)), "vote")}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div
            style={{
              marginTop: 15,
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
    size,
  );
}
