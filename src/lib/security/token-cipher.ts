import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM for secrets stored in the database (the YouTube refresh
// token), keyed with TOKEN_ENCRYPTION_KEY. Format:
// "v1.<iv>.<auth tag>.<ciphertext>", each part base64url. `purpose` is bound
// as additional authenticated data, so a ciphertext can't be moved to a
// different column or use and still decrypt.

const VERSION = "v1";

export function isTokenCipherConfigured() {
  return Boolean(env().TOKEN_ENCRYPTION_KEY);
}

function key() {
  const hex = env().TOKEN_ENCRYPTION_KEY;
  if (!hex) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** The plain token, or throws if it was tampered with or the key changed. */
export function decryptToken(stored: string, purpose: string): string {
  const [version, iv, tag, ciphertext] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unknown encrypted token format");
  }
  // authTagLength pins the tag to 16 bytes: Node otherwise accepts a
  // truncated tag, which weakens the integrity check.
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"), {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
