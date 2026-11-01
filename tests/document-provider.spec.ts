import { test,expect } from "@playwright/test";
import { suggestedDate } from "../src/lib/documents/types";
import { createOpenAIProvider,validateReading,validateExtraction } from "../src/lib/documents/provider-core";
test("optional document provider uses private inline vision input and bounded structured output without exposing keys in the body",async()=>{
  const calls:Record<string,unknown>[]=[];
  const provider=createOpenAIProvider({key:"unit-server-key",model:"explicit-fixture-model",fetcher:async(url,init)=>{
    expect(String(url)).toBe("https://api.openai.com/v1/responses");
    expect((init!.headers as Record<string,string>).Authorization).toBe("Bearer unit-server-key");
    const body=JSON.parse(String(init!.body));calls.push(body);
    expect(JSON.stringify(body)).not.toContain("unit-server-key");
    expect(body.store).toBe(false);expect(body.max_output_tokens).toBe(10000);expect(body.text.format.strict).toBe(true);
    return Response.json({id:"response-fixture",model:"resolved-fixture-model",status:"completed",usage:{input_tokens:50,output_tokens:20},output:[{content:[{type:"output_text",text:JSON.stringify({text:"Dear Jan, [unclear]",language:"en",confidence:null,uncertainty:["Illegible word"]})}]}]});
  }});
  const reading=await provider.readPage({operation:"transcribe",image:"data:image/jpeg;base64,AA=="});
  expect(reading.text).toBe("Dear Jan, [unclear]");expect(reading.receipt?.model).toBe("resolved-fixture-model");
  const input=calls[0].input as {content:{type:string}[]}[];
  expect(input[0].content.map(c=>c.type)).toEqual(["input_text","input_image"]);
  await provider.readPage({operation:"translate",image:"",sourceText:"Cher Jan, [unclear]"});
  expect((calls[1].input as {content:{type:string}[]}[])[0].content.map(c=>c.type)).toEqual(["input_text"]);
});
test("AI extraction is draft-only, page-cited and grounded in the transcribed evidence",async()=>{
  expect(suggestedDate("c. 1984")).toEqual({value:"1984",precision:"approximate"});
  expect(suggestedDate("[unclear] August").precision).toBe("unknown");
  const value={suggestions:[{kind:"place",value:"Auroville",page:2,evidence:"Auroville",context:"written_in"}]};
  expect(validateExtraction(value,2,[{page:1,text:"Dear Jan"},{page:2,text:"We are in Auroville."}]).suggestions[0].kind).toBe("place");
  expect(()=>validateExtraction(value,1)).toThrow("invalid_provider_output");
  expect(()=>validateExtraction(value,2,[{page:2,text:"An unrelated page"}])).toThrow("ungrounded_document_suggestion");
  const provider=createOpenAIProvider({key:"unit-key",model:"fixture-model",fetcher:async()=>Response.json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(value)}]}]})});
  expect((await provider.extract([{page:1,text:"Dear Jan"},{page:2,text:"Auroville"}])).suggestions).toHaveLength(1);
});
test("provider failures, truncation and malformed output are not treated as successful transcription",async()=>{
  for(const response of [new Response("private provider error",{status:429}),Response.json({status:"incomplete",output:[]}),Response.json({status:"completed",output:[]})]){
    const provider=createOpenAIProvider({key:"unit-key",model:"fixture-model",fetcher:async()=>response});
    await expect(provider.readPage({operation:"transcribe",image:"data:image/jpeg;base64,AA=="})).rejects.toThrow();
  }
  expect(()=>validateReading({text:"invented",language:"en",confidence:5,uncertainty:[]})).toThrow("invalid_provider_output");
  expect(()=>validateExtraction({suggestions:[{kind:"face",value:"Jan",evidence:"picture",page:1,context:"depicted"}]},1)).toThrow();
});
