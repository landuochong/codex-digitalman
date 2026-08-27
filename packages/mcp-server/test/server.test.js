import assert from "node:assert/strict";
import test from "node:test";
import { DigitalmanMcpServer } from "../src/server.js";

function fixture(){
  const calls=[];
  const launcher={
    action:async(...args)=>{calls.push(["action",...args]);return{running:true,focused:true,session:{session_id:"ses_1",status:"active"}};},
    bridgeRequest:async(path,options)=>{calls.push(["bridge",path,options]);return path.includes("latest")?{session_id:"ses_2",status:"ended",messages:[]}:{session_id:"ses_2",status:"ended",messages:[]};}
  };
  return{server:new DigitalmanMcpServer({launcher}),calls};
}

test("advertises exactly the three contract tools",async()=>{
  const{server}=fixture();const result=await server.handle({method:"tools/list"});
  assert.deepEqual(result.tools.map(tool=>tool.name),["digitalman_open_session","digitalman_get_session","digitalman_delete_session"]);
});

test("opens a window and returns the newly created session",async()=>{
  const{server,calls}=fixture();const result=await server.handle({method:"tools/call",params:{name:"digitalman_open_session",arguments:{topic:"休息"}}});
  assert.equal(result.structuredContent.session_id,"ses_1");
  assert.deepEqual(calls[0],["action","open",{start:true}]);
});

test("reads latest ended and deletes only an explicit session",async()=>{
  const{server,calls}=fixture();
  const read=await server.handle({method:"tools/call",params:{name:"digitalman_get_session",arguments:{}}});
  assert.equal(read.structuredContent.status,"ended");
  const missing=await server.handle({method:"tools/call",params:{name:"digitalman_delete_session",arguments:{}}});
  assert.equal(missing.isError,true);
  await server.handle({method:"tools/call",params:{name:"digitalman_delete_session",arguments:{session_id:"ses_2"}}});
  assert.ok(calls.some(call=>call[1]==="/v1/sessions/ses_2"&&call[2]?.method==="DELETE"));
});

test("refuses an active specifically selected session",async()=>{
  const launcher={action:async()=>{},bridgeRequest:async()=>({session_id:"ses_3",status:"active",messages:[]})};
  const server=new DigitalmanMcpServer({launcher});
  const result=await server.handle({method:"tools/call",params:{name:"digitalman_get_session",arguments:{session_id:"ses_3"}}});
  assert.equal(result.isError,true);
});
