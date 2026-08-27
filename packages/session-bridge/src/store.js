import { randomUUID } from "node:crypto";
import {
  DEFAULTS,
  MESSAGE_ROLES,
  MESSAGE_SOURCES,
  PROTOCOL_VERSION
} from "../../shared/src/index.js";

function copy(value) {
  return structuredClone(value);
}

function prefixedId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class SessionStore {
  constructor({
    now = () => new Date(),
    ttlMs = DEFAULTS.ttlMs,
    maxSessions = DEFAULTS.maxSessions
  } = {}) {
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxSessions = maxSessions;
    this.sessions = new Map();
  }

  sweep() {
    const cutoff = this.now().getTime() - this.ttlMs;
    for (const [id, session] of this.sessions) {
      if (Date.parse(session.started_at) <= cutoff) this.sessions.delete(id);
    }

    const ordered = [...this.sessions.values()].sort(
      (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)
    );
    for (const session of ordered.slice(this.maxSessions)) {
      this.sessions.delete(session.session_id);
    }
  }

  create({ character_id = DEFAULTS.characterId, locale = DEFAULTS.locale } = {}) {
    this.sweep();
    if (typeof character_id !== "string" || !character_id.trim()) {
      throw new StoreError("invalid_request", "character_id must be a non-empty string");
    }
    if (typeof locale !== "string" || !locale.trim()) {
      throw new StoreError("invalid_request", "locale must be a non-empty string");
    }
    const session = {
      protocol_version: PROTOCOL_VERSION,
      session_id: prefixedId("ses"),
      status: "active",
      character_id: character_id.trim(),
      started_at: this.now().toISOString(),
      ended_at: null,
      locale: locale.trim(),
      messages: []
    };
    this.sessions.set(session.session_id, session);
    this.sweep();
    return copy(session);
  }

  append(sessionId, { role, text, source } = {}) {
    this.sweep();
    const session = this.#require(sessionId);
    if (session.status !== "active") {
      throw new StoreError("session_not_active", "Session is not active");
    }
    if (!MESSAGE_ROLES.includes(role)) {
      throw new StoreError("invalid_request", "Invalid message role");
    }
    if (!MESSAGE_SOURCES.includes(source)) {
      throw new StoreError("invalid_request", "Invalid message source");
    }
    if (typeof text !== "string" || text.length === 0 || text.length > DEFAULTS.maxTextLength) {
      throw new StoreError("invalid_request", "text must contain 1 to 10000 characters");
    }
    const message = {
      message_id: prefixedId("msg"),
      role,
      text,
      created_at: this.now().toISOString(),
      source
    };
    session.messages.push(message);
    return copy(message);
  }

  end(sessionId) {
    this.sweep();
    const session = this.#require(sessionId);
    if (session.status === "active") {
      session.status = "ended";
      session.ended_at = this.now().toISOString();
    }
    if (session.status !== "ended") {
      throw new StoreError("session_not_active", "Session cannot be ended");
    }
    return copy(session);
  }

  get(sessionId) {
    this.sweep();
    return copy(this.#require(sessionId));
  }

  latestEnded() {
    this.sweep();
    const session = [...this.sessions.values()]
      .filter((item) => item.status === "ended")
      .sort((a, b) => Date.parse(b.ended_at) - Date.parse(a.ended_at))[0];
    if (!session) throw new StoreError("no_matching_session", "No ended session found");
    return copy(session);
  }

  delete(sessionId) {
    this.sweep();
    if (!this.sessions.delete(sessionId)) {
      throw new StoreError("session_not_found", "Session not found");
    }
  }

  #require(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new StoreError("session_not_found", "Session not found");
    return session;
  }
}
