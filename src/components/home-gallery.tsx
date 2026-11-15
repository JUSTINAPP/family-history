"use client";
import Link from 'next/link';
import {CardDetails} from './live/card-details';
import {PhotoLoadingStatus} from './photo-loading-status';
import {FeedMemory} from './audio/feed-memory';
import {FaceSuggestions} from './face-suggestions';
import {useWorkspace} from './workspace-provider';
import {can} from '@/lib/permissions';
import {useRouter} from 'next/navigation';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,X,Search} from 'lucide-react';
import type {ArchiveItem} from '@/lib/types';
import {feedCaption} from '@/lib/feed-caption';
import {presentationRatio} from '@/lib/preview/types';
import {relatedMaterial,feedColour} from '@/lib/related-material';
import {ArchiveImage} from './archive-image';
import {InlineConversation} from './live/inline-conversation';
import {PhotoMemories} from './audio/photo-memories';
import type {RecordingView} from '@/lib/audio/repository';

export function HomeGallery({items,recordings=[],archiveId,showControls=true}:{items:ArchiveItem[];recordings?:RecordingView[];archiveId?:string;showControls?:boolean}) {
 const workspace=useWorkspace();
 const [readyImages,setReadyImages]=useState<Set<string>>(()=>new Set());
 const [listening,setListening]=useState<string|null>(null);
 const [faceSearch,setFaceSearch]=useState(false);
 const router=useRouter(),[visible,setVisible]=useState(24),[filter,setFilter]=useState('All'),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const [instantPreview,setInstantPreview]=useState<{src:string;width:number;height:number}|undefined>();
 const scrollPosition=useRef(0),grid=useRef<HTMLElement>(null);
 const more=useRef<HTMLDivElement>(null),ownHistory=useRef(false),returnFocus=useRef<HTMLElement|null>(null);
 const available=items.filter(item=>!item.archivedAt && (!archiveId || item.archiveId===archiveId));
 const filtered=available.filter(item=>(filter==='All'||item.kind===filter) && `${item.title} ${item.year||''} ${item.date} ${item.place} ${item.reportedPeople||''} ${item.people.map(id=>workspace.historicalPeople.find(p=>p.id===id)?.name||'').join(' ')}`.toLowerCase().includes(query.toLowerCase().trim()));
 const active=available.find(item=>item.id===selected);
 const memories=(item:ArchiveItem)=>recordings.filter(r=>!r.archived && (r.itemId===item.id||r.items.includes(item.id)));
 useLayoutEffect(()=>{
  const node=grid.current;if(!node)return;
  const size=(card:HTMLElement)=>{card.style.gridRowEnd=`span ${Math.ceil((card.getBoundingClientRect().height+24)/8)}`;};
  const cards=Array.from(node.children) as HTMLElement[];
  cards.forEach(size);node.dataset.masonry='true';
  const observer=new ResizeObserver(entries=>entries.forEach(entry=>size(entry.target as HTMLElement)));
  cards.forEach(card=>observer.observe(card));return()=>observer.disconnect();
 },[visible,filter,query,filtered.length]);
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
   const timers=['/explore','/people'].map((path,index)=>setTimeout(()=>{if(document.visibilityState==='visible')router.prefetch(path);},3500+index*3000));
   return()=>timers.forEach(clearTimeout);
 },[router]);
 function open(id:string) {
   const card=Array.from(grid.current?.querySelectorAll<HTMLElement>('[data-item-id]')||[]).find(node=>node.dataset.itemId===id);
   const image=card?.querySelector<HTMLImageElement>('img');
   setInstantPreview(image?.complete && image.naturalWidth ? {src:image.currentSrc||image.src,width:image.naturalWidth,height:image.naturalHeight}:undefined);
   setListening(null);
   if(!selected){returnFocus.current=document.activeElement as HTMLElement;scrollPosition.current=window.scrollY;history.pushState({...history.state,archiveFeedPhoto:id,feedScroll:window.scrollY,feedVisible:visible,feedFilter:filter,feedQuery:query},'',`${location.pathname}${location.search}#photo=${id}`);ownHistory.current=true;}
   else history.replaceState({...history.state,archiveFeedPhoto:id},'',`${location.pathname}${location.search}#photo=${id}`);
   setSelected(id);
 }
 function close(){if(ownHistory.current){history.back();}else{setSelected(null);returnFocus.current?.focus({preventScroll:true});}}
 return <div className="home-gallery collection-feed">
  {filtered.slice(0,4).some(item=>!readyImages.has(item.id))&&<PhotoLoadingStatus names={workspace.historicalPeople.filter(person=>filtered.slice(0,4).some(item=>item.people.includes(person.id))).map(person=>person.name).slice(0,8)}/>}
  {showControls&&<><div className="feed-toolbar"><label className="feed-search"><Search size={20} aria-hidden="true"/><input aria-label="Search this collection" placeholder="Search photos, names, places or dates" value={query} onChange={e=>{setQuery(e.target.value);setVisible(24);}}/></label><Link href="/explore" className="text-link">All filters ↗</Link>{can(workspace.role,"commenter")&&<button className="subtle-button" onClick={()=>setFaceSearch(true)}>Find people</button>}</div>
  <div className="feed-filters" aria-label="Material type">{['All','Photograph','Letter','Document','Object'].map(kind=><button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>{setFilter(kind);setVisible(24);}}>{kind==='All'?'Everything':`${kind}s`}</button>)}</div></>}
  <section ref={grid} className="collection-grid" aria-label="Material from your archive">
   {filtered.slice(0,visible).map((item,index)=><article className="feed-card" data-item-id={item.id} data-kind={item.kind} key={item.id}>
    <div className="feed-image-wrap" style={{backgroundColor:feedColour(item.id),aspectRatio:item.imageSet?presentationRatio(item.imageSet):item.aspect==='portrait'?.75:item.aspect==='landscape'?1.4:1}} onLoadCapture={e=>{const image=e.target as HTMLImageElement;if(image.tagName==='IMG'&&image.naturalWidth){const quarter=(item.imageSet?.rotation??item.rotation??0)%180;e.currentTarget.style.aspectRatio=String(quarter?image.naturalHeight/image.naturalWidth:image.naturalWidth/image.naturalHeight);}}}>{memories(item).length>0?<FeedMemory item={item} recordings={memories(item)} active={listening===item.id} onActivate={()=>setListening(item.id)} onDetails={()=>open(item.id)}><ArchiveImage onReady={()=>setReadyImages(old=>old.has(item.id)?old:new Set([...old,item.id]))} src={item.image} imageSet={item.imageSet} rotation={item.rotation} variant="thumbnail" priority={index<4} alt={item.alt||item.title} sizes="(max-width:700px) 46vw, (max-width:1100px) 30vw, 24vw"/></FeedMemory>:<><button type="button" className="feed-image-open" aria-label={`View ${item.title}`} aria-haspopup="dialog" onClick={()=>open(item.id)}/>
     <ArchiveImage onReady={()=>setReadyImages(old=>old.has(item.id)?old:new Set([...old,item.id]))} src={item.image} imageSet={item.imageSet} rotation={item.rotation} variant="thumbnail" priority={index<4} alt={item.alt||item.title} sizes="(max-width:700px) 46vw, (max-width:1100px) 30vw, 24vw"/></>}
    </div>
    {feedCaption(item,workspace.historicalPeople)&&<div className="feed-caption">{feedCaption(item,workspace.historicalPeople)&&<button type="button" onClick={()=>open(item.id)}>{feedCaption(item,workspace.historicalPeople)}</button>}</div>}
   </article>)}
  </section>
  {!filtered.length&&<p className="notice">No matching images. Try another search or material type.</p>}
  {visible<filtered.length&&<div ref={more} className="feed-more"><button className="subtle-button" onClick={()=>setVisible(n=>n+24)}>Show more images</button></div>}
  {faceSearch&&<FaceSuggestions items={available} onClose={()=>setFaceSearch(false)}/>}
  {active&&<FeedViewer instantPreview={instantPreview} item={active} related={relatedMaterial(active,available)} recordings={memories(active)} onOpen={open} onClose={close}
   onPrevious={()=>open(available[(available.findIndex(i=>i.id===active.id)-1+available.length)%available.length].id)}
   onNext={()=>open(available[(available.findIndex(i=>i.id===active.id)+1)%available.length].id)}/>}
 </div>;
}
function FeedViewer({instantPreview,item,related,recordings,onOpen,onClose,onPrevious,onNext}:{instantPreview?:{src:string;width:number;height:number};item:ArchiveItem;related:ReturnType<typeof relatedMaterial>;recordings:RecordingView[];onOpen:(id:string)=>void;onClose:()=>void;onPrevious:()=>void;onNext:()=>void}) {
 const workspace=useWorkspace();
 const dialog=useRef<HTMLDialogElement>(null);
 const [detailsFor,setDetailsFor]=useState<string|null>(null);
 useEffect(()=>{const node=dialog.current,overflow=document.body.style.overflow;node?.showModal();document.body.style.overflow='hidden';return()=>{node?.close();document.body.style.overflow=overflow;};},[]);
 useEffect(()=>{dialog.current?.scrollTo({top:0});},[item.id]);
 return <dialog ref={dialog} className={`feed-viewer ${detailsFor===item.id ? "feed-viewer-details" : "feed-viewer-simple"}`} aria-label="Photo and related material" onCancel={e=>{if(e.target!==e.currentTarget)return;e.preventDefault();onClose();}}>
  <header className="feed-viewer-top"><button type="button" className="memory-button" aria-label="Back to collection" onClick={onClose}><ArrowLeft size={18}/><span>Back to collection</span></button><div><button className="icon-button" aria-label="Previous image" onClick={onPrevious}><ArrowLeft/></button><button className="icon-button" aria-label="Next image" onClick={onNext}><ArrowRight/></button><button className="icon-button" aria-label="Close image" onClick={onClose}><X/></button></div></header>
  <div className="feed-viewer-layout"><section className="feed-feature" key={item.id}>
   <PhotoMemories instantPreview={instantPreview} item={item} recordings={recordings} priority variant="thumbnail" staticPhoto onPhotoClick={()=>setDetailsFor(item.id)}>
    <div className="feed-photo-details">
    {feedCaption(item,workspace.historicalPeople)&&<h2>{feedCaption(item,workspace.historicalPeople)}</h2>}
    <InlineConversation item={item}/>
    </div>
   </PhotoMemories>
   <div className="feed-photo-details">
   <Link className="text-link" href={item.href!}>Edit details, people or crop ↗</Link>
   <CardDetails item={item} showRecorder={false}/>
   {item.transcriptionRunId&&<Link className="text-link" href={`/archive/${item.id}/review?run=${item.transcriptionRunId}`}>Read transcription ↗</Link>}
   </div>
  </section><aside className="feed-related"><h2>More to explore</h2><div className="feed-related-grid">{related.map(({item:other,reason})=><button type="button" key={other.id} onClick={()=>onOpen(other.id)} className="feed-related-card" style={{backgroundColor:feedColour(other.id)}}>
   <ArchiveImage src={other.image} imageSet={other.imageSet} rotation={other.rotation} variant="small" autoPrepare={false} alt={other.title}/><span>{reason}</span>
  </button>)}</div>{!related.length&&<p>More linked photos will appear here as the archive grows.</p>}</aside></div>
 </dialog>;
}
