import "server-only";
import * as repo from "./repository";
import { TOUR_IDS, type TourId } from "./tours";

/** The tours this staff member already finished or skipped. */
export async function getSeenTours(userId: string): Promise<TourId[]> {
  const seen = await repo.findSeenTours(userId);
  return TOUR_IDS.filter((id) => seen.includes(id));
}

export const markTourSeen = repo.markSeen;

/** "Show all tours again": every tour starts by itself once more. */
export const resetTours = repo.clearSeen;
