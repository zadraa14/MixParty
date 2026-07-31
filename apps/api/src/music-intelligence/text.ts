const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

const NON_ARTIST_PATTERNS = [
  /\b(?:skyrock\s*fm|skyrock|nrj|fun\s*radio|radio\s*fg|trace\s*urban)\b/i,
  /\b(?:records?|recordings?|music|musique|label|entertainment|productions?)\b/i,
  /\b(?:official|officiel|topic|vevo|lyrics?|paroles?|visuali[sz]er|audio|video|clip)\b/i,
  /\b(?:exclu|exclusive|premiere|freestyle|interview|podcast|reaction|review)\b/i,
  /\b(?:hd|4k|8d|sped\s*up|speed\s*up|slowed(?:\s*&\s*reverb)?)\b/i,
  /^clash(?:\s+part\.?\s*\d+)?$/i,
];

const TITLE_NOISE = [
  /\s*[\[(](?:official\s*(?:music\s*)?(?:video|audio)|clip\s*officiel|audio\s*officiel|lyrics?|paroles?|visuali[sz]er|hd|4k|8d|sped\s*up|speed\s*up|slowed(?:\s*&\s*reverb)?|exclu(?:sive)?|premiere)[^\])]*[\])]/gi,
  /\s+-\s+(?:official\s*(?:music\s*)?(?:video|audio)|clip\s*officiel|lyrics?|visuali[sz]er|hd|4k)$/gi,
  /^\s*[\[(]?(?:exclu(?:sive)?|premiere)[\])!\s:-]*/i,
];

export function decodeHtmlEntities(value: string): string {
  return String(value || "")
    .replace(/&(amp|#39|quot|lt|gt|nbsp);/gi, (match) => HTML_ENTITIES[match.toLowerCase()] || match)
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

export function stripDiacritics(value: string): string {
  return decodeHtmlEntities(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeKey(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/\b(?:feat(?:uring)?|ft|avec)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanTitle(value: string): string {
  let result = decodeHtmlEntities(value);
  for (const pattern of TITLE_NOISE) result = result.replace(pattern, " ");
  return result.replace(/\s+/g, " ").replace(/^[-–—:|]+|[-–—:|]+$/g, "").trim();
}

export function cleanArtist(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\s+-\s+topic$/i, "")
    .replace(/\bvevo$/i, "")
    .replace(/\bofficial$/i, "")
    .replace(/^[\s([\]{},:;.!+\-]+|[\s)\]\]{},:;.!+\-]+$/g, "")
    .replace(/^(?:feat(?:uring)?|ft|avec)\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlausibleArtist(value: string): boolean {
  const artist = cleanArtist(value);
  if (artist.length < 2 || artist.length > 90) return false;
  const normalized = normalizeKey(artist);
  if (!normalized || /^\d+$/.test(normalized)) return false;
  if (NON_ARTIST_PATTERNS.some((pattern) => pattern.test(artist))) return false;
  if (/^(?:part|volume|episode|track|song)\s*\d*$/i.test(artist)) return false;
  return true;
}

export function canonicalArtistName(value: string): string {
  const artist = cleanArtist(value);
  if (!artist) return "Artiste inconnu";
  if (/^[A-Z0-9 .&'’-]+$/.test(artist) && artist.length <= 24) return artist;
  return artist
    .split(/(\s+|&)/)
    .map((part) => {
      if (!part) return part;
      if (/^\s+$|^&$/.test(part)) return part;
      if (/^(?:dj|mc|gims|jul|sch|ninho|dadju|soprano)$/i.test(part)) return part.toUpperCase() === "DJ" || part.toUpperCase() === "MC" ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1).toLowerCase();
      return part.length <= 3 && /^[A-Z0-9]+$/.test(part) ? part : part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("")
    .trim();
}

export function splitGuests(value: string): string[] {
  return decodeHtmlEntities(value)
    .split(/\s*(?:,|;|\+|\bx\b|×|\bavec\b|\bfeat(?:uring)?\.?\b|\bft\.?\b)\s*/i)
    .map(cleanArtist)
    .filter(isPlausibleArtist)
    .map(canonicalArtistName);
}
