import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default function Missing() {
  return (
    <div className="space-y-4 py-12">
      <PageTitle>Property unavailable</PageTitle>
      <p className="text-muted-foreground">
        It may not be available to your account.
      </p>
      <TextLink href="/owner">
        Back to your properties
      </TextLink>
    </div>
  );
}
