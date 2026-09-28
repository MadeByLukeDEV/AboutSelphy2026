"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form/form-select";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { AdminSchedule } from "../admin-service";
import {
  addExtraAction,
  cancelOccurrenceAction,
  deleteExceptionAction,
  deleteSlotAction,
  saveSlotAction,
  type ScheduleResult,
} from "../actions";
import {
  cancellationInputSchema,
  extraInputSchema,
  slotInputSchema,
  type ExtraFormValues,
  type SlotFormValues,
} from "../schema";

type Slot = AdminSchedule["slots"][number];
type Games = AdminSchedule["games"];

function endTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || !Number.isFinite(minutes)) return "";
  const total = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** ISO weekday (1 = Monday) of a "YYYY-MM-DD" key. */
function weekdayOf(key: string) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Weekly plan + upcoming changes. State is seeded from the server and
// replaced by each action's returned schedule.
export function ScheduleManager({ initial }: { initial: AdminSchedule }) {
  const t = useTranslations("Admin.schedule");
  const format = useFormatter();
  const [schedule, setSchedule] = useState(initial);
  const [dialog, setDialog] = useState<
    | { type: "slot"; slot: Slot | null }
    | { type: "cancel" }
    | { type: "extra" }
    | { type: "deleteSlot"; slot: Slot }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function apply(result: ScheduleResult) {
    if (result.ok) {
      setSchedule(result.schedule);
      toast.success(t("saved"));
      setDialog(null);
    } else {
      toast.error(t(`errors.${result.error}`));
    }
  }

  const slotLabel = (slot: Slot) =>
    [
      t(`weekdays.${slot.weekday}` as "weekdays.1"),
      `${slot.startTime}–${endTime(slot.startTime, slot.durationMinutes)}`,
      slot.gameName ?? t("noGame"),
    ].join(" ");
  const dateLabel = (key: string) =>
    format.dateTime(new Date(`${key}T12:00:00Z`), {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const slotsById = new Map(schedule.slots.map((slot) => [slot.id, slot]));

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="weekly-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="weekly-heading" className="text-lg font-bold">
            {t("weeklyHeading")}
          </h2>
          <Button type="button" onClick={() => setDialog({ type: "slot", slot: null })}>
            <Plus aria-hidden />
            {t("addSlot")}
          </Button>
        </div>
        {schedule.slots.length === 0 ? (
          <p className="rounded-xl border bg-background p-4">{t("noSlots")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {schedule.slots.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className={cn("flex min-w-0 flex-1 flex-col", !slot.active && "text-muted-foreground")}>
                  <p className="font-semibold">
                    {t(`weekdays.${slot.weekday}` as "weekdays.1")}{" "}
                    <span className="tabular-nums">
                      {slot.startTime}–{endTime(slot.startTime, slot.durationMinutes)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {slot.gameName ?? t("noGame")}
                    {(slot.titleEn || slot.titleDe) && ` – ${slot.titleEn || slot.titleDe}`}
                  </p>
                </div>
                {!slot.active && (
                  <span className="rounded-md border px-2 py-0.5 text-xs">{t("inactive")}</span>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: "slot", slot })}>
                    <Pencil aria-hidden />
                    {t("edit")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: "deleteSlot", slot })}>
                    <Trash2 aria-hidden />
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="changes-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="changes-heading" className="text-lg font-bold">
            {t("changesHeading")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={schedule.slots.length === 0}
              onClick={() => setDialog({ type: "cancel" })}
            >
              <Ban aria-hidden />
              {t("cancelStream")}
            </Button>
            <Button type="button" onClick={() => setDialog({ type: "extra" })}>
              <CalendarPlus aria-hidden />
              {t("addExtra")}
            </Button>
          </div>
        </div>
        {schedule.exceptions.length === 0 ? (
          <p className="rounded-xl border bg-background p-4">{t("noChanges")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {schedule.exceptions.map((exception) => {
              const slot = exception.slotId ? slotsById.get(exception.slotId) : undefined;
              const stream =
                exception.kind === "cancelled"
                  ? slot
                    ? slotLabel(slot)
                    : ""
                  : `${exception.startTime}–${endTime(exception.startTime ?? "", exception.durationMinutes ?? 0)} ${exception.gameName ?? t("noGame")}${exception.titleEn || exception.titleDe ? ` – ${exception.titleEn || exception.titleDe}` : ""}`;
              return (
                <li key={exception.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="font-semibold">{dateLabel(exception.date)}</p>
                    <p className={cn("text-sm", exception.kind === "cancelled" ? "text-destructive" : "text-brand-text")}>
                      {exception.kind === "cancelled"
                        ? t("cancelledLabel", { stream })
                        : t("extraLabel", { stream })}
                    </p>
                    {(exception.noteEn || exception.noteDe) && (
                      <p className="text-sm text-muted-foreground">{exception.noteEn || exception.noteDe}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => apply(await deleteExceptionAction(exception.id)))
                    }
                  >
                    <Trash2 aria-hidden />
                    {t("delete")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {dialog?.type === "slot" && (
            <SlotForm slot={dialog.slot} games={schedule.games} onDone={apply} onCancel={() => setDialog(null)} />
          )}
          {dialog?.type === "cancel" && (
            <CancelForm
              schedule={schedule}
              slotLabel={slotLabel}
              onDone={apply}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.type === "extra" && (
            <ExtraForm today={schedule.today} games={schedule.games} onDone={apply} onCancel={() => setDialog(null)} />
          )}
          {dialog?.type === "deleteSlot" && (
            <>
              <DialogHeader>
                <DialogTitle>{slotLabel(dialog.slot)}</DialogTitle>
              </DialogHeader>
              <p>{t("confirmDeleteSlot")}</p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => apply(await deleteSlotAction(dialog.slot.id)))
                  }
                >
                  {t("delete")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useErrorText() {
  const t = useTranslations("Admin.schedule");
  return (code: string | undefined) =>
    code &&
    ["required", "tooLong", "invalidTime", "invalidDuration", "invalidDate"].includes(code)
      ? [{ message: t(`errors.${code}` as "errors.required") }]
      : undefined;
}

function FormShell({
  title,
  onSubmit,
  onCancel,
  pending,
  children,
}: {
  title: string;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Admin.schedule");
  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <FieldGroup>{children}</FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GameSelect<T extends FieldValues>({
  id,
  games,
  control,
  name,
}: {
  id: string;
  games: Games;
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const t = useTranslations("Admin.schedule");
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("game")}</FieldLabel>
      <FormSelect
        control={control}
        name={name}
        id={id}
        options={[
          { value: "", label: t("noGame") },
          ...games.map((game) => ({ value: game.id, label: game.name })),
        ]}
      />
    </Field>
  );
}

function SlotForm({
  slot,
  games,
  onDone,
  onCancel,
}: {
  slot: Slot | null;
  games: Games;
  onDone: (result: ScheduleResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotInputSchema),
    defaultValues: slot
      ? { ...slot, gameId: slot.gameId ?? "" }
      : { weekday: 1, startTime: "19:00", durationMinutes: 240, gameId: games[0]?.id ?? "", titleEn: "", titleDe: "", active: true },
  });
  const { errors } = form.formState;
  const [start, minutes] = useWatch({ control: form.control, name: ["startTime", "durationMinutes"] });

  return (
    <FormShell
      title={slot ? t("dialogSlotEdit") : t("dialogSlotAdd")}
      pending={pending}
      onCancel={onCancel}
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => onDone(await saveSlotAction(slot?.id ?? null, values))),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="weekday">{t("weekday")}</FieldLabel>
          <FormSelect
            control={form.control}
            name="weekday"
            id="weekday"
            options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({
              value: String(day),
              label: t(`weekdays.${day}` as "weekdays.1"),
            }))}
          />
        </Field>
        <Field data-invalid={!!errors.startTime}>
          <FieldLabel htmlFor="startTime">{t("startTime")}</FieldLabel>
          <Input id="startTime" type="time" step={900} {...form.register("startTime")} />
          <FieldError errors={errorText(errors.startTime?.message)} />
        </Field>
        <Field data-invalid={!!errors.durationMinutes}>
          <FieldLabel htmlFor="durationMinutes">{t("duration")}</FieldLabel>
          <Input id="durationMinutes" type="number" min={15} max={1440} step={15} {...form.register("durationMinutes")} />
          <FieldDescription>{t("endsAt", { time: endTime(String(start), Number(minutes)) })}</FieldDescription>
          <FieldError errors={errorText(errors.durationMinutes?.message)} />
        </Field>
      </div>
      <GameSelect id="gameId" games={games} control={form.control} name="gameId" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.titleEn}>
          <FieldLabel htmlFor="titleEn">{t("titleEn")}</FieldLabel>
          <Input id="titleEn" lang="en" {...form.register("titleEn")} />
          <FieldError errors={errorText(errors.titleEn?.message)} />
        </Field>
        <Field data-invalid={!!errors.titleDe}>
          <FieldLabel htmlFor="titleDe">{t("titleDe")}</FieldLabel>
          <Input id="titleDe" lang="de" {...form.register("titleDe")} />
          <FieldError errors={errorText(errors.titleDe?.message)} />
        </Field>
      </div>
      <FieldDescription>{t("titleHint")}</FieldDescription>
      <Field orientation="horizontal">
        <input id="active" type="checkbox" className="size-4 accent-primary" {...form.register("active")} />
        <FieldLabel htmlFor="active">{t("active")}</FieldLabel>
      </Field>
      <FieldDescription>{t("activeHint")}</FieldDescription>
    </FormShell>
  );
}

function CancelForm({
  schedule,
  slotLabel,
  onDone,
  onCancel,
}: {
  schedule: AdminSchedule;
  slotLabel: (slot: Slot) => string;
  onDone: (result: ScheduleResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(cancellationInputSchema),
    defaultValues: { slotId: "", date: "", noteEn: "", noteDe: "" },
  });
  const date = useWatch({ control: form.control, name: "date" });
  const options = date
    ? schedule.slots.filter((slot) => slot.active && slot.weekday === weekdayOf(date))
    : [];
  const { errors } = form.formState;

  return (
    <FormShell
      title={t("dialogCancel")}
      pending={pending}
      onCancel={onCancel}
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => onDone(await cancelOccurrenceAction(values))),
      )}
    >
      <Field data-invalid={!!errors.date}>
        <FieldLabel htmlFor="cancel-date">{t("date")}</FieldLabel>
        <Input
          id="cancel-date"
          type="date"
          min={schedule.today}
          {...form.register("date", {
            onChange: () => form.setValue("slotId", ""),
          })}
        />
        <FieldError errors={errorText(errors.date?.message)} />
      </Field>
      <Field data-invalid={!!errors.slotId}>
        <FieldLabel htmlFor="cancel-slot">{t("slot")}</FieldLabel>
        <FormSelect
          control={form.control}
          name="slotId"
          id="cancel-slot"
          disabled={options.length === 0}
          invalid={!!errors.slotId}
          placeholder={!date ? t("pickDate") : options.length === 0 ? t("noSlotOnDate") : "–"}
          options={options.map((slot) => ({ value: slot.id, label: slotLabel(slot) }))}
        />
        {errors.slotId && <FieldError>{t("errors.required")}</FieldError>}
      </Field>
      <NoteFields register={form.register} errors={errors} />
    </FormShell>
  );
}

function ExtraForm({
  today,
  games,
  onDone,
  onCancel,
}: {
  today: string;
  games: Games;
  onDone: (result: ScheduleResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const form = useForm<ExtraFormValues>({
    resolver: zodResolver(extraInputSchema),
    defaultValues: {
      date: today,
      startTime: "19:00",
      durationMinutes: 180,
      gameId: games[0]?.id ?? "",
      titleEn: "",
      titleDe: "",
      noteEn: "",
      noteDe: "",
    },
  });
  const { errors } = form.formState;
  const [start, minutes] = useWatch({ control: form.control, name: ["startTime", "durationMinutes"] });

  return (
    <FormShell
      title={t("dialogExtra")}
      pending={pending}
      onCancel={onCancel}
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => onDone(await addExtraAction(values))),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor="extra-date">{t("date")}</FieldLabel>
          <Input id="extra-date" type="date" min={today} {...form.register("date")} />
          <FieldError errors={errorText(errors.date?.message)} />
        </Field>
        <Field data-invalid={!!errors.startTime}>
          <FieldLabel htmlFor="extra-start">{t("startTime")}</FieldLabel>
          <Input id="extra-start" type="time" step={900} {...form.register("startTime")} />
          <FieldError errors={errorText(errors.startTime?.message)} />
        </Field>
        <Field data-invalid={!!errors.durationMinutes}>
          <FieldLabel htmlFor="extra-duration">{t("duration")}</FieldLabel>
          <Input id="extra-duration" type="number" min={15} max={1440} step={15} {...form.register("durationMinutes")} />
          <FieldDescription>{t("endsAt", { time: endTime(String(start), Number(minutes)) })}</FieldDescription>
          <FieldError errors={errorText(errors.durationMinutes?.message)} />
        </Field>
      </div>
      <GameSelect id="extra-game" games={games} control={form.control} name="gameId" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="extra-titleEn">{t("titleEn")}</FieldLabel>
          <Input id="extra-titleEn" lang="en" {...form.register("titleEn")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="extra-titleDe">{t("titleDe")}</FieldLabel>
          <Input id="extra-titleDe" lang="de" {...form.register("titleDe")} />
        </Field>
      </div>
      <FieldDescription>{t("titleHint")}</FieldDescription>
      <NoteFields register={form.register} errors={errors} />
    </FormShell>
  );
}

function NoteFields({
  register,
  errors,
}: {
  // Shared by the cancel and extra forms (both have noteEn/noteDe).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: (name: "noteEn" | "noteDe") => any;
  errors: { noteEn?: { message?: string }; noteDe?: { message?: string } };
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.noteEn}>
          <FieldLabel htmlFor="noteEn">{t("noteEn")}</FieldLabel>
          <Input id="noteEn" lang="en" {...register("noteEn")} />
          <FieldError errors={errorText(errors.noteEn?.message)} />
        </Field>
        <Field data-invalid={!!errors.noteDe}>
          <FieldLabel htmlFor="noteDe">{t("noteDe")}</FieldLabel>
          <Input id="noteDe" lang="de" {...register("noteDe")} />
          <FieldError errors={errorText(errors.noteDe?.message)} />
        </Field>
      </div>
      <FieldDescription>{t("noteHint")}</FieldDescription>
    </>
  );
}
