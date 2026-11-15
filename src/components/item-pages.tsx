"use client";
import {useEffect,useState} from "react";
import {loadItemPages} from "@/lib/backend/item-pages-action";
import type {ArchiveItem} from "@/lib/types";
import {pageLabel} from "@/lib/documents/types";

type Pages=NonNullable<Awaited<ReturnType<typeof loadItemPages>>["pages"]>;
export function useItemPages(item:ArchiveItem,enabled=true) {
 const [result,setResult]=useState<{itemId:string;pages?:Pages;error?:string}>();
 const [chosen,setChosen]=useState<{itemId:string;id:string}>();
 const [retry,setRetry]=useState(0);
 const needed=enabled&&((item.sourceCount||0)>1||["Letter","Document","Postcard","Certificate"].includes(item.kind));
 useEffect(()=>{
  if(!needed)return;
  let active=true;
  void loadItemPages(item.archiveId,item.id).then(data=>{if(active)setResult({itemId:item.id,...data});});
  return()=>{active=false;};
 },[item.id,item.archiveId,needed,retry]);
 const current=result?.itemId===item.id?result:undefined;
 const pages=current?.pages;
 const selected=Math.max(0,pages?.findIndex(page=>page.id===(chosen?.itemId===item.id?chosen.id:item.originalId))??0);
 const page=pages?.[selected];
 const display=page?{...item,originalId:page.id,image:`/api/v1/previews/${page.id}`,rotation:page.rotation,imageSet:page.imageSet,sourceCount:pages!.length}:item;
 const navigation=needed?<nav className="item-page-navigation" aria-label="Letter pages">
  {current?.error?<><span role="status">{current.error}</span><button className="subtle-button" onClick={()=>{setResult(undefined);setRetry(n=>n+1);}}>Retry pages</button></>:!pages?<span role="status">Loading saved pages…</span>:pages.length>1?<>
   <button type="button" className="memory-button" disabled={selected===0} onClick={()=>setChosen({itemId:item.id,id:pages[selected-1].id})}>Previous page</button>
   <span aria-live="polite">{pageLabel(page!.role,selected)} · {selected+1} of {pages.length}</span>
   <button type="button" className="memory-button" disabled={selected===pages.length-1} onClick={()=>setChosen({itemId:item.id,id:pages[selected+1].id})}>Next page</button>
  </>:null}
 </nav>:null;
 return {item:display,navigation};
}
