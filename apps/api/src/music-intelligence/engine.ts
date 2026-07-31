import { ArtistCredits, MusicMetadata, MusicMetadataSource } from "./types";
import {
  canonicalArtistName,
  cleanArtist,
  cleanTitle,
  decodeHtmlEntities,
  isPlausibleArtist,
  normalizeKey,
  splitGuests,
} from "./text";

const COLLAB_MARKER = /\s+(?:feat(?:uring)?|ft|avec)\.?\s+/i;

function uniqueArtists(values: string[], main: string): string[] {
  const mainKey = normalizeKey(main);
  const seen = new Set<string>();
  return values
    .map(cleanArtist)
    .filter(isPlausibleArtist)
    .map(canonicalArtistName)
    .filter((artist) => {
      const key = normalizeKey(artist);
      if (!key || key === mainKey || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function parseArtistCredits(value: string, sourceQuery = ""): ArtistCredits {
  let text = cleanArtist(value);
  const collaborators: string[] = [];

  text = text.replace(/[\[(]\s*(?:feat(?:uring)?|ft|avec)\.?\s+([^\])]+)[\])]/gi, (_match, guests) => {
    collaborators.push(...splitGuests(String(guests)));
    return " ";
  });

  const marker = text.match(COLLAB_MARKER);
  if (marker?.index !== undefined) {
    collaborators.push(...splitGuests(text.slice(marker.index + marker[0].length)));
    text = text.slice(0, marker.index);
  }

  text = cleanArtist(text);
  const query = cleanArtist(sourceQuery);
  const queryKey = normalizeKey(query);
  const textKey = normalizeKey(text);

  // Une requête courte et plausible est un excellent repère pour l'artiste principal.
  if (isPlausibleArtist(query) && queryKey.length >= 3) {
    if (!isPlausibleArtist(text)) {
      text = query;
    } else if (textKey.startsWith(`${queryKey} `) && textKey !== queryKey) {
      const remainder = text.slice(Math.min(text.length, query.length)).replace(/^\s*(?:&|et|x|×|,|-)\s*/i, "");
      if (remainder) collaborators.unshift(...splitGuests(remainder));
      text = query;
    }
  }

  // "GIMS x La Mano" / "GIMS & La Mano" : le premier est le principal,
  // sauf pour quelques duos connus conservés tels quels.
  const knownDuos = ["bigflo et oli", "pnk et diddy", "cats on trees"];
  const normalizedText = normalizeKey(text);
  if (!knownDuos.includes(normalizedText)) {
    const collaboration = text.match(/^(.+?)\s+(?:x|×|&)\s+(.+)$/i);
    if (collaboration && isPlausibleArtist(collaboration[1]) && isPlausibleArtist(collaboration[2])) {
      text = collaboration[1];
      collaborators.unshift(collaboration[2]);
    }
  }

  const main = isPlausibleArtist(text)
    ? canonicalArtistName(text)
    : isPlausibleArtist(query)
      ? canonicalArtistName(query)
      : "Artiste inconnu";

  return { main, collaborators: uniqueArtists(collaborators, main) };
}

export function cleanTrackTitle(value: string, artistName = ""): string {
  let title = cleanTitle(value);
  if (title.includes(" - ")) title = title.split(" - ").slice(1).join(" - ").trim();
  const artist = cleanArtist(artistName);
  if (artist) {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`^${escaped}\\s*[-–—:]\\s*`, "i"), "").trim();
  }
  return cleanTitle(title || value);
}

export function parseProvidedToYoutube(description: string): MusicMetadata | null {
  const lines = decodeHtmlEntities(description || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const providedIndex = lines.findIndex((line) => /provided to youtube by/i.test(line));
  if (providedIndex < 0) return null;

  const creditIndex = lines.findIndex((line, index) => index > providedIndex && line.includes(" · "));
  if (creditIndex < 0) return null;
  const parts = lines[creditIndex].split(" · ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const title = cleanTitle(parts[0]);
  const credits = parseArtistCredits(parts.slice(1).join(" & "));
  if (!isPlausibleArtist(credits.main)) return null;
  const albumCandidate = lines[creditIndex + 1] || "";
  const albumName = /^(?:℗|©|released on|producer|composer|lyricist|auto-generated)/i.test(albumCandidate)
    ? undefined
    : cleanTitle(albumCandidate);

  return {
    title,
    artistName: credits.main,
    featuredArtistNames: credits.collaborators,
    albumName,
    metadataSource: "ART_TRACK_DESCRIPTION",
    metadataConfidence: 0.98,
  };
}

export function extractMusicMetadata(params: {
  rawTitle: string;
  channelTitle?: string;
  description?: string;
  tags?: string[];
  query: string;
}): MusicMetadata {
  const artTrack = parseProvidedToYoutube(params.description || "");
  if (artTrack) return artTrack;

  const rawTitle = cleanTitle(params.rawTitle || "");
  const titleParts = rawTitle.split(/\s+-\s+/);
  const titleArtist = titleParts.length > 1 ? titleParts[0].trim() : "";
  const channelRaw = params.channelTitle || "";
  const topicArtist = /\s+-\s+topic$/i.test(channelRaw)
    ? cleanArtist(channelRaw.replace(/\s+-\s+topic$/i, ""))
    : "";
  const channel = cleanArtist(channelRaw);

  let candidate = "";
  let source: MusicMetadataSource = "QUERY_FALLBACK";
  let confidence = 0.58;

  if (isPlausibleArtist(titleArtist)) {
    candidate = titleArtist;
    source = "TITLE_CHANNEL";
    confidence = 0.84;
  } else if (isPlausibleArtist(topicArtist)) {
    candidate = topicArtist;
    source = "TITLE_CHANNEL";
    confidence = 0.92;
  } else if (isPlausibleArtist(channel)) {
    candidate = channel;
    source = "TITLE_CHANNEL";
    confidence = 0.7;
  } else {
    candidate = params.query;
  }

  const credits = parseArtistCredits(candidate, params.query);
  return {
    title: cleanTrackTitle(rawTitle, credits.main),
    artistName: credits.main,
    featuredArtistNames: credits.collaborators,
    albumName: undefined,
    metadataSource: source,
    metadataConfidence: confidence,
  };
}
