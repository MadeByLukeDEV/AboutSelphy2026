// A failed platform API call. The message is safe to store and show in
// /admin/stats: it names the endpoint and HTTP status, never a URL with a
// key or a token.
export class PlatformError extends Error {
  constructor(
    readonly platform: "twitch" | "youtube",
    message: string,
  ) {
    super(`${platform}: ${message}`);
    this.name = "PlatformError";
  }
}
