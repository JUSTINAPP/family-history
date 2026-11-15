import {test,expect} from '@playwright/test';
import {feedCaption} from '../src/lib/feed-caption';
import type {ArchiveItem} from '../src/lib/types';
const base={kind:'Photograph',title:'Photograph',rawTitle:'Photograph, still to be catalogued',people:[],date:'Date not yet known',place:'Place not yet known'} as unknown as ArchiveItem;
test('empty archive metadata produces no repeated type caption',()=>{expect(feedCaption(base,[])).toBe('');expect(feedCaption({...base,kind:'Letter',rawTitle:'Letter'},[])).toBe('');});
test('captions show linked names and recorded dates',()=>{expect(feedCaption({...base,people:['jan'],year:1978},[{id:'jan',name:'Jan Allen'}])).toBe('Jan Allen · 1978');});
test('a real description or place remains useful without a named person',()=>{expect(feedCaption({...base,rawTitle:'An afternoon by the river'},[])).toBe('An afternoon by the river');expect(feedCaption({...base,place:'Auroville',date:'c. 1978'},[])).toBe('Auroville · c. 1978');});
