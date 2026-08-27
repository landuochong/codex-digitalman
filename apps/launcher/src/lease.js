import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class LauncherLease {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir;
    this.lockPath = path.join(runtimeDir, "launcher.lock");
    this.metadataPath = path.join(runtimeDir, "launcher.json");
    this.handle = null;
  }

  async acquire() {
    await mkdir(this.runtimeDir, { recursive: true, mode: 0o700 });
    try {
      this.handle = await open(this.lockPath, "wx", 0o600);
      await this.handle.writeFile(`${process.pid}\n`);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number.parseInt(await readFile(this.lockPath, "utf8"), 10);
      if (Number.isInteger(pid) && this.#alive(pid)) throw new Error(`Launcher already running with PID ${pid}`);
      await rm(this.lockPath, { force: true });
      this.handle = await open(this.lockPath, "wx", 0o600);
      await this.handle.writeFile(`${process.pid}\n`);
    }
  }

  async publish(metadata) {
    const temporary = `${this.metadataPath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(metadata), { mode: 0o600 });
    await rename(temporary, this.metadataPath);
  }

  async read() {
    return JSON.parse(await readFile(this.metadataPath, "utf8"));
  }

  async release() {
    await this.handle?.close();
    this.handle = null;
    await rm(this.metadataPath, { force: true });
    await rm(this.lockPath, { force: true });
  }

  #alive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code === "EPERM";
    }
  }
}
