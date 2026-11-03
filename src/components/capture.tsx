"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {Camera,Upload,ArrowUp,ArrowDown,X,Plus,Check} from "lucide-react";
import {LocalSourcePreview} from "./local-source-preview";
import {DocumentGroups} from "./document-groups";
import {BulkImport} from "./live/bulk-import";
import {PageIntro} from "./ui";
import {useWorkspace} from "./workspace-provider";
import {validateFiles} from "@/lib/capture";
import {can} from "@/lib/permissions";
import type {CaptureKind,SourceFile} from "@/lib/workspace-types";
export function Capture() {
  const workspace=useWorkspace(),router=useRouter();
  const [files,setFiles]=useState<SourceFile[]>([]),[kind,setKind]=useState<CaptureKind>("Other");
  const [groupedPhotograph,setGroupedPhotograph]=useState(false),[together,setTogether]=useState(true),[locked,setLocked]=useState(false);
  const [written,setWritten]=useState(""),[quick,setQuick]=useState<Record<string,string>>({precision:"unknown"});
  const [error,setError]=useState(""),[saving,setSaving]=useState(false),[savedId,setSavedId]=useState(""),[activeImage,setActiveImage]=useState(0);
  const camera=useRef<HTMLInputElement>(null),upload=useRef<HTMLInputElement>(null);
  const document=["Letter","Document","Postcard","Certificate"].includes(kind);
  const separatePhotos=kind==="Photograph"&&files.length>1&&!groupedPhotograph;
  function classify(value:CaptureKind) {
    setKind(value);setTogether(true);setGroupedPhotograph(false);setError("");
    setFiles(old=>old.map((f,i)=>({...f,role:["Letter","Document","Postcard","Certificate"].includes(value)?(f.role==="image"||["Front","Detail"].includes(f.role)?"page":f.role):value==="Object"?(i?"Detail":"Front"):"image"})));
  }
  function add(list:FileList|null) {
    if(!list||locked||saving)return;
    const result=validateFiles(Array.from(list));
    if(files.length+result.accepted.length>500){setError("Choose up to 500 images at a time.");return;}
    setError(result.error);
    const additions=result.accepted.map((file,i)=>{
      const url=URL.createObjectURL(file);workspace.registerUrl(url);
      return {id:crypto.randomUUID(),file,url,originalName:file.name,role:document?"page":kind==="Object"?(files.length+i?"Detail":"Front"):"image"};
    });
    setFiles(old=>[...old,...additions]);
    if(camera.current)camera.current.value="";if(upload.current)upload.current.value="";
  }
  function move(index:number,delta:number) {
    setFiles(old=>{const next=[...old];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});setActiveImage(0);
  }
  async function save(view:boolean) {
    if(!files.length||saving||locked)return;
    if(separatePhotos)return;
    if(document&&!together){setError("Keep the pages of one document together, or remove other documents and save them separately.");return;}
    if(files.length>20){setError("Keep up to 20 images in one item. Select Photograph to save separate photographs, or save smaller groups.");return;}
    setSaving(true);setError("");
    try {
      const id=await workspace.saveCapture({kind,title:`${kind==="Other"?"Archive item":kind}, still to be catalogued`,files,
        recollection:{id:crypto.randomUUID(),contributorId:workspace.profileId,recordedAt:new Date().toISOString(),originalText:written,machineTranscript:"",editedTranscript:null},quick,suggestions:[]});
      if(!id){setError("Contributor access is required to save material.");return;}
      if(view){router.push(`/add/saved/${id}`);return;}
      setSavedId(id);setFiles([]);setKind("Other");setGroupedPhotograph(false);setTogether(true);setActiveImage(0);setWritten("");setQuick({precision:"unknown"});
      window.scrollTo({top:0,behavior:"smooth"});
    } catch(failure){setError(failure instanceof Error?failure.message:"Could not save. Your selected originals are still here; please retry.");}
    finally{setSaving(false);}
  }
  if(!can(workspace.role,"contributor"))return <div className="capture-shell"><PageIntro eyebrow="ARCHIVE ACCESS" title="A place to contribute." description="Your current role can browse this archive. Capturing material requires Contributor, Editor or Admin access."/>{workspace.mode==="demo"&&<Link className="text-link" href="/admin">Change demo access preview ↗</Link>}</div>;
  const active=files[Math.min(activeImage,files.length-1)];
  return <div className="capture-studio">
    <input ref={camera} type="file" accept="image/*,.heic,.heif" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take a photo" disabled={saving||locked} onChange={e=>add(e.target.files)}/>
    <input ref={upload} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" tabIndex={-1} aria-label="Upload existing images" disabled={saving||locked} onChange={e=>add(e.target.files)}/>
    <div className="capture-heading"><div><p className="eyebrow">ADD TO ARCHIVE</p><h1>{files.length?"The material comes first.":"What have you found?"}</h1></div><span className="help-line">{workspace.capturedCount} {workspace.capturedCount===1?"item":"items"} captured</span></div>
    {!files.length?<>
      <section className="capture-start capture-simple-start" aria-label="Choose material">
        <div className="capture-entry-actions"><button className="button" onClick={()=>camera.current?.click()}><Camera size={21}/>Take photo</button><button className="button button-light" onClick={()=>upload.current?.click()}><Upload size={21}/>Choose from library</button></div>
        <p>A photograph, some pages, something you want to keep. Choose the material now; details can wait.</p>
        <Link className="text-link" href="/add/voice">Record a memory ↗</Link>
      </section>
      {savedId&&<section className="saved-inline" role="status"><Check size={20}/><div><strong>Saved. Your originals are preserved.</strong><p><Link href={`/add/saved/${savedId}`}>View item ↗</Link></p></div><button className="subtle-button" onClick={()=>camera.current?.click()}>Capture another</button></section>}
      <p className="help-line">{workspace.mode==="live"?"Files stay on your device until you save. Your originals are kept unchanged in your private archive.":"Demo only. Files stay on this device; nothing is uploaded."}</p>
    </>:<>
      <fieldset className="capture-selection" disabled={saving||locked}>
        <div className="capture-workspace">
          <section className="capture-material" aria-label="Captured material" hidden={document && !together}>
            <div className="capture-main-image"><LocalSourcePreview file={active.file} url={active.url} alt={`Original local preview of ${active.originalName}`}/><span className="material-label">ORIGINAL · {active.originalName}</span></div>
            <div className="capture-pages">{files.map((file,index)=><div key={file.id} className={`capture-page ${index===activeImage?"selected":""}`}>
              <button className="capture-page-image" aria-label={`Preview image ${index+1}`} onClick={()=>setActiveImage(index)}><LocalSourcePreview file={file.file} url={file.url} alt=""/></button>
              <div><label><span className="sr-only">Role for {file.originalName}</span><select aria-label={`Role for ${file.originalName}`} value={file.role} onChange={e=>setFiles(old=>old.map(f=>f.id===file.id?{...f,role:e.target.value}:f))}>
                {document?<><option value="page">Page {index+1}</option><option value="image">Unlabelled page</option><option value="page-front">Page front</option><option value="page-back">Page back</option><option value="envelope-front">Envelope front</option><option value="envelope-back">Envelope back</option><option value="picture-side">Picture side</option><option value="written-side">Written side</option></>:kind==="Object"?["Front","Back","Detail","Inscription","Other view"].map(role=><option key={role}>{role}</option>):<><option value="image">Image {index+1}</option><option value="reverse">Back / reverse</option><option value="detail">Detail</option></>}
              </select></label><div className="page-order-actions"><button type="button" disabled={!index} aria-label={`Move ${file.originalName} earlier`} onClick={()=>move(index,-1)}><ArrowUp size={15}/></button><button type="button" disabled={index===files.length-1} aria-label={`Move ${file.originalName} later`} onClick={()=>move(index,1)}><ArrowDown size={15}/></button><button type="button" aria-label={`Remove ${file.originalName}`} onClick={()=>{setFiles(old=>old.filter(f=>f.id!==file.id));setActiveImage(0);}}><X size={15}/></button></div></div>
            </div>)}</div>
            <div className="add-source-buttons"><button className="subtle-button" onClick={()=>camera.current?.click()}><Plus size={17}/>{document?"Add another page":"Take another photo"}</button><button className="subtle-button" onClick={()=>upload.current?.click()}>Choose more from library</button></div>
          </section>
          <section className="capture-context" aria-label="About this material">
            <h2>What is this?</h2><label className="field"><span>Material type</span><select aria-label="Material type" value={kind==="Document"||kind==="Certificate"?"Letter":kind} onChange={e=>classify(e.target.value as CaptureKind)}><option value="Other">Not sure</option><option value="Photograph">Photograph</option><option value="Letter">Letter / document</option><option value="Object">Object</option><option value="Postcard">Postcard</option></select></label>
            {document&&kind!=="Postcard"&&<label className="field">Document type<select aria-label="Document type" value={kind} onChange={e=>classify(e.target.value as CaptureKind)}>{["Letter","Document","Certificate"].map(value=><option key={value}>{value}</option>)}</select></label>}
            <p role="status">{files.length} {kind==="Photograph"?files.length===1?"photograph selected":"photographs selected":files.length===1?"image selected":"images selected"}</p>
            {document&&files.length>1&&<div className="capture-grouping"><p>Are these pages/sides of the same item?</p><label><input type="checkbox" checked={together} onChange={e=>setTogether(e.target.checked)}/> Keep together as one {kind==="Letter"?"letter":kind==="Postcard"?"postcard":"document"}</label>{!together&&<p>Arrange the thumbnails below into separate letters. Select only the pages that belong together.</p>}</div>}
            {kind==="Object"&&<p>These views stay together as one object.</p>}
            {kind==="Other"&&<p>{files.length>1?"These images will stay together as one uncategorised item.":"Save this as an uncategorised item."} You can change its type later.</p>}
            {kind==="Photograph"&&files.length>1&&<><p>Each photograph gets its own item.</p><details><summary>Front and back of one photograph?</summary><label><input type="checkbox" checked={groupedPhotograph} onChange={e=>setGroupedPhotograph(e.target.checked)}/> Keep together as one item</label></details></>}
            {!separatePhotos&&<details className="capture-optional"><summary>Add a note or details (optional)</summary><label className="field">Your recollection, in your words<textarea value={written} onChange={e=>setWritten(e.target.value)} maxLength={10000}/></label>
              <label className="field">Reported people notes<input value={quick.People||""} onChange={e=>setQuick({...quick,People:e.target.value})} maxLength={300}/></label><label className="field">Date<input value={quick.When||""} onChange={e=>setQuick({...quick,When:e.target.value})} maxLength={300}/></label><label className="field">Date certainty<select value={quick.precision} onChange={e=>setQuick({...quick,precision:e.target.value})}><option value="unknown">Not sure</option><option value="approximate">Approximate</option><option value="year">Year</option><option value="exact">Exact</option></select></label><label className="field">Where<input value={quick.Where||""} onChange={e=>setQuick({...quick,Where:e.target.value})} maxLength={300}/></label></details>}
          </section>
        </div>
      </fieldset>
      {document && !together ? <DocumentGroups key={files.map(file => file.id).join(":")} files={files} kind={kind} written={written} quick={quick} onStarted={() => setLocked(true)} /> : separatePhotos?<BulkImport key={files.map(f=>f.id).join(":")} initialFiles={files.map(f=>f.file)} initialContext={written} embedded onStarted={()=>setLocked(true)}/>:<div className="capture-save-bar"><div><strong>Ready to keep.</strong><p>Details and optional transcription can wait until after saving.</p></div><button className="button" disabled={saving||locked||(document&&!together)} onClick={()=>void save(true)}>Save to archive</button><button className="subtle-button" disabled={saving||locked||(document&&!together)} onClick={()=>void save(false)}>Save & capture another</button></div>}
    </>}
    {saving&&<p className="notice" role="status">Saving unchanged originals. Keep this page open.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}
