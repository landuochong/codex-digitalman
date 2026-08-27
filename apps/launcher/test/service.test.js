import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createLauncherServer } from "../src/service.js";

const calls = [];
const runtime = Object.fromEntries(["open", "focus", "status", "quit"].map((action) => [
  action,
  async () => { calls.push(action); return { ok: true }; }
]));
let server;
let baseUrl;

before(async () => {
  server = createLauncherServer({ token: "launcher-test-token-value", runtime });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise((resolve) => server.close(resolve)));

test("requires a bearer token", async () => {
  const response = await fetch(`${baseUrl}/v1/actions/status`, { method: "POST" });
  assert.equal(response.status, 401);
});

test("allows only the four fixed actions", async () => {
  for (const action of ["open", "focus", "status", "quit"]) {
    const response = await fetch(`${baseUrl}/v1/actions/${action}`, {
      method: "POST",
      headers: { authorization: "Bearer launcher-test-token-value" }
    });
    assert.equal(response.status, 200);
  }
  const rejected = await fetch(`${baseUrl}/v1/actions/run-shell`, {
    method: "POST",
    headers: { authorization: "Bearer launcher-test-token-value" }
  });
  assert.equal(rejected.status, 404);
  assert.deepEqual(calls, ["open", "focus", "status", "quit"]);
});
