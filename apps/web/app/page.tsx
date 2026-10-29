import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="max-w-2xl">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary">
          For property owners
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          A place to begin.
          <br />
          <span className="text-primary">Your property, your details.</span>
        </h1>
        <p lang="km" className="mt-7 text-lg">
          ការកក់កន្លែងស្នាក់នៅ
        </p>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Start a private property draft. Save the essentials, come back when
          you’re ready, and keep everything together.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/stays">Explore stays →</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/owner">Open owner workspace →</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/sign-up">Create an account</Link>
          </Button>
        </div>
        <div className="mt-14 grid gap-5 border-t pt-8 sm:grid-cols-3">
          {[
            ["01", "Verified access", "Sign in with your verified email."],
            ["02", "Save a draft", "Add the property details you know."],
            [
              "03",
              "Return anytime",
              "Your draft stays private while you edit.",
            ],
          ].map(([n, title, copy]) => (
            <div key={n}>
              <span className="text-xs text-muted-foreground">{n}</span>
              <h2 className="mt-2 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
