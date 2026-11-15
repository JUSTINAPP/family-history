import { PageIntro } from "@/components/ui";
import { PasswordForm } from "@/components/live/password-form";
export const metadata = { title: "Reset your password" };
export default function PasswordPage() {
  return <div className="capture-shell"><PageIntro eyebrow="SYDNEY & AUROVILLE" title="Forgot your password?" description="Enter the email you use for the archive. We will send a link so you can choose a new password." /><PasswordForm /></div>;
}
