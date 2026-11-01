import {test,expect} from "@playwright/test";
import {imageSet,presentationRatio,type ImageSetRow} from "../src/lib/preview/types";
test("source presentation rotation flows through every responsive image variant without changing derivative receipts",()=>{
 const row={id:"set",original_file_id:"source",item_id:"item",display_file_id:"display",thumbnail_file_id:"thumbnail",small_file_id:"small",placeholder:"data:image/webp;base64,AA==",created_at:"2026-01-01",manifest:Object.fromEntries(["display","thumbnail","small"].map(k=>[k,{width:600,height:400,size:120,mime:"image/webp"}]))} as ImageSetRow;
 for(const angle of [0,90,180,270]){
  const set=imageSet({...row,presentation_rotation:angle});expect(set.rotation).toBe(angle);
  for(const variant of ["display","thumbnail","small"] as const){expect(presentationRatio(set,variant)).toBe(angle%180?2/3:1.5);expect(set[variant].width).toBe(600);expect(set[variant].height).toBe(400);}
  expect(set.placeholder).toBe(row.placeholder);expect(set.small.id).toBe("small");
 }
});
