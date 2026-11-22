import "server-only";

import { cache } from "react";

import { getDb } from "@/db/client";
import { studyDate } from "@/lib/day";

import { ensureDayPlan } from "./freeze";

/**
 * Today's plan, built on the day's first page load and read once per request after that. The
 * app layout calls it, so every page and both devices see the same list.
 */
export const todaysPlan = cache(async () => ensureDayPlan(getDb(), studyDate()));
