"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rememberPrepared } from "@/lib/preview/client";
import { fullFrame, validateFraming, type Framing } from "@/lib/preview/framing";
import { perspective } from "../../scripts/perspective.cjs";
export interface FramingReview {image:string;expectedSet:string|null;expectedRotation:number;framing:Framing;suggestion?:Framing & {confidence:number;needsReview:boolean;reason:string};}
export async function loadFraming(sourceId:string,suggest=false):Promise<FramingReview> {
  let response:Response;
  for(let attempt=0;;attempt++) {
    response=await fetch(`/api/v1/image-framing/${sourceId}`,{method:suggest?"POST":"GET"});
    if(response.status!==429 || attempt>=3)break;
    await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
  }
  const result=await response.json();if(!response.ok)throw Error(result.error||"Image could not load.");return result;
}
export async function saveFraming(sourceId:string,review:FramingReview,framing:Framing) {
  const response=await fetch(`/api/v1/previews/${sourceId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({framing,expectedSet:review.expectedSet,expectedRotation:review.expectedRotation})});
  const result=await response.json();if(!response.ok)throw Error(result.error||"Correction was not saved.");rememberPrepared(`/api/v1/previews/${sourceId}`,result.imageSet);return result;
}
export function ImageFraming({sourceId,initial,onClose,onSaved}:{sourceId:string;initial?:FramingReview;onClose:()=>void;onSaved?:()=>void}) {
  const router=useRouter();const [review,setReview]=useState(initial);const [frame,setFrame]=useState<Framing>(initial?.suggestion||initial?.framing||fullFrame());
  const [busy,setBusy]=useState(!initial),[message,setMessage]=useState(""),[ready,setReady]=useState(false);
  const image=useRef<HTMLImageElement>(null),canvas=useRef<HTMLCanvasElement>(null),dialog=useRef<HTMLDialogElement>(null);
  const mounted=useRef(true);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{mounted.current=true;dialog.current?.showModal();return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(initial)return;let active=true;void loadFraming(sourceId).then(value=>{if(active){setReview(value);setFrame(value.framing);}}).catch(e=>{if(active)setMessage(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[sourceId,initial,retry]);
  let valid=true;try{validateFraming(frame);}catch{valid=false;}
  useEffect(()=>{
    if(!ready||!valid||!image.current||!canvas.current)return;
    const source=image.current,target=canvas.current;
    const raf=requestAnimationFrame(()=>{
      const input=document.createElement("canvas"),scale=Math.min(1,650/source.naturalWidth,650/source.naturalHeight);
      input.width=Math.max(2,Math.round(source.naturalWidth*scale));input.height=Math.max(2,Math.round(source.naturalHeight*scale));
      const ctx=input.getContext("2d")!;ctx.drawImage(source,0,0,input.width,input.height);
      const rgba=ctx.getImageData(0,0,input.width,input.height).data,rgb=new Uint8Array(input.width*input.height*3);
      for(let i=0;i<rgb.length/3;i++)for(let c=0;c<3;c++)rgb[i*3+c]=rgba[i*4+c];
      const out=perspective(rgb,input.width,input.height,frame.points),pixels=new ImageData(out.width,out.height);
      for(let i=0;i<out.width*out.height;i++){for(let c=0;c<3;c++)pixels.data[i*4+c]=out.data[i*3+c];pixels.data[i*4+3]=255;}
      const crop=document.createElement("canvas");crop.width=out.width;crop.height=out.height;crop.getContext("2d")!.putImageData(pixels,0,0);
      const quarter=frame.rotation%180!==0;target.width=quarter?out.height:out.width;target.height=quarter?out.width:out.height;
      const dest=target.getContext("2d")!;dest.translate(target.width/2,target.height/2);dest.rotate(frame.rotation*Math.PI/180);dest.drawImage(crop,-out.width/2,-out.height/2);
    });return()=>cancelAnimationFrame(raf);
  },[frame,ready,valid]);
  function point(index:number,x:number,y:number){setFrame(old=>({...old,points:old.points.map((p,i)=>i===index?[Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y))]:p) as Framing["points"]}));}
  async function suggest(){setBusy(true);setMessage("Checking orientation and edges…");try{const value=await loadFraming(sourceId,true);if(mounted.current){setReview(value);setFrame(value.suggestion!);setMessage(`${value.suggestion!.needsReview?"Check crop: ":"Suggested correction: "}${value.suggestion!.reason}`);}}catch(e){if(mounted.current)setMessage((e as Error).message);}finally{if(mounted.current)setBusy(false);}}
  async function save(){if(!review||!valid)return;setBusy(true);setMessage("Saving corrected preview…");try{await saveFraming(sourceId,review,frame);router.refresh();onSaved?.();onClose();}catch(e){setMessage((e as Error).message);setBusy(false);}}
  return <dialog ref={dialog} className="framing-dialog" aria-labelledby="framing-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <header><h2 id="framing-title">Straighten and crop</h2><button type="button" className="subtle-button" disabled={busy} onClick={onClose}>Close</button></header>
    <p>Move the four corners to the edges of the print. The original is always kept.</p>
    <div className="import-actions"><button type="button" className="button" disabled={busy||!review} onClick={()=>void suggest()}>Suggest correction</button><button type="button" className="subtle-button" disabled={busy} onClick={()=>setFrame(old=>({...old,rotation:(old.rotation+270)%360}))}>Rotate left</button><button type="button" className="subtle-button" disabled={busy} onClick={()=>setFrame(old=>({...old,rotation:(old.rotation+90)%360}))}>Rotate right</button><button type="button" className="subtle-button" disabled={busy} onClick={()=>{setFrame(fullFrame());setMessage("Original framing restored in the preview. Save to apply.");}}>Restore original</button></div>
    {!review&&!busy&&<button type="button" className="subtle-button" onClick={()=>{setBusy(true);setMessage("");setRetry(n=>n+1);}}>Retry loading image</button>}
    {review&&<div className="framing-comparison"><section><h3>Original · adjust corners</h3><div className="framing-source">
      {/* Authenticated in-memory preview, never a public original URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={image} src={review.image} onLoad={()=>setReady(true)} alt="Original image for selecting print corners" draggable={false}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points={frame.points.map(p=>`${p[0]*100},${p[1]*100}`).join(" ")}/></svg>
      {frame.points.map((p,i)=><button type="button" key={i} disabled={busy} className="crop-handle" style={{left:`${p[0]*100}%`,top:`${p[1]*100}%`}} aria-label={`Corner ${i+1}. Drag or use arrow keys to adjust.`}
        onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const bounds=e.currentTarget.parentElement!.getBoundingClientRect();point(i,(e.clientX-bounds.left)/bounds.width,(e.clientY-bounds.top)/bounds.height);}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
        onKeyDown={e=>{const delta=e.shiftKey?.02:.005;if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();point(i,p[0]+(e.key==="ArrowLeft"?-delta:e.key==="ArrowRight"?delta:0),p[1]+(e.key==="ArrowUp"?-delta:e.key==="ArrowDown"?delta:0));}}}>{i+1}</button>)}
    </div></section><section><h3>Corrected preview</h3><canvas ref={canvas} role="img" aria-label="Preview of the crop, perspective and rotation" hidden={!ready||!valid}/>{!valid&&<p role="alert">Corners must go around the print without crossing.</p>}</section></div>}
    <p role="status">{message || (busy?"Loading original preview…":"Nothing changes until you save.")}</p><button type="button" className="button" disabled={busy||!review||!valid||!ready} onClick={()=>void save()}>{busy?"Please wait…":"Save correction"}</button>
  </dialog>;
}
