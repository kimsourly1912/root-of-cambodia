import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <main id="main" className="px-5 py-12 sm:py-16">
      <AuthForm mode="forgot-password" />
    </main>
  );
}
