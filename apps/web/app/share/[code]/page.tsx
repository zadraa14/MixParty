"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Crown, Download, Link2, Music2, Share2, Trophy, Users } from "lucide-react";
import { getApiBaseUrl } from "@/lib/config";

type RankingRow = {
  rank?: number;
  accountId: string;
  participantId?: string;
  name?: string;
  avatar?: string;
  isEphemeral?: boolean;
  partyScore: number;
  votesReceived: number;
  songsWithVotes: number;
  songsAdded: number;
};

type TopSong = {
  videoId?: string;
  title: string;
  artistName?: string;
  thumbnail?: string;
  votes: number;
  addedBy?: string;
  addedByAccountId?: string;
  played: boolean;
};

type PartyResult = {
  code: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  uniqueParticipants: number;
  totalVotes: number;
  songsPlayed: number;
  totalSongs: number;
  ranking: RankingRow[];
  topSongs: TopSong[];
  host?: { accountId: string; name: string; avatar?: string } | null;
};

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(Number(ms || 0) / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

function formatDate(timestamp: number) {
  const value = Number(timestamp || 0);
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(name?: string) {
  return String(name || "MixParty")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "MP";
}

function truncate(value: string | undefined, max: number) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}â€¦`;
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cardRowLabel(rank: number) {
  if (rank === 1) return "CHAMPION";
  if (rank === 2) return "2E PLACE";
  if (rank === 3) return "3E PLACE";
  return `TOP ${rank}`;
}

function buildStorySvg(result: PartyResult) {
  const winner = result.ranking?.[0];
  const top3 = (result.ranking || []).slice(0, 3);
  const songs = (result.topSongs || []).slice(0, 4);
  const stats = [
    { label: "Participants", value: String(result.uniqueParticipants || 0) },
    { label: "Votes", value: String(result.totalVotes || 0) },
    { label: "Titres jouÃ©s", value: String(result.songsPlayed || 0) },
    { label: "DurÃ©e", value: formatDuration(result.durationMs || 0) },
  ];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#140722" />
      <stop offset="55%" stop-color="#2a1050" />
      <stop offset="100%" stop-color="#5b1637" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d946ef" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#fb923c" />
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.16)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.04)" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="40" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)" />
  <circle cx="140" cy="190" r="180" fill="#7c3aed" opacity="0.25" filter="url(#glow)" />
  <circle cx="910" cy="250" r="210" fill="#ec4899" opacity="0.22" filter="url(#glow)" />
  <circle cx="870" cy="1690" r="240" fill="#f97316" opacity="0.18" filter="url(#glow)" />

  <rect x="54" y="54" width="972" height="1812" rx="42" fill="rgba(9,6,20,0.42)" stroke="rgba(255,255,255,0.10)" />

  <text x="120" y="155" fill="#ffffff" font-size="52" font-family="Arial, Helvetica, sans-serif" font-weight="800">MixParty</text>
  <text x="120" y="208" fill="#f0abfc" font-size="28" font-family="Arial, Helvetica, sans-serif" letter-spacing="4">RÃ‰CAP DE SOIRÃ‰E</text>

  <rect x="760" y="104" width="200" height="58" rx="29" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.10)" />
  <text x="860" y="142" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(result.code)}</text>

  <text x="120" y="315" fill="#ffffff" font-size="78" font-family="Arial, Helvetica, sans-serif" font-weight="900">Classement final</text>
  <text x="120" y="365" fill="#d1d5db" font-size="28" font-family="Arial, Helvetica, sans-serif">${escapeXml(formatDate(result.endedAt))} Â· organisÃ©e par ${escapeXml(result.host?.name || "MixParty")}</text>

  <rect x="120" y="420" width="840" height="244" rx="36" fill="rgba(16,12,35,0.78)" stroke="rgba(255,255,255,0.10)" />
  <text x="160" y="488" fill="#fbbf24" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="800" letter-spacing="2">GRAND GAGNANT</text>
  <text x="160" y="560" fill="#ffffff" font-size="58" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(truncate(winner?.name || "Champion", 22))}</text>
  <text x="160" y="615" fill="#e5e7eb" font-size="28" font-family="Arial, Helvetica, sans-serif">${escapeXml(String(winner?.votesReceived || 0))} votes Â· ${escapeXml(String(winner?.songsAdded || 0))} titres ajoutÃ©s</text>
  <rect x="755" y="470" width="145" height="145" rx="72" fill="url(#accent)" opacity="0.92" />
  <text x="827" y="566" text-anchor="middle" fill="#ffffff" font-size="72" font-family="Arial, Helvetica, sans-serif">ðŸ‘‘</text>

  ${stats.map((item, index) => {
    const x = 120 + (index % 2) * 420;
    const y = 725 + Math.floor(index / 2) * 135;
    return `
      <rect x="${x}" y="${y}" width="380" height="112" rx="28" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
      <text x="${x + 32}" y="${y + 44}" fill="#c4b5fd" font-size="20" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="1.5">${escapeXml(item.label.toUpperCase())}</text>
      <text x="${x + 32}" y="${y + 82}" fill="#ffffff" font-size="38" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(item.value)}</text>
    `;
  }).join("")}

  <text x="120" y="1068" fill="#f0abfc" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="800" letter-spacing="3">PODIUM</text>
  ${top3.map((row, index) => {
    const rank = Number(row.rank || index + 1);
    const y = 1105 + index * 150;
    return `
      <rect x="120" y="${y}" width="840" height="118" rx="30" fill="rgba(15,14,28,0.78)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="180" cy="${y + 59}" r="34" fill="${rank === 1 ? "#f59e0b" : rank === 2 ? "#9ca3af" : "#fb7185"}" />
      <text x="180" y="${y + 70}" text-anchor="middle" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="900">${rank}</text>
      <text x="240" y="${y + 52}" fill="#ffffff" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(truncate(row.name || `Participant ${rank}`, 22))}</text>
      <text x="240" y="${y + 86}" fill="#d1d5db" font-size="22" font-family="Arial, Helvetica, sans-serif">${escapeXml(cardRowLabel(rank))}</text>
      <text x="912" y="${y + 70}" text-anchor="end" fill="#fbbf24" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(String(row.votesReceived || 0))} votes</text>
    `;
  }).join("")}

  <text x="120" y="1585" fill="#fcd34d" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="800" letter-spacing="3">MORCEAUX LES PLUS VOTÃ‰S</text>
  ${songs.map((song, index) => {
    const y = 1620 + index * 64;
    return `
      <text x="130" y="${y}" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${index + 1}. ${escapeXml(truncate(song.title, 28))}</text>
      <text x="130" y="${y + 28}" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">${escapeXml(truncate(song.artistName || "Artiste inconnu", 32))}</text>
      <text x="950" y="${y + 14}" text-anchor="end" fill="#fbbf24" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(String(song.votes || 0))} â¤</text>
    `;
  }).join("")}

  <text x="540" y="1805" text-anchor="middle" fill="#ffffff" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="800">mixpartyapp.fr/share/${escapeXml(result.code)}</text>
  <text x="540" y="1846" text-anchor="middle" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">Partage ton classement sur Insta, Snap, Facebook ou X</text>
</svg>`;
}

function buildPostSvg(result: PartyResult) {
  const winner = result.ranking?.[0];
  const podium = (result.ranking || []).slice(0, 5);
  const songs = (result.topSongs || []).slice(0, 3);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#13051f" />
      <stop offset="55%" stop-color="#27104d" />
      <stop offset="100%" stop-color="#5f173d" />
    </linearGradient>
    <linearGradient id="accent2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d946ef" />
      <stop offset="50%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#fb923c" />
    </linearGradient>
  </defs>

  <rect width="1080" height="1350" fill="url(#bg2)" />
  <rect x="50" y="50" width="980" height="1250" rx="40" fill="rgba(8,6,18,0.45)" stroke="rgba(255,255,255,0.10)" />

  <text x="100" y="132" fill="#ffffff" font-size="52" font-family="Arial, Helvetica, sans-serif" font-weight="900">MixParty</text>
  <text x="100" y="175" fill="#f0abfc" font-size="24" font-family="Arial, Helvetica, sans-serif" letter-spacing="3">RÃ‰SULTAT DE SOIRÃ‰E</text>
  <text x="980" y="132" text-anchor="end" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(result.code)}</text>
  <text x="980" y="173" text-anchor="end" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">${escapeXml(formatDate(result.endedAt))}</text>

  <rect x="100" y="220" width="880" height="190" rx="34" fill="rgba(16,12,35,0.78)" stroke="rgba(255,255,255,0.10)" />
  <text x="140" y="278" fill="#fbbf24" font-size="20" font-family="Arial, Helvetica, sans-serif" font-weight="800" letter-spacing="2">GRAND GAGNANT</text>
  <text x="140" y="345" fill="#ffffff" font-size="56" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(truncate(winner?.name || "Champion", 25))}</text>
  <text x="140" y="388" fill="#d1d5db" font-size="24" font-family="Arial, Helvetica, sans-serif">${escapeXml(String(winner?.votesReceived || 0))} votes Â· ${escapeXml(String(result.uniqueParticipants || 0))} participants</text>
  <circle cx="890" cy="315" r="62" fill="url(#accent2)" />
  <text x="890" y="336" text-anchor="middle" fill="#ffffff" font-size="60" font-family="Arial, Helvetica, sans-serif">ðŸ†</text>

  <rect x="100" y="450" width="420" height="300" rx="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
  <text x="135" y="504" fill="#ffffff" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="900">Top classement</text>
  ${podium.map((row, index) => {
    const rank = Number(row.rank || index + 1);
    const y = 548 + index * 38;
    return `
      <text x="138" y="${y}" fill="#fcd34d" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="800">#${rank}</text>
      <text x="198" y="${y}" fill="#ffffff" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(truncate(row.name || `Participant ${rank}`, 20))}</text>
      <text x="485" y="${y}" text-anchor="end" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">${escapeXml(String(row.votesReceived || 0))} votes</text>
    `;
  }).join("")}

  <rect x="560" y="450" width="420" height="300" rx="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
  <text x="595" y="504" fill="#ffffff" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="900">Stats soirÃ©e</text>
  <text x="595" y="570" fill="#c4b5fd" font-size="22" font-family="Arial, Helvetica, sans-serif">DurÃ©e</text>
  <text x="930" y="570" text-anchor="end" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(formatDuration(result.durationMs || 0))}</text>
  <text x="595" y="622" fill="#c4b5fd" font-size="22" font-family="Arial, Helvetica, sans-serif">Votes</text>
  <text x="930" y="622" text-anchor="end" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(String(result.totalVotes || 0))}</text>
  <text x="595" y="674" fill="#c4b5fd" font-size="22" font-family="Arial, Helvetica, sans-serif">Titres jouÃ©s</text>
  <text x="930" y="674" text-anchor="end" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(String(result.songsPlayed || 0))}</text>
  <text x="595" y="726" fill="#c4b5fd" font-size="22" font-family="Arial, Helvetica, sans-serif">Total titres</text>
  <text x="930" y="726" text-anchor="end" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(String(result.totalSongs || 0))}</text>

  <rect x="100" y="790" width="880" height="370" rx="32" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
  <text x="140" y="848" fill="#ffffff" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="900">Morceaux les plus votÃ©s</text>
  ${songs.map((song, index) => {
    const y = 910 + index * 84;
    return `
      <text x="145" y="${y}" fill="#ffffff" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">${index + 1}. ${escapeXml(truncate(song.title, 36))}</text>
      <text x="145" y="${y + 28}" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">${escapeXml(truncate(song.artistName || "Artiste inconnu", 42))}</text>
      <text x="935" y="${y + 12}" text-anchor="end" fill="#fbbf24" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(String(song.votes || 0))} â¤</text>
    `;
  }).join("")}

  <text x="540" y="1235" text-anchor="middle" fill="#ffffff" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="800">mixpartyapp.fr/share/${escapeXml(result.code)}</text>
  <text x="540" y="1272" text-anchor="middle" fill="#d1d5db" font-size="18" font-family="Arial, Helvetica, sans-serif">La musique, les votes, le classementâ€¦ tout le recap en un lien.</text>
</svg>`;
}

function Avatar({
  name,
  src,
  size = "h-12 w-12",
}: {
  name?: string;
  src?: string;
  size?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${size} shrink-0 rounded-full border border-white/10 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${size} grid shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.07] text-xs font-black text-white/70`}
    >
      {initials(name)}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center gap-2 text-white/70">
        <span className="text-fuchsia-300">{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/60">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  );
}

export default function PartySharePage() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code || "").trim().toUpperCase();

  const [result, setResult] = useState<PartyResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<"story" | "post" | "">("");

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${getApiBaseUrl()}/party/${encodeURIComponent(code)}/share`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.result) {
          throw new Error(data?.error || "RÃ©cap indisponible.");
        }

        setResult(data.result);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e instanceof Error ? e.message : "RÃ©cap indisponible.");
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [code]);

  const shareUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://mixpartyapp.fr/share/${encodeURIComponent(code)}`;

  const shareText = useMemo(() => {
    const winner = result?.ranking?.[0]?.name;
    return winner
      ? `ðŸ† ${winner} remporte la soirÃ©e MixParty ${result?.code} ! DÃ©couvre le classement ðŸ‘‡`
      : `ðŸŽ‰ DÃ©couvre le rÃ©cap de la soirÃ©e MixParty ${code} !`;
  }, [result, code]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie ce lien :", shareUrl);
    }
  }

  async function nativeShare() {
    if (!result) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `MixParty Â· ${result.code}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }

    await copyLink();
  }

  async function downloadFromSvg(svg: string, filename: string, width: number, height: number) {
    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const img = new window.Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      throw new Error("Canvas indisponible");
    }

    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = filename;
    link.click();
  }

  async function downloadStory() {
    if (!result) return;
    try {
      setDownloading("story");
      await downloadFromSvg(
        buildStorySvg(result),
        `mixparty-story-${result.code}.png`,
        1080,
        1920,
      );
    } finally {
      setDownloading("");
    }
  }

  async function downloadPost() {
    if (!result) return;
    try {
      setDownloading("post");
      await downloadFromSvg(
        buildPostSvg(result),
        `mixparty-post-${result.code}.png`,
        1080,
        1350,
      );
    } finally {
      setDownloading("");
    }
  }

  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05010c] text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-8 py-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.32em] text-fuchsia-300">MixParty</div>
            <div className="text-3xl font-black">Chargement du rÃ©capâ€¦</div>
          </div>
        </div>
      </div>
    );
  }

  if (!result || error) {
    return (
      <div className="min-h-screen overflow-hidden bg-[#05010c] text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.35),transparent_28%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.16),transparent_24%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-[34px] border border-white/10 bg-[#090614]/90 px-8 py-9 text-center shadow-[0_30px_120px_rgba(0,0,0,0.42)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-fuchsia-300">
              <Share2 className="h-7 w-7" />
            </div>
            <div className="mb-2 text-4xl font-black">RÃ©cap indisponible</div>
            <div className="mb-7 text-base text-white/65">{error || "Impossible de rÃ©cupÃ©rer ce partage."}</div>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
            >
              Retour Ã  lâ€™accueil
            </a>
          </div>
        </div>
      </div>
    );
  }

  const winner = result.ranking?.[0];
  const topThree = (result.ranking || []).slice(0, 3);
  const topSongs = (result.topSongs || []).slice(0, 5);

  return (
    <div className="min-h-screen overflow-hidden bg-[#05010c] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.38),transparent_28%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:54px_54px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[34px] border border-white/10 bg-[#090614]/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-200">
              <Share2 className="h-3.5 w-3.5" />
              Partage MixParty
            </div>
            <h1 className="text-3xl font-black sm:text-4xl lg:text-5xl">Classement de la soirÃ©e</h1>
            <p className="mt-2 text-sm text-white/65 sm:text-base">
              {result.code} Â· {formatDate(result.endedAt)} Â· organisÃ©e par {result.host?.name || "MixParty"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {copied ? "Lien copiÃ©" : "Copier le lien"}
            </button>
            <button
              onClick={nativeShare}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-orange-400 px-5 py-3 text-sm font-black text-white shadow-[0_16px_50px_rgba(217,70,239,0.35)] transition hover:scale-[1.02]"
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Participants" value={String(result.uniqueParticipants || 0)} />
          <StatCard icon={<Trophy className="h-4 w-4" />} label="Votes" value={String(result.totalVotes || 0)} />
          <StatCard icon={<Music2 className="h-4 w-4" />} label="Titres jouÃ©s" value={String(result.songsPlayed || 0)} />
          <StatCard icon={<Link2 className="h-4 w-4" />} label="DurÃ©e" value={formatDuration(result.durationMs || 0)} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[34px] border border-white/10 bg-[#090614]/88 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-7">
            <div className="mb-6 flex flex-col gap-5 rounded-[30px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">Grand gagnant</div>
                <div className="text-3xl font-black sm:text-4xl">{winner?.name || "Champion"}</div>
                <div className="mt-2 text-sm text-white/65 sm:text-base">
                  {winner?.votesReceived || 0} votes Â· {winner?.songsAdded || 0} titre(s) ajoutÃ©(s)
                </div>
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-orange-400 text-4xl shadow-[0_20px_60px_rgba(217,70,239,0.35)]">
                ðŸ‘‘
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-200">Podium</div>
                <h2 className="mt-2 text-2xl font-black">Les meilleurs de la soirÃ©e</h2>
              </div>
            </div>

            <div className="space-y-3">
              {(result.ranking || []).map((row, index) => {
                const rank = Number(row.rank || index + 1);
                return (
                  <div
                    key={`${row.accountId || row.participantId || index}-${rank}`}
                    className={`flex items-center gap-4 rounded-[28px] border px-4 py-4 transition sm:px-5 ${
                      rank === 1
                        ? "border-amber-400/25 bg-amber-500/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${
                        rank === 1
                          ? "bg-amber-400 text-[#120915]"
                          : rank === 2
                            ? "bg-slate-300 text-[#120915]"
                            : rank === 3
                              ? "bg-rose-300 text-[#120915]"
                              : "bg-white/[0.08] text-white"
                      }`}
                    >
                      #{rank}
                    </div>
                    <Avatar name={row.name} src={row.avatar} size="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-black text-white">{row.name || `Participant ${rank}`}</div>
                      <div className="truncate text-sm text-white/55">
                        {row.votesReceived || 0} votes Â· {row.songsAdded || 0} titre(s) Â· {row.songsWithVotes || 0} titre(s) votÃ©(s)
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-black text-fuchsia-100">
                      {row.partyScore || row.votesReceived || 0} pts
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[34px] border border-white/10 bg-[#090614]/88 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-6">
              <div className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-200">Partage rÃ©seaux sociaux</div>
              <h2 className="text-2xl font-black">Exports prÃªts Ã  poster</h2>
              <p className="mt-2 text-sm text-white/60">
                Insta / Snap : tÃ©lÃ©charge la Story. Instagram / Facebook / X : utilise le format Post.
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">Format Story</div>
                      <div className="text-xs text-white/50">1080 Ã— 1920 Â· idÃ©al Snap / Insta Story</div>
                    </div>
                    <button
                      onClick={downloadStory}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-orange-400 px-4 py-2 text-sm font-black text-white"
                    >
                      <Download className="h-4 w-4" />
                      {downloading === "story" ? "Exportâ€¦" : "TÃ©lÃ©charger"}
                    </button>
                  </div>
                  <div className="aspect-[9/16] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.35),transparent_32%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.16),transparent_26%),#0a0616] p-4">
                    <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-black/25 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-200">MixParty Story</div>
                      <div className="mt-2 text-lg font-black">{result.code}</div>
                      <div className="mt-1 text-xs text-white/55">{formatDate(result.endedAt)}</div>
                      <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.05] p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Champion</div>
                        <div className="mt-1 text-xl font-black">{winner?.name || "Champion"}</div>
                        <div className="mt-1 text-xs text-white/60">{winner?.votesReceived || 0} votes</div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {topThree.map((row, index) => (
                          <div key={`story-${row.accountId || index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                            <div className="min-w-0 truncate font-bold">#{index + 1} {row.name || `Participant ${index + 1}`}</div>
                            <div className="ml-3 shrink-0 text-amber-300">{row.votesReceived || 0} â¤</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto text-center text-[10px] text-white/55">mixpartyapp.fr/share/{result.code}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">Format Post</div>
                      <div className="text-xs text-white/50">1080 Ã— 1350 Â· idÃ©al feed Instagram / Facebook / X</div>
                    </div>
                    <button
                      onClick={downloadPost}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white"
                    >
                      <Download className="h-4 w-4" />
                      {downloading === "post" ? "Exportâ€¦" : "TÃ©lÃ©charger"}
                    </button>
                  </div>
                  <div className="aspect-[4/5] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.35),transparent_32%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.16),transparent_26%),#0a0616] p-4">
                    <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-black/25 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-200">MixParty Post</div>
                          <div className="mt-1 text-lg font-black">Classement final</div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black">{result.code}</div>
                      </div>
                      <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.05] p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Grand gagnant</div>
                        <div className="mt-1 text-xl font-black">{winner?.name || "Champion"}</div>
                        <div className="mt-1 text-xs text-white/60">{winner?.votesReceived || 0} votes Â· {result.uniqueParticipants || 0} participants</div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {topThree.map((row, index) => (
                          <div key={`post-${row.accountId || index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                            <div className="min-w-0 truncate font-bold">#{index + 1} {row.name || `Participant ${index + 1}`}</div>
                            <div className="ml-3 shrink-0 text-amber-300">{row.votesReceived || 0} â¤</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">Votes : <span className="font-black">{result.totalVotes || 0}</span></div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">Titres : <span className="font-black">{result.songsPlayed || 0}</span></div>
                      </div>
                      <div className="mt-auto text-center text-[10px] text-white/55">mixpartyapp.fr/share/{result.code}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[34px] border border-white/10 bg-[#090614]/88 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-6">
              <div className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-200">Actions rapides</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={xShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
                >
                  Partager sur X
                </a>
                <a
                  href={facebookShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
                >
                  Partager sur Facebook
                </a>
              </div>
              <p className="mt-4 text-xs text-white/45">
                Pour Instagram et Snapchat, tÃ©lÃ©charge dâ€™abord la Story puis publie lâ€™image directement depuis ton tÃ©lÃ©phone.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[34px] border border-white/10 bg-[#090614]/88 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-6">
            <div className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-200">Top morceaux</div>
            <h2 className="text-2xl font-black">Les plus votÃ©s</h2>
            <div className="mt-4 space-y-3">
              {topSongs.map((song, index) => (
                <div key={`${song.videoId || song.title}-${index}`} className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
                  {song.thumbnail ? (
                    <img src={song.thumbnail} alt="" className="h-14 w-14 rounded-2xl border border-white/10 object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">ðŸŽµ</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-black text-white">{song.title}</div>
                    <div className="truncate text-sm text-white/55">{song.artistName || "Artiste inconnu"}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-amber-300">
                    {song.votes || 0} â¤
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[34px] border border-white/10 bg-[#090614]/88 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-6">
            <div className="mb-4 text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-200">Pourquoi câ€™est utile ?</div>
            <h2 className="text-2xl font-black">Un rÃ©cap fait pour partager</h2>
            <div className="mt-4 grid gap-3">
              {[
                "Lien public propre Ã  envoyer aux invitÃ©s.",
                "Story verticale 1080Ã—1920 prÃªte pour Insta / Snap.",
                "Post 1080Ã—1350 parfait pour Instagram / Facebook / X.",
                "Classement, stats et top morceaux dÃ©jÃ  mis en page.",
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75">
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
