declare module "video-name-parser" {
  export type ParsedVideoName = {
    name?: string;
    type?: "movie" | "series" | "other";
    year?: number;
    season?: number;
    episode?: number[];
    tag?: string[];
  };

  export default function parseVideoName(value: string): ParsedVideoName;
}
