import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Ruby } from "./ruby";

const html = (props: Parameters<typeof Ruby>[0]) => renderToStaticMarkup(createElement(Ruby, props));

describe("<Ruby>", () => {
  it("renders furigana inside a lang=ja span", () => {
    expect(html({ text: "{食|た}べる" })).toBe('<span lang="ja"><ruby>食<rt>た</rt></ruby>べる</span>');
  });

  it("drops furigana when it's off", () => {
    expect(html({ text: "{今日|きょう}は{晴|は}れ", furigana: false })).toBe('<span lang="ja">今日は晴れ</span>');
  });

  it("fills or hides a blank", () => {
    const text = "{雨|あめ}が{降|ふ}っている[[から]]、{出|で}かけません。";
    expect(html({ text })).toContain('underline-offset-[6px]">から</span>');
    const hidden = html({ text, blank: "hide" });
    expect(hidden).not.toContain("から");
    expect(hidden).toContain("(blank)");
    expect(hidden).toContain("<ruby>出<rt>で</rt></ruby>かけません。");
  });
});
