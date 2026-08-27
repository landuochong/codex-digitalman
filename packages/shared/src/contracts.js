export const PROTOCOL_VERSION = "1";

export const SESSION_STATUSES = Object.freeze(["active", "ended", "abandoned"]);
export const MESSAGE_ROLES = Object.freeze(["user", "assistant", "system-event"]);
export const MESSAGE_SOURCES = Object.freeze(["typed", "speech-final", "assistant-final"]);

export const ERROR_CODES = Object.freeze({
  UNAUTHORIZED: "unauthorized",
  INVALID_REQUEST: "invalid_request",
  NOT_FOUND: "not_found",
  SESSION_NOT_FOUND: "session_not_found",
  SESSION_NOT_ACTIVE: "session_not_active",
  NO_MATCHING_SESSION: "no_matching_session",
  PAYLOAD_TOO_LARGE: "payload_too_large"
});

export const DEFAULTS = Object.freeze({
  characterId: "lumi",
  locale: "zh-CN",
  ttlMs: 24 * 60 * 60 * 1000,
  maxSessions: 10,
  maxTextLength: 10_000,
  maxBodyBytes: 64 * 1024
});
