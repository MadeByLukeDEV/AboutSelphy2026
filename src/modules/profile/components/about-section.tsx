import { getTranslations } from "next-intl/server";

// The bio is plain text split into paragraphs -- rendered as text nodes,
// never as HTML.
export async function AboutSection({ bio }: { bio: string[] }) {
  const t = await getTranslations("Home");
  if (bio.length === 0) return null;

  return (
    <section aria-labelledby="about-heading" className="flex flex-col gap-5">
      <h2 id="about-heading" className="text-fluid-2xl font-bold tracking-tight">
        {t("aboutHeading")}
      </h2>
      <div className="flex max-w-[65ch] flex-col gap-4 text-fluid-base leading-relaxed">
        {bio.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
