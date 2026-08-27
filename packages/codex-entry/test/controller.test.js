import assert from "node:assert/strict";
import test from "node:test";
import { CodexEntryController } from "../src/controller.js";

test("kill switch and version guard stop before CDP access",async()=>{
  let fetched=false;const controller=new CodexEntryController({launcher:{},env:{},supportedVersions:["1"],fetchImpl:async()=>{fetched=true;}});
  assert.deepEqual(await controller.start({codexVersion:"1",debugPort:9222}),{enabled:false,reason:"kill-switch"});
  controller.env={CODEX_DIGITALMAN_ENTRY_ENABLED:"true"};
  assert.deepEqual(await controller.start({codexVersion:"2",debugPort:9222}),{enabled:false,reason:"unsupported-version"});
  assert.equal(fetched,false);
});

test("binding maps only allow-listed actions",async()=>{
  const calls=[];const controller=new CodexEntryController({launcher:{action:async(...args)=>calls.push(args)}});
  assert.equal(await controller.handleBinding({name:"codexDigitalmanHostAction",payload:"focus-digitalman"}),true);
  assert.equal(await controller.handleBinding({name:"codexDigitalmanHostAction",payload:"run-shell"}),false);
  assert.deepEqual(calls,[["focus",{start:false}]]);
});
