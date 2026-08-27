import { randomBytes } from "node:crypto";
import { createBridgeServer } from "./server.js";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.DIGITALMAN_BRIDGE_PORT ?? "0", 10);
const token = process.env.DIGITALMAN_BRIDGE_TOKEN ?? randomBytes(24).toString("base64url");

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("DIGITALMAN_BRIDGE_PORT must be an integer from 0 to 65535");
}

const server = createBridgeServer({ token });
server.listen(port, host, () => {
  const address = server.address();
  // Startup metadata only. Never log message bodies or the token after this handoff.
  process.stdout.write(`${JSON.stringify({ host, port: address.port, token })}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
