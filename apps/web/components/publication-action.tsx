"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PublicDisclosure } from "@root-of-cambodia/backend/public-listing";
type Choice = {
  action: string;
  label: string;
  disabled?: boolean;
};
export function PublicationAction({
  url,
  body,
  choices,
  reviewer = false,
  disclosure,
}: {
  url: string;
  body: Record<string, unknown>;
  choices: Choice[];
  reviewer?: boolean;
  disclosure?: PublicDisclosure;
}) {
  const router = useRouter(),
    busy = useRef(false),
    attempt = useRef<{
      key: string;
      body: Record<string, unknown>;
    } | null>(null);
  const [reason, setReason] = useState(""),
    [publicConfirmed, setPublicConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [done, setDone] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [signIn, setSignIn] = useState(false);
  async function act(action: string) {
    if (busy.current || done || conflict) return;
    setError("");
    setSignIn(false);
    if (!attempt.current) {
      if (action === "submit" && (!disclosure || !publicConfirmed)) {
        setError(
          "Review the guest listing preview and confirm public display before submitting.",
        );
        return;
      }
      if (action === "return_changes" && !reason.trim()) {
        setError("Add correction notes before returning this submission.");
        return;
      }
      attempt.current = {
        key: crypto.randomUUID(),
        body: {
          ...body,
          action,
          ...(action === "submit" ? { publicDisclosure: disclosure } : {}),
          ...(reviewer
            ? {
                reason,
              }
            : {}),
        },
      };
    }
    busy.current = true;
    setPending(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.current.key,
        },
        body: JSON.stringify(attempt.current.body),
      });
      if (response.status >= 500) {
        setUncertain(true);
        setError(
          "We couldn’t confirm the result. Retry the same action to recover it safely.",
        );
        return;
      }
      if (!response.ok) {
        const result = (await response.json()) as {
          error?: string;
        };
        attempt.current = null;
        setUncertain(false);
        if (
          result.error === "public_disclosure_required" ||
          result.error === "public_disclosure_changed"
        ) {
          setConflict(true);
          setError(
            "Review the latest guest listing preview and confirm public display before continuing.",
          );
        } else if (result.error === "publication_incomplete") {
          setConflict(true);
          setError(
            "This property no longer meets the publication checklist. Reload the latest status to see what needs attention.",
          );
        } else if (response.status === 409) {
          setConflict(true);
          setError(
            "This submission or your access changed. Reload the latest status before continuing.",
          );
        } else if (response.status === 401 || response.status === 403) {
          setSignIn(true);
          setError("Sign in again, then return to this page.");
        } else
          setError(
            result.error === "publication_terms_not_configured"
              ? "Approved booking terms must be configured before publication."
              : result.error === "unfinished_photos"
                ? "Finish or remove pending photo uploads before submitting."
                : result.error === "reviewer_not_configured"
                  ? "The pilot reviewer must be configured before submission."
                  : response.status === 404
                    ? "This submission is no longer available to your account."
                    : "Check this submission and try again.",
          );
        return;
      }
      await response.json();
      attempt.current = null;
      setUncertain(false);
      setDone(true);
      if (reviewer) router.push("/review");
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "The connection was interrupted. Retry the same action to check whether it completed.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-4">
      {disclosure && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm">
            Review the guest listing preview. Exact address, contact fields and
            arrival notes stay private. Check your description and photos for
            information you intend to share.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
              checked={publicConfirmed}
              disabled={pending || uncertain || done || conflict}
              onChange={(event) => setPublicConfirmed(event.target.checked)}
            />
            <span>
              I understand these listing details and processed photos will be
              visible publicly after approval.
            </span>
          </label>
        </div>
      )}
      {reviewer && (
        <div className="space-y-2">
          <Label htmlFor="review-reason">
            Correction notes or decision note
          </Label>
          <Textarea
            id="review-reason"
            rows={5}
            maxLength={2000}
            value={reason}
            disabled={pending || uncertain || done || conflict}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="review-reason-help"
          />
          <p id="review-reason-help" className="text-xs text-muted-foreground">
            Correction notes are required when returning a submission and are
            visible to its owner.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {signIn && (
        <Link href="/sign-in" className="block text-sm underline">
          Sign in again
        </Link>
      )}
      {done && (
        <p role="status" className="text-sm text-primary">
          Action confirmed. Updating status…
        </p>
      )}
      {conflict ? (
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload latest status
        </Button>
      ) : uncertain ? (
        <Button
          disabled={pending}
          onClick={() => act(String(attempt.current?.body.action))}
        >
          {pending ? "Checking…" : "Retry same action"}
        </Button>
      ) : (
        choices.map((c) => (
          <Button
            key={c.action}
            className="w-full"
            variant={
              c.action === "return_changes" || c.action === "withdraw"
                ? "outline"
                : "default"
            }
            disabled={
              c.disabled ||
              pending ||
              done ||
              (c.action === "submit" && (!disclosure || !publicConfirmed))
            }
            onClick={() => act(c.action)}
          >
            {pending ? "Saving…" : c.label}
          </Button>
        ))
      )}
      {uncertain && (
        <p className="text-xs text-muted-foreground">
          Keep this page open until the result is confirmed.
        </p>
      )}
    </div>
  );
}
