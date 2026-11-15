"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ArchiveItem} from '@/lib/types';
import {useWorkspace} from './workspace-provider';
import {ArchiveImage} from './archive-image';
import {identifyPersonAction} from '@/lib/backend/identification-actions';
import {faceEngine,describeFaces,type FaceDescriptor} from '@/lib/face-matching';
import {can} from '@/lib/permissions';
export function FaceSuggestions({items,onClose}:{items:ArchiveItem[];onClose:()=>void}) {
 const workspace=useWorkspace(),router=useRouter(),dialog=useRef<HTMLDialogElement>(null),stop=useRef(false),alive=useRef(true);
 const [person,setPerson]=useState(''),[chosen,setChosen]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[cursor,setCursor]=useState(0);
 const [matches,setMatches]=useState<{item:ArchiveItem;score:number;state?:'saved'|'dismissed'}[]>([]);
 const descriptors=useRef(new Map<string,FaceDescriptor[]>());
 const photographs=items.filter(i=>i.archiveId===workspace.archive.id&&i.kind==='Photograph'&&!i.archivedAt);
 const references=photographs.filter(i=>i.people.length===1&&i.people.includes(person));
 const savedIds=matches.filter(m=>m.state==='saved').map(m=>m.item.id);
 const candidates=photographs.filter(i=>!i.people.includes(person)||savedIds.includes(i.id));
 const name=workspace.historicalPeople.find(p=>p.id===person)?.name||'this person';
 useEffect(()=>{const node=dialog.current,cache=descriptors.current,overflow=document.body.style.overflow;alive.current=true;node?.showModal();document.body.style.overflow='hidden';return()=>{stop.current=true;alive.current=false;cache.clear();node?.close();document.body.style.overflow=overflow;};},[]);
 async function scan() {
  if(!chosen.length)return;stop.current=false;setBusy(true);setMessage('Loading private face tools…');let skipped=0;
  try {
   const engine=await faceEngine();
   async function faces(item:ArchiveItem){let value=descriptors.current.get(item.id);if(!value){value=await describeFaces(item,engine);if(alive.current)descriptors.current.set(item.id,value);}return value;}
   const reference:FaceDescriptor[]=[];
   for(const id of chosen){if(stop.current||!alive.current)return;const item=references.find(i=>i.id===id);if(!item)continue;const found=await faces(item);if(found.length===1)reference.push(found[0]);}
   if(!reference.length)throw Error('Choose a clearer portrait containing one face. Group photos cannot be used as reference portraits yet.');
   const end=Math.min(cursor+24,candidates.length);
   for(let n=cursor;n<end;n++){
    if(stop.current||!alive.current)break;
    setMessage(`Checking photograph ${n+1} of ${candidates.length}…`);
    try {
     const found=await faces(candidates[n]);let score=0;
     for(const face of found)for(const example of reference)score=Math.max(score,engine.match.similarity(face.embedding,example.embedding));
     if(score>=.65&&alive.current)setMatches(old=>[...old.filter(m=>m.item.id!==candidates[n].id),{item:candidates[n],score}].sort((a,b)=>b.score-a.score));
    }catch{skipped++;}
    if(alive.current)setCursor(n+1);
    await new Promise(resolve=>setTimeout(resolve,30));
   }
   if(alive.current)setMessage(`${stop.current?'Paused.':end<candidates.length?'This batch is checked. Continue to check more.':'Finished checking.'} Review possible matches before adding a name.${skipped?` ${skipped} previews could not be checked.`:''}`);
  }catch(e){if(alive.current)setMessage((e as Error).message);}finally{if(alive.current)setBusy(false);}
 }
 async function confirm(item:ArchiveItem) {
  setBusy(true);const form=new FormData();form.set('action','add');form.set('personId',person);
  try {const result=await identifyPersonAction(workspace.archive.id,item.id,form);if(result.error)throw Error(result.error);setMatches(old=>old.map(m=>m.item.id===item.id?{...m,state:'saved'}:m));setMessage(`Linked to ${name}.`);router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="framing-dialog face-suggestions" aria-label="Find people in photographs" onCancel={e=>{e.preventDefault();if(busy){stop.current=true;}else onClose();}}>
  <header><h2>Find people in photographs</h2><button className="subtle-button" disabled={busy} onClick={onClose}>Close</button></header>
  <p>Choose someone and a few clear portraits you know show them. Matching runs on this device using tools hosted by the archive. Names are only added when you confirm.</p>
  <label>Person<select value={person} disabled={busy} onChange={e=>{setPerson(e.target.value);setChosen([]);setMatches([]);setCursor(0);setMessage('');}}><option value="">Choose a person</option>{workspace.historicalPeople.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  {person&&<><h3>Choose reference portraits of {name}</h3><p>Use photos with just one face. Multiple references can help with changes in age and appearance.</p><div className="face-reference-grid">{references.map(item=><label key={item.id}><ArchiveImage src={item.image} imageSet={item.imageSet} variant="small" alt={item.title}/><span><input type="checkbox" disabled={busy} checked={chosen.includes(item.id)} onChange={e=>{setChosen(old=>e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id));setCursor(0);setMatches([]);}}/> This is {name}</span></label>)}</div>{!references.length&&<p className="notice">Link a clear portrait to {name} in the photo’s People details first, then return here.</p>}</>}
  <div className="import-actions"><button className="button" disabled={busy||!chosen.length||cursor>=candidates.length} onClick={()=>void scan()}>{cursor?'Check next photographs':'Find possible matches'}</button>{busy&&<button className="subtle-button" onClick={()=>{stop.current=true;setMessage('Pausing after this photograph…');}}>Pause</button>}</div>
  <p role="status">{message}</p><div className="face-match-grid">{matches.filter(m=>m.state!=='dismissed').map(match=><article key={match.item.id}><ArchiveImage src={match.item.image} imageSet={match.item.imageSet} variant="small" alt={match.item.title}/><h3>{match.state==='saved'?`Linked to ${name}`:`Possibly ${name}`}</h3>{match.state!=='saved'&&<div className="import-actions"><button className="button" disabled={busy||!can(workspace.role,'commenter')} onClick={()=>void confirm(match.item)}>Yes, link {name}</button><button className="subtle-button" disabled={busy} onClick={()=>setMatches(old=>old.map(m=>m.item.id===match.item.id?{...m,state:'dismissed'}:m))}>Not this person</button></div>}</article>)}</div>
  <p className="help-line">Face comparisons and rejected suggestions stay in memory for this session. Only names you confirm are saved to the archive. Old, blurred or side-on faces may not match.</p>
 </dialog>;
}
