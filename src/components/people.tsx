"use client";
import { useCatalogue } from "./catalogue";
import { PeopleOverview } from "./people-overview";
export function People() {
  const { people } = useCatalogue();
  return <PeopleOverview people={people} mode="demo" />;
}
