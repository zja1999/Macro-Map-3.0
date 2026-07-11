import { createHash, randomBytes } from "crypto";

export function newPublicToken() {
  return randomBytes(32).toString("hex");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
