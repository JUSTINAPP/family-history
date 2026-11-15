import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { fullFrame, validateFraming, validateSuggestion } from "../src/lib/preview/framing";
import { perspective } from "../scripts/perspective.cjs";
import { convertPreview } from "../src/lib/preview/convert";
import { createOpenAIProvider } from "../src/lib/documents/provider-core";

test("framing rejects crossed, tiny, non-finite and out-of-image crops", () => {
  expect(validateFraming(fullFrame())).toEqual(fullFrame());
  for (const points of [[[0,0],[1,1],[1,0],[0,1]], [[0,0],[.01,0],[.01,.01],[0,.01]], [[-1,0],[1,0],[1,1],[0,1]], [[NaN,0],[1,0],[1,1],[0,1]]]) {
    expect(() => validateFraming({points,rotation:0})).toThrow();
  }
  expect(() => validateFraming({...fullFrame(),rotation:45})).toThrow();
  expect(() => validateSuggestion({...fullFrame(),confidence:2,needsReview:false,reason:"test"})).toThrow();
});

test("perspective retains identity pixels and removes surrounding album area", () => {
  const data = new Uint8Array(100*80*3);
  for(let y=0;y<80;y++)for(let x=0;x<100;x++) {
    const inside=x>=20&&x<=79&&y>=10&&y<=69;
    data[(y*100+x)*3+(inside?1:0)]=255;
  }
  const identity=perspective(data,100,80,fullFrame().points);
  expect(identity.width).toBe(100);expect(identity.height).toBe(80);expect(identity.data).toEqual(data);
  const crop=perspective(data,100,80,[[20/99,10/79],[79/99,10/79],[79/99,69/79],[20/99,69/79]]);
  expect(crop.width).toBe(60);expect(crop.height).toBe(60);
  expect(crop.data.filter((_,i)=>i%3===0).every(v=>v===0)).toBe(true);
  expect(crop.data.filter((_,i)=>i%3===1).every(v=>v===255)).toBe(true);
});

test("isolated converter crops and rotates derivatives while preserving original bytes", async () => {
  const original=await sharp({create:{width:240,height:120,channels:3,background:"#448866"}}).png().toBuffer();
  const hash=createHash("sha256").update(original).digest("hex");
  const result=await convertPreview(original,35000,{...fullFrame(),rotation:270});
  expect([result.width,result.height]).toEqual([120,240]);
  expect((await sharp(result.bytes).metadata()).format).toBe("jpeg");
  expect(createHash("sha256").update(original).digest("hex")).toBe(hash);
});

test("framing suggestions reuse private vision transport and validate provider output", async () => {
  const suggestion={...fullFrame(),rotation:270,confidence:.94,needsReview:false,reason:"Print is sideways."};
  const provider=createOpenAIProvider({key:"fixture-key",model:"fixture-model",fetcher:async(_url,init)=>{
    const body=JSON.parse(String(init!.body));expect(body.store).toBe(false);
    expect(body.input[0].content.some((c:{type:string})=>c.type==="input_image")).toBe(true);
    return Response.json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(suggestion)}]}]});
  }});
  expect(validateSuggestion(await provider.frameImage!("data:image/webp;base64,AA=="))).toEqual(suggestion);
});
