import type {ArchiveItem} from './types';
import {assetUrl} from './preview/types';
export interface FaceDescriptor {embedding:number[];box:[number,number,number,number];}
interface Engine {load:()=>Promise<void>;detect:(input:HTMLCanvasElement)=>Promise<{face:FaceDescriptor[]}>;match:{similarity:(a:number[],b:number[])=>number};}
type EngineConstructor=new(config:Record<string,unknown>)=>Engine;
let loading:Promise<Engine>|undefined;
export function faceEngine():Promise<Engine> {
 if(loading)return loading;
 loading=(async()=>{
  const namespace=()=> (window as unknown as {Human?:{Human:EngineConstructor}}).Human;
  if(!namespace())await new Promise<void>((resolve,reject)=>{
   const script=document.createElement('script');script.src='/face-models/human.js';script.async=true;
   const timer=setTimeout(()=>{script.remove();reject(Error('Face tools took too long to load. Please retry.'));},30000);
   script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Face tools could not load. Please retry.'));};document.head.appendChild(script);
  });
  const Constructor=namespace()?.Human;if(!Constructor)throw Error('Face tools are unavailable in this browser.');
  const engine=new Constructor({backend:'webgl',modelBasePath:'/face-models/',cacheSensitivity:0,debug:false,
   filter:{enabled:false},face:{enabled:true,detector:{modelPath:'blazeface.json',rotation:true,maxDetected:20,minConfidence:.5,return:false},mesh:{enabled:true,modelPath:'facemesh.json'},iris:{enabled:false},description:{enabled:true,modelPath:'mobileface.json'},emotion:{enabled:false},antispoof:{enabled:false},liveness:{enabled:false},gear:{enabled:false},attention:{enabled:false}},body:{enabled:false},hand:{enabled:false},object:{enabled:false},gesture:{enabled:false},segmentation:{enabled:false}});
  await engine.load();return engine;
 })();void loading.catch(()=>{loading=undefined;});return loading;
}
export async function describeFaces(item:ArchiveItem,engine:Engine):Promise<FaceDescriptor[]> {
 const url=item.imageSet?assetUrl(item.imageSet.thumbnail.id):`${item.image.split('?')[0]}?variant=thumbnail`;
 if(!url.startsWith('/api/v1/'))throw Error('Only private archive images can be checked.');
 const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw Error('Image preview could not load.');
 const blob=URL.createObjectURL(await response.blob());
 try {
  const img=new Image();img.src=blob;await img.decode();
  const rotation=item.imageSet?.rotation??item.rotation??0,scale=Math.min(1,1200/img.naturalWidth,1200/img.naturalHeight);
  const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=rotation%180?h:w;canvas.height=rotation%180?w:h;
  const ctx=canvas.getContext('2d')!;ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(img,-w/2,-h/2,w,h);
  const result=await engine.detect(canvas);
  return result.face.filter(face=>Array.isArray(face.embedding)&&face.embedding.length>0&&face.embedding.every(Number.isFinite)).map(face=>({embedding:[...face.embedding],box:[...face.box] as FaceDescriptor['box']}));
 }finally{URL.revokeObjectURL(blob);}
}
