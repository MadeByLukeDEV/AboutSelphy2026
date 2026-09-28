import ReactMarkdown, { type Components } from "react-markdown";

// Renders admin-written Markdown safely: raw HTML in the source is dropped
// (skipHtml), only these elements are allowed, and react-markdown's default
// URL transform already removes javascript:/data: links. External links
// open in a new tab.

const ALLOWED = ["h2", "h3", "p", "ul", "ol", "li", "a", "strong", "em", "br", "hr"];

const components: Components = {
  h2: ({ children }) => <h2 className="mt-8 text-fluid-xl font-bold tracking-tight first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-5 font-bold">{children}</h3>,
  p: ({ children }) => <p className="mt-3 leading-relaxed text-muted-foreground">{children}</p>,
  ul: ({ children }) => <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  hr: () => <hr className="my-6" />,
  a: ({ href, children }) => {
    const external = href?.startsWith("http");
    return (
      <a
        href={href}
        className="font-medium text-brand-text underline underline-offset-4"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
};

export function Markdown({ source }: { source: string }) {
  return (
    <div className="max-w-prose [overflow-wrap:anywhere]">
      <ReactMarkdown skipHtml allowedElements={ALLOWED} unwrapDisallowed components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
