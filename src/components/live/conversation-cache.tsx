"use client";
import {createContext,useCallback,useContext,useRef,useState,type ReactNode} from "react";
import type {FamilyComment} from "@/lib/conversation";
interface Entry {rows:FamilyComment[];at:number;}
interface Cache {entries:Map<string,Entry>;write:(id:string,rows:FamilyComment[])=>void;upsert:(id:string,row:FamilyComment)=>void;load:(archive:string,id:string)=>Promise<FamilyComment[]>;}
const ConversationCache=createContext<Cache|null>(null);
// Owned by a mounted authenticated archive workspace, never browser storage or a process-global cache.
export function ConversationCacheProvider({children}:{children:ReactNode}) {
  const [entries,setEntries]=useState(new Map<string,Entry>());
  const current=useRef(entries),pending=useRef(new Map<string,Promise<FamilyComment[]>>());
  const write=useCallback((id:string,rows:FamilyComment[])=>{
    const next=new Map(current.current);next.set(id,{rows,at:Date.now()});current.current=next;setEntries(next);
  },[]);
  const upsert=useCallback((id:string,row:FamilyComment)=>{
    const rows=current.current.get(id)?.rows||[];
    write(id,[...rows.filter(c=>c.id!==row.id),row].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)));
  },[write]);
  const load=useCallback((archive:string,id:string)=>{
    const key=`${archive}:${id}`,prior=current.current.get(key);
    if(prior&&Date.now()-prior.at<30000)return Promise.resolve(prior.rows);
    const existing=pending.current.get(key);if(existing)return existing;
    const request=fetch(`/api/v1/conversations/${id}?archive=${archive}`,{cache:"no-store"}).then(async response=>{
      if(!response.ok)throw new Error("Conversation could not load. Please retry.");
      const result=await response.json();if(!Array.isArray(result.comments))throw new Error("Conversation unavailable.");
      write(key,result.comments);return result.comments as FamilyComment[];
    }).finally(()=>pending.current.delete(key));
    pending.current.set(key,request);return request;
  },[write]);
  return <ConversationCache.Provider value={{entries,write,upsert,load}}>{children}</ConversationCache.Provider>;
}
export function useConversationCache(){return useContext(ConversationCache);}
