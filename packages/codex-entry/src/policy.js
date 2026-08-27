export const HOST_ACTIONS=Object.freeze({
  "open-digitalman":"open",
  "focus-digitalman":"focus"
});

export function entryEnabled(env=process.env){
  return String(env.CODEX_DIGITALMAN_ENTRY_ENABLED??"false").toLowerCase()==="true";
}

export function versionSupported(version,supportedVersions){
  return typeof version==="string"&&supportedVersions.includes(version);
}

export function resolveHostAction(value){
  return typeof value==="string"?HOST_ACTIONS[value]??null:null;
}

export function parseRendererRequest(value){
  const hostAction=resolveHostAction(value);
  if(hostAction)return{kind:"host",action:hostAction};
  if(typeof value!=="string"||value.length>32_000)return null;
  let data;try{data=JSON.parse(value);}catch{return null;}
  if(!data||!/^[-A-Za-z0-9_]{1,64}$/.test(data.requestId??""))return null;
  if(data.action==="transcribe-chunk"){
    const index=Number(data.index),total=Number(data.total),chunk=String(data.chunk??"");
    if(!Number.isInteger(index)||!Number.isInteger(total)||index<0||total<1||total>350||index>=total||chunk.length>16_384||!chunk||!/^[A-Za-z0-9+/=]+$/.test(chunk))return null;
    return{kind:"transcribe-chunk",requestId:data.requestId,index,total,chunk};
  }
  if(data.action==="transcribe-commit"){
    const mimeType=String(data.mimeType??"").split(";",1)[0].toLowerCase();
    if(mimeType!=="audio/wav")return null;
    return{kind:"transcribe-commit",requestId:data.requestId,mimeType};
  }
  if(data.action!=="chat")return null;
  const message=String(data.message??"").trim();if(!message||message.length>2000)return null;
  const rawHistory=Array.isArray(data.history)?data.history.slice(-6):[];
  const history=[];
  for(const item of rawHistory){
    if(!item||!["user","assistant"].includes(item.role))return null;
    const content=String(item.content??"");if(!content||content.length>4000)return null;
    history.push({role:item.role,content});
  }
  const character=["lumi","xiaotao"].includes(data.character)?data.character:"lumi";
  const rawPersona=data.persona&&typeof data.persona==="object"?data.persona:{};
  const clean=(value,max,fallback)=>String(value??fallback).replace(/[\u0000-\u001f\u007f]+/g," ").replace(/\s+/g," ").trim().slice(0,max)||fallback;
  const persona={name:clean(rawPersona.name,20,"露米"),relationship:clean(rawPersona.relationship,40,"可信赖的朋友"),style:clean(rawPersona.style,160,"自然、温暖、有边界感"),background:clean(rawPersona.background,240,"擅长安静倾听，也愿意认真陪你一起想办法")};
  const voice=/^[A-Za-z0-9_-]{0,40}$/.test(data.voice??"")?String(data.voice??""):"";
  return{kind:"chat",requestId:data.requestId,message,history,character,persona,voice};
}
