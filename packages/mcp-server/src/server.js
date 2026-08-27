const TOOLS=[
  {
    name:"digitalman_open_session",
    description:"Open or focus the local Lumi digital-human window and create a new temporary chat session.",
    inputSchema:{type:"object",properties:{topic:{type:"string",maxLength:200,description:"Optional topic shown only to Codex; it is not sent as a transcript message."}},additionalProperties:false}
  },
  {
    name:"digitalman_get_session",
    description:"Read an ended temporary chat by ID, or the most recently ended chat. Active sessions are never returned.",
    inputSchema:{type:"object",properties:{session_id:{type:"string",description:'Session ID or "latest".'}},additionalProperties:false}
  },
  {
    name:"digitalman_delete_session",
    description:"Permanently delete one explicitly identified temporary transcript.",
    inputSchema:{type:"object",properties:{session_id:{type:"string",minLength:1}},required:["session_id"],additionalProperties:false}
  }
];

function toolResult(value){return{content:[{type:"text",text:JSON.stringify(value)}],structuredContent:value};}
function toolError(error){return{content:[{type:"text",text:error instanceof Error?error.message:String(error)}],isError:true};}

export class DigitalmanMcpServer{
  constructor({launcher}){this.launcher=launcher;}
  async handle(message){
    if(message.method==="initialize")return{protocolVersion:message.params?.protocolVersion??"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"codex-digitalman",version:"0.2.0"}};
    if(message.method==="ping")return{};
    if(message.method==="tools/list")return{tools:TOOLS};
    if(message.method==="tools/call"){
      try{return await this.#call(message.params?.name,message.params?.arguments??{});}catch(error){return toolError(error);}
    }
    throw Object.assign(new Error(`Method not found: ${message.method}`),{code:-32601});
  }
  async #call(name,args){
    if(name==="digitalman_open_session"){
      if(args.topic!==undefined&&(typeof args.topic!=="string"||args.topic.length>200))throw new Error("topic must be at most 200 characters");
      const result=await this.launcher.action("open",{start:true});
      return toolResult({session_id:result.session.session_id,status:result.session.status,window:{running:result.running,focused:result.focused}});
    }
    if(name==="digitalman_get_session"){
      const sessionId=args.session_id??"latest";
      const session=sessionId==="latest"
        ?await this.launcher.bridgeRequest("/v1/sessions/latest?status=ended")
        :await this.launcher.bridgeRequest(`/v1/sessions/${encodeURIComponent(sessionId)}`);
      if(session.status!=="ended")throw new Error("Only ended sessions can be read by this tool");
      return toolResult(session);
    }
    if(name==="digitalman_delete_session"){
      if(typeof args.session_id!=="string"||!args.session_id)throw new Error("session_id is required");
      await this.launcher.bridgeRequest(`/v1/sessions/${encodeURIComponent(args.session_id)}`,{method:"DELETE"});
      return toolResult({deleted:true,session_id:args.session_id});
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}

export { TOOLS };
