export const DUMMY_BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export function passwordValidationError(password: string, confirmation?: string) {
  const length = [...password].length;
  if (length < 12) return "Use at least 12 characters";
  if (length > 64) return "Use no more than 64 characters";
  if (Buffer.byteLength(password, "utf8") > 72) return "That password is too large to store safely";
  if (confirmation !== undefined && password !== confirmation) return "Passwords do not match";
  return null;
}

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function usernameValidationError(username: string) {
  if (username.length < 3 || username.length > 24) return "Username must be 3 to 24 characters";
  if (!/^[a-z0-9_]+$/.test(username)) return "Letters, numbers, and underscores only";
  return null;
}
