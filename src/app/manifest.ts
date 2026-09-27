import type { MetadataRoute } from "next";

// Web app manifest: name, colors and home-screen icons. Not a PWA (no
// service worker); "browser" keeps it a normal website when added to the
// home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AboutSelphy",
    short_name: "AboutSelphy",
    description: "AboutSelphy — streamer & creator.",
    start_url: "/",
    display: "browser",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      // No "maskable" icon: the placeholder mark has rounded corners, and a
      // maskable icon must fill its square. Add one with the real logo.
    ],
  };
}
