"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { de, enGB } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Themed date picker for react-hook-form (shadcn Calendar in a Popover).
// Use this instead of <input type="date">: its calendar is drawn by the
// browser and ignores the theme. The value stays a "YYYY-MM-DD" string, so
// schemas and actions don't change. Weeks start on Monday.

/** "2026-10-13" -> a local Date (react-day-picker works in local days). */
function toDate(key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function FormDatePicker<T extends FieldValues>({
  control,
  name,
  id,
  min,
  placeholder,
  invalid,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  id: string;
  /** Earliest selectable day ("YYYY-MM-DD"). */
  min?: string;
  placeholder: string;
  invalid?: boolean;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const minDate = min ? toDate(min) : undefined;
  const label = (date: Date) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(date);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selected = typeof field.value === "string" ? toDate(field.value) : undefined;
        return (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  id={id}
                  ref={field.ref}
                  type="button"
                  variant="outline"
                  onBlur={field.onBlur}
                  aria-invalid={invalid || undefined}
                  className={cn("h-9 w-full justify-start font-normal", !selected && "text-muted-foreground")}
                />
              }
            >
              <CalendarDays aria-hidden />
              {selected ? label(selected) : placeholder}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selected}
                defaultMonth={selected ?? minDate}
                startMonth={minDate}
                onSelect={(date) => {
                  if (!date) return;
                  field.onChange(toKey(date));
                  setOpen(false);
                }}
                disabled={minDate ? { before: minDate } : undefined}
                weekStartsOn={1}
                locale={locale === "de" ? de : enGB}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        );
      }}
    />
  );
}
