import Link from "next/link";
export default function Missing() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Booking unavailable</h1>
      <p>This booking is not available to your account.</p>
      <Link href="/bookings" className="text-primary underline">
        My bookings
      </Link>
    </section>
  );
}
