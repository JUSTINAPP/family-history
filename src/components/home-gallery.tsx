"use client";
import Link from 'next/link';
import {FaceSuggestions} from './face-suggestions';
import {useWorkspace} from './workspace-provider';
import {can} from '@/lib/permissions';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,X,Search} from 'lucide-react';
import type {ArchiveItem} from '@/lib/types';
import {relatedMaterial,feedColour} from '@/lib/related-material';
import {ArchiveImage} from './archive-image';
import {InlineConversation} from './live/inline-conversation';
import {PhotoMemories} from './audio/photo-memories';
import type {RecordingView} from '@/lib/audio/repository';

export function HomeGallery({items,recordings=[],archiveId}:{items:ArchiveItem[];recordings?:RecordingView[];archiveId?:string}) {
 const workspace=useWorkspace();
 const [faceSearch,setFaceSearch]=useState(false);
 const router=useRouter(),[visible,setVisible]=useState(24),[filter,setFilter]=useState('All'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const scrollPosition=useRef(0);
 const more=useRef<HTMLDivElement>(null),ownHistory=useRef(false),returnFocus=useRef<HTMLElement|null>(null);
 const available=items.filter(item=>!item.archivedAt && (!archiveId || item.archiveId===archiveId));
 const filtered=available.filter(item=>(filter==='All'||item.kind===filter) && `${item.title} ${item.date} ${item.place} ${item.reportedPeople||''} ${item.people.map(id=>workspace.historicalPeople.find(p=>p.id===id)?.name||'').join(' ')}`.toLowerCase().includes(query.toLowerCase().trim()));
 const active=available.find(item=>item.id===selected);
 const memories=(item:ArchiveItem)=>recordings.filter(r=>!r.archived && (r.itemId===item.id||r.items.includes(item.id)));
 useEffect(()=>{
   const pop=()=>{const state=history.state,id=state?.archiveFeedPhoto;setSelected(typeof id==='string'?id:null);
    if(id){ownHistory.current=true;scrollPosition.current=state.feedScroll||0;setVisible(state.feedVisible||24);setQuery(state.feedQuery||'');setFilter(state.feedFilter||'All');}
    else{ownHistory.current=false;requestAnimationFrame(()=>{window.scrollTo(0,scrollPosition.current);returnFocus.current?.focus({preventScroll:true});});}};
   if(history.state?.archiveFeedPhoto)queueMicrotask(pop);
   window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
 },[]);
 useEffect(()=>{
   const node=more.current;if(!node)return;
   const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setVisible(n=>Math.min(n+24,filtered.length));},{rootMargin:'500px'});
   observer.observe(node);return()=>observer.disconnect();
 },[filtered.length,visible]);
 useEffect(()=>{
   const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
   if(connection?.saveData)return;
   const timer=setTimeout(()=>{if(document.visibilityState==='visible')router.prefetch('/explore');},3500);
   return()=>clearTimeout(timer);
 },[router]);
 function open(id:string) {
   if(!selected){returnFocus.current=document.activeElement as HTMLElement;scrollPosition.current=window.scrollY;history.pushState({...history.state,archiveFeedPhoto:id,feedScroll:window.scrollY,feedVisible:visible,feedFilter:filter,feedQuery:query},'',`${location.pathname}${location.search}#photo=${id}`);ownHistory.current=true;}
   else history.replaceState({...history.state,archiveFeedPhoto:id},'',`${location.pathname}${location.search}#photo=${id}`);
   setSelected(id);
 }
 function close(){if(ownHistory.current){history.back();}else{setSelected(null);returnFocus.current?.focus({preventScroll:true});}}
 return <div className="home-gallery collection-feed">
  <div className="feed-toolbar"><label className="feed-search"><Search size={20} aria-hidden="true"/><input aria-label="Search this collection" placeholder="Search photos, names, places or dates" value={query} onChange={e=>{setQuery(e.target.value);setVisible(24);}}/></label><Link href="/explore" className="text-link">All filters ↗</Link>{can(workspace.role,"commenter")&&<button className="subtle-button" onClick={()=>setFaceSearch(true)}>Find people</button>}</div>
  <div className="feed-filters" aria-label="Material type">{['All','Photograph','Letter','Document','Object'].map(kind=><button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>{setFilter(kind);setVisible(24);}}>{kind==='All'?'Everything':`${kind}s`}</button>)}</div>
  <section className="collection-grid" aria-label="Material from your archive">
   {filtered.slice(0,visible).map((item,index)=><article className="feed-card" data-item-id={item.id} data-kind={item.kind} key={item.id} style={{backgroundColor:feedColour(item.id)}}>
    <div className="feed-image-wrap"><button type="button" className="feed-image-open" aria-label={`View ${item.title}`} aria-haspopup="dialog" onClick={()=>open(item.id)}/>
     <ArchiveImage src={item.image} imageSet={item.imageSet} rotation={item.rotation} variant="small" priority={index<4} alt={item.alt||item.title} sizes="(max-width:700px) 46vw, (max-width:1100px) 30vw, 24vw"/>
    </div>
    <div className="feed-caption"><button type="button" onClick={()=>open(item.id)}>{item.title.includes('still to be catalogued')?item.kind:item.title}</button><span>{item.year||item.kind}{memories(item).length?' · Listen available':''}</span></div>
   </article>)}
  </section>
  {!filtered.length&&<p className="notice">No matching images. Try another search or material type.</p>}
  {visible<filtered.length&&<div ref={more} className="feed-more"><button className="subtle-button" onClick={()=>setVisible(n=>n+24)}>Show more images</button></div>}
  {faceSearch&&<FaceSuggestions items={available} onClose={()=>setFaceSearch(false)}/>}
  {active&&<FeedViewer item={active} related={relatedMaterial(active,available)} recordings={memories(active)} onOpen={open} onClose={close}
   onPrevious={()=>open(available[(available.findIndex(i=>i.id===active.id)-1+available.length)%available.length].id)}
   onNext={()=>open(available[(available.findIndex(i=>i.id===active.id)+1)%available.length].id)}/>}
 </div>;
}
function FeedViewer({item,related,recordings,onOpen,onClose,onPrevious,onNext}:{item:ArchiveItem;related:ReturnType<typeof relatedMaterial>;recordings:RecordingView[];onOpen:(id:string)=>void;onClose:()=>void;onPrevious:()=>void;onNext:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current,overflow=document.body.style.overflow;node?.showModal();document.body.style.overflow='hidden';return()=>{node?.close();document.body.style.overflow=overflow;};},[]);
 useEffect(()=>{dialog.current?.scrollTo({top:0});},[item.id]);
 return <dialog ref={dialog} className="feed-viewer" aria-label="Photo and related material" onCancel={e=>{if(e.target!==e.currentTarget)return;e.preventDefault();onClose();}}>
  <header className="feed-viewer-top"><button type="button" className="memory-button" onClick={onClose}><ArrowLeft size={18}/>Back to collection</button><div><button className="icon-button" aria-label="Previous image" onClick={onPrevious}><ArrowLeft/></button><button className="icon-button" aria-label="Next image" onClick={onNext}><ArrowRight/></button><button className="icon-button" aria-label="Close image" onClick={onClose}><X/></button></div></header>
  <div className="feed-viewer-layout"><section className="feed-feature" key={item.id}>
   <PhotoMemories item={item} recordings={recordings} priority variant="thumbnail">
    <h2>{item.title}</h2><p className="muted-small">{[item.year,item.place].filter(Boolean).join(' · ')}</p>
    <InlineConversation item={item}/>
   </PhotoMemories>
   <Link className="text-link" href={item.href!}>Edit details, people or crop ↗</Link>
  </section><aside className="feed-related"><h2>Keep exploring</h2><div className="feed-related-grid">{related.map(({item:other,reason})=><button type="button" key={other.id} onClick={()=>onOpen(other.id)} className="feed-related-card" style={{backgroundColor:feedColour(other.id)}}>
   <ArchiveImage src={other.image} imageSet={other.imageSet} rotation={other.rotation} variant="small" autoPrepare={false} alt={other.title}/><span>{reason}</span>
  </button>)}</div>{!related.length&&<p>More linked photos will appear here as the archive grows.</p>}</aside></div>
 </dialog>;
}
