// Profile images are committed static files in public/profile (Dokploy
// builds from git, so they must be committed). To replace one, swap the
// file (same name) and deploy. Served through next/image, which converts
// them to AVIF/WebP per screen size.
export const PROFILE_IMAGES = {
  avatar: { src: "/profile/avatar.png", width: 800, height: 800 },
  banner: { src: "/profile/banner.png", width: 1640, height: 664 },
} as const;
