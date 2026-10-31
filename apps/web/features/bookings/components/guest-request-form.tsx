"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  requestContext,
  GuestQuote,
} from "@root-of-cambodia/backend/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
type Context = Awaited<ReturnType<typeof requestContext>>;
export function GuestRequestForm({
  context,
  initial,
}: {
  context: Context;
  initial: string;
}) {
  const router = useRouter(),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [recovery, setRecovery] = useState("");
  const params = new URLSearchParams(initial);
  const { listing, terms } = context;
  async function review(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setAuth(false);
    const data = new FormData(event.currentTarget);
    const lines = listing.rooms.flatMap((room) => {
      const quantity = Number(data.get(room.id + ":quantity"));
      return quantity
        ? [
            {
              roomId: room.id,
              quantity,
              adults: Number(data.get(room.id + ":adults")),
              children: Number(data.get(room.id + ":children")),
            },
          ]
        : [];
    });
    const input = {
      propertyId: listing.id,
      termsVersion: terms.version,
      checkin: String(data.get("checkin")),
      checkout: String(data.get("checkout")),
      lines,
    };
    // Only dates/room counts go in the return URL; guest identity and terms stay on the server.
    const selection = new URLSearchParams({
      checkin: input.checkin,
      checkout: input.checkout,
    });
    for (const line of lines)
      for (const field of ["quantity", "adults", "children"] as const)
        selection.set(line.roomId + ":" + field, String(line[field]));
    window.history.replaceState(
      null,
      "",
      `/stays/${listing.id}/request?${selection}`,
    );
    let attempt = "";
    try {
      const response = await fetch("/api/guest/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const q = (await response.json()) as GuestQuote & { error?: string };
      if (!response.ok) {
        setAuth(response.status === 401 || response.status === 403);
        setError(requestError(q.error));
        return;
      }
      attempt = crypto.randomUUID();
      const saved = await fetch(`/api/guest/attempts/${attempt}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...q.input, quoteHash: q.hash }),
      });
      if (saved.status >= 500) {
        setRecovery(attempt);
        setError(
          "We couldn’t confirm that your review was saved. Check the saved review before starting again. No booking has been sent.",
        );
        return;
      }
      if (!saved.ok) {
        const failure = (await saved.json()) as { error?: string };
        setAuth(saved.status === 401 || saved.status === 403);
        setError(requestError(failure.error));
        return;
      }
      router.push(`/bookings/requests/${attempt}`);
    } catch {
      if (attempt) setRecovery(attempt);
      setError(
        attempt
          ? "The connection was interrupted while saving your review. Check the saved review. No booking has been sent."
          : "The connection was interrupted. Review the request again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form onSubmit={review} className="space-y-7">
      <p className="text-muted-foreground">
        Request a stay at {listing.nameEn || listing.nameKm}. The owner has 12
        hours to respond. Pay at the property after confirmation.
      </p>
      <fieldset disabled={pending || !!recovery} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose your dates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checkin">Check-in date</Label>
              <Input
                required
                type="date"
                id="checkin"
                name="checkin"
                defaultValue={params.get("checkin") ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout">Check-out date</Label>
              <Input
                required
                type="date"
                id="checkout"
                name="checkout"
                defaultValue={params.get("checkout") ?? ""}
              />
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Cambodia time. Request at least 24 hours before the property’s{" "}
              {listing.checkinTime} check-in time.
            </p>
          </CardContent>
        </Card>
        {listing.rooms.map((room) => (
          <Card key={room.id}>
            <CardHeader>
              <CardTitle>{room.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Each unit: up to {room.adultCapacity} adults,{" "}
                {room.childCapacity} children and {room.totalCapacity} guests
                total.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {(["quantity", "adults", "children"] as const).map((field) => (
                  <div className="space-y-2" key={field}>
                    <Label htmlFor={room.id + ":" + field}>
                      {field === "quantity"
                        ? "Rooms / units"
                        : field === "adults"
                          ? "Adults in these rooms"
                          : "Children in these rooms"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={field === "quantity" ? 100 : 10000}
                      step={1}
                      required
                      id={room.id + ":" + field}
                      name={room.id + ":" + field}
                      defaultValue={
                        params.get(room.id + ":" + field) ??
                        (field === "adults" ? "1" : "0")
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Set rooms to 0 to skip this option. Party counts apply to all
                units selected here. Availability is checked when you review.
              </p>
            </CardContent>
          </Card>
        ))}
      </fieldset>
      {error && (
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}
      {auth && (
        <TextLink className="block"
         
          href={`/sign-in?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : `/stays/${listing.id}/request`)}`}>
          Sign in and return to this selection
        </TextLink>
      )}
      {recovery ? (
        <TextLink
          href={`/bookings/requests/${recovery}`}>
          Check saved review
        </TextLink>
      ) : (
        <Button type="submit" disabled={pending || !listing.rooms.length}>
          {pending ? "Checking price and availability…" : "Review request"}
        </Button>
      )}
    </form>
  );
}
export function requestError(code?: string) {
  return (
    (
      {
        invalid_dates:
          "Choose a valid check-in date and a later check-out date.",
        invalid_request:
          "Choose at least one room option and check your dates.",
        invalid_occupancy: "Check the room quantities and party counts.",
        occupancy_exceeded:
          "Your party exceeds the selected room capacity. Choose more rooms or adjust your party.",
        inventory_unavailable:
          "These rooms are no longer available for every night. Change your selection.",
        incomplete_rates:
          "Prices are not available for every selected night. Try different dates.",
        room_unavailable:
          "A selected room is no longer bookable. Return to the stay and review its current options.",
        lead_time_required:
          "Requests must be sent at least 24 hours before scheduled check-in.",
        quote_changed:
          "The price or stay details changed. Review a fresh quote before sending a new request.",
        terms_changed:
          "Booking terms changed. Return to the stay to review the current terms.",
        booking_terms_unavailable:
          "Approved booking terms are unavailable. Requests are currently unavailable for this stay.",
        unauthorized: "Sign in again to continue.",
        verified_session_required: "Verify your email, then sign in again.",
        not_found:
          "This stay or request is no longer available to your account.",
        booking_conflict:
          "The request could not be completed with these details. Refresh and review the current state.",
        idempotency_conflict:
          "This attempt has different saved details. Open its saved review; do not resend it with changed details.",
      } as Record<string, string>
    )[code ?? ""] ??
    "We couldn’t complete this request. Check the current details and try again."
  );
}
