import { isDemoMode } from "@/lib/supabase/config";
import { PeopleTools } from "@/components/live/people-tools";
import { People } from "@/components/people";
export const metadata = { title: "People" };
export default function PeoplePage() {
  return (
    <>
      {!isDemoMode() && <PeopleTools />}
      <People />
    </>
  );
}
