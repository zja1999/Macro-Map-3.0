import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function key() {
  const secret = process.env.HEALTH_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.DATABASE_URL || "macroverse-dev-health-integrations";
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string | null | undefined) {
  if (!token) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(ciphertext: string | null | undefined) {
  if (!ciphertext) return null;
  const [ivRaw, tagRaw, encryptedRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return null;
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}
