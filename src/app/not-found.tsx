import { ButtonLink } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="page-shell">
      <section className="page-intro">
        <p className="eyebrow">A PAGE STILL TO BE FOUND</p>
        <h1>Not in this collection.</h1>
        <p className="intro-description" style={{ marginBottom: 30 }}>
          This piece may have moved, or the address may be incomplete.
        </p>
        <ButtonLink href="/explore">Back to the archive</ButtonLink>
      </section>
    </div>
  );
}
