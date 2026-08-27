import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export function defaultRuntimeDir(env=process.env){
  return env.CODEX_DIGITALMAN_RUNTIME_DIR??path.join(os.homedir(),"Library","Application Support","codex-digitalman");
}

export class LauncherClient{
  constructor({runtimeDir=defaultRuntimeDir(),fetchImpl=fetch,spawnImpl=spawn}={}){
    this.runtimeDir=runtimeDir;this.fetchImpl=fetchImpl;this.spawnImpl=spawnImpl;
  }
  async metadata(){return JSON.parse(await readFile(path.join(this.runtimeDir,"launcher.json"),"utf8"));}
  async ensureStarted(){
    try{return await this.metadata();}catch{}
    const entry=fileURLToPath(new URL("./cli.js",import.meta.url));
    const child=this.spawnImpl(process.execPath,[entry,"serve"],{detached:true,stdio:"ignore",env:{...process.env,CODEX_DIGITALMAN_RUNTIME_DIR:this.runtimeDir},shell:false});
    child.unref();
    const deadline=Date.now()+3000;
    while(Date.now()<deadline){try{return await this.metadata();}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
    throw new Error("Launcher did not become ready within 3 seconds");
  }
  async action(action,{start=false,body}={}){
    const metadata=start?await this.ensureStarted():await this.metadata();
    const response=await this.fetchImpl(`http://127.0.0.1:${metadata.port}/v1/actions/${action}`,{method:"POST",headers:{authorization:`Bearer ${metadata.token}`,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error?.message??"Launcher request failed");
    return payload.result;
  }
  async bridgeRequest(pathname,{method="GET"}={}){
    const metadata=await this.metadata();
    const response=await this.fetchImpl(`http://127.0.0.1:${metadata.bridge.port}${pathname}`,{method,headers:{authorization:`Bearer ${metadata.bridge.token}`}});
    const text=await response.text();const payload=text?JSON.parse(text):null;
    if(!response.ok){const error=new Error(payload?.error?.message??"Bridge request failed");error.code=payload?.error?.code;throw error;}
    return payload;
  }
}
