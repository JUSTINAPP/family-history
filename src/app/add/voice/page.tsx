import { PageIntro } from "@/components/ui";
import { AudioCapture } from "@/components/audio/audio-capture";
export const metadata = { title: "Voice recording" };
export default function VoicePage() {
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="AN ORAL HISTORY"
        title="Keep the story in their voice."
        description="Record a memory, an interview or a family conversation. Names and dates can follow later."
      />
      <AudioCapture />
    </div>
  );
}
