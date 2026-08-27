import { buildInjectionSource } from "./injection.js";
import { entryEnabled, parseRendererRequest, versionSupported } from "./policy.js";

export class CodexEntryController{
  constructor({launcher,fetchImpl=fetch,WebSocketImpl=WebSocket,env=process.env,supportedVersions=[]}={}){
    this.launcher=launcher;this.fetchImpl=fetchImpl;this.WebSocketImpl=WebSocketImpl;this.env=env;this.supportedVersions=supportedVersions;
    this.socket=null;this.sequence=0;this.pending=new Map();this.audioPending=new Map();
    this.internalContext=null;
  }
  async start({codexVersion,debugPort}){
    if(!entryEnabled(this.env))return{enabled:false,reason:"kill-switch"};
    if(!versionSupported(codexVersion,this.supportedVersions))return{enabled:false,reason:"unsupported-version"};
    if(!Number.isInteger(debugPort)||debugPort<1||debugPort>65535)throw new Error("Invalid Codex debug port");
    const targets=await this.fetchImpl(`http://127.0.0.1:${debugPort}/json/list`).then(response=>response.json());
    const candidates=targets.filter(item=>item.type==="page"&&item.url?.startsWith("app://")&&item.webSocketDebuggerUrl&&/^[A-Za-z0-9._-]{1,200}$/.test(item.id));
    const target=candidates.find(item=>item.url==="app://-/index.html")??candidates.find(item=>!new URL(item.url).searchParams.has("initialRoute"))??candidates[0];
    if(!target)throw new Error("No Codex page target found");
    const debuggerUrl=new URL(target.webSocketDebuggerUrl);
    if(debuggerUrl.protocol!=="ws:"||!["127.0.0.1","localhost","[::1]"].includes(debuggerUrl.hostname)||Number(debuggerUrl.port)!==debugPort||debuggerUrl.pathname!==`/devtools/page/${target.id}`)throw new Error("Rejected unsafe CDP target");
    await this.#connect(debuggerUrl.href);
    await this.#request("Runtime.enable");
    await this.#request("Runtime.addBinding",{name:"codexDigitalmanHostAction"});
    const source=buildInjectionSource();
    await this.#request("Page.addScriptToEvaluateOnNewDocument",{source});
    await this.#request("Runtime.evaluate",{expression:source});
    return{enabled:true,targetId:target.id};
  }
  async handleBinding(params){
    if(params?.name!=="codexDigitalmanHostAction")return false;
    const request=parseRendererRequest(params.payload);
    if(!request)return false;
    if(request.kind==="transcribe-chunk"){
      const now=Date.now();for(const [id,item] of this.audioPending)if(now-item.startedAt>60_000)this.audioPending.delete(id);
      let item=this.audioPending.get(request.requestId);if(!item){item={startedAt:now,total:request.total,chunks:new Map()};this.audioPending.set(request.requestId,item);}
      if(item.total!==request.total||item.chunks.has(request.index)){this.audioPending.delete(request.requestId);return false;}
      item.chunks.set(request.index,request.chunk);return true;
    }
    if(request.kind==="transcribe-commit"){
      if(!this.internalContext)throw new Error("Digitalman internal session is not ready");
      const item=this.audioPending.get(request.requestId);this.audioPending.delete(request.requestId);
      if(!item||Date.now()-item.startedAt>60_000||item.chunks.size!==item.total)throw new Error("Incomplete audio request");
      let encoded="";for(let index=0;index<item.total;index++){const chunk=item.chunks.get(index);if(!chunk)throw new Error("Incomplete audio request");encoded+=chunk;}
      const audio=Buffer.from(encoded,"base64");if(!audio.length||audio.length>4*1024*1024)throw new Error("Rejected audio size");
      const response=await this.fetchImpl(`${this.internalContext.origin}/api/asr/transcribe`,{method:"POST",headers:{"content-type":request.mimeType,"x-asr-language":"zh-CN"},body:audio});
      const payload=await response.json().catch(()=>({}));
      const text=String(payload.text??payload.transcript??"").trim().slice(0,2000);
      const detail=response.ok&&text?{requestId:request.requestId,text}:{requestId:request.requestId,error:String(payload.error??"没有听清，请再说一次").slice(0,300)};
      await this.#dispatch("codex-digitalman-transcribe-result-v3",detail);return true;
    }
    if(request.kind==="chat"){
      if(!this.internalContext)throw new Error("Digitalman internal session is not ready");
      const response=await this.fetchImpl(`${this.internalContext.origin}/api/chat`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:request.message,history:request.history,userId:"codex-internal",persona:request.persona,realAvatarCharacter:request.character})});
      const payload=await response.json().catch(()=>({}));
      const detail=response.ok?{requestId:request.requestId,reply:String(payload.reply??"").slice(0,10_000),emotion:String(payload.emotion??"calm").slice(0,32),action:["bow","surprise"].includes(payload.action)?payload.action:"idle"}:{requestId:request.requestId,error:String(payload.error??"连接失败").slice(0,300)};
      if(response.ok&&detail.reply)try{const speech=await this.#speech(detail.reply,detail.emotion,request.voice);detail.speechDataUrl=speech.dataUrl;if(["audio/wav","audio/x-wav"].includes(speech.type)){const action=detail.action,render=await this.fetchImpl(`${this.internalContext.origin}/api/dinet/render?action=${encodeURIComponent(action)}&character=${encodeURIComponent(request.character)}`,{method:"POST",headers:{"content-type":speech.type},body:speech.bytes});const rendered=await render.json().catch(()=>({}));if(render.ok&&/^\/dinet-avatar\/generated\/[a-f0-9]{24}\.mp4$/.test(String(rendered.url??"")))detail.avatarSpeechDataUrl=await this.#assetDataUrl(`${this.internalContext.origin}${rendered.url}`,new Set(["video/mp4"]),32*1024*1024);}}catch(error){process.stderr.write(`Codex entry speech/avatar fallback: ${error.message}\n`);}
      await this.#dispatch("codex-digitalman-chat-result-v3",detail);return true;
    }
    const action=request.action;
    if(action==="open"){
      const result=await this.launcher.action(action,{start:true,body:{display:"internal"}});
      const url=new URL(result.url);
      if(url.protocol!=="http:"||!["127.0.0.1","localhost","[::1]"].includes(url.hostname)||!url.port)throw new Error("Launcher returned a non-loopback URL");
      this.internalContext={origin:url.origin,sessionId:result.session?.session_id};
      const realCharacters={};for(const [name,path] of Object.entries({lumi:"/dh-live/actions/bedroom_idle_test/01-seamless.mp4",xiaotao:"/dh-live/actions/xiaotao_idle/01.mp4"}))try{realCharacters[name]={idle:await this.#assetDataUrl(`${url.origin}${path}`,new Set(["video/mp4"]),4*1024*1024)};}catch{}
      let voiceCatalog={defaultKey:"",voices:[]};try{const response=await this.fetchImpl(`${url.origin}/api/voices`),payload=await response.json();if(response.ok){voiceCatalog={defaultKey:/^[A-Za-z0-9_-]{0,40}$/.test(payload.defaultKey??"")?String(payload.defaultKey??""):"",voices:(Array.isArray(payload.voices)?payload.voices:[]).slice(0,20).map(item=>({key:String(item.key??"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,40),label:String(item.label??"").slice(0,40),description:String(item.description??"").slice(0,100)})).filter(item=>item.key&&item.label)};}}catch{}
      await this.#dispatch("codex-digitalman-ready-v3",{url:result.url,sessionId:result.session?.session_id,realCharacters,voiceCatalog});
    }else await this.launcher.action(action,{start:false});
    return true;
  }
  #dispatch(name,detail){return this.#request("Runtime.evaluate",{expression:`globalThis.dispatchEvent(new CustomEvent(${JSON.stringify(name)},{detail:${JSON.stringify(detail)}}))`});}
  async #serveVrmResource(params){
    const requestId=params?.requestId,url=new URL(params?.request?.url??"app://-/");
    if(!requestId||url.protocol!=="app:"||url.hostname!=="-"||!this.internalContext)return this.#request("Fetch.failRequest",{requestId,errorReason:"BlockedByClient"});
    const path=url.pathname,files={
      "/__digitalman/vrm-avatar.js":"/vrm-avatar.js",
      "/__digitalman/vrm-motion.js":"/vrm-motion.js",
      "/__digitalman/three.module.js":"/vrm/vendor/three/three.module.js",
      "/__digitalman/three-vrm.module.min.js":"/vrm/vendor/three-vrm.module.min.js",
      "/__digitalman/three-vrm-animation.module.min.js":"/vrm/vendor/three-vrm-animation.module.min.js",
      "/__digitalman/model.vrm":"/vrm/models/nikechan_v1.vrm"
    };
    let upstream=files[path];if(!upstream&&/^\/__digitalman\/three\/addons\/[A-Za-z0-9_./-]+\.js$/.test(path))upstream=`/vrm/vendor/three/addons/${path.slice("/__digitalman/three/addons/".length)}`;
    if(!upstream&&/^\/__digitalman\/poses\/[A-Za-z0-9_-]+\.json$/.test(path))upstream=`/vrm/motions/poses/${path.slice("/__digitalman/poses/".length)}`;
    if(!upstream)return this.#request("Fetch.failRequest",{requestId,errorReason:"BlockedByClient"});
    try{
      const response=await this.fetchImpl(`${this.internalContext.origin}${upstream}`);if(!response.ok)throw new Error("VRM resource unavailable");
      const isModel=path.endsWith(".vrm"),isJson=path.endsWith(".json"),limit=isModel?24*1024*1024:2*1024*1024;let bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>limit)throw new Error("Rejected VRM resource size");
      if(!isModel&&!isJson){let source=bytes.toString("utf8");source=source.replace(/(["'])three\1/g,'"app://-/__digitalman/three.module.js"').replace(/(["'])three\/addons\//g,'"app://-/__digitalman/three/addons/').replace(/(["'])@pixiv\/three-vrm\1/g,'"app://-/__digitalman/three-vrm.module.min.js"').replace(/(["'])@pixiv\/three-vrm-animation\1/g,'"app://-/__digitalman/three-vrm-animation.module.min.js"').replace('const POSE_ROOT="/vrm/motions/poses"','const POSE_ROOT="app://-/__digitalman/poses"');bytes=Buffer.from(source);}
      await this.#request("Fetch.fulfillRequest",{requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:isModel?"model/gltf-binary":isJson?"application/json":"text/javascript; charset=utf-8"},{name:"Cache-Control",value:"no-store"}],body:bytes.toString("base64")});
    }catch{await this.#request("Fetch.failRequest",{requestId,errorReason:"Failed"});}
  }
  async #assetDataUrl(url,allowedTypes,maxBytes){
    const response=await this.fetchImpl(url);if(!response.ok)throw new Error("Avatar asset unavailable");
    const type=String(response.headers.get("content-type")??"").split(";",1)[0].trim().toLowerCase();if(!allowedTypes.has(type))throw new Error("Rejected asset MIME");
    const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>maxBytes)throw new Error("Rejected asset size");
    return`data:${type};base64,${bytes.toString("base64")}`;
  }
  async #speech(text,emotion,voice){
    const response=await this.fetchImpl(`${this.internalContext.origin}/api/speech`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text,emotion,voice})});
    if(!response.ok)throw new Error("Speech unavailable");
    const type=String(response.headers.get("content-type")??"").split(";",1)[0].trim().toLowerCase();
    if(!new Set(["audio/wav","audio/x-wav","audio/mpeg","audio/mp4"]).has(type))throw new Error("Rejected speech MIME");
    const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)throw new Error("Rejected speech size");
    return{type,bytes,dataUrl:`data:${type};base64,${bytes.toString("base64")}`};
  }
  ping(){return this.#request("Runtime.evaluate",{expression:"true",returnByValue:true});}
  stop(){this.socket?.close();this.socket=null;for(const {reject} of this.pending.values())reject(new Error("Controller stopped"));this.pending.clear();}
  #connect(url){
    return new Promise((resolve,reject)=>{
      const socket=new this.WebSocketImpl(url);this.socket=socket;
      socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});
      socket.addEventListener("message",event=>this.#message(event.data));
    });
  }
  #request(method,params={}){
    const id=++this.sequence;this.socket.send(JSON.stringify({id,method,params}));
    return new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));
  }
  #message(raw){
    const message=JSON.parse(String(raw));
    if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);return;}
    if(message.method==="Fetch.requestPaused")void this.#serveVrmResource(message.params).catch(()=>{});
    if(message.method==="Runtime.bindingCalled")void this.handleBinding(message.params).catch(error=>{process.stderr.write(`Codex entry binding failed: ${error.message}\n`);const request=parseRendererRequest(message.params?.payload);if(request?.requestId){const event=request.kind.startsWith("transcribe")?"codex-digitalman-transcribe-result-v3":"codex-digitalman-chat-result-v3";void this.#dispatch(event,{requestId:request.requestId,error:"本地语音服务处理失败"}).catch(()=>{});}});
  }
}
