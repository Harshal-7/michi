/**
 * The rules for a player's name and PIN on the public games (decision E and F): a name is 3–16
 * letters, digits, kana or kanji, unique ignoring case and full-width forms, and not on a short
 * blocklist; a PIN is 4 digits. Shared by the guest sheet and the server actions.
 */

export const NAME_MIN = 3;
export const NAME_MAX = 16;

/** Latin letters and digits, hiragana, katakana with ー, and kanji with 々. */
const NAME_CHARS = /^[A-Za-z0-9ぁ-ゖァ-ヺー々㐀-䶿一-鿿]+$/u;

/** Names that would pass for Michi itself or for Harshal. */
const RESERVED = new Set(["admin", "administrator", "michi", "harshal", "owner", "moderator", "mod", "guest", "anonymous", "system", "root", "support", "staff", "null", "undefined"]);

/** Anywhere in a name. Short on purpose: Harshal can hide any name from the boards. */
const BLOCKED_PARTS = ["fuck", "shit", "cunt", "bitch", "whore", "slut", "nigg", "fagg", "nazi", "hitler", "porn", "rape", "ちんこ", "まんこ", "死ね", "しね", "ころす", "殺す"];

/** The name as it's shown: full-width letters and half-width katakana made plain, ends trimmed. */
export const cleanName = (raw: string) => raw.normalize("NFKC").trim();

/** What makes two names the same: ミチ and ﾐﾁ, Aki and aki. */
export const nameKey = (name: string) => cleanName(name).toLowerCase();

/** Why a name can't be used, in plain words, or null when it can. Uniqueness is the database's job. */
export function nameProblem(raw: string): string | null {
  const name = cleanName(raw);
  const length = [...name].length;
  if (length < NAME_MIN || length > NAME_MAX) return `Use ${NAME_MIN} to ${NAME_MAX} letters, digits, kana or kanji.`;
  if (!NAME_CHARS.test(name)) return "Letters, digits, kana or kanji only, with no spaces or symbols.";
  const key = nameKey(name);
  if (RESERVED.has(key) || BLOCKED_PARTS.some((part) => key.includes(part))) return "That name isn't available. Try another.";
  return null;
}

/** A PIN as typed: full-width digits made plain, ends trimmed. */
export const cleanPin = (raw: string) => raw.normalize("NFKC").trim();

export const pinProblem = (raw: string): string | null => (/^\d{4}$/.test(cleanPin(raw)) ? null : "The PIN is 4 digits.");

/**
 * Close names to offer when one is taken: the name with a number after it (counting on from a
 * number it ends in), shortened to fit. Which are free is the database's job.
 */
export function suggestionsFor(raw: string): string[] {
  const name = cleanName(raw);
  const tail = /(\d+)$/.exec(name);
  const stem = tail ? name.slice(0, -tail[1].length) : name;
  const next = tail ? Number(tail[1]) + 1 : 1;
  const numbered = (n: number) => [...stem].slice(0, NAME_MAX - String(n).length).join("") + n;
  const all = [next, next + 1, 7, 22, 88, next + 10].map(numbered);
  return [...new Set(all)].filter((c) => nameKey(c) !== nameKey(name));
}
