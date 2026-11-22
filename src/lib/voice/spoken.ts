import { toPlain } from "@content/schema";

/** Japanese with ruby markup, said with its readings so the voice can't misread a kanji. */
export const spoken = (ja: string) => toPlain(ja.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, "$2"));
