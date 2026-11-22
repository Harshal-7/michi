/**
 * What the browser's outbox sends to /api/reviews, and what comes back. Shared by both sides.
 *
 * Every op carries an id made on the device, so a retried op is saved once. A grade also carries
 * the review the device last saw for that card (`lastReviewId`): the server saves it only if
 * that's still the card's last review, so a stale tab can't scramble a card graded elsewhere.
 */
import { z } from "zod";

export const MAX_OPS_PER_REQUEST = 20;

const instant = z.iso.datetime({ offset: true });

/** A grade from a review session. */
export const GradeOp = z.object({
  kind: z.literal("grade"),
  id: z.uuid(),
  cardId: z.int().positive(),
  rating: z.int().min(1).max(4),
  reviewedAt: instant,
  /** How long the card was on screen. */
  durationMs: z.int().min(0).max(3_600_000).nullable(),
  /** The card's last review as this device saw it; null for a card never graded. */
  lastReviewId: z.uuid().nullable(),
});
export type GradeOp = z.infer<typeof GradeOp>;

/** Undoes a grade, while it's still that card's last review. */
export const UndoOp = z.object({
  kind: z.literal("undo"),
  id: z.uuid(),
  reviewId: z.uuid(),
});
export type UndoOp = z.infer<typeof UndoOp>;

/** A quick check verdict (decision 6). */
export const CheckOp = z.object({
  kind: z.literal("check"),
  id: z.uuid(),
  itemId: z.int().positive(),
  verdict: z.enum(["known", "unsure", "unknown"]),
  /** The multiple-choice spot check's result; null when it wasn't asked. */
  verified: z.boolean().nullable(),
  checkedAt: instant,
});
export type CheckOp = z.infer<typeof CheckOp>;

export const Op = z.discriminatedUnion("kind", [GradeOp, UndoOp, CheckOp]);
export type Op = z.infer<typeof Op>;

export const OpsRequest = z.object({ ops: z.array(z.unknown()).min(1).max(MAX_OPS_PER_REQUEST) });

/**
 * - saved: done.
 * - duplicate: already done earlier (a retry).
 * - stale: dropped, because the card was reviewed elsewhere since this device loaded it.
 * - missing: the card, item or review isn't there any more.
 * - invalid: the op didn't check out.
 * Every status is final: the outbox drops the op either way.
 */
export const OP_STATUSES = ["saved", "duplicate", "stale", "missing", "invalid"] as const;
export type OpStatus = (typeof OP_STATUSES)[number];
export type OpResult = { id: string; status: OpStatus };

export type OpsResponse = { results: OpResult[]; version: string };
