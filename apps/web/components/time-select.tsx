import * as React from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

// Every half hour of the day as the "HH:MM" values the backend accepts.
const slots = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  return `${hours}:${index % 2 ? "30" : "00"}`;
});

// "14:00" → "2:00 PM". The value stays the 24-hour time.
const timeLabel = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
};

/**
 * A time of day from half-hour steps. A saved time between steps stays
 * selectable so editing never silently changes it.
 */
function TimeSelect({
  value,
  placeholder = "Choose a time",
  className,
  ...props
}: Omit<React.ComponentProps<typeof NativeSelect>, "children"> & {
  value: string;
  placeholder?: string;
}) {
  const options =
    value && !slots.includes(value) ? [...slots, value].sort() : slots;
  return (
    <NativeSelect value={value} className={cn("w-full", className)} {...props}>
      <NativeSelectOption value="" disabled>
        {placeholder}
      </NativeSelectOption>
      {options.map((time) => (
        <NativeSelectOption key={time} value={time}>
          {timeLabel(time)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export { TimeSelect };
