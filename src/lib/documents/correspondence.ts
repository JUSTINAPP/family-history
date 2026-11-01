/** Presentation of human decisions only. AI drafts never become correspondence facts. */
export interface ReviewedSuggestion {
  id: string; item_id: string; status: string; field_path: string; reviewed_at?: string;
  reviewed_value: {value?:string; context?:string; canonical_id?:string; text_only?:boolean}|null;
}
export interface Correspondent { name:string; personId?:string; wording:string; }
export function correspondents(role:"sender"|"recipient", links:{person_id:string|null;status:string;role_context?:string}[], suggestions:ReviewedSuggestion[], people:{id:string;name:string}[]):Correspondent[] {
  const linked=links.filter(l=>l.status==="accepted" && l.role_context?.split(/;\s*/).includes(role));
  const latest=suggestions.filter(s=>s.status==="accepted" && (s.reviewed_value?.context===role || s.field_path===`document.${role}`))
    .sort((a,b)=>(b.reviewed_at||"").localeCompare(a.reviewed_at||"")||b.id.localeCompare(a.id))[0]?.reviewed_value;
  if(latest?.value && latest.text_only && !latest.canonical_id)return [{name:latest.value,wording:latest.value}];
  const ids=latest?.canonical_id ? linked.filter(l=>l.person_id===latest.canonical_id) : linked;
  return [...new Set(ids.map(l=>l.person_id))].flatMap(id=>{
    const person=people.find(p=>p.id===id);
    return person?[{name:person.name,personId:person.id,wording:latest?.canonical_id===id?latest.value||person.name:person.name}]:[];
  });
}
export function correspondenceDate(value:string,precision?:string) {
  if(precision==="exact" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year,month,day]=value.split("-").map(Number);
    if(month<1||month>12||day<1||day>31)return value;
    return `${day} ${["January","February","March","April","May","June","July","August","September","October","November","December"][month-1]} ${year}`;
  }
  return precision==="approximate"&&value?`c. ${value}`:value;
}
