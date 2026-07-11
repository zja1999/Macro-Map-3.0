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
