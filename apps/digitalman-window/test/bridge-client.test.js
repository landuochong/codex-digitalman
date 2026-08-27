import assert from "node:assert/strict";
import test from "node:test";
import { BridgeClient } from "../src/bridge-client.js";

test("sends only normalized session bridge requests", async () => {
  const calls = [];
  const client = new BridgeClient({
    baseUrl: "http://127.0.0.1:1234/",
    token: "secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ status: "active" }), { status: 201 });
    }
  });
  await client.appendMessage("ses/a", { role: "user", text: "hi", source: "typed" });
  assert.equal(calls[0].url, "http://127.0.0.1:1234/v1/sessions/ses%2Fa/messages");
  assert.equal(calls[0].options.headers.authorization, "Bearer secret");
});
