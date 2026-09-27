import "server-only";
import { revalidateTag } from "next/cache";
import * as repo from "./repository";
import type { CancellationInput, ExtraInput, SlotInput } from "./schema";
import { SCHEDULE_CACHE_TAG } from "./service";
import {
  addDays,
  dateKey,
  fromDbDate,
  isoWeekday,
  parseDateKey,
  toDbDate,
  viennaToday,
} from "./time";

// Admin reads (uncached) and writes. Callers check authorization first.

export type AdminSchedule = Awaited<ReturnType<typeof getScheduleForEdit>>;

export async function getScheduleForEdit() {
  const today = viennaToday();
  const [slots, exceptions, games] = await Promise.all([
    repo.findSlots(),
    repo.findExceptionsBetween(toDbDate(today), toDbDate(addDays(today, 120))),
    repo.findGameOptions(),
  ]);
  return {
    slots: slots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      gameId: s.gameId,
      gameName: s.game?.name ?? null,
      titleEn: s.titleEn,
      titleDe: s.titleDe,
      active: s.active,
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      kind: e.kind,
      date: dateKey(fromDbDate(e.date)),
      slotId: e.slotId,
      startTime: e.startTime,
      durationMinutes: e.durationMinutes,
      gameName: e.game?.name ?? null,
      titleEn: e.titleEn,
      titleDe: e.titleDe,
      noteEn: e.noteEn,
      noteDe: e.noteDe,
    })),
    games,
    today: dateKey(today),
  };
}

/** Well-formed input that doesn't make sense (shown to the editor). */
export class ScheduleRuleError extends Error {
  constructor(readonly code: "weekdayMismatch" | "unknownSlot" | "pastDate") {
    super(code);
  }
}

async function changed() {
  revalidateTag(SCHEDULE_CACHE_TAG, { expire: 0 });
  return getScheduleForEdit();
}

export async function saveSlot(id: string | null, input: SlotInput) {
  if (id) await repo.updateSlot(id, input);
  else await repo.createSlot(input);
  return changed();
}

export async function removeSlot(id: string) {
  await repo.deleteSlot(id);
  return changed();
}

export async function cancelOccurrence(input: CancellationInput) {
  if (input.date < dateKey(viennaToday())) throw new ScheduleRuleError("pastDate");
  const date = parseDateKey(input.date);
  const slot = (await repo.findSlots()).find((s) => s.id === input.slotId);
  if (!slot) throw new ScheduleRuleError("unknownSlot");
  // The date must be one on which this weekly slot actually happens.
  if (isoWeekday(date) !== slot.weekday) throw new ScheduleRuleError("weekdayMismatch");
  await repo.createCancellation({
    slotId: input.slotId,
    date: toDbDate(date),
    noteEn: input.noteEn,
    noteDe: input.noteDe,
  });
  return changed();
}

export async function addExtra(input: ExtraInput) {
  if (input.date < dateKey(viennaToday())) throw new ScheduleRuleError("pastDate");
  await repo.createExtra({ ...input, date: toDbDate(parseDateKey(input.date)) });
  return changed();
}

export async function removeException(id: string) {
  await repo.deleteException(id);
  return changed();
}
