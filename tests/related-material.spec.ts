import {test,expect} from '@playwright/test';
import {relatedMaterial,feedColour} from '../src/lib/related-material';
import type {ArchiveItem} from '../src/lib/types';
const make=(id:string,extra:Partial<ArchiveItem>={})=>({id,archiveId:'one',people:[],kind:'Photograph',...extra}) as ArchiveItem;
test('related material ranks linked people then dates and excludes inaccessible or archived items',()=>{
 const source=make('source',{people:['jan'],year:1978,placeIds:['sydney']});
 const people=make('people',{people:['jan']}),date=make('date',{year:1978}),place=make('place',{placeIds:['sydney']}),near=make('near',{year:1980});
 const result=relatedMaterial(source,[source,place,near,date,people,make('private',{archiveId:'other',people:['jan']}),make('archived',{archivedAt:'today',people:['jan']})]);
 expect(result.map(r=>r.item.id)).toEqual(['people','date','near','place']);
 expect(result[0].reason).toBe('Linked to the same person');
 expect(result[1].reason).toBe('Also from 1978');
});
test('unknown dates and unnamed people do not fabricate relationships; colours are stable',()=>{
 expect(relatedMaterial(make('a'),[make('b')])[0].reason).toBe('More from the collection');
 expect(feedColour('photo')).toBe(feedColour('photo'));expect(feedColour('photo')).toMatch(/^#[a-f0-9]{6}$/);
});
