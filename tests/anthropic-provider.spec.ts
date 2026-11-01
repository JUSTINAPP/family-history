import {test,expect} from "@playwright/test";
import {createAnthropicProvider} from "../src/lib/documents/anthropic-provider";
import {configuredDocumentProvider} from "../src/lib/documents/provider-config";
const key="mock-anthropic-server-key";
const reading={text:"Cher Jan, [unclear]",language:"fr",uncertainty:["One illegible word"],confidence:null};
function message(value:unknown,extra:Record<string,unknown>={}) {
  return {id:"msg_mock",type:"message",role:"assistant",model:"resolved-mock-model",content:[{type:"text",text:JSON.stringify(value)}],stop_reason:"end_turn",usage:{input_tokens:120,output_tokens:50},...extra};
}
test("provider selection uses only the selected server credential and never falls back or makes a configuration probe",()=>{
  let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw new Error("No network permitted");};
  expect(configuredDocumentProvider({provider:"anthropic",model:"custom-configured-model",anthropicKey:key},fetcher)?.name).toBe("anthropic");
  expect(configuredDocumentProvider({provider:"anthropic",model:"custom-configured-model",anthropicKey:key},fetcher)?.model).toBe("custom-configured-model");
  expect(configuredDocumentProvider({provider:"openai",model:"existing-configured-model",openaiKey:"mock-openai-key"},fetcher)?.name).toBe("openai");
  for(const config of [
    {provider:"anthropic",model:"model",openaiKey:"mock-openai-key"},
    {provider:"anthropic",model:"model",anthropicKey:""},
    {provider:"anthropic",model:"model",anthropicKey:"invalid\nheader"},
    {provider:"anthropic",model:"",anthropicKey:key},
    {provider:"anthropic",model:"model\nheader",anthropicKey:key},
    {provider:"unsupported",model:"model",anthropicKey:key},
    {provider:"openai",model:"model",anthropicKey:key},
  ])expect(configuredDocumentProvider(config,fetcher)).toBeNull();
  expect(calls).toBe(0);
});
test("ordered pages use Messages base64 vision blocks, configured model, structured JSON and raw provider receipts",async()=>{
  const calls:Record<string,unknown>[]=[];
  const provider=createAnthropicProvider({key,model:"custom-configured-model",fetcher:async(url,init)=>{
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    const headers=init!.headers as Record<string,string>;
    expect(headers.Authorization).toBe(`Bearer ${key}`);expect(headers["anthropic-version"]).toBe("2026-10-21");
    expect(init!.cache).toBe("no-store");expect(init!.redirect).toBe("error");expect(init!.signal).toBeInstanceOf(AbortSignal);
    const body=JSON.parse(String(init!.body));calls.push(body);
    expect(body.model).toBe("custom-configured-model");expect(body.max_tokens).toBe(10000);
    expect(body.thinking).toEqual({type:"between_tools"});expect(body.tools).toBeUndefined();expect(body.temperature).toBeUndefined();
    expect(body.output_config.format.type).toBe("json_schema");expect(body.output_config.format.schema.additionalProperties).toBe(false);
    expect(JSON.stringify(body)).not.toContain(key);
    return Response.json(message({...reading,text:`Page ${calls.length} [unclear]`}),{headers:{"request-id":"req_mock"}});
  }});
  const pages=[];
  for(const encoded of ["QQ==","Qg=="])pages.push(await provider.readPage({image:`data:image/jpeg;base64,${encoded}`,operation:"transcribe"}));
  for(let n=0;n<2;n++) {
    const content=(calls[n].messages as {role:string;content:{type:string;source?:unknown;text?:string}[]}[])[0].content;
    expect(content[0]).toEqual({type:"image",source:{type:"base64",media_type:"image/jpeg",data:n?"Qg==":"QQ=="}});
    expect(content[1].text).toContain("handwritten or typed");expect(content[1].text).toContain("[unclear]");expect(content[1].text).toContain("Do not identify faces");
    expect(pages[n].text).toBe(`Page ${n+1} [unclear]`);
    expect(pages[n].rawResponse).toEqual(message({...reading,text:pages[n].text}));
    expect(pages[n].receipt).toMatchObject({provider:"anthropic",model:"resolved-mock-model",responseId:"msg_mock",apiVersion:"2026-10-21",requestId:"req_mock",stopReason:"end_turn",usage:{input_tokens:120,output_tokens:50}});
  }
});
test("Anthropic extraction preserves ordered evidence and returns only validated drafts for human review",async()=>{
  const suggestions=["person","place","date","sender","recipient","summary","topic"].map(kind=>({kind,value:kind==="date"?"1978-08-17":"Jan in Auroville",evidence:"Jan",page:2,context:kind==="date"?"written_date":"mentioned"}));
  const provider=createAnthropicProvider({key,model:"model",fetcher:async(_url,init)=>{
    const body=JSON.parse(String(init!.body));const content=body.messages[0].content;
    expect(content).toHaveLength(1);expect(content[0].type).toBe("text");
    expect(content[0].text.indexOf('"page":1')).toBeLessThan(content[0].text.indexOf('"page":2'));
    expect(content[0].text).toContain("Do not infer identity or residence");expect(content[0].text).toContain("written_date");
    return Response.json(message({suggestions:suggestions.map(s=>({...s,kind:s.kind==="person"?"Person":s.kind}))}));
  }});
  const output=await provider.extract([{text:"First page.",page:1},{text:"Jan in Auroville",page:2}]);
  expect(output.suggestions.map(s=>s.kind)).toEqual(suggestions.map(s=>s.kind));
  expect(output.rawResponse?.content).toEqual(message({suggestions:suggestions.map(s=>({...s,kind:s.kind==="person"?"Person":s.kind}))}).content);
});
test("English translation sends frozen source text only, preserving uncertainty and source separation",async()=>{
  let calls=0;
  const provider=createAnthropicProvider({key,model:"model",fetcher:async(_url,init)=>{
    calls++;const content=JSON.parse(String(init!.body)).messages[0].content;
    expect(content).toHaveLength(1);expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("Cher Jan, [unclear]");expect(content[0].text).toContain("into English");
    expect(content[0].text).not.toContain("private-image-marker");
    return Response.json(message({...reading,text:"Dear Jan, [unclear]",language:"en"}));
  }});
  const output=await provider.readPage({operation:"translate",image:"private-image-marker",sourceText:reading.text});
  expect(output.text).toBe("Dear Jan, [unclear]");expect(reading.text).toBe("Cher Jan, [unclear]");expect(calls).toBe(1);
  await expect(provider.readPage({operation:"translate",image:""})).rejects.toThrow("source_transcription_required");expect(calls).toBe(1);
});
test("invalid keys/models, rate limits and network errors are sanitized without automatic paid retries",async()=>{
  for(const status of [400,401,403,404,429,500,529]) {
    let calls=0;const provider=createAnthropicProvider({key,model:"model",fetcher:async()=>{calls++;return new Response(`private error ${key}`,{status});}});
    await expect(provider.readPage({operation:"transcribe",image:"data:image/jpeg;base64,QQ=="})).rejects.toThrow(/^provider_request_failed$/);expect(calls).toBe(1);
  }
  const provider=createAnthropicProvider({key,model:"model",fetcher:async()=>{throw new Error(`timeout ${key}`);}});
  await expect(provider.readPage({operation:"transcribe",image:"data:image/jpeg;base64,QQ=="})).rejects.toThrow(/^provider_request_failed$/);
});
test("refusals, truncated/non-text/malformed/oversized outputs and ungrounded suggestions cannot become drafts",async()=>{
  for(const body of [
    message(reading,{stop_reason:"refusal"}),message(reading,{stop_reason:"max_tokens"}),message(reading,{stop_reason:"tool_use"}),
    message(reading,{stop_reason:"pause_turn"}),message(reading,{content:[]}),message(reading,{content:[{type:"tool_use",name:"invent"}]}),
    message(reading,{content:[{type:"text",text:"not JSON"}]}),message({...reading,confidence:4}),
    message({...reading,text:"a".repeat(49000)}),{type:"error",error:{message:key}},null,
  ]) {
    const provider=createAnthropicProvider({key,model:"model",fetcher:async()=>Response.json(body)});
    await expect(provider.readPage({operation:"transcribe",image:"data:image/jpeg;base64,QQ=="})).rejects.toThrow();
  }
  for(const suggestion of [
    {kind:"place",value:"Auroville",page:2,evidence:"Auroville",context:"written_in"},
    {kind:"face",value:"Jan",page:1,evidence:"Jan",context:"depicted"},
    {kind:"place",value:"Auroville",page:1,evidence:"absent",context:"written_in"},
  ]) {
    const provider=createAnthropicProvider({key,model:"model",fetcher:async()=>Response.json(message({suggestions:[suggestion]}))});
    await expect(provider.extract([{page:1,text:"Jan in Auroville"}])).rejects.toThrow();
  }
});
test("external image URLs, malformed base64 and oversize image payloads are rejected before any API request",async()=>{
  let calls=0;const provider=createAnthropicProvider({key,model:"model",fetcher:async()=>{calls++;throw new Error("Must not fetch");}});
  for(const image of ["","https://private.example/original.jpg","data:image/heic;base64,QQ==","data:image/jpeg;base64,QQ=","data:image/png;base64,"+"A".repeat(10*1024*1024+4)])await expect(provider.readPage({operation:"transcribe",image})).rejects.toThrow("invalid_document_image");
  expect(calls).toBe(0);
});
