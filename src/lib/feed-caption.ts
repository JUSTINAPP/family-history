import type {ArchiveItem, Person} from './types';
/** Only show useful, recorded context; never manufacture a caption from the type. */
export function feedCaption(item:ArchiveItem,people:Pick<Person,'id'|'name'>[]) {
 const names=item.people.map(id=>people.find(p=>p.id===id)?.name).filter(Boolean).join(', ');
 const raw=item.rawTitle?.trim() || (item.titleSource==='explicit'?item.title.trim():'');
 const generic=/^(photograph|photo|letter|document|object|audio|other)(,? still to be catalogued| with a recollection)?\.?$/i;
 const title=raw&&!generic.test(raw)?raw:'';
 const place=item.place&&!/not (yet )?known/i.test(item.place)?item.place:'';
 const context=names||title||item.reportedPeople?.trim()||place;
 const when=item.date&&!/not (yet )?known/i.test(item.date)?item.date:item.year?.toString()||'';
 return [context,when].filter(Boolean).join(' · ');
}
