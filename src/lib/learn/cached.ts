import "server-only";

import { cache } from "react";

import type { Level } from "@content/schema";
import { getDb } from "@/db/client";

import { loadPoints } from "./grammar";

/** A level's grammar points, loaded once per request however many parts of the page need them. */
export const pointsFor = cache((level: Level) => loadPoints(getDb(), level));
