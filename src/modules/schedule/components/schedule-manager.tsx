"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Pencil, Plus, RotateCcw, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/form/form-select";
import { cn } from "@/lib/utils";
import type { AdminSchedule } from "../admin-service";
import {
  cancelStreamAction,
  deleteCategoryAction,
  deleteOnceAction,
  deleteSlotAction,
  restoreStreamAction,
  saveCategoryAction,
  saveStreamAction,
  type ScheduleResult,
} from "../actions";
import {
  CATEGORY_COLORS,
  categoryInputSchema,
  streamInputSchema,
  type CategoryInput,
  type StreamFormValues,
} from "../schema";
import { CATEGORY_STYLES, CategoryChip } from "./category-chip";
import { GamePicker } from "./game-picker";

type Slot = AdminSchedule["slots"][number];
type Upcoming = AdminSchedule["upcoming"][number];
type Category = AdminSchedule["categories"][number];

function endTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || !Number.isFinite(minutes)) return "";
  const total = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type DialogState =
  | { type: "stream"; id: string | null; values: StreamFormValues }
  | { type: "cancel"; stream: Upcoming }
  | { type: "deleteSlot"; slot: Slot }
  | { type: "deleteOnce"; stream: Upcoming }
  | { type: "category"; category: Category | null }
  | { type: "deleteCategory"; category: Category }
  | null;

// The schedule editor: upcoming streams (cancel/restore/edit per stream),
// the weekly plan, and stream categories. State is seeded from the server
// and replaced by each action's returned schedule.
export function ScheduleManager({ initial }: { initial: AdminSchedule }) {
  const t = useTranslations("Admin.schedule");
  const format = useFormatter();
  const [schedule, setSchedule] = useState(initial);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();
  // This week by default: weekly streams repeating for 4 weeks crowded the
  // list (the user's feedback). One-time streams always show.
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  function apply(result: ScheduleResult, message = t("saved")) {
    if (result.ok) {
      setSchedule(result.schedule);
      toast.success(message);
      setDialog(null);
      return true;
    }
    toast.error(t(`errors.${result.error}`));
    return false;
  }
  const run = (action: () => Promise<ScheduleResult>, message?: string) =>
    startTransition(async () => {
      apply(await action(), message);
    });

  const newStream = (): StreamFormValues => ({
    repeat: "weekly",
    weekday: 1,
    active: true,
    startTime: "19:00",
    durationMinutes: 240,
    game: { kind: "none" },
    titleEn: "",
    titleDe: "",
    categoryIds: [],
  });
  const editSlot = (slot: Slot) =>
    setDialog({
      type: "stream",
      id: slot.id,
      values: {
        repeat: "weekly",
        weekday: slot.weekday,
        active: slot.active,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        game: slot.game,
        titleEn: slot.titleEn,
        titleDe: slot.titleDe,
        categoryIds: slot.categoryIds,
      },
    });
  const editUpcoming = (stream: Upcoming) => {
    if (stream.source.kind === "weekly") {
      const slot = schedule.slots.find((s) => s.id === (stream.source as { slotId: string }).slotId);
      if (slot) editSlot(slot);
      return;
    }
    const once = schedule.once[stream.source.exceptionId];
    if (once) setDialog({ type: "stream", id: once.id, values: { repeat: "once", ...once } });
  };

  const time = (iso: string) =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
  const dayLabel = (key: string) =>
    format.dateTime(new Date(`${key}T12:00:00Z`), { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const weekEnd = new Date(`${schedule.today}T12:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);
  const visible = showAllWeeks
    ? schedule.upcoming
    : schedule.upcoming.filter((stream) => stream.extra || stream.date < weekEndKey);
  const hiddenCount = schedule.upcoming.length - visible.length;
  const days = groupByDate(visible);

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="upcoming-heading" className="text-lg font-bold">
              {t("upcomingHeading")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("upcomingHint")}</p>
          </div>
          <Button type="button" data-tour="add-stream" onClick={() => setDialog({ type: "stream", id: null, values: newStream() })}>
            <Plus aria-hidden />
            {t("addStream")}
          </Button>
        </div>
        {days.length === 0 ? (
          <p className="rounded-xl border bg-background p-4">{t("noUpcoming")}</p>
        ) : (
          <ol className="flex flex-col gap-5">
            {days.map(([date, streams]) => (
              <li key={date} className="flex flex-col gap-2">
                <h3 className="font-semibold">{dayLabel(date)}</h3>
                <ul className="divide-y rounded-xl border bg-background">
                  {streams.map((stream) => (
                    <li key={stream.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", stream.cancelled && "text-muted-foreground")}>
                        <p className={cn("font-semibold", stream.cancelled && "line-through")}>
                          <span className="tabular-nums">
                            {time(stream.start)}–{time(stream.end)}
                          </span>{" "}
                          {stream.gameName ?? t("noGame")}
                          {stream.title && ` – ${stream.title}`}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border px-2 py-0.5 text-xs">
                            {stream.extra ? t("kindOnce") : t("kindWeekly")}
                          </span>
                          {stream.cancelled && (
                            <span className="rounded-md border border-destructive/40 px-2 py-0.5 text-xs font-semibold text-destructive">
                              {t("cancelledBadge")}
                            </span>
                          )}
                          {stream.categories.map((c) => (
                            <CategoryChip key={c.id} name={c.name} color={c.color} />
                          ))}
                        </div>
                        {stream.note && <p className="text-sm text-muted-foreground">{stream.note}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2" data-tour="stream-actions">
                        <Button type="button" variant="outline" size="sm" onClick={() => editUpcoming(stream)}>
                          <Pencil aria-hidden />
                          {t("edit")}
                        </Button>
                        {stream.cancelled ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () =>
                                  restoreStreamAction(
                                    stream.source.kind === "weekly"
                                      ? { target: "weekly", slotId: stream.source.slotId, date: stream.date }
                                      : { target: "once", exceptionId: stream.source.exceptionId },
                                  ),
                                t("restored"),
                              )
                            }
                          >
                            <RotateCcw aria-hidden />
                            {t("restore")}
                          </Button>
                        ) : (
                          <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: "cancel", stream })}>
                            <Ban aria-hidden />
                            {t("cancelStream")}
                          </Button>
                        )}
                        {stream.extra && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: "deleteOnce", stream })}>
                            <Trash2 aria-hidden />
                            {t("delete")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
        {(hiddenCount > 0 || showAllWeeks) && (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllWeeks((v) => !v)}>
              {showAllWeeks ? t("showThisWeek") : t("showMoreWeeks")}
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="weekly-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="weekly-heading" className="text-lg font-bold">
            {t("weeklyHeading")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("weeklyHint")}</p>
        </div>
        {schedule.slots.length === 0 ? (
          <p className="rounded-xl border bg-background p-4">{t("noSlots")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {schedule.slots.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className={cn("flex min-w-0 flex-1 flex-col gap-1", !slot.active && "text-muted-foreground")}>
                  <p className="font-semibold">
                    {t(`weekdays.${slot.weekday}` as "weekdays.1")}{" "}
                    <span className="tabular-nums">
                      {slot.startTime}–{endTime(slot.startTime, slot.durationMinutes)}
                    </span>{" "}
                    {slot.gameName ?? t("noGame")}
                    {(slot.titleEn || slot.titleDe) && ` – ${slot.titleEn || slot.titleDe}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {!slot.active && <span className="rounded-md border px-2 py-0.5 text-xs">{t("inactive")}</span>}
                    {schedule.categories
                      .filter((c) => slot.categoryIds.includes(c.id))
                      .map((c) => (
                        <CategoryChip key={c.id} name={c.nameEn} color={c.color} />
                      ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => editSlot(slot)}>
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

      <section aria-labelledby="categories-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="categories-heading" className="text-lg font-bold">
              {t("categoriesHeading")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("categoriesHint")}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setDialog({ type: "category", category: null })}>
            <Tag aria-hidden />
            {t("addCategory")}
          </Button>
        </div>
        {schedule.categories.length === 0 ? (
          <p className="rounded-xl border bg-background p-4">{t("noCategories")}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {schedule.categories.map((category) => (
              <li key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <CategoryChip name={category.nameEn} color={category.color} />
                  <span className="text-sm text-muted-foreground">{category.nameDe}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: "category", category })}>
                    <Pencil aria-hidden />
                    {t("edit")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: "deleteCategory", category })}>
                    <Trash2 aria-hidden />
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {dialog?.type === "stream" && (
            <StreamForm
              id={dialog.id}
              initial={dialog.values}
              schedule={schedule}
              onDone={(result) => apply(result)}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.type === "cancel" && (
            <CancelForm
              stream={dialog.stream}
              label={`${dayLabel(dialog.stream.date)}, ${time(dialog.stream.start)} ${dialog.stream.gameName ?? ""}`}
              onDone={(result) => apply(result, t("cancelledToast"))}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.type === "category" && (
            <CategoryForm category={dialog.category} onDone={(result) => apply(result)} onCancel={() => setDialog(null)} />
          )}
          {dialog?.type === "deleteSlot" && (
            <Confirm
              title={t("confirmDeleteSlotTitle", {
                day: t(`weekdays.${dialog.slot.weekday}` as "weekdays.1"),
                time: dialog.slot.startTime,
              })}
              text={t("confirmDeleteSlot")}
              pending={isPending}
              onConfirm={() => run(() => deleteSlotAction(dialog.slot.id), t("deleted"))}
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.type === "deleteOnce" && dialog.stream.source.kind === "once" && (
            <Confirm
              title={`${dayLabel(dialog.stream.date)}, ${time(dialog.stream.start)}`}
              text={t("confirmDeleteOnce")}
              pending={isPending}
              onConfirm={() =>
                run(() => deleteOnceAction((dialog.stream.source as { exceptionId: string }).exceptionId), t("deleted"))
              }
              onCancel={() => setDialog(null)}
            />
          )}
          {dialog?.type === "deleteCategory" && (
            <Confirm
              title={t("confirmDeleteCategoryTitle", { name: dialog.category.nameEn })}
              text={t("confirmDeleteCategory")}
              pending={isPending}
              onConfirm={() => run(() => deleteCategoryAction(dialog.category.id), t("deleted"))}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function groupByDate(streams: Upcoming[]) {
  const groups = new Map<string, Upcoming[]>();
  for (const stream of streams) groups.set(stream.date, [...(groups.get(stream.date) ?? []), stream]);
  return [...groups.entries()];
}

function useErrorText() {
  const t = useTranslations("Admin.schedule");
  return (code: string | undefined) =>
    code && ["required", "tooLong", "invalidTime", "invalidDuration", "invalidDate"].includes(code)
      ? [{ message: t(`errors.${code}` as "errors.required") }]
      : undefined;
}

function FormShell({
  title,
  onSubmit,
  onCancel,
  pending,
  submitLabel,
  children,
}: {
  title: string;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel?: string;
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
          {pending ? t("saving") : (submitLabel ?? t("save"))}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Confirm({
  title,
  text,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <p>{text}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
          {t("delete")}
        </Button>
      </DialogFooter>
    </>
  );
}

function StreamForm({
  id,
  initial,
  schedule,
  onDone,
  onCancel,
}: {
  id: string | null;
  initial: StreamFormValues;
  schedule: AdminSchedule;
  onDone: (result: ScheduleResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const form = useForm<StreamFormValues>({ resolver: zodResolver(streamInputSchema), defaultValues: initial });
  const errors = form.formState.errors as Partial<Record<string, { message?: string }>>;
  const [repeat, start, minutes] = useWatch({ control: form.control, name: ["repeat", "startTime", "durationMinutes"] });
  const isNew = id === null;

  return (
    <FormShell
      title={isNew ? t("dialogStreamAdd") : repeat === "weekly" ? t("dialogWeeklyEdit") : t("dialogOnceEdit")}
      pending={pending}
      onCancel={onCancel}
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => onDone(await saveStreamAction(id, values))),
      )}
    >
      {isNew && (
        <Controller
          control={form.control}
          name="repeat"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t("repeat")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["weekly", "once"] as const).map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      field.value === option && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="radio"
                        name="repeat"
                        value={option}
                        checked={field.value === option}
                        onChange={() => {
                          const base = form.getValues();
                          form.reset(
                            option === "weekly"
                              ? {
                                  ...base,
                                  repeat: "weekly",
                                  weekday: "weekday" in base ? base.weekday : 1,
                                  active: "active" in base ? base.active : true,
                                }
                              : { ...base, repeat: "once", date: schedule.today, noteEn: "", noteDe: "" },
                          );
                        }}
                        className="accent-primary"
                      />
                      {t(option === "weekly" ? "repeatWeekly" : "repeatOnce")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(option === "weekly" ? "repeatWeeklyHint" : "repeatOnceHint")}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {repeat === "weekly" ? (
          <Field>
            <FieldLabel htmlFor="weekday">{t("weekday")}</FieldLabel>
            <FormSelect
              control={form.control}
              name="weekday"
              id="weekday"
              options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: t(`weekdays.${day}` as "weekdays.1") }))}
            />
          </Field>
        ) : (
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">{t("date")}</FieldLabel>
            <Input id="date" type="date" min={schedule.today} {...form.register("date")} />
            <FieldError errors={errorText(errors.date?.message)} />
          </Field>
        )}
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

      <Field>
        <FieldLabel htmlFor="game">{t("game")}</FieldLabel>
        <Controller
          control={form.control}
          name="game"
          render={({ field }) => (
            <GamePicker
              id="game"
              value={field.value}
              onChange={field.onChange}
              games={schedule.games}
              twitchSearch={schedule.twitchSearch}
            />
          )}
        />
      </Field>

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

      <Controller
        control={form.control}
        name="categoryIds"
        render={({ field }) => {
          const selected = new Set(field.value ?? []);
          return (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t("categories")}</legend>
              {schedule.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noCategoriesYet")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {schedule.categories.map((category) => {
                    const on = selected.has(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          field.onChange(on ? [...selected].filter((x) => x !== category.id) : [...selected, category.id])
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-sm font-semibold transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          CATEGORY_STYLES[category.color],
                          !on && "opacity-45 hover:opacity-80",
                        )}
                      >
                        {category.nameEn}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        }}
      />

      {repeat === "weekly" ? (
        <>
          <Field orientation="horizontal">
            <input id="active" type="checkbox" className="size-4 accent-primary" {...form.register("active")} />
            <FieldLabel htmlFor="active">{t("active")}</FieldLabel>
          </Field>
          <FieldDescription>{t("activeHint")}</FieldDescription>
        </>
      ) : (
        <NoteFields register={form.register as never} errors={errors} />
      )}
    </FormShell>
  );
}

function CancelForm({
  stream,
  label,
  onDone,
  onCancel,
}: {
  stream: Upcoming;
  label: string;
  onDone: (result: ScheduleResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const [pending, startTransition] = useTransition();
  const form = useForm({ defaultValues: { noteEn: "", noteDe: "" } });

  return (
    <FormShell
      title={t("dialogCancel", { stream: label })}
      pending={pending}
      submitLabel={t("cancelConfirm")}
      onCancel={onCancel}
      onSubmit={form.handleSubmit((note) =>
        startTransition(async () =>
          onDone(
            await cancelStreamAction(
              stream.source.kind === "weekly"
                ? { target: "weekly", slotId: stream.source.slotId, date: stream.date, ...note }
                : { target: "once", exceptionId: stream.source.exceptionId, ...note },
            ),
          ),
        ),
      )}
    >
      <p className="text-sm text-muted-foreground">{t("cancelExplain")}</p>
      <NoteFields register={form.register as never} errors={{}} />
    </FormShell>
  );
}

function CategoryForm({
  category,
  onDone,
  onCancel,
}: {
  category: Category | null;
  onDone: (result: ScheduleResult) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: category ?? { nameEn: "", nameDe: "", color: "green" },
  });
  const { errors } = form.formState;
  const [nameEn, color] = useWatch({ control: form.control, name: ["nameEn", "color"] });

  return (
    <FormShell
      title={category ? t("dialogCategoryEdit") : t("dialogCategoryAdd")}
      pending={pending}
      onCancel={onCancel}
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => onDone(await saveCategoryAction(category?.id ?? null, values))),
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.nameEn}>
          <FieldLabel htmlFor="nameEn">{t("categoryNameEn")}</FieldLabel>
          <Input id="nameEn" lang="en" maxLength={40} {...form.register("nameEn")} />
          <FieldError errors={errorText(errors.nameEn?.message)} />
        </Field>
        <Field data-invalid={!!errors.nameDe}>
          <FieldLabel htmlFor="nameDe">{t("categoryNameDe")}</FieldLabel>
          <Input id="nameDe" lang="de" maxLength={40} {...form.register("nameDe")} />
          <FieldError errors={errorText(errors.nameDe?.message)} />
        </Field>
      </div>
      <Controller
        control={form.control}
        name="color"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("categoryColor")}</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "cursor-pointer rounded-md border px-2.5 py-1 text-sm font-semibold has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    CATEGORY_STYLES[option],
                    field.value !== option && "opacity-45 hover:opacity-80",
                  )}
                >
                  <input
                    type="radio"
                    name="color"
                    value={option}
                    checked={field.value === option}
                    onChange={() => field.onChange(option)}
                    className="sr-only"
                  />
                  {t(`colors.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {t("categoryPreview")} <CategoryChip name={nameEn || "Dixper"} color={color} />
      </p>
    </FormShell>
  );
}

function NoteFields({
  register,
  errors,
}: {
  // Shared by the cancel and one-time stream forms (both have noteEn/noteDe).
  register: (name: "noteEn" | "noteDe") => object;
  errors: Partial<Record<string, { message?: string }>>;
}) {
  const t = useTranslations("Admin.schedule");
  const errorText = useErrorText();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.noteEn}>
          <FieldLabel htmlFor="noteEn">{t("noteEn")}</FieldLabel>
          <Input id="noteEn" lang="en" maxLength={200} {...register("noteEn")} />
          <FieldError errors={errorText(errors.noteEn?.message)} />
        </Field>
        <Field data-invalid={!!errors.noteDe}>
          <FieldLabel htmlFor="noteDe">{t("noteDe")}</FieldLabel>
          <Input id="noteDe" lang="de" maxLength={200} {...register("noteDe")} />
          <FieldError errors={errorText(errors.noteDe?.message)} />
        </Field>
      </div>
      <FieldDescription>{t("noteHint")}</FieldDescription>
    </>
  );
}
