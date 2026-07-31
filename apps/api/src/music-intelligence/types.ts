export type MusicMetadataSource =
  | "ART_TRACK_DESCRIPTION"
  | "TITLE_CHANNEL"
  | "QUERY_FALLBACK";

export type ArtistCredits = {
  main: string;
  collaborators: string[];
};

export type MusicMetadata = {
  title: string;
  artistName: string;
  featuredArtistNames: string[];
  albumName?: string;
  metadataSource: MusicMetadataSource;
  metadataConfidence: number;
};
