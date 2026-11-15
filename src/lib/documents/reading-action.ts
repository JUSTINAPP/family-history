"use server";
import {loadItem} from "../backend/repository";
import {UUID_PATTERN} from "../backend/validation";
import {loadPlaceData} from "../backend/places";
import {documentState} from "./repository";
import {documentKinds} from "./types";
import {can} from "../permissions";

export async function loadDocumentReading(itemId:string, selected?:string) {
 try {
  if(!UUID_PATTERN.test(itemId)||(selected&&!UUID_PATTERN.test(selected)))throw new Error();
  const result=await loadItem(itemId);
  if(!result||!documentKinds.includes(result.item.kind))throw new Error();
  const {item,snapshot}=result;
  const [initialState,places]=await Promise.all([documentState(itemId,selected),loadPlaceData(item.archive_id,item.id)]);
  const sourceRun=!selected?initialState.runs.find(run=>run.operation==="transcribe"):undefined;
  const state=sourceRun&&sourceRun.id!==initialState.run?.id?await documentState(itemId,sourceRun.id):initialState;
  const role=snapshot.members.find(m=>m.profileId===snapshot.profileId&&m.status==="active")?.role||"viewer";
  return {data:{...state,archiveId:item.archive_id,itemId:item.id,kind:item.kind,title:item.title,
   files:result.files.filter(f=>f.purpose==="original"),sets:result.imageSets,
   editor:can(role,"editor"),canProcess:item.lifecycle==="active"&&item.ingestion_status==="ready"&&!item.archived_at&&(can(role,"editor")||(can(role,"contributor")&&item.contributed_by===snapshot.profileId&&item.evidence_status!=="verified")),
   people:snapshot.people,places:places.places,date:item.reported_date||"",precision:item.date_precision||"unknown"}};
 } catch {return {error:"Transcription could not load. Please retry. Your original pages are unchanged."};}
}
