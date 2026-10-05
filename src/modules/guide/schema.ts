import { z } from "zod";
import { TOUR_IDS } from "./tours";

export const tourIdSchema = z.enum(TOUR_IDS);
