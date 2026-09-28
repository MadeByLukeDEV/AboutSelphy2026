import { splitMentions } from "../mentions";

// Renders text with every "@name" as a link to twitch.tv/name (new tab). Plain React
// text nodes and anchors, never HTML.
export function WithMentions({ text }: { text: string }) {
  return splitMentions(text).map((part, index) =>
    "url" in part ? (
      <a
        key={index}
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-brand-text underline-offset-4 hover:underline uppercase"
      >
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
