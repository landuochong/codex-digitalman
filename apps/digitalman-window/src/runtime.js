import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROJECT_DIR = "/Users/Admin/whb/AI/digitalman";
const ALLOWED_BROWSER_APPS = new Set(["Google Chrome", "Chromium", "Microsoft Edge"]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DigitalmanRuntime {
  constructor({
    projectDir = DEFAULT_PROJECT_DIR,
    port = 3000,
    profile = "anime",
    browserApp = "Google Chrome",
    spawnImpl = spawn,
    fetchImpl = fetch,
    healthTimeoutMs = 3_000,
    pollIntervalMs = 100,
    env = process.env
  } = {}) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid digitalman port");
    if (!ALLOWED_BROWSER_APPS.has(browserApp)) throw new Error("Unsupported browser app");
    this.projectDir = path.resolve(projectDir);
    this.port = port;
    this.profile = profile;
    this.browserApp = browserApp;
    this.spawnImpl = spawnImpl;
    this.fetchImpl = fetchImpl;
    this.healthTimeoutMs = healthTimeoutMs;
    this.pollIntervalMs = pollIntervalMs;
    this.env = env;
    this.child = null;
    this.sessionId = "";
  }

  get baseUrl() {
    return `http://127.0.0.1:${this.port}`;
  }

  get windowUrl() {
    const parameters=new URLSearchParams({profile:this.profile});
    if(this.sessionId)parameters.set("codexSession",this.sessionId);
    return `${this.baseUrl}/?${parameters}`;
  }

  async status() {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(800)
      });
      return { running: response.ok, url: this.windowUrl, owned: this.child !== null };
    } catch {
      return { running: false, url: this.windowUrl, owned: this.child !== null };
    }
  }

  async open() {
    const {started}=await this.prepare();
    await this.#openAppWindow();
    return { running: true, started, focused: true, url: this.windowUrl };
  }

  async prepare(){
    const started=!(await this.status()).running;
    if(started)await this.#start();
    return{running:true,started,focused:false,url:this.windowUrl};
  }

  async focus() {
    const status = await this.status();
    if (!status.running) return this.open();
    await this.#openAppWindow();
    return { ...status, focused: true };
  }

  async quit() {
    if (!this.child) return { stopped: false, reason: "not-owned" };
    const child = this.child;
    this.child = null;
    child.kill("SIGTERM");
    return { stopped: true };
  }

  async #start() {
    const entry = path.join(this.projectDir, "server.mjs");
    await access(entry);
    const child = this.spawnImpl(process.execPath, [entry], {
      cwd: this.projectDir,
      env: { ...this.env, PORT: String(this.port) },
      stdio: "ignore",
      shell: false
    });
    this.child = child;
    child.once?.("exit", () => {
      if (this.child === child) this.child = null;
    });

    const deadline = Date.now() + this.healthTimeoutMs;
    while (Date.now() < deadline) {
      if ((await this.status()).running) return;
      await delay(this.pollIntervalMs);
    }
    child.kill("SIGTERM");
    this.child = null;
    throw new Error(`Digitalman health check timed out at ${this.baseUrl}/api/health`);
  }

  async #openAppWindow() {
    const child = this.spawnImpl("/usr/bin/open", [
      "-na",
      this.browserApp,
      "--args",
      `--app=${this.windowUrl}`
    ], { stdio: "ignore", shell: false });
    await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`open exited with ${code}`)));
    });
  }
}

export { ALLOWED_BROWSER_APPS, DEFAULT_PROJECT_DIR };
