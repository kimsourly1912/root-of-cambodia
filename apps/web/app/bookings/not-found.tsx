import { PageTitle } from "@/components/typography";
import { TextLink } from "@/components/text-link";
export default function Missing() {
  return (
    <section className="space-y-4">
      <PageTitle>Booking unavailable</PageTitle>
      <p>This booking is not available to your account.</p>
      <TextLink href="/bookings">
        My bookings
      </TextLink>
    </section>
  );
}
