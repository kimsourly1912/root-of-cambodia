import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default function NotFound() {
  return (
    <div className="py-16">
      <PageTitle>Stay unavailable</PageTitle>
      <p className="my-5 text-muted-foreground">
        This listing is not available to browse.
      </p>
      <TextLink href="/stays">
        Explore other stays
      </TextLink>
    </div>
  );
}
