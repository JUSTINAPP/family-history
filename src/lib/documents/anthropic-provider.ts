import type { DocumentProvider } from "./types";
import { pagePrompt,extractionPrompt,pageSchema,extractionSchema,validateReading,validateExtraction } from "./provider-core";
const apiVersion="2026-10-21";
// Pure transport with injected fetch for offline tests. Only the server-only factory supplies secrets.
export function createAnthropicProvider({key,model,fetcher=fetch}:{key:string;model:string;fetcher?:typeof fetch}):DocumentProvider {
  async function response(prompt:string,schema:object,image?:string) {
    const content:Record<string,unknown>[]=[];
    if(image) {
      const match=image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/);
      // Claude's direct API image limit is measured on the base64 representation, not decoded bytes.
      if(!match || match[2].length>10*1024*1024 || match[2].length%4!==0)throw new Error("invalid_document_image");
      content.push({type:"image",source:{type:"base64",media_type:match[1],data:match[2]}});
    }
    content.push({type:"text",text:prompt});
    let result:Response;
    try {
      result=await fetcher("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{Authorization:`Bearer ${key}`,"anthropic-version":apiVersion,"Content-Type":"application/json"},
        body:JSON.stringify({model,max_tokens:10000,messages:[{role:"user",content}],
          // Sonnet 5.5 uses between_tools rather than disabled; without tools it returns only text.
          thinking:{type:"between_tools"},output_config:{format:{type:"json_schema",schema}}}),
        signal:AbortSignal.timeout(40000),cache:"no-store",redirect:"error",
      });
    } catch {throw new Error("provider_request_failed");} // Never propagate a fetch error containing credentials/source data.
    if(!result.ok)throw new Error("provider_request_failed"); // Never log or retain provider error bodies.
    let data:Record<string,unknown>;
    try {data=await result.json();} catch {throw new Error("invalid_provider_output");}
    if(!data || data.type!=="message" || data.role!=="assistant" || typeof data.id!=="string" || !data.id || typeof data.model!=="string" || !data.model || !Array.isArray(data.content))throw new Error("invalid_provider_output");
    if(data.stop_reason!=="end_turn")throw new Error("provider_incomplete"); // Refusal, token exhaustion, tool calls and paused responses are not drafts.
    const blocks=data.content as {type?:string;text?:unknown}[];
    if(blocks.some(b=>!b || b.type!=="text" || typeof b.text!=="string"))throw new Error("invalid_provider_output");
    const text=blocks.map(b=>b.text).join("");
    if(!text || text.length>150000)throw new Error("invalid_provider_output");
    let parsed:unknown;
    try {parsed=JSON.parse(text);} catch {throw new Error("invalid_provider_output");}
    return {parsed,rawResponse:data,receipt:{provider:"anthropic",apiVersion,responseId:data.id,model:data.model,
      requestId:result.headers.get("request-id"),stopReason:"end_turn",usage:data.usage && typeof data.usage==="object" ? data.usage as Record<string,unknown> : null}};
  }
  function bounded<T>(value:T,limit:number):T {
    // Keep complete raw responses within migration 013's existing JSON limits, without truncating evidence.
    if(JSON.stringify(value).length>limit)throw new Error("invalid_provider_output");
    return value;
  }
  return {
    name:"anthropic",model,
    async readPage({image,operation,sourceText}) {
      if(operation==="transcribe" && !image)throw new Error("invalid_document_image");
      if(operation==="translate" && typeof sourceText!=="string")throw new Error("source_transcription_required");
      const result=await response(pagePrompt(operation,sourceText),pageSchema,operation==="transcribe"?image:undefined);
      return bounded({...validateReading(result.parsed),receipt:result.receipt,rawResponse:result.rawResponse},90000);
    },
    async extract(pages) {
      const result=await response(extractionPrompt(pages),extractionSchema);
      // JSON-schema enum casing is not guaranteed by Claude. Normalize only kind, preserving raw response.
      const value=result.parsed as {suggestions?:{kind?:unknown}[]};
      if(Array.isArray(value?.suggestions))value.suggestions=value.suggestions.map(s=>s && typeof s.kind==="string"?{...s,kind:s.kind.toLowerCase()}:s);
      return bounded({...validateExtraction(value,pages.length,pages),receipt:result.receipt,rawResponse:result.rawResponse},290000);
    },
  };
}
