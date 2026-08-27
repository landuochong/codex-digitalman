import readline from "node:readline";
import { LauncherClient } from "../../../apps/launcher/src/client.js";
import { DigitalmanMcpServer } from "./server.js";

const server=new DigitalmanMcpServer({launcher:new LauncherClient()});
const input=readline.createInterface({input:process.stdin,terminal:false});

function send(message){process.stdout.write(`${JSON.stringify(message)}\n`);}

input.on("line",async line=>{
  let request;
  try{request=JSON.parse(line);}catch{send({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Parse error"}});return;}
  if(request.id===undefined)return;
  try{send({jsonrpc:"2.0",id:request.id,result:await server.handle(request)});}
  catch(error){send({jsonrpc:"2.0",id:request.id,error:{code:error.code??-32603,message:error.message??"Internal error"}});}
});
