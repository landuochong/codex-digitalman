import { readFile } from "node:fs/promises";
import { LauncherClient } from "../../../apps/launcher/src/client.js";
import { CodexEntryController } from "./controller.js";

const supported=JSON.parse(await readFile(new URL("../supported-versions.json",import.meta.url),"utf8"));
const codexVersion=process.env.CODEX_DIGITALMAN_CODEX_VERSION??"";
const debugPort=Number.parseInt(process.env.CODEX_DIGITALMAN_CODEX_DEBUG_PORT??"0",10);
const controller=new CodexEntryController({launcher:new LauncherClient(),supportedVersions:supported});
const result=await controller.start({codexVersion,debugPort});
process.stdout.write(`${JSON.stringify(result)}\n`);
if(!result.enabled)process.exit(0);
const heartbeat=setInterval(async()=>{
  try{await controller.ping();}
  catch(error){process.stderr.write(`Codex entry heartbeat failed: ${error.message}\n`);clearInterval(heartbeat);controller.stop();process.exit(1);}
},10_000);
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{clearInterval(heartbeat);controller.stop();process.exit(0);});
