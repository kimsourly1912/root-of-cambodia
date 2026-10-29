import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-3xl font-semibold">Stay unavailable</h1>
      <p className="my-5 text-muted-foreground">
        This listing is not available to browse.
      </p>
      <Link href="/stays" className="text-primary underline">
        Explore other stays
      </Link>
    </div>
  );
}
