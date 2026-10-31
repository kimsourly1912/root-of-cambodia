import Link from "next/link";
import { Button } from "@/components/ui/button";
import { runtime } from "@/server/runtime";
import { PageTitle, SectionTitle } from "@/components/typography";
import { PageContainer } from "@/components/page-container";
export default async function Home() {
  const { readOnly, fixtureTest } = await runtime();
  return (
    <PageContainer>
      <div className="max-w-2xl">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-primary">
          {readOnly ? "Staging preview" : "For property owners"}
        </p>
        <PageTitle size="hero">
          A place to begin.
          <br />
          <span className="text-primary">Your property, your details.</span>
        </PageTitle>
        <p lang="km" className="mt-7 text-lg">
          ការកក់កន្លែងស្នាក់នៅ
        </p>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          {readOnly
            ? "Browse this preview. Account access and bookings are unavailable while email is disconnected."
            : "Start a private property draft. Save the essentials, come back when you’re ready, and keep everything together."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/stays">Explore stays →</Link>
          </Button>
          {!readOnly && <><Button asChild size="lg">
            <Link href="/owner">Open owner workspace →</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            {fixtureTest ? <Link href="/testing">Start testing</Link> :
            <Link href="/sign-up">Create an account</Link>
            }
          </Button></>}
        </div>
        {!readOnly && <div className="mt-14 grid gap-5 border-t pt-8 sm:grid-cols-3">
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
              <SectionTitle size="sm" className="mt-2">{title}</SectionTitle>
              <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>}
      </div>
    </PageContainer>
  );
}
