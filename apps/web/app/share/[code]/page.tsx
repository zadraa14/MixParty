import type { Metadata } from "next";
import ShareClient from "./ShareClient";

type PartyResult = {
  code: string;
  uniqueParticipants: number;
  totalVotes: number;
  songsPlayed: number;
  ranking: Array<{
    name?: string;
    votesReceived?: number;
  }>;
  host?: { name?: string } | null;
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://mixpartyapp.fr").replace(/\/+$/, "");

async function getPublicResult(code: string): Promise<PartyResult | null> {
  try {
    const response = await fetch(
      `${SITE_URL}/mixparty-api/party/${encodeURIComponent(code)}/share`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data?.result || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code: rawCode } = await params;
  const code = String(rawCode || "").trim().toUpperCase();
  const result = await getPublicResult(code);
  const winner = result?.ranking?.[0]?.name;

  const title = winner
    ? `${winner} remporte la soirée MixParty ${code} 🏆`
    : `Résultats de la soirée MixParty ${code}`;

  const description = result
    ? `${result.uniqueParticipants || 0} participant${Number(result.uniqueParticipants || 0) > 1 ? "s" : ""} · ${result.totalVotes || 0} vote${Number(result.totalVotes || 0) > 1 ? "s" : ""} · ${result.songsPlayed || 0} titre${Number(result.songsPlayed || 0) > 1 ? "s" : ""} joué${Number(result.songsPlayed || 0) > 1 ? "s" : ""}. Découvre le classement final de la soirée MixParty.`
    : "Découvre le classement final, les stats et les morceaux les plus votés de cette soirée MixParty.";

  const canonical = `${SITE_URL}/share/${encodeURIComponent(code)}`;
  const image = `${canonical}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "MixParty",
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `Récap MixParty ${code}`,
        },
      ],
      locale: "fr_FR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function PartySharePage() {
  return <ShareClient />;
}
