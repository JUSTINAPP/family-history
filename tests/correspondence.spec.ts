import {test,expect} from "@playwright/test";
import {cataloguePresentation} from "../src/lib/catalogue-presentation";
import {correspondents,correspondenceDate,type ReviewedSuggestion} from "../src/lib/documents/correspondence";
import {readingOutput} from "../src/lib/documents/reading-output";
import {reviewChoice} from "../src/lib/documents/review-choice";
const base={kind:"Letter",title:"Letter, still to be catalogued"};
for(const [from,to,date,title] of [
  [["Jan Allen"],["Tina"],"2010-05-17","Letter from Jan Allen to Tina, 2010"],
  [["Jan Allen"],[],"","Letter from Jan Allen"],
  [[],["Tina"],"","Letter to Tina"],
] as [string[],string[],string,string][])test(title,()=>expect(cataloguePresentation({...base,from,to,date}).title).toBe(title));
test("explicit titles win and transcribed/reviewed correspondence progresses without optional metadata",()=>{
 expect(cataloguePresentation({...base,title:"A particular summer",from:["Jan"],to:["Tina"]}).title).toBe("A particular summer");
 expect(cataloguePresentation({...base,hasTranscription:true})).toMatchObject({title:"Letter",catalogueState:"In progress"});
 expect(cataloguePresentation({...base,hasTranscription:true,hasReviewedTranscription:true})).toMatchObject({title:"Letter",catalogueState:"Catalogued"});
 expect(cataloguePresentation({...base,from:["Jan"],date:"2010"}).catalogueState).toBe("Catalogued");
 expect(cataloguePresentation(base).title).toBe("Letter, still to be catalogued");
});
test("confirmed role relationships link canonical People, while reviewed recipients can remain text",()=>{
 const people=[{id:"jan",name:"Jan Allen"}],links=[{person_id:"jan",status:"accepted",role_context:"mentioned; sender"}];
 expect(correspondents("sender",links,[],people)).toEqual([{name:"Jan Allen",personId:"jan",wording:"Jan Allen"}]);
 const suggestion:ReviewedSuggestion={id:"s",item_id:"letter",field_path:"document.recipient",status:"accepted",reviewed_value:{value:"Tina",context:"recipient",text_only:true}};
 expect(correspondents("recipient",links,[suggestion],people)).toEqual([{name:"Tina",wording:"Tina"}]);
 expect(correspondents("recipient",links,[{...suggestion,status:"pending"}],people)).toEqual([]);
 expect(correspondents("sender",[{...links[0],status:"reported"}],[],people)).toEqual([]);
 const removed={...suggestion,field_path:"document.sender",reviewed_value:{value:"Jan",context:"sender",canonical_id:"jan"}};
 expect(correspondents("sender",[],[removed],people)).toEqual([]);
 expect(correspondenceDate("2010-05-17","exact")).toBe("17 May 2010");
});
test("concise review never automatically links names or creates canonical records",()=>{
 const s={id:"s",document_run_id:"r",source_file_id:"f",status:"pending",reviewed_value:null,suggested_value:{kind:"recipient" as const,value:"Tina",evidence:"Dear Tina",page:1,context:"recipient"}};
 expect(reviewChoice(s)).toMatchObject({text_only:true,canonical_id:"",create:false,selected:false,context:"recipient"});
 expect(reviewChoice({...s,suggested_value:{...s.suggested_value,kind:"date",value:"2010-05-17",context:"written_date"}})).toMatchObject({value:"2010-05-17",precision:"exact",context:"written_date"});
});

test("reading payload preserves uncertainty/receipts without duplicating raw provider output or extraction",()=>{
 const raw={page:{text:"source".repeat(10000),uncertainty:["[unclear]"],language:"en",receipt:{model:"configured-model"},rawResponse:{text:"private receipt".repeat(10000)}},extraction:{suggestions:[]}};
 const filtered=readingOutput(raw);
 expect(filtered).toEqual({page:{uncertainty:["[unclear]"],language:"en",receipt:{model:"configured-model"}}});
 expect(JSON.stringify(filtered).length).toBeLessThan(200);expect(JSON.stringify(raw).length).toBeGreaterThan(100000);
 expect(raw.page.rawResponse.text).toContain("private receipt");
});
