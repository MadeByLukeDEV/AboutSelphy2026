import type { Locale } from "@/modules/i18n";

// schema.org objects for JSON-LD. Stable @ids let pages reference the same
// Person/WebSite instead of redefining them.

export function personId(siteUrl: string) {
  return `${siteUrl}/#person`;
}

export function websiteId(siteUrl: string) {
  return `${siteUrl}/#website`;
}

export function personSchema(options: {
  siteUrl: string;
  name: string;
  description: string;
  sameAs: string[];
  knowsAbout: string[];
  /** Absolute URL of the profile picture. */
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId(options.siteUrl),
    name: options.name,
    url: options.siteUrl,
    description: options.description,
    sameAs: options.sameAs,
    knowsAbout: options.knowsAbout,
    ...(options.image ? { image: options.image } : {}),
  };
}

export function websiteSchema(options: {
  siteUrl: string;
  name: string;
  locale: Locale;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(options.siteUrl),
    name: options.name,
    url: options.siteUrl,
    inLanguage: options.locale,
    publisher: { "@id": personId(options.siteUrl) },
  };
}

export function profilePageSchema(options: {
  siteUrl: string;
  url: string;
  locale: Locale;
  dateModified?: Date | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: options.url,
    inLanguage: options.locale,
    isPartOf: { "@id": websiteId(options.siteUrl) },
    mainEntity: { "@id": personId(options.siteUrl) },
    ...(options.dateModified
      ? { dateModified: options.dateModified.toISOString() }
      : {}),
  };
}

/** schema.org VideoObject for a YouTube video/Short (permanent URLs only). */
export function videoSchema(video: {
  name: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  uploadDate: Date;
  durationSeconds: number;
  views: number;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.name,
    url: video.url,
    embedUrl: video.embedUrl,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate.toISOString(),
    ...(video.durationSeconds > 0 ? { duration: `PT${video.durationSeconds}S` } : {}),
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "WatchAction" },
      userInteractionCount: video.views,
    },
    author: { "@id": personId(video.siteUrl) },
  };
}

/** schema.org Event for one scheduled Twitch stream. */
export function streamEventSchema(event: {
  name: string;
  description: string;
  start: Date;
  end: Date;
  cancelled: boolean;
  twitchUrl: string;
  image: string;
  siteUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.description,
    startDate: event.start.toISOString(),
    endDate: event.end.toISOString(),
    eventStatus: event.cancelled
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: event.twitchUrl },
    image: event.image,
    organizer: { "@id": personId(event.siteUrl) },
    performer: { "@id": personId(event.siteUrl) },
    isAccessibleForFree: true,
  };
}

/** schema.org BreadcrumbList: Home -> this page (absolute URLs). */
export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
