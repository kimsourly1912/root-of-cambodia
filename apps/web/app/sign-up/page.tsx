import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main id="main" className="px-5 py-12 sm:py-16">
      <AuthForm mode="sign-up" next={next} />
    </main>
  );
}
