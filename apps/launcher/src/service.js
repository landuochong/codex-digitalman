import http from "node:http";

export const ALLOWED_ACTIONS = Object.freeze(["open", "focus", "status", "quit"]);

async function readOptions(request){
  const chunks=[];let size=0;
  for await(const chunk of request){size+=chunk.length;if(size>4096)throw new Error("Action payload too large");chunks.push(chunk);}
  if(!size)return{};
  const value=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid action payload");
  return value;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  response.end(body);
}

export function createLauncherServer({ token, runtime, onQuit = () => {} }) {
  if (typeof token !== "string" || token.length < 16) throw new Error("Launcher token is too short");
  return http.createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      sendJson(response, 401, { error: { code: "unauthorized", message: "Valid Bearer token required" } });
      return;
    }
    const url = new URL(request.url, "http://127.0.0.1");
    const match = request.method === "POST" && url.pathname.match(/^\/v1\/actions\/([^/]+)$/);
    if (!match || !ALLOWED_ACTIONS.includes(match[1])) {
      sendJson(response, 404, { error: { code: "action_not_allowed", message: "Action not allowed" } });
      return;
    }
    try {
      const action = match[1];
      const options=await readOptions(request);
      const result = await runtime[action](options);
      sendJson(response, 200, { action, result });
      if (action === "quit") queueMicrotask(onQuit);
    } catch (error) {
      sendJson(response, 503, {
        error: { code: "runtime_unavailable", message: error instanceof Error ? error.message : "Runtime unavailable" }
      });
    }
  });
}
