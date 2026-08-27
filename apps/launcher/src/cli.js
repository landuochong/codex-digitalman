import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DigitalmanRuntime } from "../../digitalman-window/src/runtime.js";
import { createBridgeServer } from "../../../packages/session-bridge/src/server.js";
import { SessionStore } from "../../../packages/session-bridge/src/store.js";
import { LauncherLease } from "./lease.js";
import { ALLOWED_ACTIONS, createLauncherServer } from "./service.js";

const action = process.argv[2] ?? "serve";
const runtimeDir = process.env.CODEX_DIGITALMAN_RUNTIME_DIR ?? path.join(os.homedir(), "Library", "Application Support", "codex-digitalman");
const lease = new LauncherLease(runtimeDir);

async function serve() {
  await lease.acquire();
  const token = randomBytes(24).toString("base64url");
  const bridgeToken = randomBytes(24).toString("base64url");
  const store=new SessionStore();
  const bridgeServer = createBridgeServer({ token: bridgeToken,store });
  await new Promise((resolve, reject) => {
    bridgeServer.once("error", reject);
    bridgeServer.listen(0, "127.0.0.1", resolve);
  });
  const bridgePort = bridgeServer.address().port;
  const digitalmanRuntime = new DigitalmanRuntime({
    projectDir: process.env.DIGITALMAN_PROJECT_DIR,
    port: Number.parseInt(process.env.DIGITALMAN_PORT ?? "3000", 10),
    profile: process.env.DIGITALMAN_PROFILE ?? "anime",
    browserApp: process.env.DIGITALMAN_BROWSER_APP ?? "Google Chrome",
    env: {
      ...process.env,
      CODEX_DIGITALMAN_BRIDGE_URL: `http://127.0.0.1:${bridgePort}`,
      CODEX_DIGITALMAN_BRIDGE_TOKEN: bridgeToken
    }
  });
  const runtime={
    open:async({display="external"}={})=>{
      if(!["internal","external"].includes(display))throw new Error("Unsupported display mode");
      const session=store.create();
      digitalmanRuntime.sessionId=session.session_id;
      const window=display==="internal"?await digitalmanRuntime.prepare():await digitalmanRuntime.open();
      return {...window,display,session};
    },
    focus:()=>digitalmanRuntime.focus(),
    status:()=>digitalmanRuntime.status(),
    quit:()=>digitalmanRuntime.quit()
  };
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await digitalmanRuntime.quit();
    server.close(async () => {
      await new Promise((resolve) => bridgeServer.close(resolve));
      await lease.release();
      process.exit(0);
    });
  };
  const server = createLauncherServer({ token, runtime, onQuit: shutdown });
  server.listen(0, "127.0.0.1", async () => {
    await lease.publish({
      pid: process.pid,
      port: server.address().port,
      token,
      bridge: { port: bridgePort, token: bridgeToken }
    });
    process.stdout.write(`${JSON.stringify({ status: "ready", pid: process.pid, port: server.address().port })}\n`);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function call(requestedAction) {
  let metadata;
  try {
    metadata = await lease.read();
  } catch {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], {
      detached: true,
      stdio: "ignore",
      env: process.env
    });
    child.unref();
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      try {
        metadata = await lease.read();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }
  if (!metadata) throw new Error("Launcher did not become ready within 3 seconds");
  const response = await fetch(`http://127.0.0.1:${metadata.port}/v1/actions/${requestedAction}`, {
    method: "POST",
    headers: { authorization: `Bearer ${metadata.token}` }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "Launcher request failed");
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (action === "serve") await serve();
else if (ALLOWED_ACTIONS.includes(action)) await call(action);
else throw new Error(`Unsupported action: ${action}`);
