"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            const response = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!response.ok) throw new Error();
            router.replace("/sign-in");
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          Couldn’t sign out. Try again.
        </p>
      )}
    </div>
  );
}
