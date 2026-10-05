import { createHash } from "node:crypto";
import { splitMentions } from "../mentions";
import type { StreamOccurrence } from "../occurrences";

// Pure: the week's streams -> the Discord embed (and a hash of everything
// that decides how the message looks, so unchanged weeks aren't re-sent).
// Times use Discord timestamps (<t:unix:t>), which every viewer sees in
// their own time zone; the day headings are Vienna dates.

export type DiscordTexts = {
  title: string;
  empty: string;
  cancelled: string;
  footer: string;
  /** "Monday, 6 October" for a stream's start. */
  dayLabel: (start: Date) => string;
};

const BRAND_COLOR = 0x00ffa8;
const DESCRIPTION_LIMIT = 4000; // Discord allows 4096.

/** Escapes Discord markdown in staff-written text (titles, notes, names). */
export function escapeMarkdown(text: string) {
  return escapeOnly(text).replace(/\s+/g, " ").trim();
}

function escapeOnly(text: string) {
  return (
    text
      .replace(/([\\*_~`|<>[\]()#])/g, "\\$1")
      // "<" escaped above stops <t:..>, <@id>, <#id>; this stops bare URLs
      // from becoming links (the text is inert on the website too).
      .replace(/:\/\//g, "\\://")
  );
}

/** Text with @handles as Twitch links, everything else escaped. */
export function withMentions(text: string) {
  // Escape each piece, but normalise whitespace once over the whole text:
  // trimming the pieces ate the spaces around mentions.
  return splitMentions(text)
    .map((part) => ("url" in part ? `[${part.text}](${part.url})` : escapeOnly(part.text)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function streamLine(stream: StreamOccurrence, texts: DiscordTexts) {
  const from = Math.floor(stream.start.getTime() / 1000);
  const to = Math.floor(stream.end.getTime() / 1000);
  const what = [
    stream.gameName ? `**${escapeMarkdown(stream.gameName)}**` : "",
    stream.title ? withMentions(stream.title) : "",
  ]
    .filter(Boolean)
    .join(" – ");
  const categories = stream.categories.map((c) => `\`${c.name.replace(/`/g, "'")}\``).join(" ");
  const main = [`<t:${from}:t>–<t:${to}:t>`, what, categories].filter(Boolean).join("  ");
  if (!stream.cancelled) {
    return stream.note ? `${main}\n-# ${withMentions(stream.note)}` : main;
  }
  const reason = stream.note ? `: ${withMentions(stream.note)}` : "";
  return `~~${main}~~\n-# ${texts.cancelled}${reason}`;
}

export function buildScheduleEmbed(
  streams: StreamOccurrence[],
  texts: DiscordTexts,
  pageUrl: string,
) {
  const lines: string[] = [];
  let day = "";
  for (const stream of streams) {
    const label = texts.dayLabel(stream.start);
    if (label !== day) {
      if (day) lines.push("");
      lines.push(`**${escapeMarkdown(label)}**`);
      day = label;
    }
    lines.push(streamLine(stream, texts));
  }
  let description = lines.length ? lines.join("\n") : texts.empty;
  if (description.length > DESCRIPTION_LIMIT) {
    // Cut at a line break so no markdown is left half open.
    const cut = description.lastIndexOf("\n", DESCRIPTION_LIMIT);
    description = `${description.slice(0, cut > 0 ? cut : DESCRIPTION_LIMIT)}\n…`;
  }

  const embed = {
    title: texts.title,
    url: pageUrl,
    description,
    color: BRAND_COLOR,
    image: { url: "attachment://schedule.png" },
    footer: { text: texts.footer },
  };
  // The image also shows covers, which the text doesn't: they're part of the
  // hash. The timestamp ("updated ...") is left out on purpose.
  const hash = createHash("sha256")
    .update(JSON.stringify([embed, streams.map((s) => s.gameCoverUrl)]))
    .digest("hex");
  return { embed: { ...embed, timestamp: new Date().toISOString() }, hash };
}
