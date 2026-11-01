import { test, expect } from "@playwright/test";
import { historicalDate, commentThreads, needsInformation, type FamilyComment } from "../src/lib/conversation";
test("historical dates retain year, month, decade and unknown precision", () => {
  expect(historicalDate("1984", "approximate")).toBe("c. 1984");
  expect(historicalDate("c. 1984", "approximate")).toBe("c. 1984");
  expect(historicalDate("1980s", "decade")).toBe("1980s");
  expect(historicalDate("1984-03", "month")).toBe("1984-03");
  expect(historicalDate("", "unknown")).toBe("Not yet known");
});
test("conversation threads retain separate authors and handle a moderated missing root", () => {
  const root={id:"a",body:"Where was this?",author_id:"one",created_at:"1980",revision:1} as FamilyComment;
  const reply={...root,id:"b",body:"At home",author_id:"two",parent_id:"a",created_at:"1981"};
  const threads=commentThreads([reply, root]);
  expect(threads[0][1]).toEqual({root,replies:[reply]});
  expect(commentThreads([reply])[0][1]).toEqual({replies:[reply]});
  expect(root.body).toBe("Where was this?");
});
test("next needing information respects independent fields without requiring a recollection", () => {
  expect(needsInformation({people:["p"],placeIds:["place"],date:"c. 1984"})).toBe(false);
  expect(needsInformation({people:["p"],placeIds:[],date:"c. 1984"})).toBe(true);
  expect(needsInformation({people:[],placeIds:["place"],date:"1980s"})).toBe(true);
});
