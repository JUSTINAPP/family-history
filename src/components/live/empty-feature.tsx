import { PageIntro, TextLink } from "../ui";
export function EmptyFeature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="YOUR PRIVATE ARCHIVE"
        title={title}
        description={description}
      />
      <p className="demo-note">
        This feature is not connected to the database yet. Fictional demo
        records are not shown in your real archive.
      </p>
      <TextLink href="/explore">Explore your material</TextLink>
    </div>
  );
}
