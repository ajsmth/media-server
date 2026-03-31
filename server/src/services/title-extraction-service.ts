const RELEASE_EXTENSION_PATTERN = /\.[^.]+$/;
const RELEASE_PREFIX_PATTERN =
  /^(?:(?:www|ww[wv])[\w.-]*\.(?:org|com|net|cc|ws|to)|\[[^\]]+\])\s*[-_. ]+\s*/i;
const RELEASE_TAG_BOUNDARY =
  /(?:^|[.\s_-])(?:19|20)\d{2}(?=$|[.\s_-])|(?:^|[.\s_-])(?:480p|576p|720p|1080p|1440p|2160p|4320p|4k|8k|webrip|web-dl|webdl|bluray|brrip|dvdrip|hdrip|hdtv|remux|x26[45]|h\.?26[45]|hevc|av1|aac(?:2\.?0)?|ddp?(?:5\.?1|7\.?1)?|eac3|dts(?:-hd)?|truehd|atmos|proper|repack|extended|limited|internal)(?=$|[.\s_-])/i;

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class TitleExtractionService {
  private readonly cache = new Map<string, string>();
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async extractTitle(raw: string): Promise<string> {
    const normalized = raw.trim();

    if (!normalized) {
      return normalized;
    }

    const cached = this.cache.get(normalized);

    if (cached) {
      return cached;
    }

    const pending = this.inflight.get(normalized);

    if (pending) {
      return pending;
    }

    const request = this.extractAndCache(normalized);
    this.inflight.set(normalized, request);

    try {
      return await request;
    } finally {
      this.inflight.delete(normalized);
    }
  }

  private async extractAndCache(raw: string): Promise<string> {
    const fallbackTitle = this.fallbackTitle(raw);

    if (!this.apiKey) {
      this.cache.set(raw, fallbackTitle);
      return fallbackTitle;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "media_title_extraction",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                },
                required: ["title"],
              },
            },
          },
          messages: [
            {
              role: "system",
              content:
                "Extract the human-readable movie or episode title from a messy release filename. Remove site prefixes, codec tags, resolution, source, language, audio, and release group text. Restore normal title casing and obvious punctuation when clear. Return only JSON matching the schema.",
            },
            {
              role: "user",
              content: raw,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed with ${response.status}`);
      }

      const payload = (await response.json()) as OpenAiChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI response did not include content");
      }

      const parsed = JSON.parse(content) as { title?: string };
      const title = parsed.title?.trim() || fallbackTitle;
      this.cache.set(raw, title);
      return title;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown title extraction error";
      console.warn(`Falling back to heuristic title extraction for "${raw}": ${message}`);
      this.cache.set(raw, fallbackTitle);
      return fallbackTitle;
    }
  }

  private fallbackTitle(raw: string): string {
    const withoutExtension = raw.replace(RELEASE_EXTENSION_PATTERN, "");
    const withoutPrefix = withoutExtension.replace(RELEASE_PREFIX_PATTERN, "");
    const boundaryMatch = withoutPrefix.match(RELEASE_TAG_BOUNDARY);
    const titleSlice = boundaryMatch
      ? withoutPrefix.slice(0, boundaryMatch.index).trim()
      : withoutPrefix.trim();

    const normalizedWhitespace = titleSlice
      .replace(/[._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return normalizedWhitespace || withoutPrefix || raw;
  }
}
