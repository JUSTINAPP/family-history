"use client";
import {useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function PhotoLoadingStatus({names=[],recover=false}:{names?:string[];recover?:boolean}) {
 const router=useRouter(),[step,setStep]=useState(0),[pending,startTransition]=useTransition();
 useEffect(()=>{const timer=setInterval(()=>setStep(n=>n+1),4000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!recover||step===0||step>3)return;startTransition(()=>router.refresh());},[recover,router,step]);
 const slow=step>=4;
 const name=names.length?names[(step-1+names.length)%names.length]:'';
 return <div className="photo-loading-status"><p role="status" aria-live="polite">{slow?'Photos are taking longer than expected.':step>0&&name?`Loading photos linked to ${name}…`:'Your photos are loading…'}</p>{slow&&<button className="subtle-button" disabled={pending} onClick={()=>startTransition(()=>router.refresh())}>{pending?'Trying again…':'Try again'}</button>}</div>;
}
