// "@name" in a schedule title or note links to that Twitch channel. Pure, so
// it can be tested directly.
//
// Twitch logins are 4-25 letters, digits or underscores. The match must not
// follow a word character or another "@", so e-mail addresses
// ("mail@example.com") are left alone. Because the handle can only contain
// [A-Za-z0-9_], the URL built from it needs no further escaping.
const MENTION = /(?<![\w@])@([A-Za-z0-9_]{4,25})(?![\w@])/g;

export type TextPart = { text: string } | { text: string; handle: string; url: string };

export function twitchChannelUrl(handle: string) {
  return `https://www.twitch.tv/${handle.toLowerCase()}`;
}

/** Splits text into plain parts and @mentions (text keeps the "@"). */
export function splitMentions(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const index = match.index;
    if (index > last) parts.push({ text: text.slice(last, index) });
    parts.push({ text: match[0], handle: match[1], url: twitchChannelUrl(match[1]) });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
