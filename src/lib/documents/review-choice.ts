import {suggestedDate} from "./types";
import type {StoredDocumentSuggestion} from "./repository";
export interface ReviewChoice {id:string;selected:boolean;action:string;value:string;canonical_id:string;create:boolean;context:string;precision:string;text_only:boolean;}
export function reviewChoice(s:StoredDocumentSuggestion):ReviewChoice {
  const kind=s.suggested_value.kind,date=suggestedDate(s.suggested_value.value);
  return {id:s.id,selected:false,action:"accept",value:kind==="date"?date.value:s.suggested_value.value,canonical_id:"",create:false,
    context:kind==="date"?(s.suggested_value.context==="written_date"&&date.precision!=="unknown"?"written_date":"mentioned_date"):
      kind==="place"?(["written_in","sent_to"].includes(s.suggested_value.context)?s.suggested_value.context:"related"):
      ["sender","recipient"].includes(kind)?kind:"mentioned",precision:date.precision,text_only:["sender","recipient"].includes(kind)};
}
