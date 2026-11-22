/** Polite HTTP for the link checker and the list scraper: one request at a time, a pause between. */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Page = { url: string; status: number; finalUrl: string; body: string };

/** Fetches a page, retrying a few times with a growing pause when the server errors (5xx) or drops. */
export async function getPage(url: string, { timeoutMs = 30_000, tries = 4 } = {}): Promise<Page> {
  let page = await getOnce(url, timeoutMs);
  for (let i = 1; i < tries && (page.status === 0 || page.status >= 500); i++) {
    await sleep(5000 * i);
    page = await getOnce(url, timeoutMs);
  }
  return page;
}

async function getOnce(url: string, timeoutMs: number): Promise<Page> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { url, status: res.status, finalUrl: res.url, body: await res.text() };
  } catch (e) {
    return { url, status: 0, finalUrl: url, body: String(e) };
  }
}

/** The page's <title>, with entities decoded enough to read. */
export function pageTitle(body: string): string {
  const m = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
