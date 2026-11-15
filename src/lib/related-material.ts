import type { ArchiveItem } from './types';
export function relatedMaterial(current:ArchiveItem, items:ArchiveItem[], limit=8) {
  return items.filter(item=>item.id!==current.id && item.archiveId===current.archiveId && !item.archivedAt && item.kind!=='Audio').map(item=>{
    const people=item.people.filter(id=>current.people.includes(id));
    const places=(item.placeIds||[]).filter(id=>current.placeIds?.includes(id));
    const year=current.year && item.year ? Math.abs(current.year-item.year) : undefined;
    const score=people.length*100+(year===0?40:year!==undefined&&year<=3?20:0)+places.length*10;
    const reason=people.length?'Linked to the same person':year===0?`Also from ${item.year}`:year!==undefined&&year<=3?'Around the same time':places.length?'Linked to the same place':'More from the collection';
    return {item,score,reason};
  }).sort((a,b)=>b.score-a.score || a.item.id.localeCompare(b.item.id)).slice(0,limit);
}
export function feedColour(id:string) {
  const colours=['#ded9ca','#d4ddd3','#d9d1c9','#d4dce0','#e1d8c4','#dcd4db'];
  let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;
  return colours[hash%colours.length];
}
