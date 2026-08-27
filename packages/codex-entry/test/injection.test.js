import assert from "node:assert/strict";
import test from "node:test";
import { buildInjectionSource } from "../src/injection.js";

test("internal workspace renders directly without iframe, webview, or external action",()=>{
  const source=buildInjectionSource();
  assert.match(source,/codex-digitalman-workspace/);
  assert.match(source,/127\.0\.0\.1/);
  assert.match(source,/digitalman-chat-result/);
  assert.match(source,/digitalman-real-video/);
  assert.match(source,/digitalman-character/);
  assert.match(source,/digitalman-persona-form/);
  assert.match(source,/voiceCatalog/);
  assert.match(source,/action:"chat"/);
  assert.match(source,/action:"transcribe-chunk"/);
  assert.match(source,/action:"transcribe-commit"/);
  assert.match(source,/digitalman-voice-button/);
  assert.match(source,/getUserMedia/);
  assert.match(source,/speechDataUrl/);
  assert.match(source,/avatarSpeechDataUrl/);
  assert.doesNotMatch(source,/focus-digitalman/);
  assert.doesNotMatch(source,/<webview/);
  assert.doesNotMatch(source,/<iframe/);
});

test("internal panel never contains an external-window control",()=>{
  const source=buildInjectionSource();
  assert.doesNotMatch(source,/独立窗口/);
  assert.doesNotMatch(source,/data-action=\?"external/);
});

test("workspace can be closed with Escape or by toggling the sidebar entry",()=>{
  const source=buildInjectionSource();
  assert.match(source,/event\.key!=="Escape"/);
  assert.match(source,/workspace\?\.dataset\.visible==="true"/);
});
