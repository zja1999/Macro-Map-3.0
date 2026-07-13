import test from "node:test";
import assert from "node:assert/strict";

// Prevent importing auth/permissions from opening the local PGlite database in
// this credential-free policy suite.
process.env.NEXT_PHASE = "phase-production-build";

test("public auth tokens are high entropy and only deterministic after hashing", async () => {
  const { newPublicToken, tokenHash } = await import("../../src/lib/authTokens");
  const first = newPublicToken();
  const second = newPublicToken();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.equal(tokenHash(first), tokenHash(first));
  assert.notEqual(tokenHash(first), first);
  assert.notEqual(tokenHash(first), tokenHash(second));
});

test("post-auth continuations stay on same-origin absolute paths", async () => {
  const { safeRedirectPath } = await import("../../src/lib/safeRedirect");
  assert.equal(safeRedirectPath("/macrotray-connect?code=abc"), "/macrotray-connect?code=abc");
  assert.equal(safeRedirectPath("https://evil.example/steal"), "/");
  assert.equal(safeRedirectPath("//evil.example/steal"), "/");
  assert.equal(safeRedirectPath("/\\evil"), "/");
  assert.equal(safeRedirectPath("/ok\r\nLocation:https://evil.example"), "/");
});

test("email/password authentication is fail-closed unless explicitly enabled", async () => {
  const { isEmailPasswordAuthEnabled } = await import("../../src/lib/authFeatures");

  assert.equal(isEmailPasswordAuthEnabled(undefined), false);
  assert.equal(isEmailPasswordAuthEnabled("false"), false);
  assert.equal(isEmailPasswordAuthEnabled("unexpected"), false);
  assert.equal(isEmailPasswordAuthEnabled(" TRUE "), true);
});

test("Google-only mode rejects direct email/password initiation actions", async () => {
  const previous = process.env.AUTH_EMAIL_PASSWORD_ENABLED;
  process.env.AUTH_EMAIL_PASSWORD_ENABLED = "false";
  try {
    const {
      EMAIL_PASSWORD_AUTH_DISABLED_MESSAGE,
    } = await import("../../src/lib/authFeatures");
    const { login, register, requestPasswordReset, resendVerification } = await import("../../src/actions/auth");
    const attempts = [login, register, requestPasswordReset, resendVerification];

    for (const action of attempts) {
      const result = await action(undefined, new FormData());
      assert.deepEqual(result, { error: EMAIL_PASSWORD_AUTH_DISABLED_MESSAGE });
    }
  } finally {
    if (previous === undefined) delete process.env.AUTH_EMAIL_PASSWORD_ENABLED;
    else process.env.AUTH_EMAIL_PASSWORD_ENABLED = previous;
  }
});

test("Google callback failures map to actionable, allow-listed login messages", async () => {
  const { googleAuthErrorMessage } = await import("../../src/lib/authFeatures");

  assert.match(googleAuthErrorMessage("google_not_configured") ?? "", /not configured/i);
  assert.match(googleAuthErrorMessage("google_state_invalid") ?? "", /start Google sign-in again/i);
  assert.match(googleAuthErrorMessage("google_account_unavailable") ?? "", /verified Google account/i);
  assert.equal(googleAuthErrorMessage("provider_secret=do-not-render"), undefined);
});

test("MacroTray pairing uses separate hashed approval and device secrets", async () => {
  const { desktopPairingRequests } = await import("../../src/db/schema");
  assert.ok(desktopPairingRequests.deviceCodeHash);
  assert.ok(desktopPairingRequests.approvalCodeHash);
  assert.ok(desktopPairingRequests.expiresAt);
  assert.ok(desktopPairingRequests.approvedAt);
  assert.ok(desktopPairingRequests.consumedAt);
  assert.equal("deviceCode" in desktopPairingRequests, false);
  assert.equal("approvalCode" in desktopPairingRequests, false);
});

test("MacroTray pairing states expire and cannot return to approved after consumption", async () => {
  const { desktopPairingStatus } = await import("../../src/lib/desktopPairing");
  const now = new Date("2026-07-13T12:00:00Z");
  const future = new Date("2026-07-13T12:10:00Z");
  const past = new Date("2026-07-13T11:59:59Z");

  assert.equal(desktopPairingStatus(undefined, now), "invalid");
  assert.equal(desktopPairingStatus({ approvedAt: null, consumedAt: null, expiresAt: future }, now), "pending");
  assert.equal(desktopPairingStatus({ approvedAt: now, consumedAt: null, expiresAt: future }, now), "approved");
  assert.equal(desktopPairingStatus({ approvedAt: now, consumedAt: null, expiresAt: past }, now), "expired");
  assert.equal(desktopPairingStatus({ approvedAt: now, consumedAt: now, expiresAt: future }, now), "consumed");
});

test("MacroTray download offer is limited to eligible Windows desktop browsers", async () => {
  const { canOfferMacroTrayDownload } = await import("../../src/lib/macrotrayDownload");
  const now = Date.parse("2026-07-13T12:00:00Z");
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140";
  const base = { userAgent: windows, maxTouchPoints: 0, standalone: false, dismissedAt: 0, now };

  assert.equal(canOfferMacroTrayDownload(base), true);
  assert.equal(canOfferMacroTrayDownload({ ...base, userAgent: `${windows} MacroTray/0.1.0` }), false);
  assert.equal(canOfferMacroTrayDownload({ ...base, userAgent: `${windows} MacroVerseApp` }), false);
  assert.equal(canOfferMacroTrayDownload({ ...base, standalone: true }), false);
  assert.equal(canOfferMacroTrayDownload({ ...base, maxTouchPoints: 5 }), false);
  assert.equal(canOfferMacroTrayDownload({ ...base, dismissedAt: now - 1000 }), false);
  assert.equal(canOfferMacroTrayDownload({ ...base, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)" }), false);
});

test("global roles form a strict user < moderator < admin hierarchy", async () => {
  const { rankOf, isModerator, isAdmin } = await import("../../src/lib/permissions");

  assert.ok(rankOf("user") < rankOf("moderator"));
  assert.ok(rankOf("moderator") < rankOf("admin"));
  assert.equal(isModerator({ role: "user" }), false);
  assert.equal(isModerator({ role: "moderator" }), true);
  assert.equal(isModerator({ role: "admin" }), true);
  assert.equal(isAdmin({ role: "moderator" }), false);
  assert.equal(isAdmin({ role: "admin" }), true);
  assert.equal(rankOf("unexpected-role"), rankOf("user"));
});

test("staff cannot manage themselves or an equal/higher role", async () => {
  const { canManageUser } = await import("../../src/lib/permissions");
  const admin = { id: "admin", role: "admin" };
  const moderator = { id: "mod", role: "moderator" };
  const user = { id: "user", role: "user" };

  assert.equal(canManageUser(admin, admin), false);
  assert.equal(canManageUser(admin, { id: "other-admin", role: "admin" }), false);
  assert.equal(canManageUser(admin, moderator), true);
  assert.equal(canManageUser(moderator, user), true);
  assert.equal(canManageUser(moderator, admin), false);
  assert.equal(canManageUser(user, moderator), false);
});
