import assert from "node:assert/strict";
import test from "node:test";
import { entryEnabled,parseRendererRequest,resolveHostAction,versionSupported } from "../src/policy.js";

test("entry is disabled by default and accepts only an explicit true",()=>{
  assert.equal(entryEnabled({}),false);assert.equal(entryEnabled({CODEX_DIGITALMAN_ENTRY_ENABLED:"true"}),true);
});
test("unknown versions fail closed",()=>{
  assert.equal(versionSupported("1.2.3",[]),false);assert.equal(versionSupported("1.2.3",["1.2.3"]),true);
});
test("host binding accepts only open and focus",()=>{
  assert.equal(resolveHostAction("open-digitalman"),"open");assert.equal(resolveHostAction("focus-digitalman"),"focus");assert.equal(resolveHostAction("run-shell"),null);
});
test("renderer chat requests are bounded and normalized",()=>{
  assert.deepEqual(parseRendererRequest("open-digitalman"),{kind:"host",action:"open"});
  assert.deepEqual(parseRendererRequest(JSON.stringify({action:"chat",requestId:"req_1",message:" 你好 ",history:[{role:"user",content:"早"}],character:"xiaotao",persona:{name:" 小晴 ",relationship:"伙伴",style:"活泼",background:"喜欢音乐"},voice:"sweet"})),{kind:"chat",requestId:"req_1",message:"你好",history:[{role:"user",content:"早"}],character:"xiaotao",persona:{name:"小晴",relationship:"伙伴",style:"活泼",background:"喜欢音乐"},voice:"sweet"});
  assert.equal(parseRendererRequest(JSON.stringify({action:"chat",requestId:"../bad",message:"x"})),null);
  assert.equal(parseRendererRequest(JSON.stringify({action:"chat",requestId:"ok",message:"x".repeat(2001)})),null);
});
test("renderer voice requests accept only bounded allow-listed audio",()=>{
  assert.deepEqual(parseRendererRequest(JSON.stringify({action:"transcribe-chunk",requestId:"asr_1",index:0,total:1,chunk:"dm9pY2U="})),{kind:"transcribe-chunk",requestId:"asr_1",index:0,total:1,chunk:"dm9pY2U="});
  assert.deepEqual(parseRendererRequest(JSON.stringify({action:"transcribe-commit",requestId:"asr_1",mimeType:"audio/wav"})),{kind:"transcribe-commit",requestId:"asr_1",mimeType:"audio/wav"});
  assert.equal(parseRendererRequest(JSON.stringify({action:"transcribe-chunk",requestId:"asr_1",index:1,total:1,chunk:"dm9pY2U="})),null);
  assert.equal(parseRendererRequest(JSON.stringify({action:"transcribe-commit",requestId:"asr_1",mimeType:"audio/webm"})),null);
});
