"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import type { CalendarNight } from "@root-of-cambodia/backend/calendar";
import type { CalendarEdit } from "@root-of-cambodia/backend/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { TextLink } from "@/components/text-link";
import { StatusMessage } from "@/components/status-message";
import { Alert } from "@/components/ui/alert";
type Row = CalendarNight & { units: string; blocks: string; price: string };
type CalendarFormValues = {
  rows: Row[];
  bulkPrice: string;
  bulkUnits: string;
  bulkBlocked: string;
};
const rowsFrom = (nights: CalendarNight[]): Row[] =>
  nights.map((n) => ({
    ...n,
    units: n.capacity === null ? "" : String(n.capacity),
    blocks: String(n.blocked ?? 0),
    price: n.unitCents === null ? "" : (n.unitCents / 100).toFixed(2),
  }));
// Parse whole cents from decimal text, without rounding a floating-point amount.
function cents(value: string) {
  const text = value.trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) return null;
  const [usd, part = ""] = text.split(".");
  const amount = Number(usd) * 100 + Number(part.padEnd(2, "0"));
  return amount <= 100000000 ? amount : null;
}
function count(value: string) {
  return value.trim() !== "" &&
    /^\d+$/.test(value) &&
    Number.isInteger(Number(value)) &&
    Number(value) <= 10000
    ? Number(value)
    : null;
}
export function RoomCalendarForm({
  propertyId,
  roomId,
  roomRevision,
  nights,
  editable,
}: {
  propertyId: string;
  roomId: string;
  roomRevision: number;
  nights: CalendarNight[];
  editable: boolean;
}) {
  const router = useRouter(),
    busy = useRef(false),
    completed = useRef(false),
    attempt = useRef<{ key: string; body: CalendarEdit } | null>(null);
  const [hydrated, setHydrated] = useState(false),
    [dirty, setDirty] = useState<string[]>([]),
    [pending, setPending] = useState(false),
    [settling, setSettling] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conflict, setConflict] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [needsSignIn, setNeedsSignIn] = useState(false);
  const defaultValues: CalendarFormValues = {
    rows: rowsFrom(nights),
    bulkPrice: "",
    bulkUnits: "",
    bulkBlocked: "0",
  };
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setNeedsSignIn(false);
      if (!hydrated || busy.current || completed.current) return;
      if (!attempt.current) {
        const selected = value.rows.filter((row) => dirty.includes(row.night));
        if (!selected.length) return;
        const changes = [];
        for (const row of selected) {
          const unitCents = cents(row.price),
            capacity = count(row.units),
            blocked = count(row.blocks);
          if (
            unitCents === null ||
            capacity === null ||
            blocked === null ||
            capacity < blocked + (row.reserved ?? 0)
          ) {
            setError(
              `Check ${row.night}: enter a valid price and enough total units to cover blocked and reserved units.`,
            );
            return;
          }
          changes.push({
            night: row.night,
            capacity,
            blocked,
            unitCents,
            inventoryRevision: row.inventoryRevision,
            rateRevision: row.rateRevision,
          });
        }
        attempt.current = {
          key: crypto.randomUUID(),
          body: { roomRevision, nights: changes },
        };
      }
      busy.current = true;
      setPending(true);
      setError("");
      setSaved(false);
      try {
        const response = await fetch(
          `/api/owner/properties/${propertyId}/rooms/${roomId}/calendar`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": attempt.current.key,
            },
            body: JSON.stringify(attempt.current.body),
          },
        );
        if (response.status >= 500) {
          setUncertain(true);
          setError(
            "We couldn’t confirm this save. Retry the same save to recover the result safely.",
          );
          return;
        }
        if (!response.ok) {
          setNeedsSignIn(response.status === 401 || response.status === 403);
          attempt.current = null;
          setUncertain(false);
          if (response.status === 409) {
            setConflict(true);
            setError(
              "The room, prices or availability changed since you opened this week. Reload the latest details before saving again.",
            );
          } else
            setError(
              response.status === 401 || response.status === 403
                ? "Your session needs attention. Sign in again, then return to this week."
                : response.status === 404
                  ? "This room is no longer available to your account."
                  : "Check the selected dates, prices and unit counts, then try again.",
            );
          return;
        }
        await response.json();
        attempt.current = null;
        completed.current = true;
        setSettling(true);
        setUncertain(false);
        setDirty([]);
        setSaved(true);
        router.refresh();
      } catch {
        setUncertain(true);
        setError(
          "The connection was interrupted. Retry the same save to check whether it completed.",
        );
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
  });
  const versions = nights
    .map((n) =>
      [n.night, n.inventoryRevision, n.rateRevision, n.reserved].join(":"),
    )
    .join("|");
  useEffect(() => {
    form.setFieldValue("rows", rowsFrom(nights));
    setDirty([]);
    completed.current = false;
    setSettling(false);
    setHydrated(true);
  }, [versions, roomRevision]);
  const frozen = !hydrated || !editable || pending || settling || uncertain || conflict;
  function change(
    night: string,
    fieldName: "price" | "units" | "blocks",
    value: string,
  ) {
    form.setFieldValue(
      "rows",
      form.state.values.rows.map((row) =>
        row.night === night ? { ...row, [fieldName]: value } : row,
      ),
    );
    setDirty((current) =>
      current.includes(night) ? current : [...current, night],
    );
    setSaved(false);
  }
  function fill() {
    const values = form.state.values;
    setNeedsSignIn(false);
    if (
      cents(values.bulkPrice) === null ||
      count(values.bulkUnits) === null ||
      count(values.bulkBlocked) === null
    ) {
      setError(
        "Enter a valid nightly price and whole unit counts before applying them.",
      );
      return;
    }
    form.setFieldValue("rows", values.rows.map((row) => ({
        ...row,
        price: values.bulkPrice,
        units: values.bulkUnits,
        blocks: values.bulkBlocked,
      })));
    setDirty(values.rows.map((row) => row.night));
    setSaved(false);
    setError("");
  }
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      event.stopPropagation();
      void form.handleSubmit();
    }} className="space-y-6">
      <fieldset disabled={frozen} aria-label="Fill this week">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Fill this week{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </CardTitle>
            <CardDescription>
              Apply the same values to all seven nights, then adjust individual
              dates below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-price">Nightly price for week (USD)</Label>
              <form.Field name="bulkPrice">{(field) =>
                <Input
                  id="bulk-price"
                  inputMode="decimal"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              }</form.Field>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-units">Total units for week</Label>
              <form.Field name="bulkUnits">{(field) =>
                <Input
                  id="bulk-units"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              }</form.Field>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-blocked">Blocked units for week</Label>
              <form.Field name="bulkBlocked">{(field) =>
                <Input
                  id="bulk-blocked"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              }</form.Field>
            </div>
            <Button type="button" variant="outline" onClick={fill}>
              Apply to seven nights
            </Button>
          </CardContent>
        </Card>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Total units include blocked and reserved units. Reserved units are
        managed by bookings. Prices are USD per unit, per night; guests pay at
        the property.
      </p>
      <form.Field name="rows">{(rowsField) =>
      <div className="space-y-3">
        {rowsField.state.value.map((row) => {
          const available = count(row.units);
          return (
            <fieldset
              key={row.night}
              disabled={frozen}
              aria-label={row.night}
              className="min-w-0 rounded-xl border bg-white p-4 sm:p-5"
            >
              <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <div className="col-span-2 self-center sm:col-span-3 lg:col-span-1">
                  <p className="font-semibold">{row.night}</p>
                  <p className="text-xs text-muted-foreground">
                    {dirty.includes(row.night)
                      ? "Unsaved changes"
                      : row.inventoryRevision === null ||
                          row.rateRevision === null
                        ? "Not fully set"
                        : "Saved"}
                  </p>
                </div>
                <div className="col-span-2 space-y-2 sm:col-span-1">
                  <Label htmlFor={row.night + "-price"}>
                    Nightly price (USD)
                  </Label>
                  <Input
                    id={row.night + "-price"}
                    inputMode="decimal"
                    value={row.price}
                    required={dirty.includes(row.night)}
                    onChange={(event) => change(row.night, "price", event.target.value)}
                    onBlur={rowsField.handleBlur}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={row.night + "-units"}>Total units</Label>
                  <Input
                    id={row.night + "-units"}
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={row.units}
                    required={dirty.includes(row.night)}
                    onChange={(event) => change(row.night, "units", event.target.value)}
                    onBlur={rowsField.handleBlur}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={row.night + "-blocked"}>Blocked units</Label>
                  <Input
                    id={row.night + "-blocked"}
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={row.blocks}
                    required={dirty.includes(row.night)}
                    onChange={(event) => change(row.night, "blocks", event.target.value)}
                    onBlur={rowsField.handleBlur}
                  />
                </div>
                <dl className="col-span-2 grid grid-cols-2 gap-4 rounded-lg bg-secondary/50 px-3 py-2 sm:col-span-3 lg:col-span-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Reserved</dt>
                    <dd className="font-semibold">{row.reserved ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Available</dt>
                    <dd className="font-semibold">
                      {available === null
                        ? "—"
                        : available -
                          Number(row.blocks || 0) -
                          (row.reserved ?? 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            </fieldset>
          );
        })}
      </div>
      }</form.Field>
      {error && (
        <Alert variant="destructive"
          role="alert">
          <p>{error}</p>
          {conflict && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload latest week
            </Button>
          )}
          {needsSignIn && (
            <TextLink href="/sign-in">
              Sign in again
            </TextLink>
          )}
        </Alert>
      )}
      {saved && (
        <StatusMessage tone="success">
          Calendar saved.
        </StatusMessage>
      )}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium">
            {dirty.length} changed {dirty.length === 1 ? "night" : "nights"}
          </p>
          <p className="text-xs text-muted-foreground">
            {editable
              ? "Changes stay inside your private draft."
              : "This setup view is read-only outside private drafts."}
          </p>
        </div>
        {editable && !conflict && (
          <Button
            type="submit"
            formNoValidate
            disabled={!hydrated || pending || settling || (!dirty.length && !uncertain)}
          >
            {pending
              ? "Saving…"
              : uncertain
                ? "Retry same save"
                : "Save changed nights"}
          </Button>
        )}
      </div>
      {uncertain && (
        <p className="text-sm text-muted-foreground">
          Keep this week open until the save is confirmed.
        </p>
      )}
    </form>
  );
}
