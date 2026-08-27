import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { DEFAULTS, ERROR_CODES, PROTOCOL_VERSION } from "../../shared/src/index.js";
import { SessionStore, StoreError } from "./store.js";

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  response.end(body);
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

function authorized(header, token) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > DEFAULTS.maxBodyBytes) {
      throw new StoreError(ERROR_CODES.PAYLOAD_TOO_LARGE, "Request body exceeds 64 KiB");
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new StoreError(ERROR_CODES.INVALID_REQUEST, "Request body must be valid JSON");
  }
}

export function createBridgeServer({ token, store = new SessionStore() }) {
  if (typeof token !== "string" || token.length < 16) {
    throw new Error("Bridge token must contain at least 16 characters");
  }

  return http.createServer(async (request, response) => {
    response.setHeader("connection", "close");
    if (!authorized(request.headers.authorization, token)) {
      sendError(response, 401, ERROR_CODES.UNAUTHORIZED, "Valid Bearer token required");
      return;
    }

    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, { status: "ok", protocol_version: PROTOCOL_VERSION });
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/sessions") {
        sendJson(response, 201, store.create(await readJson(request)));
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/sessions/latest") {
        if (url.searchParams.get("status") !== "ended") {
          throw new StoreError(ERROR_CODES.INVALID_REQUEST, "latest requires status=ended");
        }
        sendJson(response, 200, store.latestEnded());
        return;
      }

      const match = url.pathname.match(/^\/v1\/sessions\/([^/]+)(?:\/(messages|end))?$/);
      if (match) {
        const sessionId = decodeURIComponent(match[1]);
        const action = match[2];
        if (request.method === "POST" && action === "messages") {
          sendJson(response, 201, store.append(sessionId, await readJson(request)));
          return;
        }
        if (request.method === "POST" && action === "end") {
          await readJson(request);
          sendJson(response, 200, store.end(sessionId));
          return;
        }
        if (request.method === "GET" && !action) {
          sendJson(response, 200, store.get(sessionId));
          return;
        }
        if (request.method === "DELETE" && !action) {
          store.delete(sessionId);
          response.writeHead(204, { "cache-control": "no-store" });
          response.end();
          return;
        }
      }
      sendError(response, 404, ERROR_CODES.NOT_FOUND, "Route not found");
    } catch (error) {
      if (error instanceof StoreError) {
        const status = error.code === ERROR_CODES.SESSION_NOT_FOUND ||
          error.code === ERROR_CODES.NO_MATCHING_SESSION ? 404 :
          error.code === ERROR_CODES.SESSION_NOT_ACTIVE ? 409 :
          error.code === ERROR_CODES.PAYLOAD_TOO_LARGE ? 413 : 400;
        sendError(response, status, error.code, error.message);
        return;
      }
      sendError(response, 500, "internal_error", "Internal server error");
    }
  });
}
