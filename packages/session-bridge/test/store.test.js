import assert from "node:assert/strict";
import test from "node:test";
import { SessionStore } from "../src/store.js";

test("retains at most the configured number of sessions", () => {
  let tick = 0;
  const store = new SessionStore({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    maxSessions: 2
  });
  const first = store.create();
  store.create();
  store.create();
  assert.throws(() => store.get(first.session_id), { code: "session_not_found" });
});

test("expires sessions after the TTL", () => {
  let now = new Date("2026-01-01T00:00:00.000Z");
  const store = new SessionStore({ now: () => now, ttlMs: 1000 });
  const session = store.create();
  now = new Date("2026-01-01T00:00:01.001Z");
  assert.throws(() => store.get(session.session_id), { code: "session_not_found" });
});

test("returns defensive copies", () => {
  const store = new SessionStore();
  const session = store.create();
  session.status = "ended";
  assert.equal(store.get(session.session_id).status, "active");
});
