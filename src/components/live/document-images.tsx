"use client";
import {useCallback,useState} from "react";
import {ArchiveImage} from "../archive-image";
import type {ImageSet} from "@/lib/preview/types";
/** Retain decoded adjacent pages only while this private reader is mounted. */
export function DocumentImages({pages,sets,selected,title,enlarged=false,className="document-page"}:{
  pages:{id:string;presentation_rotation?:number}[];sets:ImageSet[];selected:number;title:string;enlarged?:boolean;className?:string;
}) {
  const [ready,setReady]=useState<Set<string>>(()=>new Set());
  const markReady=useCallback((id:string)=>setReady(old=>old.has(id)?old:new Set([...old,id])),[]);
  const current=pages[selected];
  if(!current)return null;
  return <div className="document-image-window">{pages.slice(Math.max(0,selected-1),selected+2).map(p=>{
    const active=p.id===current.id;
    if(!active&&!ready.has(current.id)&&!ready.has(p.id))return null;
    return <div key={p.id} hidden={!active} aria-hidden={!active} data-document-source={p.id}>
      <ArchiveImage src={`/api/v1/previews/${p.id}`} alt={active?title:""} className={className}
        imageSet={sets.find(s=>s.originalId===p.id)} rotation={p.presentation_rotation||0}
        variant={enlarged&&active?"display":"thumbnail"} sizes="(max-width: 820px) 90vw, 1100px"
        priority fetchPriority={active?"high":"low"} originalPreserved onReady={()=>markReady(p.id)} />
    </div>;
  })}</div>;
}
