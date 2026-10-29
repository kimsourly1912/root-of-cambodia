import Link from "next/link";
export default function Missing() {
  return (
    <div className="space-y-4 py-12">
      <h1 className="text-2xl font-semibold">Review unavailable</h1>
      <p className="text-muted-foreground">
        It may not be available to your account.
      </p>
      <Link href="/owner" className="text-primary underline">
        Back to your properties
      </Link>
    </div>
  );
}
