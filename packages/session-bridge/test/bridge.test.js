import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createBridgeServer } from "../src/server.js";

const token = "test-token-with-adequate-length";
let server;
let baseUrl;

before(async () => {
  server = createBridgeServer({ token });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, { method = "GET", body, auth = true } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(auth ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, json: text ? JSON.parse(text) : null };
}

test("requires authentication, including health checks", async () => {
  const result = await request("/healthz", { auth: false });
  assert.equal(result.response.status, 401);
  assert.equal(result.json.error.code, "unauthorized");
});

test("runs the create, append, end, latest, read and delete contract", async () => {
  const created = await request("/v1/sessions", { method: "POST", body: {} });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.status, "active");
  assert.equal(created.json.protocol_version, "1");

  const id = created.json.session_id;
  const appended = await request(`/v1/sessions/${id}/messages`, {
    method: "POST",
    body: { role: "user", text: "今天有点累。", source: "typed" }
  });
  assert.equal(appended.response.status, 201);
  assert.equal(appended.json.text, "今天有点累。");

  const ended = await request(`/v1/sessions/${id}/end`, { method: "POST", body: {} });
  assert.equal(ended.json.status, "ended");
  assert.ok(ended.json.ended_at);

  const latest = await request("/v1/sessions/latest?status=ended");
  assert.equal(latest.json.session_id, id);
  assert.equal(latest.json.messages.length, 1);

  const read = await request(`/v1/sessions/${id}`);
  assert.equal(read.json.session_id, id);

  const deleted = await request(`/v1/sessions/${id}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 204);
  const missing = await request(`/v1/sessions/${id}`);
  assert.equal(missing.response.status, 404);
  assert.equal(missing.json.error.code, "session_not_found");
});

test("does not expose an active session through latest ended", async () => {
  await request("/v1/sessions", { method: "POST", body: {} });
  const result = await request("/v1/sessions/latest?status=ended");
  assert.equal(result.response.status, 404);
  assert.equal(result.json.error.code, "no_matching_session");
});

test("rejects invalid messages and appends after end", async () => {
  const created = await request("/v1/sessions", { method: "POST", body: {} });
  const id = created.json.session_id;
  const invalid = await request(`/v1/sessions/${id}/messages`, {
    method: "POST",
    body: { role: "user", text: "", source: "typed" }
  });
  assert.equal(invalid.response.status, 400);
  await request(`/v1/sessions/${id}/end`, { method: "POST", body: {} });
  const late = await request(`/v1/sessions/${id}/messages`, {
    method: "POST",
    body: { role: "user", text: "late", source: "typed" }
  });
  assert.equal(late.response.status, 409);
  assert.equal(late.json.error.code, "session_not_active");
});
